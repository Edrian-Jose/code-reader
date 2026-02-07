import { MongoClient, type Db } from 'mongodb';
import { getConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';

let client: MongoClient | null = null;
let db: Db | null = null;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function connectToDatabase(): Promise<Db> {
  if (db) {
    return db;
  }

  const config = getConfig();

  // Determine connection strategy
  const uris: Array<{ uri: string; label: string }> = [];

  // Priority 1: Legacy single URI (if set, use it exclusively)
  if (config.mongodb.uri && config.mongodb.uri !== 'mongodb://localhost:27017') {
    uris.push({ uri: config.mongodb.uri, label: 'configured URI' });
  }
  // Priority 2: Atlas Local (primary) + Standard MongoDB (fallback)
  else {
    if (config.mongodb.atlasUri) {
      uris.push({ uri: config.mongodb.atlasUri, label: 'Atlas Local (Docker)' });
    }
    if (config.mongodb.localUri) {
      uris.push({ uri: config.mongodb.localUri, label: 'Local MongoDB' });
    }
    // Default if neither configured
    if (uris.length === 0) {
      uris.push({ uri: 'mongodb://localhost:27017', label: 'default local' });
    }
  }

  // Try each URI in order
  for (const { uri, label } of uris) {
    logger.info(`Attempting connection to ${label}: ${uri}`);

    try {
      const testClient = new MongoClient(uri, {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
      });

      await testClient.connect();
      const testDb = testClient.db(config.mongodb.database);

      // Verify connection
      await testDb.command({ ping: 1 });

      // Success! Use this connection
      client = testClient;
      db = testDb;

      logger.info(`✓ Connected to MongoDB (${label}): ${uri}`);
      return db;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`✗ Connection to ${label} failed: ${errorMessage}`);

      // Try next URI if available
      if (uris.indexOf({ uri, label }) < uris.length - 1) {
        logger.info(`Trying fallback connection...`);
      }
    }
  }

  // All connection attempts failed
  throw new Error(`Failed to connect to MongoDB. Tried: ${uris.map((u) => u.label).join(', ')}`);
}

export function getDatabase(): Db {
  if (!db) {
    throw new Error('Database not connected. Call connectToDatabase() first.');
  }
  return db;
}

export function getClient(): MongoClient {
  if (!client) {
    throw new Error('Database not connected. Call connectToDatabase() first.');
  }
  return client;
}

export async function disconnectFromDatabase(): Promise<void> {
  if (client) {
    logger.info('Disconnecting from MongoDB...');
    await client.close();
    client = null;
    db = null;
    logger.info('Disconnected from MongoDB');
  }
}

export async function isConnected(): Promise<boolean> {
  if (!db) {
    return false;
  }

  try {
    await db.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}
