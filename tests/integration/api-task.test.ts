import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../../src/server/app.js';
import { connectToDatabase, disconnectFromDatabase, getDatabase } from '../../src/db/client.js';
import { createIndexes } from '../../src/db/indexes.js';
import { resetConfig } from '../../src/config/index.js';
import { COLLECTION_NAMES } from '../../src/db/collections.js';
import type { Express } from 'express';
import { mkdtempSync, rmdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Task API', () => {
  let app: Express;
  let tempDir: string;

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

    // Create a temp directory for testing
    tempDir = mkdtempSync(join(tmpdir(), 'code-reader-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    if (tempDir) {
      try {
        rmdirSync(tempDir, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('POST /task', () => {
    it('should create a new task with valid repository path', async () => {
      const response = await request(app)
        .post('/task')
        .send({ repositoryPath: tempDir })
        .expect(201);

      expect(response.body.data.type).toBe('task');
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.attributes.status).toBe('pending');
      expect(response.body.data.attributes.version).toBe(1);
    });

    it('should increment version for same repository path', async () => {
      // Create first task
      await request(app)
        .post('/task')
        .send({ repositoryPath: tempDir })
        .expect(201);

      // Create second task for same path
      const response = await request(app)
        .post('/task')
        .send({ repositoryPath: tempDir })
        .expect(201);

      expect(response.body.data.attributes.version).toBe(2);
    });

    it('should accept custom configuration', async () => {
      const response = await request(app)
        .post('/task')
        .send({
          repositoryPath: tempDir,
          config: {
            batchSize: 25,
            chunkSize: 800,
          },
        })
        .expect(201);

      expect(response.body.data.attributes.status).toBe('pending');
    });

    it('should return 400 for missing repository path', async () => {
      const response = await request(app)
        .post('/task')
        .send({})
        .expect(400);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for non-existent path', async () => {
      const response = await request(app)
        .post('/task')
        .send({ repositoryPath: '/non/existent/path/12345' })
        .expect(400);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].code).toBe('INVALID_PATH');
    });

    it('should return 400 for invalid batch size', async () => {
      const response = await request(app)
        .post('/task')
        .send({
          repositoryPath: tempDir,
          config: { batchSize: 1000 },
        })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });
  });

  describe('GET /task/:taskId', () => {
    it('should return task details', async () => {
      // Create a task first
      const createResponse = await request(app)
        .post('/task')
        .send({ repositoryPath: tempDir })
        .expect(201);

      const taskId = createResponse.body.data.id;

      // Get task details
      const response = await request(app)
        .get(`/task/${taskId}`)
        .expect(200);

      expect(response.body.data.type).toBe('task');
      expect(response.body.data.id).toBe(taskId);
      expect(response.body.data.attributes.repositoryPath).toBe(tempDir);
      expect(response.body.data.attributes.progress).toBeDefined();
      expect(response.body.data.attributes.config).toBeDefined();
    });

    it('should return 404 for non-existent task', async () => {
      const response = await request(app)
        .get('/task/550e8400-e29b-41d4-a716-446655440000')
        .expect(404);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].code).toBe('TASK_NOT_FOUND');
    });

    it('should return 400 for invalid task ID format', async () => {
      const response = await request(app)
        .get('/task/invalid-id')
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });
  });
});
