/**
 * Task Queue Data Migration Tools
 * Handles schema updates and data migrations for task queue system
 */

import { TaskQueue } from '../types/taskQueue';
import { TaskQueuePersistenceService, MigrationRecord } from './taskQueuePersistence';

export interface MigrationDefinition {
  id: string;
  name: string;
  description: string;
  fromVersion: number;
  toVersion: number;
  migrationFunction: (queue: TaskQueue) => TaskQueue;
  rollbackFunction?: (queue: TaskQueue) => TaskQueue;
  validationFunction?: (queue: TaskQueue) => boolean;
  dryRun?: boolean;
}

export interface MigrationPlan {
  migrations: MigrationDefinition[];
  totalSteps: number;
  estimatedDuration: number;
  affectedPlayers: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface MigrationResult {
  migrationId: string;
  success: boolean;
  processedPlayers: number;
  failedPlayers: string[];
  duration: number;
  errors: string[];
  rollbackAvailable: boolean;
}

export class TaskQueueMigrationTools {
  private persistenceService: TaskQueuePersistenceService;
  private migrationHistory: Map<string, MigrationResult> = new Map();

  constructor(persistenceService: TaskQueuePersistenceService) {
    this.persistenceService = persistenceService;
  }

  /**
   * Predefined migration definitions for common schema updates
   */
  private getMigrationDefinitions(): { [key: string]: MigrationDefinition } {
    return {
      // Migration from version 1 to 2: Add queue configuration
      'v1_to_v2_add_config': {
        id: 'v1_to_v2_add_config',
        name: 'Add Queue Configuration',
        description: 'Add configuration object to existing queues',
        fromVersion: 1,
        toVersion: 2,
        migrationFunction: (queue: TaskQueue) => {
          return {
            ...queue,
            config: {
              maxQueueSize: 50,
              maxTaskDuration: 24 * 60 * 60 * 1000, // 24 hours
              maxTotalQueueDuration: 7 * 24 * 60 * 60 * 1000, // 7 days
              autoStart: true,
              priorityHandling: false,
              retryEnabled: true,
              maxRetries: 3,
              validationEnabled: true,
              syncInterval: 5000,
              offlineProcessingEnabled: true,
              pauseOnError: true,
              resumeOnResourceAvailable: true,
              persistenceInterval: 30000,
              integrityCheckInterval: 300000,
              maxHistorySize: 100
            },
            version: 2
          };
        },
        rollbackFunction: (queue: TaskQueue) => {
          return {
            ...queue,
            version: 1,
            // Remove v2 specific properties if any
            config: {
              maxQueueSize: 50,
              maxTaskDuration: 24 * 60 * 60 * 1000,
              maxTotalQueueDuration: 7 * 24 * 60 * 60 * 1000,
              autoStart: true,
              priorityHandling: false,
              retryEnabled: true,
              maxRetries: 3,
              validationEnabled: true,
              syncInterval: 5000,
              offlineProcessingEnabled: true,
              pauseOnError: true,
              resumeOnResourceAvailable: true,
              persistenceInterval: 30000,
              integrityCheckInterval: 300000,
              maxHistorySize: 10
            }
          };
        },
        validationFunction: (queue: TaskQueue) => {
          return queue.version === 2 && queue.config !== undefined;
        }
      },

      // Migration from version 2 to 3: Add state history tracking
      'v2_to_v3_add_history': {
        id: 'v2_to_v3_add_history',
        name: 'Add State History Tracking',
        description: 'Add state history and integrity tracking to queues',
        fromVersion: 2,
        toVersion: 3,
        migrationFunction: (queue: TaskQueue) => {
          return {
            ...queue,
            stateHistory: [],
            maxHistorySize: queue.config?.maxHistorySize || 100,
            lastValidated: Date.now(),
            checksum: this.calculateChecksum(queue),
            version: 3
          };
        },
        rollbackFunction: (queue: TaskQueue) => {
          return {
            ...queue,
            version: 2,
            // Keep required properties but reset to v2 defaults
            stateHistory: [],
            maxHistorySize: 10,
            lastValidated: Date.now(),
            checksum: ''
          };
        },
        validationFunction: (queue: TaskQueue) => {
          return queue.version === 3 && 
                 Array.isArray(queue.stateHistory) && 
                 typeof queue.lastValidated === 'number' &&
                 typeof queue.checksum === 'string';
        }
      },

      // Migration from version 3 to 4: Enhanced task validation
      'v3_to_v4_enhanced_validation': {
        id: 'v3_to_v4_enhanced_validation',
        name: 'Enhanced Task Validation',
        description: 'Add enhanced validation fields to tasks',
        fromVersion: 3,
        toVersion: 4,
        migrationFunction: (queue: TaskQueue) => {
          const updatedTasks = queue.queuedTasks.map(task => ({
            ...task,
            isValid: true,
            validationErrors: [],
            retryCount: task.retryCount || 0,
            maxRetries: task.maxRetries || 3
          }));

          const updatedCurrentTask = queue.currentTask ? {
            ...queue.currentTask,
            isValid: true,
            validationErrors: [],
            retryCount: queue.currentTask.retryCount || 0,
            maxRetries: queue.currentTask.maxRetries || 3
          } : null;

          return {
            ...queue,
            queuedTasks: updatedTasks,
            currentTask: updatedCurrentTask,
            version: 4
          };
        },
        rollbackFunction: (queue: TaskQueue) => {
          const rollbackTasks = queue.queuedTasks.map(task => {
            return {
              ...task,
              // Reset validation properties to v3 defaults
              isValid: true,
              validationErrors: []
            };
          });

          const rollbackCurrentTask = queue.currentTask ? {
            ...queue.currentTask,
            isValid: true,
            validationErrors: []
          } : null;

          return {
            ...queue,
            queuedTasks: rollbackTasks,
            currentTask: rollbackCurrentTask,
            version: 3
          };
        },
        validationFunction: (queue: TaskQueue) => {
          return queue.version === 4 && 
                 queue.queuedTasks.every(task => 
                   typeof task.isValid === 'boolean' && 
                   Array.isArray(task.validationErrors)
                 );
        }
      }
    };
  }

