import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation.js';
import { taskService } from '../../services/task.js';
import { batchProcessor } from '../../services/processor.js';
import { taskQueue } from '../../services/queue.js';
import { isValidUUID } from '../../utils/uuid.js';
import { ValidationError, ConflictError } from '../../utils/errors.js';

const router = Router();

// Request validation schema
const ProcessRequestSchema = z.object({
  taskId: z.string().refine((val) => isValidUUID(val), {
    message: 'Invalid task ID format',
  }).optional(),
  identifier: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),
  fileLimit: z.number().int().min(1).optional(), // Max files to process before stopping
}).refine(
  (data) => data.taskId || data.identifier,
  { message: 'Either taskId or identifier must be provided' }
);

const StopProcessingSchema = z.object({
  taskId: z.string().refine((val) => isValidUUID(val), {
    message: 'Invalid task ID format',
  }).optional(),
  identifier: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),
}).refine(
  (data) => data.taskId || data.identifier,
  { message: 'Either taskId or identifier must be provided' }
);

// POST /process - Start or resume processing
router.post(
  '/process',
  validate({ body: ProcessRequestSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { taskId, identifier, fileLimit } = req.body;

      // Get task by taskId or identifier
      const task = taskId ? await taskService.getById(taskId) : await taskService.getByIdentifier(identifier);

      // Check if task is already being processed or queued
      if (taskQueue.isTaskQueued(task.taskId)) {
        throw new ConflictError('Task is already being processed or is queued for processing', {
          taskId: task.taskId,
        });
      }

      // Only allow processing of pending or failed tasks
      if (task.status !== 'pending' && task.status !== 'failed') {
        throw new ValidationError(
          `Cannot process task with status '${task.status}'. Only 'pending' or 'failed' tasks can be processed.`,
          { taskId: task.taskId, currentStatus: task.status }
        );
      }

      // Start processing with optional file limit (non-blocking)
      await batchProcessor.startProcessing(task.taskId, fileLimit);

      // Return immediately
      res.status(202).json({
        data: {
          type: 'process',
          attributes: {
            status: 'processing',
            message: fileLimit
              ? `Processing started (max ${fileLimit} files)`
              : 'Processing started',
            taskId: task.taskId,
            identifier: task.identifier,
            fileLimit: fileLimit || null,
            queuePosition: taskQueue.getQueueLength(),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /process/stop - Stop processing
router.post(
  '/process/stop',
  validate({ body: StopProcessingSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { taskId, identifier } = req.body;

      // Get task by taskId or identifier
      const task = taskId ? await taskService.getById(taskId) : await taskService.getByIdentifier(identifier);

      // Stop the processing
      const stopped = await batchProcessor.stopProcessing(task.taskId);

      if (!stopped) {
        throw new ValidationError('Task is not currently being processed', { taskId: task.taskId });
      }

      res.json({
        data: {
          type: 'process',
          attributes: {
            status: 'stopped',
            message: 'Processing will stop after current batch completes',
            taskId: task.taskId,
            identifier: task.identifier,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
