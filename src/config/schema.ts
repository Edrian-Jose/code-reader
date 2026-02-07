import { z } from 'zod';

export const MongoDbConfigSchema = z.object({
  uri: z.string().default('mongodb://localhost:27017'),
  database: z.string().default('code_reader'),
});

export const OpenAIConfigSchema = z.object({
  embeddingModel: z.string().default('text-embedding-3-small'),
  baseURL: z.string().optional(), // Optional custom API endpoint (e.g., Azure OpenAI, proxy)
});

export const ExtractionConfigSchema = z.object({
  batchSize: z.number().min(1).max(500).default(50),
  maxFileSize: z.number().default(1048576), // 1MB
  chunkSize: z.number().min(500).max(1500).default(1000),
  chunkOverlap: z.number().min(0).max(500).default(100),
  extensions: z
    .array(z.string())
    .default(['.js', '.ts', '.py', '.go', '.rs', '.java', '.cpp', '.c', '.h', '.md', '.json', '.yaml', '.yml']),
  excludeDirs: z.array(z.string()).default(['node_modules', '.git', 'dist', 'build']),
});

export const ServerConfigSchema = z.object({
  port: z.number().min(1).max(65535).default(3100),
  host: z.string().default('localhost'),
});

export const LoggingConfigSchema = z.object({
  level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  directory: z.string().default('logs'),
  maxFileSize: z.number().default(10 * 1024 * 1024), // 10MB
  maxFiles: z.number().default(5),
});

export const ConfigSchema = z.object({
  mongodb: MongoDbConfigSchema.optional(),
  openai: OpenAIConfigSchema.optional(),
  extraction: ExtractionConfigSchema.optional(),
  server: ServerConfigSchema.optional(),
  logging: LoggingConfigSchema.optional(),
});

// Helper to apply defaults to config
export function applyConfigDefaults(config: z.infer<typeof ConfigSchema>): Config {
  return {
    mongodb: MongoDbConfigSchema.parse(config.mongodb ?? {}),
    openai: OpenAIConfigSchema.parse(config.openai ?? {}),
    extraction: ExtractionConfigSchema.parse(config.extraction ?? {}),
    server: ServerConfigSchema.parse(config.server ?? {}),
    logging: LoggingConfigSchema.parse(config.logging ?? {}),
  };
}

export type Config = {
  mongodb: z.infer<typeof MongoDbConfigSchema>;
  openai: z.infer<typeof OpenAIConfigSchema>;
  extraction: z.infer<typeof ExtractionConfigSchema>;
  server: z.infer<typeof ServerConfigSchema>;
  logging: z.infer<typeof LoggingConfigSchema>;
};

export type MongoDbConfig = z.infer<typeof MongoDbConfigSchema>;
export type OpenAIConfig = z.infer<typeof OpenAIConfigSchema>;
export type ExtractionConfig = z.infer<typeof ExtractionConfigSchema>;
export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
