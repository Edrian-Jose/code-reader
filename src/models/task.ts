import type { ObjectId } from 'mongodb';

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface TaskConfig {
  batchSize: number;
  chunkSize: number;
  chunkOverlap: number;
  embeddingModel: string;
  extensions: string[];
  excludeDirs: string[];
  maxFileSize: number;
}

export interface TaskProgress {
  totalFiles: number;
  processedFiles: number;
  currentBatch: number;
  totalBatches: number;
}

export interface Task {
  _id?: ObjectId;
  taskId: string;
  identifier: string; // User-friendly identifier (e.g., "my-app", "auth-service")
  version: number;
  repositoryPath: string;
  status: TaskStatus;
  progress: TaskProgress;
  config: TaskConfig;
  recommendedFileLimit?: number; // Recommended files per process based on ~200k tokens
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  error: string | null;
}

export interface CreateTaskInput {
  repositoryPath: string;
  identifier: string; // User-friendly identifier for this task
  config?: Partial<TaskConfig>;
}

export interface TaskResponse {
  data: {
    type: 'task';
    id: string;
    attributes: {
      taskId: string;
      identifier: string;
      version: number;
      status: TaskStatus;
      repositoryPath?: string;
      progress?: TaskProgress;
      config?: TaskConfig;
      recommendedFileLimit?: number;
      createdAt?: string;
      updatedAt?: string;
      completedAt?: string | null;
      error?: string | null;
    };
  };
}

export const DEFAULT_TASK_CONFIG: TaskConfig = {
  batchSize: 50,
  chunkSize: 1000,
  chunkOverlap: 100,
  embeddingModel: 'text-embedding-3-small',
  extensions: ['.js', '.ts', '.py', '.go', '.rs', '.java', '.cpp', '.c', '.h', '.md', '.json', '.yaml', '.yml'],
  excludeDirs: ['node_modules', '.git', 'dist', 'build'],
  maxFileSize: 1048576,
};

export function createTaskResponse(task: Task, detailed = false): TaskResponse {
  const response: TaskResponse = {
    data: {
      type: 'task',
      id: task.taskId,
      attributes: {
        taskId: task.taskId,
        identifier: task.identifier,
        version: task.version,
        status: task.status,
      },
    },
  };

  if (detailed) {
    response.data.attributes = {
      ...response.data.attributes,
      repositoryPath: task.repositoryPath,
      progress: task.progress,
      config: task.config,
      recommendedFileLimit: task.recommendedFileLimit,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      completedAt: task.completedAt?.toISOString() || null,
      error: task.error,
    };
  }

  return response;
}

export function calculatePercentComplete(progress: TaskProgress): number {
  if (progress.totalBatches === 0) {
    return 0;
  }
  return Math.round((progress.currentBatch / progress.totalBatches) * 100);
}
