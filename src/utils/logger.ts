import winston from 'winston';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const { combine, timestamp, printf, colorize, json } = winston.format;

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] ${level}: ${message}${metaStr}`;
});

// Get log configuration from environment or defaults
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_DIR = process.env.LOG_DIR || 'logs';
const MAX_FILE_SIZE = parseInt(process.env.LOG_MAX_FILE_SIZE || '10485760', 10); // 10MB
const MAX_FILES = parseInt(process.env.LOG_MAX_FILES || '5', 10);

// Ensure log directory exists
if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true });
}

// Create transports array
const transports: winston.transport[] = [
  // Console transport with colors
  new winston.transports.Console({
    format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), consoleFormat),
  }),
];

// Add file transport for non-test environments
if (process.env.NODE_ENV !== 'test') {
  transports.push(
    // Rotating file transport
    new winston.transports.File({
      filename: join(LOG_DIR, 'error.log'),
      level: 'error',
      format: combine(timestamp(), json()),
      maxsize: MAX_FILE_SIZE,
      maxFiles: MAX_FILES,
    }),
    new winston.transports.File({
      filename: join(LOG_DIR, 'combined.log'),
      format: combine(timestamp(), json()),
      maxsize: MAX_FILE_SIZE,
      maxFiles: MAX_FILES,
    })
  );
}

// Create the logger instance
export const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: combine(timestamp(), json()),
  transports,
  exitOnError: false,
});

// Export a stream for use with Morgan (if needed for HTTP logging)
export const loggerStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};
