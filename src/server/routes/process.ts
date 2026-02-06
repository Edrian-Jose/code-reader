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
  }),
});

// POST /process - Start or resume processing
router.post(
  '/process',
  validate({ body: ProcessRequestSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { taskId } = req.body;

      // Get task and validate status
      const task = await taskService.getById(taskId);

      // Check if task is already being processed or queued
      if (taskQueue.isTaskQueued(taskId)) {
        throw new ConflictError('Task is already being processed or is queued for processing', { taskId });
      }

      // Only allow processing of pending or failed tasks
      if (task.status !== 'pending' && task.status !== 'failed') {
        throw new ValidationError(
          `Cannot process task with status '${task.status}'. Only 'pending' or 'failed' tasks can be processed.`,
          { taskId, currentStatus: task.status }
        );
      }

      // Start processing (non-blocking)
      await batchProcessor.startProcessing(taskId);

      // Return immediately
      res.status(202).json({
        data: {
          type: 'process',
          attributes: {
            status: 'processing',
            message: 'Processing started',
            taskId,
            queuePosition: taskQueue.getQueueLength(),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
