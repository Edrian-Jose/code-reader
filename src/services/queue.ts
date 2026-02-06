import { logger } from '../utils/logger.js';

type QueuedTask = {
  taskId: string;
  execute: () => Promise<void>;
};

export class TaskQueue {
  private queue: QueuedTask[] = [];
  private isProcessing = false;
  private currentTaskId: string | null = null;

  enqueue(taskId: string, execute: () => Promise<void>): void {
    this.queue.push({ taskId, execute });
    logger.info(`Task ${taskId} added to queue. Queue length: ${this.queue.length}`);
    this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const task = this.queue.shift()!;
    this.currentTaskId = task.taskId;

    logger.info(`Processing task ${task.taskId} from queue. Remaining: ${this.queue.length}`);

    try {
      await task.execute();
      logger.info(`Task ${task.taskId} completed`);
    } catch (error) {
      logger.error(`Task ${task.taskId} failed`, { error: (error as Error).message });
    } finally {
      this.currentTaskId = null;
      this.isProcessing = false;
      // Process next task in queue
      setImmediate(() => this.processNext());
    }
  }

  getCurrentTaskId(): string | null {
    return this.currentTaskId;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  isTaskQueued(taskId: string): boolean {
    return this.queue.some((t) => t.taskId === taskId) || this.currentTaskId === taskId;
  }
}

export const taskQueue = new TaskQueue();
