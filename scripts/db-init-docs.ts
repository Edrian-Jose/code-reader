#!/usr/bin/env tsx

import { connectToDatabase, disconnectFromDatabase } from '../src/db/client.js';
import { DOCUMENTATION_COLLECTION_NAMES } from '../src/db/documentation-collections.js';
import { logger } from '../src/utils/logger.js';

/**
 * Database initialization script for documentation generation collections
 * Creates MongoDB collections and indexes for documentation plans, tasks, artifacts, and external source configs
 * Usage: npm run db:init:docs
 */
async function initializeDocumentationCollections(): Promise<void> {
  try {
    logger.info('Starting documentation collections initialization...');

    // Connect to MongoDB
    const db = await connectToDatabase();
    logger.info('Database connection established');

    // Create collections if they don't exist
    const existingCollections = await db.listCollections().toArray();
    const existingNames = existingCollections.map((c) => c.name);

    logger.info('Checking documentation collections...');

    for (const collectionName of Object.values(DOCUMENTATION_COLLECTION_NAMES)) {
      if (!existingNames.includes(collectionName)) {
        logger.info(`Creating collection: ${collectionName}`);
        await db.createCollection(collectionName);
      } else {
        logger.info(`Collection already exists: ${collectionName}`);
      }
    }

    // Create indexes for documentation_plans
    logger.info('Creating indexes for documentation_plans...');
    await db.collection(DOCUMENTATION_COLLECTION_NAMES.PLANS).createIndex({ planId: 1 }, { unique: true });
    await db.collection(DOCUMENTATION_COLLECTION_NAMES.PLANS).createIndex({ identifier: 1, version: -1 });
    await db.collection(DOCUMENTATION_COLLECTION_NAMES.PLANS).createIndex({ status: 1 });
    await db.collection(DOCUMENTATION_COLLECTION_NAMES.PLANS).createIndex({ repositoryIdentifier: 1 });

    // Create indexes for documentation_tasks
    logger.info('Creating indexes for documentation_tasks...');
    await db.collection(DOCUMENTATION_COLLECTION_NAMES.TASKS).createIndex({ taskId: 1 }, { unique: true });
    await db.collection(DOCUMENTATION_COLLECTION_NAMES.TASKS).createIndex({ planId: 1 });
    await db.collection(DOCUMENTATION_COLLECTION_NAMES.TASKS).createIndex({ planId: 1, status: 1 });
    await db.collection(DOCUMENTATION_COLLECTION_NAMES.TASKS).createIndex({ planId: 1, priorityScore: -1 });

    // Create indexes for documentation_artifacts
    logger.info('Creating indexes for documentation_artifacts...');
    await db.collection(DOCUMENTATION_COLLECTION_NAMES.ARTIFACTS).createIndex({ artifactId: 1 }, { unique: true });
    await db.collection(DOCUMENTATION_COLLECTION_NAMES.ARTIFACTS).createIndex({ planId: 1 });
    await db.collection(DOCUMENTATION_COLLECTION_NAMES.ARTIFACTS).createIndex({ taskId: 1 });
    await db.collection(DOCUMENTATION_COLLECTION_NAMES.ARTIFACTS).createIndex({ domainName: 1 });

    // Create indexes for external_source_configs
    logger.info('Creating indexes for external_source_configs...');
    await db.collection(DOCUMENTATION_COLLECTION_NAMES.EXTERNAL_SOURCES).createIndex({ configId: 1 }, { unique: true });
    await db.collection(DOCUMENTATION_COLLECTION_NAMES.EXTERNAL_SOURCES).createIndex({ planId: 1 });
    await db.collection(DOCUMENTATION_COLLECTION_NAMES.EXTERNAL_SOURCES).createIndex({
      planId: 1,
      sourceType: 1,
      enabled: 1,
    });

    logger.info('✅ Documentation collections initialization complete');

    // Disconnect
    await disconnectFromDatabase();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('❌ Database initialization failed', { error });
    process.exit(1);
  }
}

initializeDocumentationCollections();
