import type { ObjectId } from 'mongodb';

export type PlanStatus = 'planning' | 'executing' | 'completed' | 'failed';

export interface PlanProgress {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  currentTask: string | null; // TaskId of currently executing task
}

export interface PrioritizationHeuristic {
  name: string; // e.g., "FoundationalFirst-v1"
  version: string; // Heuristic version for reproducibility
  parameters: Record<string, any>; // Heuristic config (weights, thresholds)
}

export interface DocumentationPlan {
  _id?: ObjectId;
  planId: string; // UUID v4
  identifier: string; // User-friendly name (e.g., "my-repo-docs")
  version: number; // Sequential version starting from 1
  repositoryIdentifier: string; // Links to code extraction task identifier
  status: PlanStatus;
  progress: PlanProgress;
  heuristic: PrioritizationHeuristic;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  error: string | null;
}

export interface CreatePlanInput {
  repositoryIdentifier: string;
  identifier: string; // User-friendly identifier for this plan
  heuristicVersion?: string; // Optional heuristic selection
  externalSources?: {
    confluence?: {
      enabled: boolean;
      cloudId: string;
    };
  };
}

export interface PlanResponse {
  data: {
    type: 'documentation_plan';
    id: string;
    attributes: {
      planId: string;
      identifier: string;
      version: number;
      repositoryIdentifier?: string;
      status: PlanStatus;
      progress?: PlanProgress;
      heuristic?: PrioritizationHeuristic;
      createdAt?: string;
      updatedAt?: string;
      completedAt?: string | null;
      error?: string | null;
    };
    relationships?: {
      tasks?: {
        data: Array<{
          type: 'documentation_task';
          id: string;
          attributes: any;
        }>;
      };
    };
  };
  meta?: {
    estimatedDuration?: string;
  };
}

export const DEFAULT_HEURISTIC: PrioritizationHeuristic = {
  name: 'FoundationalFirst-v1',
  version: '1.0.0',
  parameters: {
    foundationalWeight: 100,
    dependencyWeight: 50,
    informationGainWeight: 30,
    crossSourceWeight: 20,
    complexityPenalty: 1,
  },
};

export function createPlanResponse(plan: DocumentationPlan, detailed = false): PlanResponse {
  const response: PlanResponse = {
    data: {
      type: 'documentation_plan',
      id: plan.planId,
      attributes: {
        planId: plan.planId,
        identifier: plan.identifier,
        version: plan.version,
        status: plan.status,
      },
    },
  };

  if (detailed) {
    response.data.attributes = {
      ...response.data.attributes,
      repositoryIdentifier: plan.repositoryIdentifier,
      progress: plan.progress,
      heuristic: plan.heuristic,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
      completedAt: plan.completedAt?.toISOString() || null,
      error: plan.error,
    };
  }

  return response;
}

export function calculatePlanPercentComplete(progress: PlanProgress): number {
  if (progress.totalTasks === 0) {
    return 0;
  }
  return Math.round((progress.completedTasks / progress.totalTasks) * 100);
}
