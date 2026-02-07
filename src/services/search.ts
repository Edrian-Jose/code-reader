import { getEmbeddingsCollection, getChunksCollection } from '../db/collections.js';
import { embedder } from './embedder.js';
import { taskService } from './task.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import type { Chunk } from '../models/chunk.js';
import type { Embedding } from '../models/embedding.js';

export interface SearchResult {
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  score: number;
}

export interface SearchOptions {
  query: string;
  taskId: string;
  limit?: number;
  minScore?: number; // Minimum similarity score (0-1, default 0.7)
}

export class SearchService {
  private useAtlasSearch: boolean | null = null;

  /**
   * Performs semantic search over embedded code chunks.
   * Uses MongoDB Atlas Vector Search if available, otherwise falls back to in-memory cosine similarity.
   * Results are filtered by minimum similarity score (default 0.7).
   * @param options - Search parameters
   * @param options.query - Natural language search query
   * @param options.taskId - UUID of the task to search within
   * @param options.limit - Maximum number of results (1-100, default 10)
   * @param options.minScore - Minimum cosine similarity score (0-1, default 0.7)
   * @returns Array of search results with file paths, content, line numbers, and similarity scores
   * @throws ValidationError if query is empty, limit is out of range, or minScore is invalid
   * @throws NotFoundError if task doesn't exist
   */
  async search(options: SearchOptions): Promise<SearchResult[]> {
    const { query, taskId, limit = 10, minScore = 0.7 } = options;

    // Validate inputs
    if (!query || query.trim().length === 0) {
      throw new ValidationError('Search query is required');
    }

    if (limit < 1 || limit > 100) {
      throw new ValidationError('Limit must be between 1 and 100');
    }

    if (minScore < 0 || minScore > 1) {
      throw new ValidationError('minScore must be between 0 and 1');
    }

    // Verify task exists
    await taskService.getById(taskId);

    // Generate query embedding
    logger.debug(`Generating embedding for search query: "${query}"`);
    const queryEmbedding = await this.embedQuery(query);

    // Determine search method
    if (this.useAtlasSearch === null) {
      this.useAtlasSearch = await this.detectAtlasSearch();
    }

    // Perform search
    const allResults = this.useAtlasSearch
      ? await this.searchWithAtlas(taskId, queryEmbedding, limit, minScore)
      : await this.searchWithCosine(taskId, queryEmbedding, limit, minScore);

    // Filter by minimum score
    const filteredResults = allResults.filter((result) => result.score >= minScore);

    logger.info(
      `Search completed: ${filteredResults.length} results above ${minScore} threshold (${allResults.length} total) for task ${taskId}`
    );
    return filteredResults;
  }

  private async embedQuery(query: string): Promise<number[]> {
    const results = await embedder.embed([query]);

    if (results.length === 0) {
      throw new Error('Failed to generate query embedding');
    }

    return results[0].vector;
  }

