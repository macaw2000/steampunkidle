/**
 * Atomic Queue State Manager
 * Provides atomic operations for task queue state updates to prevent corruption
 */

import { TaskQueue, Task, QueueStateSnapshot, QueueValidationResult } from '../types/taskQueue';
import { TaskQueuePersistenceService } from './taskQueuePersistence';
import { createHash } from 'crypto';

export interface AtomicOperation<T> {
  operation: (queue: TaskQueue) => Promise<T> | T;
  retryCount?: number;
  timeout?: number;
  rollbackOnFailure?: boolean;
}

export interface AtomicTransactionResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  retryCount: number;
  duration: number;
  rollbackPerformed: boolean;
}

export interface QueueLock {
  playerId: string;
  lockId: string;
  acquiredAt: number;
  expiresAt: number;
  operation: string;
}

export class AtomicQueueStateManager {
  private persistenceService: TaskQueuePersistenceService;
  private activeLocks: Map<string, QueueLock> = new Map();
  private lockTimeout: number = 30000; // 30 seconds
  private maxRetries: number = 3;
  private retryDelayMs: number = 1000;

  constructor(persistenceService: TaskQueuePersistenceService) {
    this.persistenceService = persistenceService;
    
    // Clean up expired locks every 10 seconds
    setInterval(() => this.cleanupExpiredLocks(), 10000);
  }

  /**
   * Execute an atomic operation on a task queue with optimistic locking
   */
  async executeAtomicOperation<T>(
    playerId: string,
    operation: AtomicOperation<T>
  ): Promise<AtomicTransactionResult<T>> {
    const startTime = Date.now();
    let retryCount = 0;
    let rollbackPerformed = false;
    const maxRetries = operation.retryCount ?? this.maxRetries;
    const timeout = operation.timeout ?? this.lockTimeout;

    // Acquire lock
    const lockId = await this.acquireLock(playerId, operation.operation.name || 'unknown', timeout);
    
    try {
      while (retryCount < maxRetries) {
        try {
          // Load current queue state
          const currentQueue = await this.persistenceService.loadQueue(playerId);
          if (!currentQueue) {
            throw new Error(`Queue not found for player ${playerId}`);
          }

          // Create snapshot before operation
          const preOperationSnapshot = this.createStateSnapshot(currentQueue);

          // Execute the operation
          const result = await operation.operation(currentQueue);

          // Validate the updated queue
          const validation = await this.persistenceService.validateQueueIntegrity(currentQueue);
          if (!validation.isValid) {
            throw new Error(`Queue validation failed after operation: ${validation.errors.map(e => e.message).join(', ')}`);
          }

          // Save the updated queue with atomic update
          await this.persistenceService.saveQueueWithAtomicUpdate(currentQueue, {
            validateBeforeUpdate: true,
            createSnapshot: true
          });

          return {
            success: true,
            result,
            retryCount,
            duration: Date.now() - startTime,
            rollbackPerformed
          };

        } catch (error: any) {
          retryCount++;
          
          if (retryCount >= maxRetries) {
            // Attempt rollback if requested
            if (operation.rollbackOnFailure) {
              try {
                await this.rollbackToLastSnapshot(playerId);
                rollbackPerformed = true;
              } catch (rollbackError: any) {
                console.error(`Rollback failed for player ${playerId}:`, rollbackError);
              }
            }
            
            return {
              success: false,
              error: error as Error,
              retryCount,
              duration: Date.now() - startTime,
              rollbackPerformed
            };
          }
          
          // Exponential backoff
          await this.delay(this.retryDelayMs * Math.pow(2, retryCount - 1));
        }
      }

      throw new Error('Unexpected end of retry loop');

    } finally {
      // Release lock
      await this.releaseLock(playerId, lockId);
    }
  }

