import type { ObjectId } from 'mongodb';

export interface Embedding {
  _id?: ObjectId;
  chunkId: string;
  taskId: string;
  vector: number[];
  model: string;
  createdAt: Date;
}

export const EMBEDDING_DIMENSIONS = 1536; // text-embedding-3-small dimensions
