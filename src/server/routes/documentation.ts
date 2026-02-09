/**
 * Documentation generation routes
 * Handles endpoints for creating documentation plans, executing tasks, and retrieving artifacts
 */

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { validate, CreateDocumentationPlanSchema, ExecuteDocumentationTaskSchema, PlanIdentifierParamSchema, ArtifactIdParamSchema } from '../middleware/validation.js';
import { createDocumentationPlan, getPlanByIdentifier, getTasksForPlan } from '../../services/documentation-planner.js';
import { executeNextTask, getArtifactById } from '../../services/documentation-executor.js';
import { createPlanResponse } from '../../models/documentation-plan.js';
import { createTaskResponse } from '../../models/documentation-task.js';
import { createArtifactResponse } from '../../models/documentation-artifact.js';
import { logger } from '../../utils/logger.js';

const router = express.Router();

/**
 * POST /documentation/plan
 * Create documentation plan (User Story 1 - T024)
 * TODO: T025 - Add validation middleware
 * TODO: T026 - Add error handling
 * TODO: T027 - Add comprehensive logging
 */
router.post('/plan', validate({ body: CreateDocumentationPlanSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('[US1] Creating documentation plan', { body: req.body });

    // T024: Call createDocumentationPlan service
    const plan = await createDocumentationPlan(req.body);
    const response = createPlanResponse(plan, true);

    // T027: Comprehensive logging
    logger.info('[US1] Documentation plan created', {
      planId: plan.planId,
      identifier: plan.identifier,
      taskCount: plan.progress.totalTasks,
      version: plan.version,
    });

    // Add estimated duration to meta
    const estimatedMinutes = Math.ceil((plan.progress.totalTasks * 2) / 60); // 2 min per task
    response.meta = {
      estimatedDuration: `${estimatedMinutes * 60} minutes (${plan.progress.totalTasks} tasks × 2 min avg)`,
    };

    res.status(201).json(response);
  } catch (error: any) {
    // T026: Handle specific errors
    logger.error('[US1] Plan creation failed', {
      error: error.message,
      identifier: req.body?.identifier,
    });
    next(error);
  }
});

/**
 * POST /documentation/execute
 * Execute next documentation task (User Story 2 - T039)
 * TODO: T040 - Add execution validation
 * TODO: T041 - Add error handling with continuation logic
 * TODO: T042 - Add lifecycle logging
 */
router.post('/execute', validate({ body: ExecuteDocumentationTaskSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('[US2] Executing documentation task', { identifier: req.body.identifier });

    // T039: Call executeNextTask service
    const task = await executeNextTask(req.body.identifier);

    // T040: Validation - no ready tasks available
    if (!task) {
      return res.status(400).json({
        errors: [
          {
            status: '400',
            code: 'NO_READY_TASKS',
            title: 'No Ready Tasks',
            detail: 'All tasks are either completed, failed, or have unsatisfied dependencies',
          },
        ],
      });
    }

    const response = createTaskResponse(task);

    // T042: Add plan progress to meta
    const plan = await getPlanByIdentifier(req.body.identifier);
    if (plan) {
      (response as any).meta = {
        planProgress: {
          completed: plan.progress.completedTasks,
          remaining: plan.progress.totalTasks - plan.progress.completedTasks,
          percentComplete: Math.round((plan.progress.completedTasks / plan.progress.totalTasks) * 100),
        },
        message: `Task execution ${task.status === 'completed' ? 'completed' : 'failed'} for domain: ${task.domain}`,
      };
    }

    res.status(200).json(response);
  } catch (error: any) {
    // T041: Handle task failures with continuation logic
    logger.error('[US2] Task execution error', {
      error: error.message,
      identifier: req.body?.identifier,
    });
    next(error);
  }
});

/**
 * GET /documentation/plan/:identifier
 * Get plan status with task list (User Story 3 - T043)
 */
router.get('/plan/:identifier', validate({ params: PlanIdentifierParamSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // T043, T045: Implement plan status query
    const identifier = Array.isArray(req.params.identifier) ? req.params.identifier[0] : req.params.identifier;
    const plan = await getPlanByIdentifier(identifier);

    if (!plan) {
      return res.status(404).json({
        errors: [
          {
            status: '404',
            code: 'PLAN_NOT_FOUND',
            title: 'Plan Not Found',
            detail: `No documentation plan found with identifier: ${req.params.identifier}`,
          },
        ],
      });
    }

    // Get all tasks for this plan
    const tasks = await getTasksForPlan(plan.planId);

    const response = createPlanResponse(plan, true);

    // Add task relationships
    response.data.relationships = {
      tasks: {
        data: tasks.map((t) => ({
          type: 'documentation_task' as const,
          id: t.taskId,
          attributes: {
            domain: t.domain,
            status: t.status,
            priorityScore: t.priorityScore,
            artifactRef: t.artifactRef,
          },
        })),
      },
    };

    logger.info('[US3] Plan status retrieved', {
      identifier: req.params.identifier,
      planId: plan.planId,
      taskCount: tasks.length,
    });

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /documentation/artifact/:artifactId
 * Retrieve generated documentation artifact (User Story 3 - T044)
 */
router.get('/artifact/:artifactId', validate({ params: ArtifactIdParamSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // T044, T046: Implement artifact retrieval
    const artifactId = Array.isArray(req.params.artifactId) ? req.params.artifactId[0] : req.params.artifactId;
    const artifact = await getArtifactById(artifactId);

    if (!artifact) {
      return res.status(404).json({
        errors: [
          {
            status: '404',
            code: 'ARTIFACT_NOT_FOUND',
            title: 'Artifact Not Found',
            detail: `No documentation artifact found with ID: ${artifactId}`,
          },
        ],
      });
    }

    // T047: Content negotiation support
    const acceptHeader = req.headers.accept || 'application/json';
    const contentType = acceptHeader.includes('text/markdown') ? 'markdown' : 'json';

    const response = createArtifactResponse(artifact, contentType);

    logger.info('[US3] Artifact retrieved', {
      artifactId,
      domain: artifact.domainName,
      contentType,
    });

    // Set appropriate content type header
    if (contentType === 'markdown') {
      res.setHeader('Content-Type', 'text/markdown');
      res.send(artifact.markdownContent);
    } else {
      res.status(200).json(response);
    }
  } catch (error) {
    next(error);
  }
});

export default router;
