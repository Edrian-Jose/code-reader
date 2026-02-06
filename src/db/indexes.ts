import { getDatabase } from './client.js';
import { COLLECTION_NAMES } from './collections.js';
import { logger } from '../utils/logger.js';

export async function createIndexes(): Promise<void> {
  const db = getDatabase();

  logger.info('Creating database indexes...');

  // Tasks collection indexes
  const tasks = db.collection(COLLECTION_NAMES.TASKS);
  await tasks.createIndex({ taskId: 1 }, { unique: true });
  await tasks.createIndex({ repositoryPath: 1, version: -1 });
  await tasks.createIndex({ status: 1 });

  // Files collection indexes
  const files = db.collection(COLLECTION_NAMES.FILES);
  await files.createIndex({ fileId: 1 }, { unique: true });
  await files.createIndex({ taskId: 1 });
  await files.createIndex({ taskId: 1, filePath: 1 }, { unique: true });
  await files.createIndex({ taskId: 1, batchNumber: 1 });

  // Chunks collection indexes
  const chunks = db.collection(COLLECTION_NAMES.CHUNKS);
  await chunks.createIndex({ chunkId: 1 }, { unique: true });
  await chunks.createIndex({ taskId: 1 });
  await chunks.createIndex({ fileId: 1 });
  await chunks.createIndex({ taskId: 1, filePath: 1 });

  // Embeddings collection indexes
  const embeddings = db.collection(COLLECTION_NAMES.EMBEDDINGS);
  await embeddings.createIndex({ chunkId: 1 }, { unique: true });
  await embeddings.createIndex({ taskId: 1 });

  logger.info('Database indexes created successfully');
}

export async function dropIndexes(): Promise<void> {
  const db = getDatabase();

  logger.info('Dropping all indexes...');

  await db.collection(COLLECTION_NAMES.TASKS).dropIndexes();
  await db.collection(COLLECTION_NAMES.FILES).dropIndexes();
  await db.collection(COLLECTION_NAMES.CHUNKS).dropIndexes();
  await db.collection(COLLECTION_NAMES.EMBEDDINGS).dropIndexes();

  logger.info('All indexes dropped');
}
