import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  DEFAULT_TASK_CONFIG,
  createTaskResponse,
  calculatePercentComplete,
  type Task,
  type TaskProgress,
} from '../../src/models/task.js';

describe('Task Model', () => {
  describe('DEFAULT_TASK_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_TASK_CONFIG.batchSize).toBe(50);
      expect(DEFAULT_TASK_CONFIG.chunkSize).toBe(1000);
      expect(DEFAULT_TASK_CONFIG.chunkOverlap).toBe(100);
      expect(DEFAULT_TASK_CONFIG.embeddingModel).toBe('text-embedding-3-small');
      expect(DEFAULT_TASK_CONFIG.maxFileSize).toBe(1048576);
    });

    it('should include all required extensions', () => {
      expect(DEFAULT_TASK_CONFIG.extensions).toContain('.js');
      expect(DEFAULT_TASK_CONFIG.extensions).toContain('.ts');
      expect(DEFAULT_TASK_CONFIG.extensions).toContain('.py');
      expect(DEFAULT_TASK_CONFIG.extensions).toContain('.go');
      expect(DEFAULT_TASK_CONFIG.extensions).toContain('.md');
    });

    it('should exclude common build directories', () => {
      expect(DEFAULT_TASK_CONFIG.excludeDirs).toContain('node_modules');
      expect(DEFAULT_TASK_CONFIG.excludeDirs).toContain('.git');
      expect(DEFAULT_TASK_CONFIG.excludeDirs).toContain('dist');
      expect(DEFAULT_TASK_CONFIG.excludeDirs).toContain('build');
    });
  });

  describe('createTaskResponse', () => {
    const mockTask: Task = {
      taskId: 'test-task-id',
      identifier: 'test-repo',
      version: 1,
      repositoryPath: '/test/path',
      status: 'pending',
      progress: {
        totalFiles: 100,
        processedFiles: 50,
        currentBatch: 2,
        totalBatches: 4,
      },
      config: DEFAULT_TASK_CONFIG,
      recommendedFileLimit: 133,
      createdAt: new Date('2026-02-07T10:00:00Z'),
      updatedAt: new Date('2026-02-07T10:05:00Z'),
      completedAt: null,
      error: null,
    };

    it('should create basic response', () => {
      const response = createTaskResponse(mockTask);

      expect(response.data.type).toBe('task');
      expect(response.data.id).toBe('test-task-id');
      expect(response.data.attributes.taskId).toBe('test-task-id');
      expect(response.data.attributes.identifier).toBe('test-repo');
      expect(response.data.attributes.version).toBe(1);
      expect(response.data.attributes.status).toBe('pending');
    });

    it('should include detailed attributes when requested', () => {
      const response = createTaskResponse(mockTask, true);

      expect(response.data.attributes.repositoryPath).toBe('/test/path');
      expect(response.data.attributes.progress).toBeDefined();
      expect(response.data.attributes.config).toBeDefined();
      expect(response.data.attributes.createdAt).toBe('2026-02-07T10:00:00.000Z');
    });

    it('should not include detailed attributes by default', () => {
      const response = createTaskResponse(mockTask);

      expect(response.data.attributes.repositoryPath).toBeUndefined();
      expect(response.data.attributes.progress).toBeUndefined();
    });
  });

  describe('calculatePercentComplete', () => {
    it('should calculate correct percentage', () => {
      const progress: TaskProgress = {
        totalFiles: 100,
        processedFiles: 50,
        currentBatch: 2,
        totalBatches: 4,
      };

      expect(calculatePercentComplete(progress)).toBe(50);
    });

    it('should return 0 when no batches', () => {
      const progress: TaskProgress = {
        totalFiles: 0,
        processedFiles: 0,
        currentBatch: 0,
        totalBatches: 0,
      };

      expect(calculatePercentComplete(progress)).toBe(0);
    });

    it('should return 100 when complete', () => {
      const progress: TaskProgress = {
        totalFiles: 100,
        processedFiles: 100,
        currentBatch: 4,
        totalBatches: 4,
      };

      expect(calculatePercentComplete(progress)).toBe(100);
    });
  });
});
