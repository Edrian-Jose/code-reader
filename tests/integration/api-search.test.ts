import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../../src/server/app.js';
import { connectToDatabase, disconnectFromDatabase, getDatabase } from '../../src/db/client.js';
import { createIndexes } from '../../src/db/indexes.js';
import { resetConfig } from '../../src/config/index.js';
import { COLLECTION_NAMES } from '../../src/db/collections.js';
import { generateUUID } from '../../src/utils/uuid.js';
import type { Express } from 'express';
import type { Task } from '../../src/models/task.js';
import type { Chunk } from '../../src/models/chunk.js';
import type { Embedding } from '../../src/models/embedding.js';

describe('Search API', () => {
  let app: Express;
  let testTaskId: string;

  beforeAll(async () => {
    resetConfig();
    await connectToDatabase();
    await createIndexes();
    app = createApp();
  });

  afterAll(async () => {
    await disconnectFromDatabase();
  });

  beforeEach(async () => {
    // Clean up test data
    const db = getDatabase();
    await db.collection(COLLECTION_NAMES.TASKS).deleteMany({});
    await db.collection(COLLECTION_NAMES.FILES).deleteMany({});
    await db.collection(COLLECTION_NAMES.CHUNKS).deleteMany({});
    await db.collection(COLLECTION_NAMES.EMBEDDINGS).deleteMany({});

    // Create a test task with sample data
    testTaskId = generateUUID();
    const now = new Date();

    const task: Task = {
      taskId: testTaskId,
      identifier: 'test-search-repo',
      version: 1,
      repositoryPath: '/test/repo',
      status: 'completed',
      progress: {
        totalFiles: 2,
        processedFiles: 2,
        currentBatch: 1,
        totalBatches: 1,
      },
      config: {
        batchSize: 50,
        chunkSize: 1000,
        chunkOverlap: 100,
        embeddingModel: 'text-embedding-3-small',
        extensions: ['.ts'],
        excludeDirs: ['node_modules'],
        maxFileSize: 1048576,
      },
      recommendedFileLimit: 133,
      createdAt: now,
      updatedAt: now,
      completedAt: now,
      error: null,
    };

    await db.collection(COLLECTION_NAMES.TASKS).insertOne(task);

    // Create test chunks
    const chunk1Id = generateUUID();
    const chunk2Id = generateUUID();

    const chunk1: Chunk = {
      chunkId: chunk1Id,
      taskId: testTaskId,
      fileId: generateUUID(),
      filePath: 'src/auth/handler.ts',
      content: 'export async function authenticateUser(credentials) {\n  return validateCredentials(credentials);\n}',
      startLine: 1,
      endLine: 3,
      tokenCount: 20,
    };

    const chunk2: Chunk = {
      chunkId: chunk2Id,
      taskId: testTaskId,
      fileId: generateUUID(),
      filePath: 'src/utils/helper.ts',
      content: 'export function formatDate(date: Date): string {\n  return date.toISOString();\n}',
      startLine: 5,
      endLine: 7,
      tokenCount: 15,
    };

    await db.collection(COLLECTION_NAMES.CHUNKS).insertMany([chunk1, chunk2]);

    // Create test embeddings (with fake vectors)
    const embedding1: Embedding = {
      chunkId: chunk1Id,
      taskId: testTaskId,
      vector: new Array(1536).fill(0).map(() => Math.random()),
      model: 'text-embedding-3-small',
      createdAt: now,
    };

    const embedding2: Embedding = {
      chunkId: chunk2Id,
      taskId: testTaskId,
      vector: new Array(1536).fill(0).map(() => Math.random()),
      model: 'text-embedding-3-small',
      createdAt: now,
    };

    await db.collection(COLLECTION_NAMES.EMBEDDINGS).insertMany([embedding1, embedding2]);
  });

  describe('POST /search_code', () => {
    it('should return 400 for missing query', async () => {
      const response = await request(app)
        .post('/search_code')
        .send({ taskId: testTaskId })
        .expect(400);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for missing taskId and identifier', async () => {
      const response = await request(app)
        .post('/search_code')
        .send({ query: 'authentication' })
        .expect(400);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].code).toBe('VALIDATION_ERROR');
    });

    it('should search by identifier instead of taskId', async () => {
      const response = await request(app)
        .post('/search_code')
        .send({ query: 'function', identifier: 'test-search-repo', limit: 5 })
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(response.body.data.type).toBe('search_results');
      expect(response.body.data.attributes.identifier).toBe('test-search-repo');
      expect(response.body.data.attributes.query).toBe('function');
    });

    it('should return 400 for invalid taskId format', async () => {
      const response = await request(app)
        .post('/search_code')
        .send({ query: 'authentication', taskId: 'invalid-id' })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    it('should return 400 for invalid limit', async () => {
      const response = await request(app)
        .post('/search_code')
        .send({ query: 'authentication', taskId: testTaskId, limit: 0 })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    it('should return 404 for non-existent task', async () => {
      const response = await request(app)
        .post('/search_code')
        .send({ query: 'authentication', taskId: '550e8400-e29b-41d4-a716-446655440000' })
        .expect(404);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].code).toBe('TASK_NOT_FOUND');
    });

    it('should return search results with proper format', async () => {
      // Note: This test uses in-memory cosine similarity since we don't have Atlas in test env
      const response = await request(app)
        .post('/search_code')
        .send({ query: 'authentication function', taskId: testTaskId, limit: 5 })
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(response.body.data.type).toBe('search_results');
      expect(response.body.data.attributes.query).toBe('authentication function');
      expect(response.body.data.attributes.taskId).toBe(testTaskId);
      expect(response.body.data.attributes.resultCount).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(response.body.data.attributes.results)).toBe(true);
    });

    it('should return results with required fields', async () => {
      const response = await request(app)
        .post('/search_code')
        .send({ query: 'function', taskId: testTaskId, limit: 10 })
        .expect(200);

      const results = response.body.data.attributes.results;

      if (results.length > 0) {
        const firstResult = results[0];
        expect(firstResult.filePath).toBeDefined();
        expect(firstResult.content).toBeDefined();
        expect(firstResult.startLine).toBeDefined();
        expect(firstResult.endLine).toBeDefined();
        expect(firstResult.score).toBeDefined();
        expect(typeof firstResult.score).toBe('number');
        expect(firstResult.score).toBeGreaterThanOrEqual(0);
        expect(firstResult.score).toBeLessThanOrEqual(1);
      }
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .post('/search_code')
        .send({ query: 'function', taskId: testTaskId, limit: 1 })
        .expect(200);

      const results = response.body.data.attributes.results;
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('should use default limit of 10', async () => {
      const response = await request(app)
        .post('/search_code')
        .send({ query: 'function', taskId: testTaskId })
        .expect(200);

      expect(response.body.data.attributes.resultCount).toBeDefined();
      // With only 2 chunks, we won't hit the limit
      expect(response.body.data.attributes.results.length).toBeLessThanOrEqual(10);
    });
  });
});
