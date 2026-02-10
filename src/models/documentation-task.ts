import type { ObjectId } from 'mongodb';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';
export type SourceType = 'claude_md' | 'code_chunks' | 'confluence';

export interface DocumentationTask {
  _id?: ObjectId;
  taskId: string; // UUID v4
  planId: string; // Reference to parent plan
  domain: string; // Domain/feature name (e.g., "User Authentication")
  description: string; // What this task documents
  priorityScore: number; // Calculated by heuristic (higher = earlier)
  dependencies: string[]; // TaskIds that must complete first
  sourcesRequired: SourceType[]; // Which sources needed
  isFoundational: boolean; // Establishes architecture/vocabulary
  estimatedComplexity: number; // 1-10 scale for chunk size control
  status: TaskStatus;
  artifactRef: string | null; // ArtifactId when completed
  startedAt: Date | null;
  completedAt: Date | null;
  error: string | null; // Error details if failed
  createdAt: Date;
}

export interface CreateTaskInput {
  planId: string;
  domain: string;
  description: string;
  priorityScore: number;
  dependencies?: string[];
  sourcesRequired: SourceType[];
  isFoundational?: boolean;
  estimatedComplexity?: number;
}

export interface TaskResponse {
  data: {
    type: 'documentation_task';
    id: string;
    attributes: {
      taskId: string;
      domain: string;
      status: TaskStatus;
      priorityScore?: number;
      sourcesRequired?: SourceType[];
      artifactRef?: string | null;
      startedAt?: string | null;
      completedAt?: string | null;
      error?: string | null;
    };
  };
}

export function createTaskResponse(task: DocumentationTask): TaskResponse {
  return {
    data: {
      type: 'documentation_task',
      id: task.taskId,
      attributes: {
        taskId: task.taskId,
        domain: task.domain,
        status: task.status,
        priorityScore: task.priorityScore,
        sourcesRequired: task.sourcesRequired,
        artifactRef: task.artifactRef,
        startedAt: task.startedAt?.toISOString() || null,
        completedAt: task.completedAt?.toISOString() || null,
        error: task.error,
      },
    },
  };
}
