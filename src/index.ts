import { createApp } from './server/app.js';
import { connectToDatabase, disconnectFromDatabase } from './db/client.js';
import { createIndexes } from './db/indexes.js';
import { getConfig } from './config/index.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  logger.info('Code Reader MCP Server starting...');

  // Load configuration
  const config = getConfig();

  // Connect to database
  await connectToDatabase();

  // Ensure indexes exist
  await createIndexes();

  // Create and start server
  const app = createApp();

  const server = app.listen(config.server.port, config.server.host, () => {
    logger.info(`Server listening on http://${config.server.host}:${config.server.port}`);
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown...`);

    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        await disconnectFromDatabase();
        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  logger.error('Fatal error during startup', { error: error.message, stack: error.stack });
  process.exit(1);
});
