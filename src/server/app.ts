import express, { type Express } from 'express';
import healthRoutes from './routes/health.js';
import taskRoutes from './routes/task.js';
import processRoutes from './routes/process.js';
import searchRoutes from './routes/search.js';
import docsRoutes from './routes/docs.js';
import documentationRoutes from './routes/documentation.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { logger } from '../utils/logger.js';

export function createApp(): Express {
  const app = express();

  // Middleware
  app.use(express.json({ limit: '1mb' }));

  // Request logging
  app.use((req, _res, next) => {
    logger.debug(`${req.method} ${req.path}`, {
      query: req.query,
      contentLength: req.headers['content-length'],
    });
    next();
  });

  // Routes
  app.use(healthRoutes);
  app.use(taskRoutes);
  app.use(processRoutes);
  app.use(searchRoutes);
  app.use(docsRoutes);
  app.use('/documentation', documentationRoutes);

  // 404 handler
  app.use(notFoundHandler);

  // Error handler
  app.use(errorHandler);

  return app;
}
