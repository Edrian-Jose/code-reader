import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { mkdtempSync, writeFileSync, rmdirSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { connectToDatabase, disconnectFromDatabase, getDatabase } from '../../src/db/client.js';
import { createIndexes } from '../../src/db/indexes.js';
import { resetConfig } from '../../src/config/index.js';
import { COLLECTION_NAMES } from '../../src/db/collections.js';
import { taskService } from '../../src/services/task.js';
import { BatchProcessor } from '../../src/services/processor.js';

// Mock the embedder for integration tests
jest.mock('../../src/services/embedder.js', () => ({
  embedder: {
    embed: jest.fn().mockImplementation((texts: string[]) => {
      return Promise.resolve(
        texts.map((_, index) => ({
          index,
          vector: new Array(1536).fill(0.1),
        }))
      );
    }),
  },
}));

describe('BatchProcessor Integration', () => {
  let tempDir: string;
  let processor: BatchProcessor;

  beforeAll(async () => {
    resetConfig();
    await connectToDatabase();
    await createIndexes();
    processor = new BatchProcessor();
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

    // Create temp directory with test files
    tempDir = mkdtempSync(join(tmpdir(), 'processor-test-'));

    // Create some test files
    writeFileSync(
      join(tempDir, 'test1.ts'),
      `export function hello() {
  console.log("Hello");
}

export function world() {
  console.log("World");
}`
    );

    writeFileSync(
      join(tempDir, 'test2.py'),
      `def greet():
    print("Hello from Python")

def farewell():
    print("Goodbye")`
    );

    mkdirSync(join(tempDir, 'src'));
    writeFileSync(
      join(tempDir, 'src', 'index.ts'),
      `import { hello } from './test1';
hello();`
    );
  });

  afterEach(() => {
    if (tempDir) {
      try {
        rmdirSync(tempDir, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('should process a repository and create chunks/embeddings', async () => {
    // Create a task
    const task = await taskService.create({ repositoryPath: tempDir });

    // Process the task directly (not via queue for testing)
    await (processor as any).processTask(task.taskId);

    // Verify task is completed
    const updatedTask = await taskService.getById(task.taskId);
    expect(updatedTask.status).toBe('completed');
    expect(updatedTask.progress.processedFiles).toBeGreaterThan(0);

    // Verify files were created
    const db = getDatabase();
    const files = await db.collection(COLLECTION_NAMES.FILES).find({ taskId: task.taskId }).toArray();
    expect(files.length).toBeGreaterThan(0);

    // Verify chunks were created
    const chunks = await db.collection(COLLECTION_NAMES.CHUNKS).find({ taskId: task.taskId }).toArray();
    expect(chunks.length).toBeGreaterThan(0);

    // Verify embeddings were created
    const embeddings = await db.collection(COLLECTION_NAMES.EMBEDDINGS).find({ taskId: task.taskId }).toArray();
    expect(embeddings.length).toBe(chunks.length);
  });

  it('should handle empty repository', async () => {
    // Create empty temp directory
    const emptyDir = mkdtempSync(join(tmpdir(), 'empty-test-'));

    try {
      const task = await taskService.create({ repositoryPath: emptyDir });
      await (processor as any).processTask(task.taskId);

      const updatedTask = await taskService.getById(task.taskId);
      expect(updatedTask.status).toBe('completed');
      expect(updatedTask.progress.totalFiles).toBe(0);
    } finally {
      rmdirSync(emptyDir, { recursive: true });
    }
  });
});
