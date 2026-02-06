import type { Request, Response, NextFunction } from 'express';
import { z, type ZodSchema } from 'zod';
import { ValidationError } from '../../utils/errors.js';

export interface ValidationSchemas {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

export function validate(schemas: ValidationSchemas) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }

      if (schemas.params) {
        const validated = await schemas.params.parseAsync(req.params);
        Object.assign(req.params, validated);
      }

      if (schemas.query) {
        const validated = await schemas.query.parseAsync(req.query);
        Object.assign(req.query, validated);
      }

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        next(new ValidationError(`Validation failed: ${details}`, { errors: error.issues }));
      } else {
        next(error);
      }
    }
  };
}

// Common validation schemas
export const UUIDParamSchema = z.object({
  id: z.string().uuid('Invalid task ID format'),
});

export const TaskIdParamSchema = z.object({
  taskId: z.string().uuid('Invalid task ID format'),
});
