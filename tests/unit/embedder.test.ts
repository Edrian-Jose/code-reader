import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock response data
const mockEmbeddingResponse = {
  data: [
    { index: 0, embedding: new Array(1536).fill(0.1) },
    { index: 1, embedding: new Array(1536).fill(0.2) },
  ],
};

// Create the mock create function with proper typing
const mockCreate = jest.fn<() => Promise<{ data: { index: number; embedding: number[] }[] }>>();

// Mock OpenAI before importing Embedder
jest.mock('openai', () => {
  // Mock APIError class
  class MockAPIError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
      this.name = 'APIError';
    }
  }

  // Create a proper mock class that can be instantiated with `new`
  function MockOpenAI() {
    return {
      embeddings: {
        create: mockCreate,
      },
    };
  }

  // Add APIError as a static property
  MockOpenAI.APIError = MockAPIError;

  return {
    default: MockOpenAI,
    __esModule: true,
  };
});

// Import after mock is set up
import { Embedder } from '../../src/services/embedder.js';

describe('Embedder', () => {
  let embedder: Embedder;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
    mockCreate.mockResolvedValue(mockEmbeddingResponse);
    embedder = new Embedder();
  });

  it('should return empty array for empty input', async () => {
    const results = await embedder.embed([]);
    expect(results).toHaveLength(0);
  });

  it('should embed texts and return vectors', async () => {
    const texts = ['Hello world', 'Test text'];
    const results = await embedder.embed(texts);

    expect(results).toHaveLength(2);
    expect(results[0].index).toBe(0);
    expect(results[0].vector).toHaveLength(1536);
    expect(results[1].index).toBe(1);
    expect(results[1].vector).toHaveLength(1536);
  });

  it('should handle batch of texts', async () => {
    // For 25 texts, we need to mock multiple batches
    // Batch 1: 20 items, Batch 2: 5 items
    mockCreate
      .mockResolvedValueOnce({
        data: Array.from({ length: 20 }, (_, i) => ({
          index: i,
          embedding: new Array(1536).fill(0.1),
        })),
      })
      .mockResolvedValueOnce({
        data: Array.from({ length: 5 }, (_, i) => ({
          index: i,
          embedding: new Array(1536).fill(0.2),
        })),
      });

    const texts = Array(25).fill('Test text');
    const results = await embedder.embed(texts);

    // Should process in batches of 20
    expect(results).toHaveLength(25);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});
