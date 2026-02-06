import { existsSync, statSync } from 'fs';
import { getTasksCollection, getFilesCollection, getChunksCollection, getEmbeddingsCollection } from '../db/collections.js';
import { generateUUID } from '../utils/uuid.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, InvalidPathError, ValidationError } from '../utils/errors.js';
import {
  type Task,
  type TaskStatus,
  type CreateTaskInput,
  type TaskConfig,
  type TaskProgress,
  DEFAULT_TASK_CONFIG,
} from '../models/task.js';
import { getConfig } from '../config/index.js';

const MAX_VERSIONS_TO_KEEP = 3;

export class TaskService {
  async create(input: CreateTaskInput): Promise<Task> {
    // Validate repository path
    await this.validatePath(input.repositoryPath);

    // Get next version number for this repository
    const version = await this.getNextVersion(input.repositoryPath);

    // Merge config with defaults
    const config = getConfig();
    const taskConfig: TaskConfig = {
      ...DEFAULT_TASK_CONFIG,
      batchSize: config.extraction.batchSize,
      chunkSize: config.extraction.chunkSize,
      chunkOverlap: config.extraction.chunkOverlap,
      embeddingModel: config.openai.embeddingModel,
      extensions: config.extraction.extensions,
      excludeDirs: config.extraction.excludeDirs,
      maxFileSize: config.extraction.maxFileSize,
      ...input.config,
    };

    const now = new Date();
    const task: Task = {
      taskId: generateUUID(),
      version,
      repositoryPath: input.repositoryPath,
      status: 'pending',
      progress: {
        totalFiles: 0,
        processedFiles: 0,
        currentBatch: 0,
        totalBatches: 0,
      },
      config: taskConfig,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      error: null,
    };

    const collection = getTasksCollection();
    await collection.insertOne(task);

    logger.info(`Task created: ${task.taskId} (v${version}) for ${input.repositoryPath}`);

    // Clean up old versions
    await this.cleanupOldVersions(input.repositoryPath);

    return task;
  }

  async getById(taskId: string): Promise<Task> {
    const collection = getTasksCollection();
    const task = await collection.findOne({ taskId });

    if (!task) {
      throw new NotFoundError('Task', taskId);
    }

    return task;
  }

  async updateStatus(taskId: string, status: TaskStatus, error?: string): Promise<Task> {
    const collection = getTasksCollection();
    const now = new Date();

    const update: Record<string, unknown> = {
      status,
      updatedAt: now,
    };

    if (status === 'completed') {
      update.completedAt = now;
    }

    if (status === 'failed' && error) {
      update.error = error;
    }

    const result = await collection.findOneAndUpdate(
      { taskId },
      { $set: update },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new NotFoundError('Task', taskId);
    }

    logger.info(`Task ${taskId} status updated to ${status}`);
    return result;
  }

  async updateProgress(taskId: string, progress: Partial<TaskProgress>): Promise<Task> {
    const collection = getTasksCollection();
    const now = new Date();

    const updateFields: Record<string, unknown> = { updatedAt: now };

    if (progress.totalFiles !== undefined) {
      updateFields['progress.totalFiles'] = progress.totalFiles;
    }
    if (progress.processedFiles !== undefined) {
      updateFields['progress.processedFiles'] = progress.processedFiles;
    }
    if (progress.currentBatch !== undefined) {
      updateFields['progress.currentBatch'] = progress.currentBatch;
    }
    if (progress.totalBatches !== undefined) {
      updateFields['progress.totalBatches'] = progress.totalBatches;
    }

    const result = await collection.findOneAndUpdate(
      { taskId },
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new NotFoundError('Task', taskId);
    }

    return result;
  }

  async validatePath(repositoryPath: string): Promise<void> {
    if (!repositoryPath || typeof repositoryPath !== 'string') {
      throw new ValidationError('Repository path is required');
    }

    if (!existsSync(repositoryPath)) {
      throw new InvalidPathError(repositoryPath);
    }

    const stats = statSync(repositoryPath);
    if (!stats.isDirectory()) {
      throw new InvalidPathError(`Path is not a directory: ${repositoryPath}`);
    }
  }

  async getNextVersion(repositoryPath: string): Promise<number> {
    const collection = getTasksCollection();
    const latestTask = await collection
      .find({ repositoryPath })
      .sort({ version: -1 })
      .limit(1)
      .toArray();

    if (latestTask.length === 0) {
      return 1;
    }

    return latestTask[0].version + 1;
  }

  async cleanupOldVersions(repositoryPath: string): Promise<void> {
    const collection = getTasksCollection();

    // Get all versions for this repository, sorted by version descending
    const tasks = await collection
      .find({ repositoryPath })
      .sort({ version: -1 })
      .toArray();

    // Keep only the last MAX_VERSIONS_TO_KEEP versions
    if (tasks.length <= MAX_VERSIONS_TO_KEEP) {
      return;
    }

    const tasksToDelete = tasks.slice(MAX_VERSIONS_TO_KEEP);

    for (const task of tasksToDelete) {
      await this.deleteTask(task.taskId);
      logger.info(`Deleted old task version: ${task.taskId} (v${task.version}) for ${repositoryPath}`);
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    // Delete all related data
    await getEmbeddingsCollection().deleteMany({ taskId });
    await getChunksCollection().deleteMany({ taskId });
    await getFilesCollection().deleteMany({ taskId });
    await getTasksCollection().deleteOne({ taskId });
  }

  async getTasksByStatus(status: TaskStatus): Promise<Task[]> {
    const collection = getTasksCollection();
    return collection.find({ status }).toArray();
  }

  async getPendingTasks(): Promise<Task[]> {
    return this.getTasksByStatus('pending');
  }

  async getProcessingTasks(): Promise<Task[]> {
    return this.getTasksByStatus('processing');
  }
}

// Export singleton instance
export const taskService = new TaskService();
