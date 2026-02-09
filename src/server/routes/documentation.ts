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
import { getDocumentationPlansCollection } from '../../db/documentation-collections.js';
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

    // Add estimated duration and cost to meta
    const estimatedMinutes = Math.ceil((plan.progress.totalTasks * 2) / 60); // 2 min per task
    const estimatedCostPerTask = 0.25; // ~$0.25 per task average
    const estimatedTotalCost = plan.progress.totalTasks * estimatedCostPerTask;

    (response as any).meta = {
      estimatedDuration: `${estimatedMinutes * 60} minutes (${plan.progress.totalTasks} tasks × 2 min avg)`,
      planningCost: plan.planningCost
        ? {
            inputTokens: plan.planningCost.inputTokens,
            outputTokens: plan.planningCost.outputTokens,
            totalTokens: plan.planningCost.totalTokens,
            costUSD: `$${plan.planningCost.costUSD.toFixed(4)}`,
          }
        : null,
      estimatedExecutionCost: `$${estimatedTotalCost.toFixed(2)} (${plan.progress.totalTasks} tasks × $${estimatedCostPerTask} avg)`,
      totalEstimatedCost: plan.planningCost
        ? `$${(plan.planningCost.costUSD + estimatedTotalCost).toFixed(2)}`
        : `$${estimatedTotalCost.toFixed(2)}`,
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

    // T042: Add plan progress and cost info to meta
    const plan = await getPlanByIdentifier(req.body.identifier);
    if (plan) {
      // Get artifact to access cost info
      let costInfo = null;
      if (task.artifactRef) {
        const artifact = await getArtifactById(task.artifactRef);
        if (artifact?.llmCost) {
          costInfo = {
            inputTokens: artifact.llmCost.inputTokens,
            outputTokens: artifact.llmCost.outputTokens,
            totalTokens: artifact.llmCost.totalTokens,
            costUSD: `$${artifact.llmCost.costUSD.toFixed(4)}`,
          };
        }
      }

      (response as any).meta = {
        planProgress: {
          completed: plan.progress.completedTasks,
          remaining: plan.progress.totalTasks - plan.progress.completedTasks,
          percentComplete: Math.round((plan.progress.completedTasks / plan.progress.totalTasks) * 100),
        },
        message: `Task execution ${task.status === 'completed' ? 'completed' : 'failed'} for domain: ${task.domain}`,
        ...(costInfo && { llmCost: costInfo }),
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

/**
 * POST /documentation/export
 * Export all documentation artifacts as markdown files to repository's /docs folder
 */
router.post('/export', validate({ body: ExecuteDocumentationTaskSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('[EXPORT] Exporting documentation artifacts to /docs folder', { identifier: req.body.identifier });

    // Get plan
    const identifier = req.body.identifier;
    const plan = await getPlanByIdentifier(identifier);

    if (!plan) {
      return res.status(404).json({
        errors: [
          {
            status: '404',
            code: 'PLAN_NOT_FOUND',
            title: 'Plan Not Found',
            detail: `No documentation plan found with identifier: ${identifier}`,
          },
        ],
      });
    }

    // Get all completed tasks with artifacts
    const tasks = await getTasksForPlan(plan.planId, ['completed']);
    const artifactIds = tasks.map((t) => t.artifactRef).filter((id): id is string => id !== null);

    if (artifactIds.length === 0) {
      return res.status(400).json({
        errors: [
          {
            status: '400',
            code: 'NO_ARTIFACTS',
            title: 'No Artifacts to Export',
            detail: 'No completed documentation tasks found. Execute tasks before exporting.',
          },
        ],
      });
    }

    // Get repository path from extraction task
    const extractionTask = await (await import('../../services/task.js')).taskService.getByIdentifier(
      plan.repositoryIdentifier
    );

    if (!extractionTask) {
      return res.status(400).json({
        errors: [
          {
            status: '400',
            code: 'REPOSITORY_NOT_FOUND',
            title: 'Repository Not Found',
            detail: `Extraction task for repository ${plan.repositoryIdentifier} not found`,
          },
        ],
      });
    }

    const repositoryPath = extractionTask.repositoryPath;

    // Export all artifacts
    const { writeFileSync, mkdirSync, existsSync } = await import('fs');
    const { join } = await import('path');

    const docsDir = join(repositoryPath, 'docs');

    // Create /docs directory if it doesn't exist
    if (!existsSync(docsDir)) {
      mkdirSync(docsDir, { recursive: true });
      logger.info('Created /docs directory', { path: docsDir });
    }

    const exportedFiles: string[] = [];

    // Write each artifact as markdown file
    for (const artifactId of artifactIds) {
      const artifact = await getArtifactById(artifactId);

      if (!artifact) {
        logger.warn('Artifact not found', { artifactId });
        continue;
      }

      // Create filename from domain name (replace spaces with hyphens, lowercase)
      const filename = `${artifact.domainName.replace(/\s+/g, '-').toLowerCase()}.md`;
      const filePath = join(docsDir, filename);

      // Write markdown content to file
      writeFileSync(filePath, artifact.markdownContent, 'utf-8');

      exportedFiles.push(filename);

      logger.info('Exported artifact', {
        domain: artifact.domainName,
        filename,
        qualityScore: artifact.qualityScore,
      });
    }

    logger.info('[EXPORT] Documentation export complete', {
      identifier,
      exportedCount: exportedFiles.length,
      docsDir,
    });

    res.status(200).json({
      data: {
        type: 'export_result',
        attributes: {
          planId: plan.planId,
          identifier: plan.identifier,
          exportedCount: exportedFiles.length,
          docsDirectory: docsDir,
          files: exportedFiles,
        },
      },
      meta: {
        message: `Exported ${exportedFiles.length} documentation artifacts to ${docsDir}`,
      },
    });
  } catch (error: any) {
    logger.error('[EXPORT] Export failed', {
      error: error.message,
      identifier: req.body?.identifier,
    });
    next(error);
  }
});

/**
 * POST /documentation/source/configure
 * Configure external documentation sources (Confluence) for a plan
 * User Story 4 - T056
 *
 * CONFLUENCE FEATURE COMMENTED OUT - Not production ready
 */
/*
router.post('/source/configure', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('[US4] Configuring external source', { body: req.body });

    // T057: Validation for external source configuration
    const { planId, sourceType, configuration } = req.body;

    if (!planId || !sourceType || !configuration) {
      return res.status(400).json({
        errors: [
          {
            status: '400',
            code: 'INVALID_CONFIG',
            title: 'Invalid Configuration',
            detail: 'planId, sourceType, and configuration are required',
          },
        ],
      });
    }

    if (sourceType !== 'confluence') {
      return res.status(400).json({
        errors: [
          {
            status: '400',
            code: 'UNSUPPORTED_SOURCE_TYPE',
            title: 'Unsupported Source Type',
            detail: `Source type '${sourceType}' is not supported. Supported types: confluence`,
          },
        ],
      });
    }

    // Validate Confluence configuration
    if (!configuration.cloudId) {
      return res.status(400).json({
        errors: [
          {
            status: '400',
            code: 'MISSING_CLOUD_ID',
            title: 'Missing Cloud ID',
            detail: 'Confluence cloudId is required in configuration',
          },
        ],
      });
    }

    // Get plan by planId (UUID)
    const plansCollection = getDocumentationPlansCollection();
    const plan = await plansCollection.findOne({ planId });

    if (!plan) {
      return res.status(404).json({
        errors: [
          {
            status: '404',
            code: 'PLAN_NOT_FOUND',
            title: 'Plan Not Found',
            detail: `No documentation plan found with planId: ${planId}`,
          },
        ],
      });
    }

    // T058: Error handling for authentication expiry (delegated to MCP client)
    // Authentication is handled by MCP client - we only store cloudId (not credentials)
    const { v4: uuidv4 } = await import('uuid');
    const { createExternalSourceConfigResponse } = await import('../../models/external-source-config.js');

    const externalSourceConfig = {
      configId: uuidv4(),
      planId: plan.planId,
      sourceType: sourceType as 'confluence',
      enabled: true,
      connectionParams: {
        cloudId: configuration.cloudId,
      },
      authDelegation: {
        protocol: 'mcp' as const,
        upstreamServer: 'atlassian', // Confluence MCP server
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Update plan with external source configuration
    const plansCollectionForUpdate = getDocumentationPlansCollection();

    await plansCollectionForUpdate.updateOne(
      { planId: plan.planId },
      {
        $set: {
          externalSources: [externalSourceConfig],
          updatedAt: new Date(),
        },
      }
    );

    // T059: Add logging for external source integration
    logger.info('[US4] External source configured', {
      planId: plan.planId,
      sourceType,
      cloudId: configuration.cloudId,
      configId: externalSourceConfig.configId,
      configuredAt: externalSourceConfig.createdAt,
    });

    const response = createExternalSourceConfigResponse(externalSourceConfig);
    res.status(200).json(response);
  } catch (error: any) {
    logger.error('[US4] External source configuration failed', {
      error: error.message,
      planId: req.body?.planId,
    });
    next(error);
  }
});
*/

export default router;
