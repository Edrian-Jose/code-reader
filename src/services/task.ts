import { existsSync, statSync } from 'fs';
import { getTasksCollection, getFilesCollection, getChunksCollection, getEmbeddingsCollection } from '../db/collections.js';
import { generateUUID } from '../utils/uuid.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, InvalidPathError, ValidationError, ConflictError } from '../utils/errors.js';
import {
  type Task,
  type TaskStatus,
  type CreateTaskInput,
  type TaskConfig,
  type TaskProgress,
  DEFAULT_TASK_CONFIG,
} from '../models/task.js';
import { getConfig } from '../config/index.js';
import { FileScanner } from './scanner.js';

const MAX_VERSIONS_TO_KEEP = 3;

export class TaskService {
  /**
   * Creates a new extraction task with a user-friendly identifier.
   * Scans repository immediately and calculates recommended file limit.
   * @param input - Task creation parameters including repositoryPath and identifier
   * @returns Created task with totalFiles and recommendedFileLimit
   * @throws InvalidPathError if repository path doesn't exist or isn't a directory
   * @throws ValidationError if identifier format is invalid
   */
  async create(input: CreateTaskInput): Promise<Task> {
    // Validate repository path
    await this.validatePath(input.repositoryPath);

    // Validate identifier is unique
    await this.validateIdentifier(input.identifier);

    // Get next version number for this identifier
    const version = await this.getNextVersion(input.identifier);

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

    // Scan repository to get file count
    const scanner = new FileScanner();
    const scanResult = await scanner.scan(input.repositoryPath, taskConfig);
    const totalFiles = scanResult.files.length;

    // Calculate recommended file limit based on ~200k token target
    // Assume average file has ~500 tokens/chunk, chunk size is configured
    const avgTokensPerFile = taskConfig.chunkSize * 1.5; // 1.5 chunks per file average
    const targetTokens = 200000;
    const recommendedFileLimit = Math.max(10, Math.floor(targetTokens / avgTokensPerFile));

    const now = new Date();
    const task: Task = {
      taskId: generateUUID(),
      identifier: input.identifier,
      version,
      repositoryPath: input.repositoryPath,
      status: 'pending',
      progress: {
        totalFiles,
        processedFiles: 0,
        currentBatch: 0,
        totalBatches: 0,
      },
      config: taskConfig,
      recommendedFileLimit,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      error: null,
    };

    const collection = getTasksCollection();
    await collection.insertOne(task);

    logger.info(
      `Task created: ${task.identifier} (v${version}) - ${totalFiles} files, recommended limit: ${recommendedFileLimit}`
    );

    // Clean up old versions
    await this.cleanupOldVersions(input.identifier);

    return task;
  }

  /**
   * Retrieves a task by its UUID.
   * @param taskId - UUID of the task
   * @returns Task object
   * @throws NotFoundError if task doesn't exist
   */
  async getById(taskId: string): Promise<Task> {
    const collection = getTasksCollection();
    const task = await collection.findOne({ taskId });

    if (!task) {
      throw new NotFoundError('Task', taskId);
    }

    return task;
  }

  /**
   * Updates the status of a task.
   * Sets completedAt timestamp when status is 'completed'.
   * @param taskId - UUID of the task
   * @param status - New status (pending, processing, completed, failed)
   * @param error - Error message (required if status is 'failed')
   * @returns Updated task
   * @throws NotFoundError if task doesn't exist
   */
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

  /**
   * Updates task progress metrics.
   * @param taskId - UUID of the task
   * @param progress - Partial progress update (totalFiles, processedFiles, currentBatch, totalBatches)
   * @returns Updated task
   * @throws NotFoundError if task doesn't exist
   */
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

  /**
   * Retrieves the latest version of a task by its user-friendly identifier.
   * @param identifier - User-friendly identifier (e.g., "my-app")
   * @returns Latest version of the task
   * @throws NotFoundError if no task with this identifier exists
   */
  async getByIdentifier(identifier: string): Promise<Task> {
    const collection = getTasksCollection();
    const task = await collection.findOne({ identifier }, { sort: { version: -1 } });

    if (!task) {
      throw new NotFoundError('Task', identifier);
    }

    return task;
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

  async validateIdentifier(identifier: string): Promise<void> {
    if (!identifier || typeof identifier !== 'string') {
      throw new ValidationError('Identifier is required');
    }

    // Validate identifier format (alphanumeric, hyphens, underscores only)
    if (!/^[a-zA-Z0-9_-]+$/.test(identifier)) {
      throw new ValidationError(
        'Identifier must contain only alphanumeric characters, hyphens, and underscores'
      );
    }

    if (identifier.length < 2 || identifier.length > 100) {
      throw new ValidationError('Identifier must be between 2 and 100 characters');
    }
  }

  async getNextVersion(identifier: string): Promise<number> {
    const collection = getTasksCollection();
    const latestTask = await collection
      .find({ identifier })
      .sort({ version: -1 })
      .limit(1)
      .toArray();

    if (latestTask.length === 0) {
      return 1;
    }

    return latestTask[0].version + 1;
  }

  async cleanupOldVersions(identifier: string): Promise<void> {
    const collection = getTasksCollection();

    // Get all versions for this identifier, sorted by version descending
    const tasks = await collection.find({ identifier }).sort({ version: -1 }).toArray();

    // Keep only the last MAX_VERSIONS_TO_KEEP versions
    if (tasks.length <= MAX_VERSIONS_TO_KEEP) {
      return;
    }

    const tasksToDelete = tasks.slice(MAX_VERSIONS_TO_KEEP);

    for (const task of tasksToDelete) {
      await this.deleteTask(task.taskId);
      logger.info(`Deleted old task version: ${task.identifier} (v${task.version})`);
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
