import type { Collection, Document } from 'mongodb';
import { getDatabase } from './client.js';
import type { Task } from '../models/task.js';
import type { ProcessedFile } from '../models/file.js';
import type { Chunk } from '../models/chunk.js';
import type { Embedding } from '../models/embedding.js';

export const COLLECTION_NAMES = {
  TASKS: 'tasks',
  FILES: 'files',
  CHUNKS: 'chunks',
  EMBEDDINGS: 'embeddings',
} as const;

export function getTasksCollection(): Collection<Task> {
  return getDatabase().collection<Task>(COLLECTION_NAMES.TASKS);
}

export function getFilesCollection(): Collection<ProcessedFile> {
  return getDatabase().collection<ProcessedFile>(COLLECTION_NAMES.FILES);
}

export function getChunksCollection(): Collection<Chunk> {
  return getDatabase().collection<Chunk>(COLLECTION_NAMES.CHUNKS);
}

export function getEmbeddingsCollection(): Collection<Embedding> {
  return getDatabase().collection<Embedding>(COLLECTION_NAMES.EMBEDDINGS);
}

export function getCollection<T extends Document>(name: string): Collection<T> {
  return getDatabase().collection<T>(name);
}
