/**
 * Task Prioritizer Service
 * Implements FoundationalFirst heuristic for documentation task ordering
 */

import type { DocumentationTask } from '../models/documentation-task.js';
import type { PrioritizationHeuristic } from '../models/documentation-plan.js';
import { DEFAULT_HEURISTIC } from '../models/documentation-plan.js';

export interface PlanContext {
  totalTasks: number;
  foundationalTaskCount: number;
}

/**
 * Calculate priority score for a documentation task using FoundationalFirst heuristic
 * Higher score = higher priority (executed earlier)
 *
 * Scoring factors:
 * 1. Foundational knowledge first (+100 if establishes architecture/vocabulary)
 * 2. Dependency awareness (+50 for each dependent task unlocked)
 * 3. Information gain (+30 if combines multiple sources)
 * 4. Cross-source reinforcement (+20 if validates across CLAUDE.md + code + Confluence)
 * 5. Chunk size control (penalty for tasks estimated >10 min execution)
 */
export function calculatePriorityScore(
  task: Pick<
    DocumentationTask,
    'isFoundational' | 'sourcesRequired' | 'estimatedComplexity' | 'dependencies'
  >,
  dependentCount: number, // Number of other tasks that depend on this one
  heuristic: PrioritizationHeuristic = DEFAULT_HEURISTIC
): number {
  let score = 0;
  const params = heuristic.parameters;

  // 1. Foundational knowledge first
  if (task.isFoundational) {
    score += params.foundationalWeight || 100;
  }

  // 2. Dependency awareness (how many tasks this unlocks)
  score += dependentCount * (params.dependencyWeight || 50);

  // 3. Information gain (multiple sources = more comprehensive)
  if (task.sourcesRequired.length > 1) {
    score += params.informationGainWeight || 30;
  }

  // 4. Cross-source reinforcement
  if (
    task.sourcesRequired.includes('confluence') &&
    task.sourcesRequired.length >= 2
  ) {
    score += params.crossSourceWeight || 20;
  }

  // 5. Chunk size control (penalty for high complexity)
  if (task.estimatedComplexity > 10) {
    score -= task.estimatedComplexity * (params.complexityPenalty || 1);
  }

  return score;
}

/**
 * Calculate dependent count for each task
 * Returns a map of taskId -> number of tasks that depend on it
 */
export function calculateDependentCounts(tasks: DocumentationTask[]): Map<string, number> {
  const dependentCounts = new Map<string, number>();

  // Initialize all tasks with 0
  for (const task of tasks) {
    dependentCounts.set(task.taskId, 0);
  }

  // Count dependencies
  for (const task of tasks) {
    for (const depId of task.dependencies) {
      const currentCount = dependentCounts.get(depId) || 0;
      dependentCounts.set(depId, currentCount + 1);
    }
  }

  return dependentCounts;
}

/**
 * Assign priority scores to all tasks in a plan
 * Mutates tasks to set priorityScore field
 */
export function assignPriorityScores(
  tasks: DocumentationTask[],
  heuristic: PrioritizationHeuristic = DEFAULT_HEURISTIC
): void {
  const dependentCounts = calculateDependentCounts(tasks);

  for (const task of tasks) {
    const dependentCount = dependentCounts.get(task.taskId) || 0;
    task.priorityScore = calculatePriorityScore(task, dependentCount, heuristic);
  }
}
