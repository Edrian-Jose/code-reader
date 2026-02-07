import { get_encoding, type Tiktoken } from 'tiktoken';
import { logger } from '../utils/logger.js';
import type { ChunkMetadata } from '../models/chunk.js';

export interface ChunkResult {
  content: string;
  metadata: ChunkMetadata;
}

// Boundary detection patterns for different languages
const BOUNDARY_PATTERNS: Record<string, RegExp> = {
  typescript: /^(export\s+)?(async\s+)?(function|class|interface|type|const|let)\s+/,
  javascript: /^(export\s+)?(async\s+)?(function|class|const|let)\s+/,
  python: /^(def|class|async def)\s+/,
  go: /^(func|type)\s+/,
  rust: /^(fn|struct|impl|trait|enum)\s+/,
  java: /^(public|private|protected)?\s*(static)?\s*(class|interface|void|int|String)/,
  cpp: /^(class|struct|void|int|bool|template|namespace)\s+/,
  c: /^(void|int|char|struct|typedef)\s+/,
  markdown: /^#{1,6}\s+/,
};

export class Chunker {
  private encoder: Tiktoken | null = null;

  private getEncoder(): Tiktoken {
    if (!this.encoder) {
      this.encoder = get_encoding('cl100k_base');
    }
    return this.encoder;
  }

  countTokens(text: string): number {
    const encoder = this.getEncoder();
    return encoder.encode(text).length;
  }

  chunk(
    content: string,
    filePath: string,
    options: {
      chunkSize: number;
      chunkOverlap: number;
      language: string;
    }
  ): ChunkResult[] {
    const { chunkSize, chunkOverlap, language } = options;
    const lines = content.split('\n');
    const chunks: ChunkResult[] = [];

    let currentChunk: string[] = [];
    let currentTokens = 0;
    let startLine = 1;
    let previousOverlapLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineTokens = this.countTokens(line + '\n');

      // Check if adding this line would exceed the limit
      if (currentTokens + lineTokens > chunkSize && currentChunk.length > 0) {
        // Look for a good boundary to split at
        const splitIndex = this.findBoundary(currentChunk, language);

        if (splitIndex > 0 && splitIndex < currentChunk.length - 1) {
          // Split at boundary
          const chunkContent = currentChunk.slice(0, splitIndex).join('\n');
          const remainingLines = currentChunk.slice(splitIndex);

          chunks.push({
            content: chunkContent,
            metadata: {
              filePath,
              startLine,
              endLine: startLine + splitIndex - 1,
              tokenCount: this.countTokens(chunkContent),
            },
          });

          // Calculate overlap
          previousOverlapLines = this.getOverlapLines(currentChunk.slice(0, splitIndex), chunkOverlap);

          // Start new chunk with remaining lines plus overlap
          currentChunk = [...previousOverlapLines, ...remainingLines];
          startLine = startLine + splitIndex - previousOverlapLines.length;
          currentTokens = this.countTokens(currentChunk.join('\n'));
        } else {
          // No good boundary found, split at current position
          const chunkContent = currentChunk.join('\n');

          chunks.push({
            content: chunkContent,
            metadata: {
              filePath,
              startLine,
              endLine: startLine + currentChunk.length - 1,
              tokenCount: this.countTokens(chunkContent),
            },
          });

          // Calculate overlap
          previousOverlapLines = this.getOverlapLines(currentChunk, chunkOverlap);

          // Start new chunk with overlap
          currentChunk = [...previousOverlapLines];
          startLine = i + 1 - previousOverlapLines.length;
          currentTokens = this.countTokens(currentChunk.join('\n'));
        }
      }

      currentChunk.push(line);
      currentTokens += lineTokens;
    }

    // Don't forget the last chunk
    if (currentChunk.length > 0) {
      const chunkContent = currentChunk.join('\n');
      const tokenCount = this.countTokens(chunkContent);

      // Only add if not empty after trimming
      if (chunkContent.trim().length > 0) {
        chunks.push({
          content: chunkContent,
          metadata: {
            filePath,
            startLine,
            endLine: startLine + currentChunk.length - 1,
            tokenCount,
          },
        });
      }
    }

    logger.debug(`Chunked ${filePath}: ${lines.length} lines -> ${chunks.length} chunks`);
    return chunks;
  }

  private findBoundary(lines: string[], language: string): number {
    const pattern = BOUNDARY_PATTERNS[language] || BOUNDARY_PATTERNS.typescript;
    const maxLookback = 20;

    // Look backwards from the end for a boundary
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - maxLookback); i--) {
      if (pattern.test(lines[i].trimStart())) {
        return i;
      }
    }

    // No boundary found
    return -1;
  }

  private getOverlapLines(lines: string[], overlapTokens: number): string[] {
    if (overlapTokens <= 0 || lines.length === 0) {
      return [];
    }

    const overlapLines: string[] = [];
    let tokenCount = 0;

    // Work backwards to collect overlap lines
    for (let i = lines.length - 1; i >= 0 && tokenCount < overlapTokens; i--) {
      const lineTokens = this.countTokens(lines[i] + '\n');
      if (tokenCount + lineTokens <= overlapTokens) {
        overlapLines.unshift(lines[i]);
        tokenCount += lineTokens;
      } else {
        break;
      }
    }

    return overlapLines;
  }

  cleanup(): void {
    if (this.encoder) {
      this.encoder.free();
      this.encoder = null;
    }
  }
}

export const chunker = new Chunker();