  private async detectAtlasSearch(): Promise<boolean> {
    try {
      const collection = getEmbeddingsCollection();
      const db = collection.db;

      // Check if running on Atlas (cloud or local)
      const buildInfo = await db.admin().command({ buildInfo: 1 });
      const isAtlas =
        buildInfo.modules?.includes('enterprise') ||
        buildInfo.gitVersion?.includes('atlas') ||
        buildInfo.version >= '7.0'; // Atlas Local typically uses MongoDB 7.0+

      // Try to list Atlas Search indexes using the $listSearchIndexes aggregation
      let hasVectorIndex = false;
      try {
        const searchIndexes = await collection.aggregate([{ $listSearchIndexes: {} }]).toArray();

        logger.info(`Found ${searchIndexes.length} search index(es) on embeddings collection`);

        // Log all search indexes for debugging
        if (searchIndexes.length > 0) {
          searchIndexes.forEach((index: { name?: string; type?: string; status?: string }) => {
            logger.info(`  - Index "${index.name}": type=${index.type}, status=${index.status}`);
          });
        }

        hasVectorIndex = searchIndexes.some((index: { name?: string; type?: string; status?: string }) => {
          const isVectorSearch = index.type === 'vectorSearch';
          const isReady = index.status === 'READY' || index.status === 'ACTIVE';
          return isVectorSearch && isReady;
        });

        if (hasVectorIndex) {
          logger.info('✓ MongoDB Atlas Vector Search index is READY - using native vector search');
          return true;
        }

        // Check if vector index exists but is still building
        const buildingIndex = searchIndexes.find(
          (index: { name?: string; type?: string; status?: string }) =>
            index.type === 'vectorSearch' && (index.status === 'BUILDING' || index.status === 'PENDING')
        );

        if (buildingIndex) {
          logger.warn(`Vector search index "${buildingIndex.name}" is ${buildingIndex.status} - using fallback temporarily`);
          logger.warn('The index will be available once status changes to READY');
          logger.warn('This usually takes 1-5 minutes. Restart the server once ready.');
          logger.warn('Check status: db.embeddings.getSearchIndexes()');
          logger.warn('Using in-memory cosine similarity fallback for now');
          return false;
        }

        // If we got here, no vector search indexes found
        if (searchIndexes.length > 0 && isAtlas) {
          logger.warn(`Found ${searchIndexes.length} search index(es) but none are type "vectorSearch" with status READY`);
        }
      } catch (searchIndexError) {
        const errorMessage = searchIndexError instanceof Error ? searchIndexError.message : String(searchIndexError);
        logger.info('$listSearchIndexes aggregation failed:', errorMessage);
        logger.info('This usually means Atlas Search API is not available');
        // Fall through to check regular indexes
      }

      // Fallback: check regular indexes (won't find search indexes but worth trying)
      const regularIndexes = await collection.listIndexes().toArray();
      hasVectorIndex = regularIndexes.some((index) => {
        return (
          index.type === 'vectorSearch' ||
          index.type === 'search' ||
          (index as { mappings?: unknown }).mappings !== undefined
        );
      });

      if (hasVectorIndex) {
        logger.info('MongoDB Atlas Vector Search index detected - using native vector search');
        return true;
      }

      // If running on Atlas but no index found
      if (isAtlas) {
        logger.warn('MongoDB Atlas detected but no READY vector search index found');
        logger.warn('Create a search index named "vector_index" on the embeddings collection:');
        logger.warn('  mongosh> use code_reader;');
        logger.warn('  mongosh> db.embeddings.createSearchIndex({');
        logger.warn('    name: "vector_index", type: "vectorSearch",');
        logger.warn('    definition: { fields: [{ type: "vector", path: "vector", numDimensions: 1536, similarity: "cosine" }] }');
        logger.warn('  });');
        logger.warn('Using in-memory cosine similarity fallback for now');
      } else {
        logger.warn('No Atlas Vector Search index found - using in-memory cosine similarity fallback');
        logger.warn('For better performance with large datasets, use MongoDB Atlas or Atlas Local');
      }

      return false;
    } catch (error) {
      logger.warn('Could not detect Atlas Vector Search, using fallback', { error });
      return false;
    }
  }

  private async searchWithAtlas(
    taskId: string,
    queryVector: number[],
    limit: number,
    minScore: number
  ): Promise<SearchResult[]> {
    const collection = getEmbeddingsCollection();

    // MongoDB Atlas Vector Search aggregation
    const pipeline = [
      {
        $vectorSearch: {
          index: 'vector_index', // Atlas vector search index name
          path: 'vector',
          queryVector: queryVector,
          numCandidates: Math.min(limit * 10, 1000),
          limit: limit,
          filter: { taskId: { $eq: taskId } },
        },
      },
      {
        $addFields: {
          score: { $meta: 'vectorSearchScore' },
        },
      },
      {
        $project: {
          chunkId: 1,
          score: 1,
        },
      },
    ];

    const searchResults = await collection.aggregate(pipeline).toArray();

    // Map to full results with chunk data
    const scoredResults = searchResults.map((doc) => ({
      chunkId: doc.chunkId as string,
      score: doc.score as number,
    }));

    return this.mapToResults(scoredResults);
  }

  private async searchWithCosine(
    taskId: string,
    queryVector: number[],
    limit: number,
    minScore: number
  ): Promise<SearchResult[]> {
    const collection = getEmbeddingsCollection();

    // Fetch all embeddings for this task
    const embeddings = await collection.find({ taskId }).toArray();

    if (embeddings.length === 0) {
      return [];
    }

    logger.debug(`Computing cosine similarity for ${embeddings.length} embeddings`);

    // Calculate cosine similarity for each embedding
    const scored = embeddings.map((embedding) => ({
      chunkId: embedding.chunkId,
      score: this.cosineSimilarity(queryVector, embedding.vector),
    }));

    // Sort by score descending and take top N
    scored.sort((a, b) => b.score - a.score);
    const topResults = scored.slice(0, limit);

    // Map to full results
    return this.mapToResults(topResults);
  }

  private async mapToResults(
    scoredResults: Array<{ chunkId: string; score: number }>
  ): Promise<SearchResult[]> {
    const chunksCollection = getChunksCollection();
    const results: SearchResult[] = [];

    for (const item of scoredResults) {
      const chunk = await chunksCollection.findOne({ chunkId: item.chunkId });

      if (chunk) {
        results.push({
          filePath: chunk.filePath,
          content: chunk.content,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          score: item.score,
        });
      }
    }

    return results;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);

    if (magnitude === 0) {
      return 0;
    }

    return dotProduct / magnitude;
  }
}

// Export singleton instance
export const searchService = new SearchService();