  /**
   * Create a migration plan for upgrading from one version to another
   */
  async createMigrationPlan(fromVersion: number, toVersion: number): Promise<MigrationPlan> {
    const migrations = this.getMigrationDefinitions();
    const migrationChain: MigrationDefinition[] = [];
    
    // Build migration chain
    let currentVersion = fromVersion;
    while (currentVersion < toVersion) {
      const nextMigration = Object.values(migrations).find(m => m.fromVersion === currentVersion);
      if (!nextMigration) {
        throw new Error(`No migration path found from version ${currentVersion} to ${toVersion}`);
      }
      migrationChain.push(nextMigration);
      currentVersion = nextMigration.toVersion;
    }

    // Estimate affected players (this would query the database in a real implementation)
    const affectedPlayers = await this.countPlayersWithVersion(fromVersion);
    
    // Calculate risk level based on migration complexity
    const riskLevel = this.calculateRiskLevel(migrationChain);
    
    // Estimate duration (rough calculation)
    const estimatedDuration = migrationChain.length * affectedPlayers * 100; // 100ms per player per migration

    return {
      migrations: migrationChain,
      totalSteps: migrationChain.length,
      estimatedDuration,
      affectedPlayers,
      riskLevel
    };
  }

  /**
   * Execute a migration plan
   */
  async executeMigrationPlan(plan: MigrationPlan, dryRun: boolean = false): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];

    for (const migration of plan.migrations) {
      console.log(`${dryRun ? '[DRY RUN] ' : ''}Executing migration: ${migration.name}`);
      
      const result = await this.executeSingleMigration(migration, dryRun);
      results.push(result);
      
      if (!result.success && !dryRun) {
        console.error(`Migration ${migration.id} failed, stopping migration plan`);
        break;
      }
    }

