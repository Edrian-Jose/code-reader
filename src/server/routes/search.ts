import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation.js';
import { searchService } from '../../services/search.js';
import { taskService } from '../../services/task.js';
import { isValidUUID } from '../../utils/uuid.js';

const router = Router();

// Request validation schema
const SearchRequestSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  taskId: z.string().refine((val) => isValidUUID(val), {
    message: 'Invalid task ID format',
  }).optional(),
  identifier: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),
  limit: z.number().int().min(1).max(100).optional().default(10),
  minScore: z.number().min(0).max(1).optional().default(0.7), // Minimum similarity score threshold
}).refine(
  (data) => data.taskId || data.identifier,
  { message: 'Either taskId or identifier must be provided' }
);

// POST /search_code - Search embedded code
router.post(
  '/search_code',
  validate({ body: SearchRequestSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { query, taskId, identifier, limit, minScore } = req.body;

      // Get task by taskId or identifier
      const task = taskId ? await taskService.getById(taskId) : await taskService.getByIdentifier(identifier);

      // Perform search using the task's actual taskId
      const results = await searchService.search({ query, taskId: task.taskId, limit, minScore });

      // Format JSON:API response
      const response = {
        data: {
          type: 'search_results',
          attributes: {
            query,
            taskId: task.taskId,
            identifier: task.identifier,
            minScore: minScore || 0.7,
            resultCount: results.length,
            results: results.map((result) => ({
              filePath: result.filePath,
              content: result.content,
              startLine: result.startLine,
              endLine: result.endLine,
              score: result.score,
            })),
          },
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
