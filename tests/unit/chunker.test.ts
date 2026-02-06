import { describe, it, expect, afterAll } from '@jest/globals';
import { Chunker } from '../../src/services/chunker.js';

describe('Chunker', () => {
  const chunker = new Chunker();

  afterAll(() => {
    chunker.cleanup();
  });

  describe('countTokens', () => {
    it('should count tokens in text', () => {
      const text = 'Hello, world!';
      const count = chunker.countTokens(text);
      expect(count).toBeGreaterThan(0);
    });

    it('should return consistent counts for same text', () => {
      const text = 'function test() { return 42; }';
      const count1 = chunker.countTokens(text);
      const count2 = chunker.countTokens(text);
      expect(count1).toBe(count2);
    });
  });

  describe('chunk', () => {
    it('should create chunks from small file', () => {
      const content = `function hello() {
  console.log("Hello");
}

function world() {
  console.log("World");
}`;

      const chunks = chunker.chunk(content, 'test.ts', {
        chunkSize: 1000,
        chunkOverlap: 100,
        language: 'typescript',
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.startLine).toBe(1);
      expect(chunks[0].metadata.filePath).toBe('test.ts');
    });

    it('should create multiple chunks for large file', () => {
      // Create a file with many functions
      const functions = [];
      for (let i = 0; i < 50; i++) {
        functions.push(`function func${i}() {
  const x = ${i};
  const y = x * 2;
  const z = y + x;
  console.log(z);
  return z;
}`);
      }
      const content = functions.join('\n\n');

      const chunks = chunker.chunk(content, 'large.ts', {
        chunkSize: 200,
        chunkOverlap: 20,
        language: 'typescript',
      });

      expect(chunks.length).toBeGreaterThan(1);

      // Check that chunks don't exceed token limit too much
      for (const chunk of chunks) {
        // Allow some flexibility for boundary detection
        expect(chunk.metadata.tokenCount).toBeLessThan(400);
      }
    });

    it('should track line numbers correctly', () => {
      const content = `line 1
line 2
line 3
line 4
line 5`;

      const chunks = chunker.chunk(content, 'test.txt', {
        chunkSize: 1000,
        chunkOverlap: 0,
        language: 'markdown',
      });

      expect(chunks[0].metadata.startLine).toBe(1);
      expect(chunks[0].metadata.endLine).toBe(5);
    });

    it('should handle empty content', () => {
      const chunks = chunker.chunk('', 'empty.ts', {
        chunkSize: 1000,
        chunkOverlap: 100,
        language: 'typescript',
      });

      expect(chunks).toHaveLength(0);
    });

    it('should handle whitespace-only content', () => {
      const chunks = chunker.chunk('   \n\n   ', 'whitespace.ts', {
        chunkSize: 1000,
        chunkOverlap: 100,
        language: 'typescript',
      });

      expect(chunks).toHaveLength(0);
    });
  });
});
