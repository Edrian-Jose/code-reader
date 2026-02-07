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
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      logger.info(`Connecting to MongoDB (attempt ${attempt}/${MAX_RETRIES})...`);

      client = new MongoClient(config.mongodb.uri, {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
      });

      await client.connect();
      db = client.db(config.mongodb.database);

      // Verify connection
      await db.command({ ping: 1 });

      logger.info(`Connected to MongoDB at ${config.mongodb.uri}`);
      return db;
    } catch (error) {
      lastError = error as Error;
      logger.warn(`MongoDB connection attempt ${attempt} failed: ${lastError.message}`);

      if (client) {
        try {
          await client.close();
        } catch {
          // Ignore close errors
        }
        client = null;
      }

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        logger.info(`Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw new Error(`Failed to connect to MongoDB after ${MAX_RETRIES} attempts: ${lastError?.message}`);
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
