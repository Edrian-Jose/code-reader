import { readFile } from 'fs/promises';
import { extname } from 'path';
import { hashContent } from '../utils/hash.js';
import { logger } from '../utils/logger.js';
import { getLanguageFromExtension } from '../models/file.js';

export interface ExtractedContent {
  content: string;
  language: string;
  hash: string;
  lines: number;
  size: number;
}

export class ContentExtractor {
  async extract(filePath: string): Promise<ExtractedContent | null> {
    try {
      // Read file as buffer first to check for binary content
      const buffer = await readFile(filePath);

      // Check for binary content (null bytes in first 8KB)
      if (this.isBinaryContent(buffer)) {
        logger.debug(`Skipped binary file: ${filePath}`);
        return null;
      }

      // Convert to string
      const content = buffer.toString('utf-8');

      // Get language from extension
      const extension = extname(filePath);
      const language = getLanguageFromExtension(extension);

      // Calculate hash
      const hash = hashContent(content);

      // Count lines
      const lines = content.split('\n').length;

      return {
        content,
        language,
        hash,
        lines,
        size: buffer.length,
      };
    } catch (error) {
      logger.warn(`Failed to extract content from ${filePath}`, { error: (error as Error).message });
      return null;
    }
  }

  private isBinaryContent(buffer: Buffer): boolean {
    // Check first 8KB for null bytes
    const checkLength = Math.min(buffer.length, 8192);

    for (let i = 0; i < checkLength; i++) {
      if (buffer[i] === 0) {
        return true;
      }
    }

    return false;
  }
}

export const contentExtractor = new ContentExtractor();
