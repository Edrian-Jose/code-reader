#!/usr/bin/env tsx

import { connectToDatabase, disconnectFromDatabase } from '../src/db/client.js';
import { COLLECTION_NAMES } from '../src/db/collections.js';
import { createIndexes } from '../src/db/indexes.js';
import { logger } from '../src/utils/logger.js';

/**
 * Database initialization script
 * Creates all required collections and indexes
 * Usage: npm run db:init
 */
async function initializeDatabase(): Promise<void> {
  try {
    logger.info('Starting database initialization...');

    // Connect to MongoDB
    const db = await connectToDatabase();
    logger.info('Database connection established');

    // Create collections if they don't exist
    const existingCollections = await db.listCollections().toArray();
    const existingNames = existingCollections.map((c) => c.name);

    logger.info('Checking collections...');

    for (const collectionName of Object.values(COLLECTION_NAMES)) {
      if (!existingNames.includes(collectionName)) {
        logger.info(`Creating collection: ${collectionName}`);
        await db.createCollection(collectionName);
      } else {
        logger.info(`Collection already exists: ${collectionName}`);
      }
    }

    // Create indexes
    logger.info('Creating indexes...');
    await createIndexes();

    logger.info('Database initialization completed successfully');
    process.exit(0);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Database initialization failed: ${errorMessage}`);
    console.error(error);
    process.exit(1);
  } finally {
    await disconnectFromDatabase();
  }
}

// Run initialization
initializeDatabase();
