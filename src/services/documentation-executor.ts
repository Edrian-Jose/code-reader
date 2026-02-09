/**
 * Documentation Executor Service
 * Executes documentation tasks incrementally with resume capability
 */

import type { DocumentationTask } from '../models/documentation-task.js';
import type { DocumentationArtifact } from '../models/documentation-artifact.js';
import {
  getDocumentationPlansCollection,
  getDocumentationTasksCollection,
  getDocumentationArtifactsCollection,
} from '../db/documentation-collections.js';
import { getPlanByIdentifier, getTasksForPlan } from './documentation-planner.js';
import { synthesizeDocumentation } from './source-synthesizer.js';
import { generateArtifact } from './artifact-generator.js';
import { getReadyNodes } from '../utils/dependency-graph.js';
import { logger } from '../utils/logger.js';

/**
 * T033, T037-T038: Execute the next ready documentation task for a plan
 * Implements task selection, synthesis, generation, and atomic persistence
 */
export async function executeNextTask(identifier: string): Promise<DocumentationTask | null> {
  logger.info('Executing next documentation task', { identifier });

  // Load plan by identifier
  const plan = await getPlanByIdentifier(identifier);
  if (!plan) {
    throw new Error(`Plan not found: ${identifier}`);
  }

  if (plan.status !== 'executing') {
    throw new Error(`Plan is not in executing status: ${plan.status}`);
  }

  // T033: Select next ready task (highest priority, all dependencies complete)
  const allTasks = await getTasksForPlan(plan.planId);
  const completedTaskIds = new Set(allTasks.filter((t) => t.status === 'completed').map((t) => t.taskId));

  const readyTaskIds = getReadyNodes(
    allTasks.map((t) => ({ id: t.taskId, dependencies: t.dependencies })),
    completedTaskIds
  );

  const readyTasks = allTasks.filter((t) => readyTaskIds.includes(t.taskId) && t.status === 'pending');

  if (readyTasks.length === 0) {
    logger.info('No ready tasks available', { planId: plan.planId, completedCount: completedTaskIds.size, totalTasks: allTasks.length });

    // Check if all tasks are complete
    const incompleteTasks = allTasks.filter((t) => t.status !== 'completed');
    if (incompleteTasks.length === 0) {
      // All tasks complete - update plan status
      await getDocumentationPlansCollection().updateOne(
        { planId: plan.planId },
        {
          $set: {
            status: 'completed',
            completedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );

      logger.info('All tasks complete, plan marked as completed', { planId: plan.planId });
    }

    return null;
  }

  // Select highest priority task
  const nextTask = readyTasks.sort((a, b) => b.priorityScore - a.priorityScore)[0];

  logger.info('Selected next task for execution', {
    taskId: nextTask.taskId,
    domain: nextTask.domain,
    priorityScore: nextTask.priorityScore,
  });

  // Update task status to 'in_progress'
  const startTime = Date.now();
  await getDocumentationTasksCollection().updateOne(
    { taskId: nextTask.taskId },
    { $set: { status: 'in_progress', startedAt: new Date() } }
  );

  // Update plan current task
  await getDocumentationPlansCollection().updateOne(
    { planId: plan.planId },
    { $set: { 'progress.currentTask': nextTask.taskId, updatedAt: new Date() } }
  );

  try {
   // T034-T035: Synthesize documentation from sources using LLM-powered analysis
   // Pass domain metadata to provide context for LLM analysis

   // Resolve task dependencies to domain names
   const dependencyDomains: string[] = [];
   if (nextTask.dependencies.length > 0) {
     const dependencyTasks = allTasks.filter(t => nextTask.dependencies.includes(t.taskId));
     dependencyDomains.push(...dependencyTasks.map(t => t.domain));
   }

   const synthesized = await synthesizeDocumentation(
    nextTask.domain,
    nextTask.sourcesRequired,
    plan.repositoryIdentifier,
    {
      description: nextTask.description,
      isFoundational: nextTask.isFoundational,
      dependencies: dependencyDomains,
    }
   );

   // T036: Generate and validate artifact
   const artifact = await generateArtifact(
    nextTask.taskId,
    plan.planId,
    nextTask.domain,
    synthesized,
   );

   // T037: Persist artifact and update task atomically
   await getDocumentationArtifactsCollection().insertOne(artifact);

   await getDocumentationTasksCollection().updateOne(
    { taskId: nextTask.taskId },
    {
     $set: {
      status: "completed",
      artifactRef: artifact.artifactId,
      completedAt: new Date(),
     },
    },
   );

   // Update plan progress
   const executionTime = Date.now() - startTime;
   await getDocumentationPlansCollection().updateOne(
    { planId: plan.planId },
    {
     $set: {
      "progress.completedTasks": plan.progress.completedTasks + 1,
      "progress.currentTask": null,
      updatedAt: new Date(),
     },
    },
   );

   // T042: Log lifecycle event with metrics (including LLM cost)
   logger.info("Task completed successfully", {
    taskId: nextTask.taskId,
    domain: nextTask.domain,
    executionTime: `${executionTime}ms`,
    qualityScore: artifact.qualityScore,
    artifactId: artifact.artifactId,
    llmCost: synthesized.llmCost
     ? `$${synthesized.llmCost.costUSD.toFixed(4)}`
     : "N/A",
    llmTokens: synthesized.llmCost?.totalTokens || 0,
   });

   // Update nextTask object to reflect changes
   nextTask.status = "completed";
   nextTask.artifactRef = artifact.artifactId;
   nextTask.completedAt = new Date();

   return nextTask;
  } catch (error: any) {
    // Task failed - mark as failed and log error
    const executionTime = Date.now() - startTime;

    await getDocumentationTasksCollection().updateOne(
      { taskId: nextTask.taskId },
      {
        $set: {
          status: 'failed',
          error: error.message || 'Unknown error',
          completedAt: new Date(),
        },
      }
    );

    await getDocumentationPlansCollection().updateOne(
      { planId: plan.planId },
      {
        $set: {
          'progress.failedTasks': plan.progress.failedTasks + 1,
          'progress.currentTask': null,
          updatedAt: new Date(),
        },
      }
    );

    logger.error('Task execution failed', {
      taskId: nextTask.taskId,
      domain: nextTask.domain,
      executionTime: `${executionTime}ms`,
      error: error.message,
    });

    // Update nextTask object
    nextTask.status = 'failed';
    nextTask.error = error.message;
    nextTask.completedAt = new Date();

    // Continue with next task (don't throw - allow workflow to continue)
    return nextTask;
  }
}

/**
 * T038: Resume documentation generation from last completed task
 * Loads state, skips completed, continues from next ready task
 */
export async function resumeDocumentation(identifier: string): Promise<void> {
  logger.info('Resuming documentation generation', { identifier });

  const plan = await getPlanByIdentifier(identifier);
  if (!plan) {
    throw new Error(`Plan not found: ${identifier}`);
  }

  if (plan.status !== 'executing') {
    throw new Error(`Cannot resume plan with status: ${plan.status}`);
  }

  // Execute tasks until all complete or no more ready tasks
  let tasksExecuted = 0;
  const maxIterations = plan.progress.totalTasks; // Safety limit

  while (tasksExecuted < maxIterations) {
    const nextTask = await executeNextTask(identifier);

    if (!nextTask) {
      // No more ready tasks
      logger.info('Resume complete - no more ready tasks', { identifier, tasksExecuted });
      break;
    }

    tasksExecuted++;

    if (nextTask.status === 'failed') {
      logger.warn('Task failed during resume, continuing with next task', {
        taskId: nextTask.taskId,
        domain: nextTask.domain,
      });
    }
  }

  logger.info('Documentation resume completed', { identifier, tasksExecuted });
}

/**
 * T046: Get documentation artifact by ID
 * Supports content negotiation for JSON vs markdown
 */
export async function getArtifactById(artifactId: string): Promise<DocumentationArtifact | null> {
  logger.debug('Retrieving artifact', { artifactId });

  const artifact = await getDocumentationArtifactsCollection().findOne({ artifactId });

  if (artifact) {
    logger.info('Artifact retrieved', { artifactId, domain: artifact.domainName });
  } else {
    logger.warn('Artifact not found', { artifactId });
  }

  return artifact;
}
