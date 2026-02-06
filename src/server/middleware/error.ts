import type { Request, Response, NextFunction } from 'express';
import { formatErrorResponse, getStatusCode, AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = getStatusCode(error);
  const errorResponse = formatErrorResponse(error);

  // Log the error
  if (statusCode >= 500) {
    logger.error('Server error', {
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
    });
  } else {
    logger.warn('Client error', {
      error: error.message,
      code: error instanceof AppError ? error.code : 'UNKNOWN',
      path: req.path,
      method: req.method,
    });
  }

  res.status(statusCode).json(errorResponse);
}

export function notFoundHandler(req: Request, res: Response): void {
  const errorResponse = {
    errors: [
      {
        status: '404',
        code: 'ROUTE_NOT_FOUND',
        title: 'Not Found',
        detail: `Route ${req.method} ${req.path} not found`,
      },
    ],
  };

  res.status(404).json(errorResponse);
}
