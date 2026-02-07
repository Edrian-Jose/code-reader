import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { config as loadDotenv } from 'dotenv';
import { ConfigSchema, applyConfigDefaults, type Config } from './schema.js';

// Load .env file
loadDotenv();

let cachedConfig: Config | null = null;

export function loadConfig(configPath?: string): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  const defaultConfigPath = join(process.cwd(), 'config.json');
  const filePath = configPath || defaultConfigPath;

  let fileConfig: Record<string, unknown> = {};

  if (existsSync(filePath)) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      fileConfig = JSON.parse(content);
    } catch (error) {
      console.warn(`Warning: Could not parse config file at ${filePath}`);
    }
  }

  // Apply environment variable overrides
  const envOverrides: Record<string, unknown> = {};

  // MongoDB connection handling with fallback support
  const mongoConfig = (fileConfig.mongodb as Record<string, unknown>) || {};

  if (process.env.MONGODB_URI) {
    // Legacy: Single URI overrides everything
    envOverrides.mongodb = {
      ...mongoConfig,
      uri: process.env.MONGODB_URI,
    };
  } else {
    // Dual connection: Atlas primary, Local fallback
    const updates: Record<string, unknown> = {};

    if (process.env.MONGODB_ATLAS_URI) {
      updates.atlasUri = process.env.MONGODB_ATLAS_URI;
    }

    if (process.env.MONGODB_LOCAL_URI) {
      updates.localUri = process.env.MONGODB_LOCAL_URI;
    }

    if (Object.keys(updates).length > 0) {
      envOverrides.mongodb = {
        ...mongoConfig,
        ...updates,
      };
    }
  }

  if (process.env.CODE_READER_PORT) {
    envOverrides.server = {
      ...(fileConfig.server as Record<string, unknown> || {}),
      port: parseInt(process.env.CODE_READER_PORT, 10),
    };
  }

  if (process.env.LOG_LEVEL) {
    envOverrides.logging = {
      ...(fileConfig.logging as Record<string, unknown> || {}),
      level: process.env.LOG_LEVEL,
    };
  }

  if (process.env.OPENAI_BASE_URL) {
    envOverrides.openai = {
      ...(fileConfig.openai as Record<string, unknown> || {}),
      baseURL: process.env.OPENAI_BASE_URL,
    };
  }

  // Merge configs: defaults < file config < env overrides
  const mergedConfig = {
    ...fileConfig,
    ...envOverrides,
  };

  // Validate and parse with Zod
  const result = ConfigSchema.safeParse(mergedConfig);

  if (!result.success) {
    throw new Error(`Invalid configuration: ${result.error.message}`);
  }

  // Apply defaults to all config sections
  cachedConfig = applyConfigDefaults(result.data);
  return cachedConfig;
}

export function getConfig(): Config {
  if (!cachedConfig) {
    return loadConfig();
  }
  return cachedConfig;
}

export function resetConfig(): void {
  cachedConfig = null;
}

export * from './schema.js';
