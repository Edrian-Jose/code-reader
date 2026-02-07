import type { ObjectId } from 'mongodb';

export interface ProcessedFile {
  _id?: ObjectId;
  fileId: string;
  taskId: string;
  filePath: string;
  relativePath: string;
  language: string;
  size: number;
  lines: number;
  hash: string;
  batchNumber: number;
  processedAt: Date;
}

export const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.js': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.cpp': 'cpp',
  '.c': 'c',
  '.h': 'c',
  '.md': 'markdown',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
};

export function getLanguageFromExtension(extension: string): string {
  return EXTENSION_TO_LANGUAGE[extension.toLowerCase()] || 'unknown';
}
