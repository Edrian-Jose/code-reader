import { getFilesCollection, getChunksCollection, getEmbeddingsCollection } from '../db/collections.js';
import { taskService } from './task.js';
import { fileScanner, type ScannedFile } from './scanner.js';
import { contentExtractor } from './extractor.js';
import { chunker } from './chunker.js';
import { embedder } from './embedder.js';
import { taskQueue } from './queue.js';
import { generateUUID } from '../utils/uuid.js';
import { logger } from '../utils/logger.js';
import { ProcessingError } from '../utils/errors.js';
import type { Task } from '../models/task.js';
import type { ProcessedFile } from '../models/file.js';
import type { Chunk } from '../models/chunk.js';
import type { Embedding } from '../models/embedding.js';

export class BatchProcessor {
  async startProcessing(taskId: string): Promise<void> {
    // Queue the task for processing
    taskQueue.enqueue(taskId, async () => {
      await this.processTask(taskId);
    });
  }

  private async processTask(taskId: string): Promise<void> {
    let task: Task;

    try {
      task = await taskService.getById(taskId);

      // Update status to processing
      task = await taskService.updateStatus(taskId, 'processing');

      // Scan repository
      const scanResult = await fileScanner.scan(task.repositoryPath, task.config);

      if (scanResult.files.length === 0) {
        logger.info(`No files to process for task ${taskId}`);
        await taskService.updateStatus(taskId, 'completed');
        return;
      }

      // Divide into batches
      const batches = fileScanner.divideBatches(scanResult.files, task.config.batchSize);

      // Update progress with total info
      await taskService.updateProgress(taskId, {
        totalFiles: scanResult.files.length,
        totalBatches: batches.length,
        currentBatch: task.progress.currentBatch, // Resume from where we left off
      });

      // Process batches starting from the last completed one
      const startBatch = task.progress.currentBatch;

      for (let i = startBatch; i < batches.length; i++) {
        logger.info(`Processing batch ${i + 1}/${batches.length} for task ${taskId}`);

        try {
          await this.processBatch(taskId, batches[i], i + 1, task.config);

          // Update progress after successful batch
          await taskService.updateProgress(taskId, {
            currentBatch: i + 1,
            processedFiles: (i + 1) * task.config.batchSize,
          });

          // Yield to event loop between batches
          await this.yield();
        } catch (error) {
          // Rollback partial batch data
          await this.rollbackBatch(taskId, i + 1);

          // Update task as failed
          await taskService.updateStatus(taskId, 'failed', (error as Error).message);
          throw error;
        }
      }

      // Mark as completed
      await taskService.updateProgress(taskId, {
        processedFiles: scanResult.files.length,
      });
      await taskService.updateStatus(taskId, 'completed');

      logger.info(`Task ${taskId} completed successfully`);
    } catch (error) {
      logger.error(`Task ${taskId} failed`, { error: (error as Error).message });
      throw error;
    }
  }

  private async processBatch(
    taskId: string,
    files: ScannedFile[],
    batchNumber: number,
    config: Task['config']
  ): Promise<void> {
    const processedFiles: ProcessedFile[] = [];
    const chunks: Chunk[] = [];
    const now = new Date();

    // Extract and chunk files
    for (const scannedFile of files) {
      const extracted = await contentExtractor.extract(scannedFile.filePath);

      if (!extracted) {
        continue; // Skip binary or unreadable files
      }

      const fileId = generateUUID();

      // Create processed file record
      const processedFile: ProcessedFile = {
        fileId,
        taskId,
        filePath: scannedFile.filePath,
        relativePath: scannedFile.relativePath,
        language: extracted.language,
        size: extracted.size,
        lines: extracted.lines,
        hash: extracted.hash,
        batchNumber,
        processedAt: now,
      };
      processedFiles.push(processedFile);

      // Chunk the content
      const fileChunks = chunker.chunk(extracted.content, scannedFile.relativePath, {
        chunkSize: config.chunkSize,
        chunkOverlap: config.chunkOverlap,
        language: extracted.language,
      });

      for (const chunk of fileChunks) {
        chunks.push({
          chunkId: generateUUID(),
          taskId,
          fileId,
          filePath: scannedFile.relativePath,
          content: chunk.content,
          startLine: chunk.metadata.startLine,
          endLine: chunk.metadata.endLine,
          tokenCount: chunk.metadata.tokenCount,
          createdAt: now,
        });
      }
    }

    if (chunks.length === 0) {
      logger.info(`Batch ${batchNumber}: No chunks generated (all files skipped)`);
      return;
    }

    // Generate embeddings
    const texts = chunks.map((c) => c.content);
    const embeddingResults = await embedder.embed(texts);

    // Create embedding records
    const embeddings: Embedding[] = embeddingResults.map((result, index) => ({
      chunkId: chunks[index].chunkId,
      taskId,
      vector: result.vector,
      model: config.embeddingModel,
      createdAt: now,
    }));

    // Persist everything atomically
    await this.persistBatch(processedFiles, chunks, embeddings);

    logger.info(
      `Batch ${batchNumber}: Processed ${processedFiles.length} files, created ${chunks.length} chunks`
    );
  }

  private async persistBatch(
    files: ProcessedFile[],
    chunks: Chunk[],
    embeddings: Embedding[]
  ): Promise<void> {
    try {
      // Insert in order: files -> chunks -> embeddings
      if (files.length > 0) {
        await getFilesCollection().insertMany(files);
      }
      if (chunks.length > 0) {
        await getChunksCollection().insertMany(chunks);
      }
      if (embeddings.length > 0) {
        await getEmbeddingsCollection().insertMany(embeddings);
      }
    } catch (error) {
      throw new ProcessingError(`Failed to persist batch: ${(error as Error).message}`);
    }
  }

  private async rollbackBatch(taskId: string, batchNumber: number): Promise<void> {
    logger.warn(`Rolling back batch ${batchNumber} for task ${taskId}`);

    try {
      // Get files from this batch
      const files = await getFilesCollection()
        .find({ taskId, batchNumber })
        .toArray();
      const fileIds = files.map((f) => f.fileId);

      // Delete embeddings for chunks from these files
      if (fileIds.length > 0) {
        const chunks = await getChunksCollection()
          .find({ fileId: { $in: fileIds } })
          .toArray();
        const chunkIds = chunks.map((c) => c.chunkId);

        if (chunkIds.length > 0) {
          await getEmbeddingsCollection().deleteMany({ chunkId: { $in: chunkIds } });
        }

        await getChunksCollection().deleteMany({ fileId: { $in: fileIds } });
      }

      await getFilesCollection().deleteMany({ taskId, batchNumber });

      logger.info(`Rollback complete for batch ${batchNumber}`);
    } catch (error) {
      logger.error(`Rollback failed for batch ${batchNumber}`, { error: (error as Error).message });
    }
  }

  private yield(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve));
  }
}

export const batchProcessor = new BatchProcessor();
