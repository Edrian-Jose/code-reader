import { glob } from 'glob';
import { stat, lstat, realpath } from 'fs/promises';
import { join, relative, extname } from 'path';
import { logger } from '../utils/logger.js';
import type { TaskConfig } from '../models/task.js';

export interface ScannedFile {
  filePath: string;
  relativePath: string;
  size: number;
  extension: string;
}

export interface ScanResult {
  files: ScannedFile[];
  skippedFiles: {
    path: string;
    reason: string;
  }[];
  totalScanned: number;
}

export class FileScanner {
  private visitedPaths: Set<string> = new Set();

  async scan(repositoryPath: string, config: TaskConfig): Promise<ScanResult> {
    this.visitedPaths.clear();
    const result: ScanResult = {
      files: [],
      skippedFiles: [],
      totalScanned: 0,
    };

    // Build glob patterns for supported extensions
    const patterns = config.extensions.map((ext) => `**/*${ext}`);

    // Build ignore patterns for excluded directories
    const ignorePatterns = config.excludeDirs.map((dir) => `**/${dir}/**`);

    logger.info(`Scanning repository: ${repositoryPath}`);
    logger.debug('Patterns:', { patterns, ignorePatterns });

    try {
      const files = await glob(patterns, {
        cwd: repositoryPath,
        ignore: ignorePatterns,
        nodir: true,
        absolute: false,
        follow: true, // Follow symlinks
      });

      logger.info(`Found ${files.length} files matching patterns`);

      for (const relativePath of files) {
        result.totalScanned++;
        const filePath = join(repositoryPath, relativePath);

        try {
          // Check for circular symlinks
          const isCircular = await this.isCircularSymlink(filePath);
          if (isCircular) {
            result.skippedFiles.push({
              path: relativePath,
              reason: 'Circular symlink detected',
            });
            logger.debug(`Skipped circular symlink: ${relativePath}`);
            continue;
          }

          // Get file stats
          const stats = await stat(filePath);

          // Check file size
          if (stats.size > config.maxFileSize) {
            result.skippedFiles.push({
              path: relativePath,
              reason: `File exceeds maximum size (${stats.size} > ${config.maxFileSize})`,
            });
            logger.warn(`Skipped oversized file: ${relativePath} (${stats.size} bytes)`);
            continue;
          }

          // Skip empty files
          if (stats.size === 0) {
            result.skippedFiles.push({
              path: relativePath,
              reason: 'Empty file',
            });
            logger.debug(`Skipped empty file: ${relativePath}`);
            continue;
          }

          result.files.push({
            filePath,
            relativePath,
            size: stats.size,
            extension: extname(relativePath).toLowerCase(),
          });
        } catch (error) {
          result.skippedFiles.push({
            path: relativePath,
            reason: `Error accessing file: ${(error as Error).message}`,
          });
          logger.debug(`Error accessing file: ${relativePath}`, { error });
        }
      }

      logger.info(`Scan complete: ${result.files.length} files to process, ${result.skippedFiles.length} skipped`);
      return result;
    } catch (error) {
      logger.error('Error scanning repository', { error, repositoryPath });
      throw error;
    }
  }

  private async isCircularSymlink(filePath: string): Promise<boolean> {
    try {
      const lstats = await lstat(filePath);

      if (!lstats.isSymbolicLink()) {
        return false;
      }

      const realPath = await realpath(filePath);

      if (this.visitedPaths.has(realPath)) {
        return true;
      }

      this.visitedPaths.add(realPath);
      return false;
    } catch {
      // If we can't resolve the symlink, treat it as circular
      return true;
    }
  }

  divideBatches(files: ScannedFile[], batchSize: number): ScannedFile[][] {
    const batches: ScannedFile[][] = [];

    for (let i = 0; i < files.length; i += batchSize) {
      batches.push(files.slice(i, i + batchSize));
    }

    return batches;
  }
}

export const fileScanner = new FileScanner();
