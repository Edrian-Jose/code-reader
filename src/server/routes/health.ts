import { Router, type Request, type Response } from 'express';
import { isConnected } from '../../db/client.js';

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  const dbConnected = await isConnected();

  const health = {
    status: dbConnected ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: dbConnected ? 'connected' : 'disconnected',
    },
  };

  const statusCode = dbConnected ? 200 : 503;
  res.status(statusCode).json(health);
});

export default router;
