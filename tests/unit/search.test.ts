import { describe, it, expect } from '@jest/globals';

// Helper function to test cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
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

describe('Search Service - Cosine Similarity', () => {
  describe('cosineSimilarity', () => {
    it('should calculate similarity for identical vectors', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2, 3];
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should calculate similarity for orthogonal vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(0.0, 5);
    });

    it('should calculate similarity for opposite vectors', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [-1, -2, -3];
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(-1.0, 5);
    });

    it('should handle zero vectors', () => {
      const zeroVec = [0, 0, 0];
      const normalVec = [1, 2, 3];
      const similarity = cosineSimilarity(zeroVec, normalVec);
      expect(similarity).toBe(0);
    });

    it('should handle normalized vectors', () => {
      // Unit vectors at 45 degrees
      const vec1 = [1 / Math.sqrt(2), 1 / Math.sqrt(2), 0];
      const vec2 = [1, 0, 0];
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(1 / Math.sqrt(2), 5);
    });

    it('should throw error for mismatched vector lengths', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2];
      expect(() => cosineSimilarity(vec1, vec2)).toThrow('Vectors must have the same length');
    });

    it('should work with high-dimensional vectors', () => {
      const dim = 1536; // OpenAI embedding dimension
      const vec1 = new Array(dim).fill(0.5);
      const vec2 = new Array(dim).fill(0.5);
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(1.0, 5);
    });
  });
});

