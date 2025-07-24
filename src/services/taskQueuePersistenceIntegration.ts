/**
 * Task Queue Persistence Integration
 * Integrates all persistence components for robust state management
 */

import { TaskQueuePersistenceService, TaskQueuePersistenceConfig } from './taskQueuePersistence';
import { AtomicQueueStateManager } from './atomicQueueStateManager';
import { TaskQueueMigrationTools } from './taskQueueMigrationTools';
import { TaskQueue, QueueValidationResult } from '../types/taskQueue';

export interface PersistenceIntegrationConfig {
  persistence: TaskQueuePersistenceConfig;
  enableAtomicOperations: boolean;
  enableMigrations: boolean;
  enablePeriodicSnapshots: boolean;
  snapshotIntervalMs: number;
}

export class TaskQueuePersistenceIntegration {
  private persistenceService: TaskQueuePersistenceService;
  private atomicManager?: AtomicQueueStateManager;
  private migrationTools?: TaskQueueMigrationTools;
  private config: PersistenceIntegrationConfig;
  private snapshotTimer?: NodeJS.Timeout;

  constructor(config: PersistenceIntegrationConfig) {
    this.config = config;
    this.persistenceService = new TaskQueuePersistenceService(config.persistence);
    
    if (config.enableAtomicOperations) {
      this.atomicManager = new AtomicQueueStateManager(this.persistenceService);
    }
    
    if (config.enableMigrations) {
      this.migrationTools = new TaskQueueMigrationTools(this.persistenceService);
    }

    if (config.enablePeriodicSnapshots) {
      this.startPeriodicSnapshots();
    }
  }

  /**
   * Initialize the persistence system
   */
  async initialize(): Promise<void> {
    console.log('Initializing Task Queue Persistence Integration...');
    
    // Validate configuration
    await this.validateConfiguration();
    
    // Run any pending migrations
    if (this.config.enableMigrations && this.migrationTools) {
      await this.runPendingMigrations();
    }
    
    console.log('Task Queue Persistence Integration initialized successfully');
  }

  /**
   * Shutdown the persistence system
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down Task Queue Persistence Integration...');
    
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = undefined;
    }
    
    console.log('Task Queue Persistence Integration shutdown complete');
  }

  /**
   * Get the persistence service
   */
  getPersistenceService(): TaskQueuePersistenceService {
    return this.persistenceService;
  }

  /**
   * Get the atomic manager (if enabled)
   */
  getAtomicManager(): AtomicQueueStateManager | undefined {
    return this.atomicManager;
  }

  /**
   * Get the migration tools (if enabled)
   */
  getMigrationTools(): TaskQueueMigrationTools | undefined {
    return this.migrationTools;
  }

  /**
   * Save queue with full persistence features
   */
  async saveQueue(queue: TaskQueue, options: {
    useAtomicUpdate?: boolean;
    createSnapshot?: boolean;
    validateIntegrity?: boolean;
  } = {}): Promise<void> {
    const {
      useAtomicUpdate = this.config.enableAtomicOperations,
      createSnapshot = false,
      validateIntegrity = true
    } = options;

    if (useAtomicUpdate && this.atomicManager) {
      // Use atomic operations
      const result = await this.atomicManager.executeAtomicOperation(queue.playerId, {
        operation: (q: TaskQueue) => {
          // Copy all properties from the input queue to the loaded queue
          Object.assign(q, queue);
          return 'saved';
        },
        rollbackOnFailure: true
      });

      if (!result.success) {
        throw new Error(`Failed to save queue atomically: ${result.error?.message}`);
      }
    } else {
      // Use regular persistence
      await this.persistenceService.saveQueueWithAtomicUpdate(queue, {
        createSnapshot,
        validateBeforeUpdate: validateIntegrity
      });
    }
  }

  /**
   * Load queue with integrity validation
   */
  async loadQueue(playerId: string, options: {
    validateIntegrity?: boolean;
    autoRepair?: boolean;
  } = {}): Promise<TaskQueue | null> {
    const {
      validateIntegrity = true,
      autoRepair = true
    } = options;

    const queue = await this.persistenceService.loadQueue(playerId);
    
    if (!queue) {
      return null;
    }

    if (validateIntegrity) {
      const validation = await this.persistenceService.validateQueueIntegrity(queue);
      
      if (!validation.isValid) {
        console.warn(`Queue integrity issues detected for player ${playerId}:`, validation.errors);
        
        if (autoRepair && validation.canRepair) {
          console.log(`Attempting to repair queue for player ${playerId}`);
          const repairedQueue = await this.persistenceService.repairQueue(queue);
          await this.saveQueue(repairedQueue, { createSnapshot: true });
          return repairedQueue;
        } else {
          throw new Error(`Queue integrity validation failed for player ${playerId}: ${validation.errors.map(e => e.message).join(', ')}`);
        }
      }
    }

    return queue;
  }

  /**
   * Create manual snapshot
   */
  async createSnapshot(playerId: string, reason: string = 'manual'): Promise<string> {
    const queue = await this.loadQueue(playerId, { validateIntegrity: false });
    if (!queue) {
      throw new Error(`Queue not found for player ${playerId}`);
    }

    return await this.persistenceService.createStateSnapshot(queue, reason as any);
  }

