import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { loadConfig, resetConfig, ConfigSchema, applyConfigDefaults } from '../../src/config/index.js';

describe('Config Loader', () => {
  beforeEach(() => {
    resetConfig();
  });

  afterEach(() => {
    resetConfig();
  });

  it('should load default configuration', () => {
    const config = loadConfig();

    expect(config.mongodb.uri).toBe('mongodb://localhost:27017');
    expect(config.mongodb.database).toBe('code_reader');
    expect(config.server.port).toBe(3100);
    expect(config.extraction.batchSize).toBe(50);
    expect(config.openai.embeddingModel).toBe('text-embedding-3-small');
  });

  it('should validate config schema', () => {
    const validConfig = {
      mongodb: { uri: 'mongodb://localhost:27017', database: 'test' },
      server: { port: 3000, host: 'localhost' },
    };

    const result = ConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('should reject invalid port numbers', () => {
    const invalidConfig = {
      server: { port: 99999, host: 'localhost' },
    };

    const result = ConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });

  it('should reject invalid batch size', () => {
    const invalidConfig = {
      extraction: { batchSize: 1000 }, // max is 500
    };

    const result = ConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });

  it('should apply default values for missing fields', () => {
    const partialConfig = {};
    const parsed = ConfigSchema.parse(partialConfig);
    const result = applyConfigDefaults(parsed);

    expect(result.mongodb.uri).toBe('mongodb://localhost:27017');
    expect(result.extraction.chunkSize).toBe(1000);
    expect(result.logging.level).toBe('info');
  });
});
