import type { ObjectId } from 'mongodb';

export interface Chunk {
  _id?: ObjectId;
  chunkId: string;
  taskId: string;
  fileId: string;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  tokenCount: number;
  createdAt: Date;
}

export interface ChunkMetadata {
  filePath: string;
  startLine: number;
  endLine: number;
  tokenCount: number;
}
