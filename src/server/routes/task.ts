import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation.js';
import { taskService } from '../../services/task.js';
import { createTaskResponse } from '../../models/task.js';
import { isValidUUID } from '../../utils/uuid.js';
import { ValidationError } from '../../utils/errors.js';

const router = Router();

// Request validation schemas
const CreateTaskSchema = z.object({
  repositoryPath: z.string().min(1, 'Repository path is required'),
  identifier: z
    .string()
    .min(2, 'Identifier must be at least 2 characters')
    .max(100, 'Identifier must be at most 100 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Identifier must contain only alphanumeric characters, hyphens, and underscores'),
  config: z
    .object({
      batchSize: z.number().min(1).max(500).optional(),
      chunkSize: z.number().min(500).max(1500).optional(),
      chunkOverlap: z.number().min(0).max(500).optional(),
      embeddingModel: z.string().optional(),
      extensions: z.array(z.string()).optional(),
      excludeDirs: z.array(z.string()).optional(),
    })
    .optional(),
});

const TaskIdParamSchema = z.object({
  taskId: z.string().refine((val) => isValidUUID(val), {
    message: 'Invalid task ID format',
  }),
});

const IdentifierParamSchema = z.object({
  identifier: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid identifier format'),
});

// POST /task - Create extraction task
router.post(
  '/task',
  validate({ body: CreateTaskSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const task = await taskService.create(req.body);
      const response = createTaskResponse(task, true); // Return detailed info including totalFiles
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

// GET /task/:taskId - Get task status (backward compatibility)
router.get(
  '/task/:taskId',
  validate({ params: TaskIdParamSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const taskId = req.params.taskId as string;
      const task = await taskService.getById(taskId);
      const response = createTaskResponse(task, true);

      // Add percentage complete to progress
      if (response.data.attributes.progress) {
        const { currentBatch, totalBatches } = response.data.attributes.progress;
        const progressWithPercent = {
          ...response.data.attributes.progress,
          percentComplete: totalBatches > 0 ? Math.round((currentBatch / totalBatches) * 100) : 0,
        };
        response.data.attributes.progress = progressWithPercent;
      }

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// GET /task/by-identifier/:identifier - Get task by user-friendly identifier
router.get(
  '/task/by-identifier/:identifier',
  validate({ params: IdentifierParamSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const identifier = req.params.identifier as string;
      const task = await taskService.getByIdentifier(identifier);
      const response = createTaskResponse(task, true);

      // Add percentage complete to progress
      if (response.data.attributes.progress) {
        const { currentBatch, totalBatches } = response.data.attributes.progress;
        const progressWithPercent = {
          ...response.data.attributes.progress,
          percentComplete: totalBatches > 0 ? Math.round((currentBatch / totalBatches) * 100) : 0,
        };
        response.data.attributes.progress = progressWithPercent;
      }

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