    return results;
  }

  /**
   * Execute a single migration
   */
  async executeSingleMigration(migration: MigrationDefinition, dryRun: boolean = false): Promise<MigrationResult> {
    const startTime = Date.now();
    const processedPlayers: string[] = [];
    const failedPlayers: string[] = [];
    const errors: string[] = [];

    try {
      if (!dryRun) {
        // Create migration record
        await this.persistenceService.createMigration(
          migration.id,
          migration.fromVersion,
          migration.toVersion,
          migration.migrationFunction
        );
      }

      // Get all players with the source version
      const playersToMigrate = await this.getPlayersWithVersion(migration.fromVersion);
      
      console.log(`${dryRun ? '[DRY RUN] ' : ''}Found ${playersToMigrate.length} players to migrate`);

      // Process each player
      for (const playerId of playersToMigrate) {
        try {
          const queue = await this.persistenceService.loadQueue(playerId);
          if (!queue) {
            failedPlayers.push(playerId);
            errors.push(`Queue not found for player ${playerId}`);
            continue;
          }

          // Validate source version
          if (queue.version !== migration.fromVersion) {
            console.warn(`Player ${playerId} has version ${queue.version}, expected ${migration.fromVersion}`);
            continue;
          }

          if (!dryRun) {
            // Create backup before migration
            await this.persistenceService.createStateSnapshot(queue, 'before_update');
          }

          // Apply migration
          const migratedQueue = migration.migrationFunction(queue);

          // Validate migration result
          if (migration.validationFunction && !migration.validationFunction(migratedQueue)) {
            throw new Error(`Migration validation failed for player ${playerId}`);
          }

          if (!dryRun) {
            // Save migrated queue
            await this.persistenceService.saveQueueWithAtomicUpdate(migratedQueue, {
              validateBeforeUpdate: true,
              createSnapshot: false
            });
          }

          processedPlayers.push(playerId);
          
          if (processedPlayers.length % 100 === 0) {
            console.log(`${dryRun ? '[DRY RUN] ' : ''}Processed ${processedPlayers.length}/${playersToMigrate.length} players`);
          }

        } catch (error: any) {
          failedPlayers.push(playerId);
          errors.push(`Player ${playerId}: ${error.message}`);
          console.error(`Migration failed for player ${playerId}:`, error);
        }
      }

      if (!dryRun) {
        // Update migration status
        await this.persistenceService.executeMigration(migration.id);
      }

      const result: MigrationResult = {
        migrationId: migration.id,
        success: failedPlayers.length === 0,
        processedPlayers: processedPlayers.length,
        failedPlayers,
        duration: Date.now() - startTime,
        errors,
        rollbackAvailable: !!migration.rollbackFunction
      };

      this.migrationHistory.set(migration.id, result);
      return result;

    } catch (error: any) {
      const result: MigrationResult = {
        migrationId: migration.id,
        success: false,
        processedPlayers: processedPlayers.length,
        failedPlayers,
        duration: Date.now() - startTime,
        errors: [...errors, error.message],
        rollbackAvailable: !!migration.rollbackFunction
      };

      this.migrationHistory.set(migration.id, result);
      return result;
    }
  }

  /**
   * Rollback a migration
   */
  async rollbackMigration(migrationId: string): Promise<MigrationResult> {
    const migrations = this.getMigrationDefinitions();
    const migration = migrations[migrationId];
    
    if (!migration) {
      throw new Error(`Migration ${migrationId} not found`);
    }

    if (!migration.rollbackFunction) {
      throw new Error(`Migration ${migrationId} does not support rollback`);
    }

    const startTime = Date.now();
    const processedPlayers: string[] = [];
    const failedPlayers: string[] = [];
    const errors: string[] = [];

    try {
      // Get all players with the target version
      const playersToRollback = await this.getPlayersWithVersion(migration.toVersion);
      
      console.log(`Rolling back ${playersToRollback.length} players from version ${migration.toVersion} to ${migration.fromVersion}`);

      // Process each player
      for (const playerId of playersToRollback) {
        try {
          const queue = await this.persistenceService.loadQueue(playerId);
          if (!queue) {
            failedPlayers.push(playerId);
            errors.push(`Queue not found for player ${playerId}`);
            continue;
          }

          // Create backup before rollback
          await this.persistenceService.createStateSnapshot(queue, 'before_update');

          // Apply rollback
          const rolledBackQueue = migration.rollbackFunction!(queue);

          // Save rolled back queue
          await this.persistenceService.saveQueueWithAtomicUpdate(rolledBackQueue, {
            validateBeforeUpdate: true,
            createSnapshot: false
          });

          processedPlayers.push(playerId);

        } catch (error: any) {
          failedPlayers.push(playerId);
          errors.push(`Player ${playerId}: ${error.message}`);
          console.error(`Rollback failed for player ${playerId}:`, error);
        }
      }

      const result: MigrationResult = {
        migrationId: `${migrationId}_rollback`,
        success: failedPlayers.length === 0,
        processedPlayers: processedPlayers.length,
        failedPlayers,
        duration: Date.now() - startTime,
        errors,
        rollbackAvailable: false
      };

      return result;

    } catch (error: any) {
      throw new Error(`Rollback failed: ${error.message}`);
    }
  }

  /**
   * Get migration history
   */
  getMigrationHistory(): MigrationResult[] {
    return Array.from(this.migrationHistory.values());
  }

  /**
   * Validate all queues after migration
   */
  async validateAllQueues(): Promise<{ valid: number; invalid: string[] }> {
    const allPlayers = await this.getAllPlayerIds();
    const invalid: string[] = [];
    let valid = 0;

    for (const playerId of allPlayers) {
      try {
        const queue = await this.persistenceService.loadQueue(playerId);
        if (queue) {
          const validation = await this.persistenceService.validateQueueIntegrity(queue);
          if (validation.isValid) {
            valid++;
          } else {
            invalid.push(playerId);
          }
        }
      } catch (error) {
        invalid.push(playerId);
      }
    }

    return { valid, invalid };
  }

  /**
   * Helper methods
   */
  private async countPlayersWithVersion(version: number): Promise<number> {
    // This would query the database to count players with specific version
    // For now, return a mock value
    return 1000;
  }

  private async getPlayersWithVersion(version: number): Promise<string[]> {
    // This would query the database to get players with specific version
    // For now, return mock data
    return ['player1', 'player2', 'player3'];
  }

  private async getAllPlayerIds(): Promise<string[]> {
    // This would query the database to get all player IDs
    // For now, return mock data
    return ['player1', 'player2', 'player3'];
  }

  private calculateRiskLevel(migrations: MigrationDefinition[]): 'low' | 'medium' | 'high' {
    // Calculate risk based on migration complexity
    const complexMigrations = migrations.filter(m => !m.rollbackFunction).length;
    const totalMigrations = migrations.length;
    
    if (complexMigrations === 0) return 'low';
    if (complexMigrations / totalMigrations < 0.5) return 'medium';
    return 'high';
  }

  private calculateChecksum(queue: TaskQueue): string {
    // This would calculate a checksum for the queue
    // For now, return a mock checksum
    return 'mock_checksum';
  }
}