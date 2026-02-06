export interface JsonApiError {
  status: string;
  code: string;
  title: string;
  detail: string;
  meta?: Record<string, unknown>;
}

export interface JsonApiErrorResponse {
  errors: JsonApiError[];
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly meta?: Record<string, unknown>;

  constructor(message: string, statusCode: number, code: string, meta?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.meta = meta;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

// Predefined error types
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const detail = id ? `${resource} with ID '${id}' not found` : `${resource} not found`;
    super(detail, 404, `${resource.toUpperCase()}_NOT_FOUND`, id ? { id } : undefined);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, meta?: Record<string, unknown>) {
    super(message, 400, 'VALIDATION_ERROR', meta);
    this.name = 'ValidationError';
  }
}

export class InvalidPathError extends AppError {
  constructor(path: string) {
    super(`Invalid or inaccessible path: ${path}`, 400, 'INVALID_PATH', { path });
    this.name = 'InvalidPathError';
  }
}

export class ProcessingError extends AppError {
  constructor(message: string, meta?: Record<string, unknown>) {
    super(message, 500, 'PROCESSING_FAILED', meta);
    this.name = 'ProcessingError';
  }
}

export class OpenAIError extends AppError {
  constructor(message: string, meta?: Record<string, unknown>) {
    super(message, 502, 'OPENAI_ERROR', meta);
    this.name = 'OpenAIError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, meta?: Record<string, unknown>) {
    super(message, 503, 'DB_ERROR', meta);
    this.name = 'DatabaseError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, meta?: Record<string, unknown>) {
    super(message, 409, 'CONFLICT', meta);
    this.name = 'ConflictError';
  }
}

// Format error as JSON:API response
export function formatErrorResponse(error: AppError | Error): JsonApiErrorResponse {
  if (error instanceof AppError) {
    return {
      errors: [
        {
          status: String(error.statusCode),
          code: error.code,
          title: error.name,
          detail: error.message,
          meta: error.meta,
        },
      ],
    };
  }

  // Generic error handling
  return {
    errors: [
      {
        status: '500',
        code: 'INTERNAL_ERROR',
        title: 'Internal Server Error',
        detail: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message,
      },
    ],
  };
}

// Get HTTP status code from error
export function getStatusCode(error: Error): number {
  if (error instanceof AppError) {
    return error.statusCode;
  }
  return 500;
}