  /**
   * Execute multiple atomic operations as a transaction
   */
  async executeAtomicTransaction<T>(
    playerId: string,
    operations: AtomicOperation<any>[]
  ): Promise<AtomicTransactionResult<T[]>> {
    const startTime = Date.now();
    const results: any[] = [];
    let rollbackPerformed = false;

    // Acquire lock for the entire transaction
    const lockId = await this.acquireLock(playerId, 'transaction', this.lockTimeout * operations.length);

    try {
      // Create initial snapshot
      const initialQueue = await this.persistenceService.loadQueue(playerId);
      if (!initialQueue) {
        throw new Error(`Queue not found for player ${playerId}`);
      }

      const initialSnapshot = this.createStateSnapshot(initialQueue);

      // Execute operations sequentially
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        
        try {
          const currentQueue = await this.persistenceService.loadQueue(playerId);
          if (!currentQueue) {
            throw new Error(`Queue not found for player ${playerId} during transaction step ${i}`);
          }

          const result = await operation.operation(currentQueue);
          results.push(result);

          // Validate after each operation
          const validation = await this.persistenceService.validateQueueIntegrity(currentQueue);
          if (!validation.isValid) {
            throw new Error(`Queue validation failed at transaction step ${i}: ${validation.errors.map(e => e.message).join(', ')}`);
          }

          // Save intermediate state
          await this.persistenceService.saveQueueWithAtomicUpdate(currentQueue, {
            validateBeforeUpdate: false, // Already validated above
            createSnapshot: false // Will create final snapshot at end
          });

        } catch (error: any) {
          // Rollback entire transaction
          try {
            await this.restoreFromSnapshot(playerId, initialSnapshot);
            rollbackPerformed = true;
          } catch (rollbackError: any) {
            console.error(`Transaction rollback failed for player ${playerId}:`, rollbackError);
          }

          return {
            success: false,
            error: error as Error,
            retryCount: 0,
            duration: Date.now() - startTime,
            rollbackPerformed
          };
        }
      }

      // Create final snapshot after successful transaction
      const finalQueue = await this.persistenceService.loadQueue(playerId);
      if (finalQueue) {
        await this.persistenceService.createStateSnapshot(finalQueue, 'manual');
      }

      return {
        success: true,
        result: results,
        retryCount: 0,
        duration: Date.now() - startTime,
        rollbackPerformed
      };

    } finally {
      await this.releaseLock(playerId, lockId);
    }
  }

  /**
   * Acquire a distributed lock for queue operations
   */
  private async acquireLock(playerId: string, operation: string, timeoutMs: number): Promise<string> {
    const lockId = `${playerId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = Date.now() + timeoutMs;

    // Check if player already has an active lock
    const existingLock = this.activeLocks.get(playerId);
    if (existingLock && existingLock.expiresAt > Date.now()) {
      throw new Error(`Player ${playerId} already has an active lock for operation: ${existingLock.operation}`);
    }

    const lock: QueueLock = {
      playerId,
      lockId,
      acquiredAt: Date.now(),
      expiresAt,
      operation
    };

    this.activeLocks.set(playerId, lock);
    return lockId;
  }

  /**
   * Release a distributed lock
   */
  private async releaseLock(playerId: string, lockId: string): Promise<void> {
    const lock = this.activeLocks.get(playerId);
    if (lock && lock.lockId === lockId) {
      this.activeLocks.delete(playerId);
    }
  }

  /**
   * Clean up expired locks
   */
  private cleanupExpiredLocks(): void {
    const now = Date.now();
    for (const [playerId, lock] of this.activeLocks.entries()) {
      if (lock.expiresAt <= now) {
        this.activeLocks.delete(playerId);
        console.warn(`Cleaned up expired lock for player ${playerId}, operation: ${lock.operation}`);
      }
    }
  }

  /**
   * Create a state snapshot for rollback purposes
   */
  private createStateSnapshot(queue: TaskQueue): QueueStateSnapshot {
    return {
      timestamp: Date.now(),
      currentTaskId: queue.currentTask?.id || null,
      queuedTaskIds: queue.queuedTasks.map(t => t.id),
      isRunning: queue.isRunning,
      isPaused: queue.isPaused,
      pauseReason: queue.pauseReason,
      totalTasksCompleted: queue.totalTasksCompleted,
      checksum: this.calculateChecksum(queue)
    };
  }

  /**
   * Restore queue from a state snapshot
   */
  private async restoreFromSnapshot(playerId: string, snapshot: QueueStateSnapshot): Promise<void> {
    const currentQueue = await this.persistenceService.loadQueue(playerId);
    if (!currentQueue) {
      throw new Error(`Cannot restore: Queue not found for player ${playerId}`);
    }

    // Restore basic state
    currentQueue.isRunning = snapshot.isRunning;
    currentQueue.isPaused = snapshot.isPaused;
    currentQueue.pauseReason = snapshot.pauseReason;
    currentQueue.totalTasksCompleted = snapshot.totalTasksCompleted;

    // Restore current task
    if (snapshot.currentTaskId) {
      const currentTask = currentQueue.queuedTasks.find(t => t.id === snapshot.currentTaskId);
      currentQueue.currentTask = currentTask || null;
    } else {
      currentQueue.currentTask = null;
    }

    // Restore queued tasks order
    const restoredTasks = snapshot.queuedTaskIds
      .map(id => currentQueue.queuedTasks.find(t => t.id === id))
      .filter((task): task is Task => task !== undefined);
    
    currentQueue.queuedTasks = restoredTasks;

    // Update metadata
    currentQueue.lastUpdated = Date.now();
    currentQueue.version += 1;
    currentQueue.checksum = this.calculateChecksum(currentQueue);

    // Save restored state
    await this.persistenceService.saveQueueWithAtomicUpdate(currentQueue, {
      validateBeforeUpdate: false,
      createSnapshot: false
    });
  }

  /**
   * Rollback to the most recent snapshot
   */
  private async rollbackToLastSnapshot(playerId: string): Promise<void> {
    const snapshots = await this.persistenceService.getPlayerSnapshots(playerId, 1);
    if (snapshots.length === 0) {
      throw new Error(`No snapshots available for rollback for player ${playerId}`);
    }

    const latestSnapshot = snapshots[0];
    await this.persistenceService.restoreFromSnapshot(playerId, latestSnapshot.snapshotId);
  }

  /**
   * Calculate checksum for queue state
   */
  private calculateChecksum(queue: TaskQueue): string {
    const stableData = {
      playerId: queue.playerId,
      currentTaskId: queue.currentTask?.id || null,
      queuedTaskIds: queue.queuedTasks.map(t => t.id).sort(),
      isRunning: queue.isRunning,
      isPaused: queue.isPaused,
      totalTasksCompleted: queue.totalTasksCompleted
    };
    
    return createHash('sha256')
      .update(JSON.stringify(stableData))
      .digest('hex');
  }

  /**
   * Utility method for delays
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get lock status for a player
   */
  public getLockStatus(playerId: string): QueueLock | null {
    const lock = this.activeLocks.get(playerId);
    if (lock && lock.expiresAt > Date.now()) {
      return lock;
    }
    return null;
  }

  /**
   * Force release a lock (admin function)
   */
  public async forceReleaseLock(playerId: string): Promise<boolean> {
    const lock = this.activeLocks.get(playerId);
    if (lock) {
      this.activeLocks.delete(playerId);
      console.warn(`Force released lock for player ${playerId}, operation: ${lock.operation}`);
      return true;
    }
    return false;
  }

  /**
   * Get all active locks (monitoring function)
   */
  public getActiveLocks(): QueueLock[] {
    const now = Date.now();
    return Array.from(this.activeLocks.values()).filter(lock => lock.expiresAt > now);
  }
}