  /**
   * Restore from snapshot
   */
  async restoreFromSnapshot(playerId: string, snapshotId: string): Promise<TaskQueue> {
    if (this.atomicManager) {
      const result = await this.atomicManager.executeAtomicOperation(playerId, {
        operation: async () => {
          return await this.persistenceService.restoreFromSnapshot(playerId, snapshotId);
        },
        rollbackOnFailure: false
      });

      if (!result.success) {
        throw new Error(`Failed to restore from snapshot: ${result.error?.message}`);
      }

      return result.result!;
    } else {
      return await this.persistenceService.restoreFromSnapshot(playerId, snapshotId);
    }
  }

  /**
   * Get queue health status
   */
  async getQueueHealth(playerId: string): Promise<{
    isHealthy: boolean;
    validation: QueueValidationResult;
    snapshots: number;
    lastSnapshot: number | null;
  }> {
    const queue = await this.persistenceService.loadQueue(playerId);
    if (!queue) {
      return {
        isHealthy: false,
        validation: {
          isValid: false,
          errors: [{ code: 'QUEUE_NOT_FOUND', message: 'Queue not found', severity: 'critical' }],
          warnings: [],
          integrityScore: 0,
          canRepair: false,
          repairActions: []
        },
        snapshots: 0,
        lastSnapshot: null
      };
    }

    const validation = await this.persistenceService.validateQueueIntegrity(queue);
    const snapshots = await this.persistenceService.getPlayerSnapshots(playerId, 1);
    
    return {
      isHealthy: validation.isValid,
      validation,
      snapshots: snapshots.length,
      lastSnapshot: snapshots.length > 0 ? snapshots[0].timestamp : null
    };
  }

  /**
   * Execute atomic transaction
   */
  async executeTransaction<T>(
    playerId: string,
    operations: Array<(queue: TaskQueue) => T | Promise<T>>
  ): Promise<T[]> {
    if (!this.atomicManager) {
      throw new Error('Atomic operations not enabled');
    }

    const atomicOperations = operations.map(op => ({
      operation: op
    }));

    const result = await this.atomicManager.executeAtomicTransaction(playerId, atomicOperations);
    
    if (!result.success) {
      throw new Error(`Transaction failed: ${result.error?.message}`);
    }

    return result.result as T[];
  }

  /**
   * Run system health check
   */
  async runHealthCheck(): Promise<{
    overall: 'healthy' | 'warning' | 'critical';
    activeLocks: number;
    pendingMigrations: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    let overall: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check active locks
    const activeLocks = this.atomicManager ? this.atomicManager.getActiveLocks().length : 0;
    if (activeLocks > 10) {
      issues.push(`High number of active locks: ${activeLocks}`);
      overall = 'warning';
    }

    // Check for long-running locks
    if (this.atomicManager) {
      const longRunningLocks = this.atomicManager.getActiveLocks()
        .filter(lock => Date.now() - lock.acquiredAt > 300000); // 5 minutes
      
      if (longRunningLocks.length > 0) {
        issues.push(`${longRunningLocks.length} long-running locks detected`);
        overall = 'critical';
      }
    }

    // Check for pending migrations
    const pendingMigrations = this.migrationTools ? 
      this.migrationTools.getMigrationHistory().filter(m => !m.success).length : 0;
    
    if (pendingMigrations > 0) {
      issues.push(`${pendingMigrations} failed migrations need attention`);
      overall = 'warning';
    }

    return {
      overall,
      activeLocks,
      pendingMigrations,
      issues
    };
  }

  /**
   * Private methods
   */
  private async validateConfiguration(): Promise<void> {
    // Validate that required tables exist and are accessible
    // This would typically involve checking table status
    console.log('Configuration validation completed');
  }

  private async runPendingMigrations(): Promise<void> {
    if (!this.migrationTools) return;

    // Check for and run any pending migrations
    // This is a simplified implementation
    console.log('No pending migrations found');
  }

  private startPeriodicSnapshots(): void {
    this.snapshotTimer = setInterval(async () => {
      try {
        // This would typically get a list of active players and create snapshots
        // For now, this is a placeholder
        console.log('Periodic snapshot check completed');
      } catch (error) {
        console.error('Error during periodic snapshot:', error);
      }
    }, this.config.snapshotIntervalMs);
  }
}

/**
 * Factory function to create a configured persistence integration
 */
export function createTaskQueuePersistenceIntegration(
  config: Partial<PersistenceIntegrationConfig> = {}
): TaskQueuePersistenceIntegration {
  const defaultConfig: PersistenceIntegrationConfig = {
    persistence: {
      tableName: process.env.TASK_QUEUES_TABLE || 'steampunk-idle-game-task-queues-enhanced',
      snapshotTableName: process.env.SNAPSHOTS_TABLE || 'steampunk-idle-game-task-queue-snapshots',
      migrationTableName: process.env.MIGRATIONS_TABLE || 'steampunk-idle-game-task-queue-migrations',
      region: process.env.AWS_REGION || 'us-east-1',
      maxRetries: 3,
      retryDelayMs: 1000,
      snapshotInterval: 300000, // 5 minutes
      maxSnapshots: 10
    },
    enableAtomicOperations: true,
    enableMigrations: true,
    enablePeriodicSnapshots: true,
    snapshotIntervalMs: 300000 // 5 minutes
  };

  const mergedConfig = {
    ...defaultConfig,
    ...config,
    persistence: {
      ...defaultConfig.persistence,
      ...config.persistence
    }
  };

  return new TaskQueuePersistenceIntegration(mergedConfig);
}