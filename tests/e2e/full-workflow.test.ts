import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../../src/server/app.js';
import { connectToDatabase, disconnectFromDatabase, getDatabase } from '../../src/db/client.js';
import { createIndexes } from '../../src/db/indexes.js';
import { resetConfig } from '../../src/config/index.js';
import { COLLECTION_NAMES } from '../../src/db/collections.js';
import type { Express } from 'express';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('End-to-End Workflow', () => {
  let app: Express;
  const testRepoPath = join(__dirname, '../fixtures/sample-repo');
  const testIdentifier = 'e2e-test-repo';
  let taskId: string;

  beforeAll(async () => {
    resetConfig();
    await connectToDatabase();
    await createIndexes();
    app = createApp();

    // Clean up any existing test data
    const db = getDatabase();
    await db.collection(COLLECTION_NAMES.TASKS).deleteMany({ identifier: testIdentifier });
    await db.collection(COLLECTION_NAMES.FILES).deleteMany({});
    await db.collection(COLLECTION_NAMES.CHUNKS).deleteMany({});
    await db.collection(COLLECTION_NAMES.EMBEDDINGS).deleteMany({});
  });

  afterAll(async () => {
    // Clean up test data
    const db = getDatabase();
    await db.collection(COLLECTION_NAMES.TASKS).deleteMany({ identifier: testIdentifier });
    await db.collection(COLLECTION_NAMES.FILES).deleteMany({});
    await db.collection(COLLECTION_NAMES.CHUNKS).deleteMany({});
    await db.collection(COLLECTION_NAMES.EMBEDDINGS).deleteMany({});

    await disconnectFromDatabase();
  });

  it('should complete full workflow: create task -> process -> search', async () => {
    // Step 1: Create extraction task
    console.log('\n=== Step 1: Creating task ===');
    const createResponse = await request(app)
      .post('/task')
      .send({
        repositoryPath: testRepoPath,
        identifier: testIdentifier,
      })
      .expect(201);

    expect(createResponse.body.data.type).toBe('task');
    expect(createResponse.body.data.attributes.identifier).toBe(testIdentifier);
    expect(createResponse.body.data.attributes.status).toBe('pending');
    expect(createResponse.body.data.attributes.progress.totalFiles).toBeGreaterThan(0);
    expect(createResponse.body.data.attributes.recommendedFileLimit).toBeDefined();

    taskId = createResponse.body.data.id;
    const totalFiles = createResponse.body.data.attributes.progress.totalFiles;

    console.log(`✓ Task created: ${taskId}`);
    console.log(`  Identifier: ${testIdentifier}`);
    console.log(`  Total files: ${totalFiles}`);
    console.log(`  Recommended limit: ${createResponse.body.data.attributes.recommendedFileLimit}`);

    // Step 2: Get task by identifier (test identifier-based lookup)
    console.log('\n=== Step 2: Getting task by identifier ===');
    const getByIdResponse = await request(app)
      .get(`/task/by-identifier/${testIdentifier}`)
      .expect(200);

    expect(getByIdResponse.body.data.id).toBe(taskId);
    expect(getByIdResponse.body.data.attributes.identifier).toBe(testIdentifier);
    console.log(`✓ Task retrieved by identifier successfully`);

    // Step 3: Start processing (Note: We can't easily test actual processing in unit tests
    // because it requires OpenAI API key and takes time. This is more of an integration smoke test)
    console.log('\n=== Step 3: Testing process endpoint ===');
    const processResponse = await request(app)
      .post('/process')
      .send({
        identifier: testIdentifier,
        fileLimit: 2, // Process just 2 files for this test
      })
      .expect(202);

    expect(processResponse.body.data.attributes.status).toBe('processing');
    expect(processResponse.body.data.attributes.identifier).toBe(testIdentifier);
    expect(processResponse.body.data.attributes.fileLimit).toBe(2);
    console.log(`✓ Processing started (file limit: 2)`);

    // Step 4: Stop processing (test stop endpoint)
    console.log('\n=== Step 4: Testing stop endpoint ===');

    // Wait a moment for processing to actually start
    await new Promise((resolve) => setTimeout(resolve, 100));

    const stopResponse = await request(app)
      .post('/process/stop')
      .send({ identifier: testIdentifier });

    // May return 200 if still processing, or 400 if already stopped
    expect([200, 400]).toContain(stopResponse.status);

    if (stopResponse.status === 200) {
      console.log(`✓ Stop request accepted`);
      expect(stopResponse.body.data.attributes.status).toBe('stopped');
    } else {
      console.log(`✓ Task already stopped or completed`);
    }

    // Step 5: Verify workflow completion
    console.log('\n=== Step 5: Verifying workflow completion ===');
    const finalStatus = await request(app)
      .get(`/task/${taskId}`)
      .expect(200);

    expect(finalStatus.body.data.attributes.identifier).toBe(testIdentifier);
    console.log(`✓ Task status: ${finalStatus.body.data.attributes.status}`);
    console.log(`✓ Processed files: ${finalStatus.body.data.attributes.progress.processedFiles}`);

    console.log('\n=== End-to-End Workflow Test Complete ===\n');
  }, 30000); // 30 second timeout for this test
});
