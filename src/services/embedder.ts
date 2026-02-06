import OpenAI from 'openai';
import { getConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { OpenAIError } from '../utils/errors.js';

const MAX_BATCH_SIZE = 20;
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;
const MAX_DELAY_MS = 60000;

export interface EmbeddingResult {
  index: number;
  vector: number[];
}

export class Embedder {
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new OpenAIError('OPENAI_API_KEY environment variable is not set');
      }
      this.client = new OpenAI({ apiKey });
    }
    return this.client;
  }

  async embed(texts: string[]): Promise<EmbeddingResult[]> {
    if (texts.length === 0) {
      return [];
    }

    const config = getConfig();
    const model = config.openai.embeddingModel;

    // Split into batches
    const batches: string[][] = [];
    for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
      batches.push(texts.slice(i, i + MAX_BATCH_SIZE));
    }

    const results: EmbeddingResult[] = [];
    let globalIndex = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const batchResults = await this.embedBatchWithRetry(batch, model, batchIndex);

      for (const result of batchResults) {
        results.push({
          index: globalIndex + result.index,
          vector: result.embedding,
        });
      }

      globalIndex += batch.length;
    }

    return results;
  }

  private async embedBatchWithRetry(
    texts: string[],
    model: string,
    batchIndex: number
  ): Promise<OpenAI.Embeddings.Embedding[]> {
    let lastError: Error | null = null;
    let delay = INITIAL_DELAY_MS;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        logger.debug(`Embedding batch ${batchIndex + 1}, attempt ${attempt}/${MAX_RETRIES}`);

        const client = this.getClient();
        const response = await client.embeddings.create({
          model,
          input: texts,
        });

        logger.debug(`Batch ${batchIndex + 1} embedded successfully: ${response.data.length} vectors`);
        return response.data;
      } catch (error) {
        lastError = error as Error;
        const errorMessage = lastError.message || 'Unknown error';

        // Check for rate limiting
        if (this.isRateLimitError(error)) {
          logger.warn(`Rate limit hit for batch ${batchIndex + 1}, waiting ${delay}ms before retry`);
          await this.sleep(delay);
          delay = Math.min(delay * 2, MAX_DELAY_MS);
          continue;
        }

        // Check for server errors
        if (this.isServerError(error)) {
          logger.warn(`Server error for batch ${batchIndex + 1}: ${errorMessage}, retrying in ${delay}ms`);
          await this.sleep(delay);
          delay = Math.min(delay * 2, MAX_DELAY_MS);
          continue;
        }

        // For other errors, don't retry
        logger.error(`Embedding batch ${batchIndex + 1} failed: ${errorMessage}`);
        throw new OpenAIError(`Embedding failed: ${errorMessage}`);
      }
    }

    throw new OpenAIError(`Failed to embed batch after ${MAX_RETRIES} attempts: ${lastError?.message}`);
  }

  private isRateLimitError(error: unknown): boolean {
    // Check using OpenAI.APIError if available, or duck-type check for status property
    if (OpenAI.APIError && error instanceof OpenAI.APIError) {
      return error.status === 429;
    }
    // Fallback: duck-type check for error objects with status
    if (error && typeof error === 'object' && 'status' in error) {
      return (error as { status: number }).status === 429;
    }
    return false;
  }

  private isServerError(error: unknown): boolean {
    // Check using OpenAI.APIError if available, or duck-type check for status property
    if (OpenAI.APIError && error instanceof OpenAI.APIError) {
      return error.status >= 500 && error.status < 600;
    }
    // Fallback: duck-type check for error objects with status
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as { status: number }).status;
      return status >= 500 && status < 600;
    }
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const embedder = new Embedder();
