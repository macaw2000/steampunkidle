/**
 * Task Queue Recovery Service
 * Implements comprehensive recovery and error handling for the task queue system
 */

import { TaskQueue, Task, QueueValidationResult } from '../types/taskQueue';
import { TaskQueuePersistenceService } from './taskQueuePersistence';
import { AtomicQueueStateManager } from './atomicQueueStateManager';
import { queueStateManager } from './queueStateManager';

export interface RecoveryOptions {
  maxRetries: number;
  retryDelayMs: number;
  enableCircuitBreaker: boolean;
  gracefulDegradation: boolean;
  backupToLocalStorage: boolean;
  notifyUser: boolean;
}

export interface RecoveryResult {
  success: boolean;
  recoveredQueue?: TaskQueue;
  fallbackQueue?: TaskQueue;
  errors: RecoveryError[];
  warnings: string[];
  recoveryMethod: RecoveryMethod;
  duration: number;
}

export interface RecoveryError {
  code: string;
  message: string;
  severity: 'critical' | 'major' | 'minor';
  timestamp: number;
  context?: any;
}

export type RecoveryMethod = 
  | 'snapshot_restore' 
  | 'state_repair' 
  | 'backup_restore' 
  | 'fallback_creation' 
  | 'graceful_degradation';

export interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailureTime: number;
  nextRetryTime: number;
  halfOpenAttempts: number;
}

export interface SystemResourceStatus {
  memoryUsage: number;
  cpuUsage: number;
  databaseConnections: number;
  activeOperations: number;
  isOverloaded: boolean;
  degradationLevel: 'none' | 'minimal' | 'moderate' | 'severe';
}

export class TaskQueueRecoveryService {
  private persistenceService: TaskQueuePersistenceService;
  private atomicManager: AtomicQueueStateManager;
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private resourceMonitor: SystemResourceMonitor;
  
  // Circuit breaker configuration
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute
  private readonly HALF_OPEN_MAX_ATTEMPTS = 3;
  
  // Resource limits for graceful degradation
  private readonly MEMORY_LIMIT_WARNING = 0.8; // 80%
  private readonly MEMORY_LIMIT_CRITICAL = 0.9; // 90%
  private readonly CPU_LIMIT_WARNING = 0.7; // 70%
  private readonly CPU_LIMIT_CRITICAL = 0.85; // 85%

  constructor(
    persistenceService: TaskQueuePersistenceService,
    atomicManager: AtomicQueueStateManager
  ) {
    this.persistenceService = persistenceService;
    this.atomicManager = atomicManager;
    this.resourceMonitor = new SystemResourceMonitor();
    
    // Start resource monitoring
    this.startResourceMonitoring();
  }

  /**
   * Comprehensive queue recovery from corruption or data loss
   */
  async recoverQueue(
    playerId: string, 
    options: Partial<RecoveryOptions> = {}
  ): Promise<RecoveryResult> {
    const startTime = Date.now();
    const opts: RecoveryOptions = {
      maxRetries: 3,
      retryDelayMs: 1000,
      enableCircuitBreaker: true,
      gracefulDegradation: true,
      backupToLocalStorage: true,
      notifyUser: true,
      ...options
    };

    const errors: RecoveryError[] = [];
    const warnings: string[] = [];

    try {
      // Check circuit breaker
      if (opts.enableCircuitBreaker && this.isCircuitBreakerOpen(playerId)) {
        return this.handleCircuitBreakerOpen(playerId, startTime);
      }

      // Check system resources
      const resourceStatus = await this.resourceMonitor.getStatus();
      if (resourceStatus.isOverloaded && opts.gracefulDegradation) {
        return await this.handleResourceOverload(playerId, resourceStatus, startTime);
      }

      // Attempt recovery methods in order of preference
      const recoveryMethods: Array<() => Promise<RecoveryResult>> = [
        () => this.recoverFromSnapshot(playerId, startTime),
        () => this.recoverFromStateRepair(playerId, startTime),
        () => this.recoverFromBackup(playerId, startTime),
        () => this.createFallbackQueue(playerId, startTime)
      ];

      for (const recoveryMethod of recoveryMethods) {
        try {
          const result = await recoveryMethod();
          
          if (result.success) {
            // Reset circuit breaker on success
            this.resetCircuitBreaker(playerId);
            return result;
          } else {
            errors.push(...result.errors);
            warnings.push(...result.warnings);
          }
        } catch (error: any) {
          errors.push({
            code: 'RECOVERY_METHOD_FAILED',
            message: `Recovery method failed: ${error.message}`,
            severity: 'major',
            timestamp: Date.now(),
            context: { method: recoveryMethod.name }
          });
        }
      }

      // All recovery methods failed
      this.recordCircuitBreakerFailure(playerId);
      
      return {
        success: false,
        errors,
        warnings,
        recoveryMethod: 'fallback_creation',
        duration: Date.now() - startTime
      };

    } catch (error: any) {
      this.recordCircuitBreakerFailure(playerId);
      
      errors.push({
        code: 'RECOVERY_SYSTEM_ERROR',
        message: `Recovery system error: ${error.message}`,
        severity: 'critical',
        timestamp: Date.now()
      });

      return {
        success: false,
        errors,
        warnings,
        recoveryMethod: 'fallback_creation',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Recover queue from the most recent snapshot
   */
  private async recoverFromSnapshot(playerId: string, startTime: number): Promise<RecoveryResult> {
    const errors: RecoveryError[] = [];
    const warnings: string[] = [];

    try {
      // Get available snapshots
      const snapshots = await this.persistenceService.getPlayerSnapshots(playerId, 5);
      
      if (snapshots.length === 0) {
        errors.push({
          code: 'NO_SNAPSHOTS_AVAILABLE',
          message: 'No snapshots available for recovery',
          severity: 'major',
          timestamp: Date.now()
        });
        
        return {
          success: false,
          errors,
          warnings,
          recoveryMethod: 'snapshot_restore',
          duration: Date.now() - startTime
        };
      }

      // Try snapshots from most recent to oldest
      for (const snapshot of snapshots) {
        try {
          const recoveredQueue = await this.persistenceService.restoreFromSnapshot(
            playerId, 
            snapshot.snapshotId
          );

          // Validate recovered queue
          const validation = await this.persistenceService.validateQueueIntegrity(recoveredQueue);
          
          if (validation.isValid || validation.canRepair) {
            if (!validation.isValid && validation.canRepair) {
              warnings.push(`Recovered queue required repairs: ${validation.errors.length} issues fixed`);
              const repairedQueue = await this.persistenceService.repairQueue(recoveredQueue);
              
              return {
                success: true,
                recoveredQueue: repairedQueue,
                errors,
                warnings,
                recoveryMethod: 'snapshot_restore',
                duration: Date.now() - startTime
              };
            }

            return {
              success: true,
              recoveredQueue,
              errors,
              warnings,
              recoveryMethod: 'snapshot_restore',
              duration: Date.now() - startTime
            };
          }
        } catch (error: any) {
          warnings.push(`Failed to restore from snapshot ${snapshot.snapshotId}: ${error.message}`);
        }
      }

      errors.push({
        code: 'ALL_SNAPSHOTS_INVALID',
        message: 'All available snapshots are corrupted or invalid',
        severity: 'major',
        timestamp: Date.now()
      });

      return {
        success: false,
        errors,
        warnings,
        recoveryMethod: 'snapshot_restore',
        duration: Date.now() - startTime
      };

    } catch (error: any) {
      errors.push({
        code: 'SNAPSHOT_RECOVERY_ERROR',
        message: `Snapshot recovery failed: ${error.message}`,
        severity: 'major',
        timestamp: Date.now()
      });

      return {
        success: false,
        errors,
        warnings,
        recoveryMethod: 'snapshot_restore',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Recover queue by repairing the current state
   */
  private async recoverFromStateRepair(playerId: string, startTime: number): Promise<RecoveryResult> {
    const errors: RecoveryError[] = [];
    const warnings: string[] = [];

    try {
      // Load current queue state
      const currentQueue = await this.persistenceService.loadQueue(playerId);
      
      if (!currentQueue) {
        errors.push({
          code: 'NO_CURRENT_STATE',
          message: 'No current queue state found for repair',
          severity: 'major',
          timestamp: Date.now()
        });
        
        return {
          success: false,
          errors,
          warnings,
          recoveryMethod: 'state_repair',
          duration: Date.now() - startTime
        };
      }

      // Validate current state
      const validation = await this.persistenceService.validateQueueIntegrity(currentQueue);
      
      if (validation.canRepair) {
        const repairedQueue = await this.persistenceService.repairQueue(currentQueue);
        
        warnings.push(`Queue repaired successfully: ${validation.repairActions.length} actions applied`);
        
        return {
          success: true,
          recoveredQueue: repairedQueue,
          errors,
          warnings,
          recoveryMethod: 'state_repair',
          duration: Date.now() - startTime
        };
      } else {
        errors.push({
          code: 'QUEUE_UNREPAIRABLE',
          message: 'Queue state cannot be repaired automatically',
          severity: 'major',
          timestamp: Date.now(),
          context: { validationErrors: validation.errors }
        });

        return {
          success: false,
          errors,
          warnings,
          recoveryMethod: 'state_repair',
          duration: Date.now() - startTime
        };
      }

    } catch (error: any) {
      errors.push({
        code: 'STATE_REPAIR_ERROR',
        message: `State repair failed: ${error.message}`,
        severity: 'major',
        timestamp: Date.now()
      });

      return {
        success: false,
        errors,
        warnings,
        recoveryMethod: 'state_repair',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Recover queue from local storage backup
   */
  private async recoverFromBackup(playerId: string, startTime: number): Promise<RecoveryResult> {
    const errors: RecoveryError[] = [];
    const warnings: string[] = [];

    try {
      // Try to load from local storage backup
      const backupKey = `taskQueue_backup_${playerId}`;
      const backupData = localStorage.getItem(backupKey);
      
      if (!backupData) {
        errors.push({
          code: 'NO_BACKUP_AVAILABLE',
          message: 'No local storage backup available',
          severity: 'minor',
          timestamp: Date.now()
        });
        
        return {
          success: false,
          errors,
          warnings,
          recoveryMethod: 'backup_restore',
          duration: Date.now() - startTime
        };
      }

      const backupQueue: TaskQueue = JSON.parse(backupData);
      
      // Validate backup data
      const validation = await this.persistenceService.validateQueueIntegrity(backupQueue);
      
      if (validation.isValid || validation.canRepair) {
        let recoveredQueue = backupQueue;
        
        if (!validation.isValid && validation.canRepair) {
          recoveredQueue = await this.persistenceService.repairQueue(backupQueue);
          warnings.push('Backup queue required repairs before restoration');
        }

        // Update timestamps and version
        recoveredQueue.lastUpdated = Date.now();
        recoveredQueue.version = (recoveredQueue.version || 0) + 1;
        recoveredQueue.checksum = this.calculateChecksum(recoveredQueue);

        // Save restored queue
        await this.persistenceService.saveQueueWithAtomicUpdate(recoveredQueue);

        warnings.push('Queue restored from local storage backup');
        
        return {
          success: true,
          recoveredQueue,
          errors,
          warnings,
          recoveryMethod: 'backup_restore',
          duration: Date.now() - startTime
        };
      } else {
        errors.push({
          code: 'BACKUP_CORRUPTED',
          message: 'Local storage backup is corrupted and cannot be repaired',
          severity: 'major',
          timestamp: Date.now()
        });

        return {
          success: false,
          errors,
          warnings,
          recoveryMethod: 'backup_restore',
          duration: Date.now() - startTime
        };
      }

    } catch (error: any) {
      errors.push({
        code: 'BACKUP_RECOVERY_ERROR',
        message: `Backup recovery failed: ${error.message}`,
        severity: 'major',
        timestamp: Date.now()
      });

      return {
        success: false,
        errors,
        warnings,
        recoveryMethod: 'backup_restore',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Create a fallback queue as last resort
   */
  private async createFallbackQueue(playerId: string, startTime: number): Promise<RecoveryResult> {
    const errors: RecoveryError[] = [];
    const warnings: string[] = [];

    try {
      // Create a minimal, safe queue state
      const fallbackQueue: TaskQueue = {
        playerId,
        currentTask: null,
        queuedTasks: [],
        isRunning: false,
        isPaused: false,
        canResume: true,
        totalTasksCompleted: 0,
        totalTimeSpent: 0,
        totalRewardsEarned: [],
        averageTaskDuration: 0,
        taskCompletionRate: 0,
        queueEfficiencyScore: 0,
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
        },
        lastUpdated: Date.now(),
        lastSynced: Date.now(),
        createdAt: Date.now(),
        version: 1,
        checksum: '',
        lastValidated: Date.now(),
        stateHistory: [],
        maxHistorySize: 10
      };

      // Calculate checksum
      fallbackQueue.checksum = this.calculateChecksum(fallbackQueue);

      // Save fallback queue
      await this.persistenceService.saveQueueWithAtomicUpdate(fallbackQueue, {
        validateBeforeUpdate: false,
        createSnapshot: true
      });

      warnings.push('Created new fallback queue - all previous queue data has been lost');

      return {
        success: true,
        fallbackQueue,
        errors,
        warnings,
        recoveryMethod: 'fallback_creation',
        duration: Date.now() - startTime
      };

    } catch (error: any) {
      errors.push({
        code: 'FALLBACK_CREATION_ERROR',
        message: `Fallback queue creation failed: ${error.message}`,
        severity: 'critical',
        timestamp: Date.now()
      });

      return {
        success: false,
        errors,
        warnings,
        recoveryMethod: 'fallback_creation',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Handle circuit breaker open state
   */
  private handleCircuitBreakerOpen(playerId: string, startTime: number): RecoveryResult {
    const circuitBreaker = this.circuitBreakers.get(playerId);
    const timeUntilRetry = circuitBreaker ? circuitBreaker.nextRetryTime - Date.now() : 0;

    return {
      success: false,
      errors: [{
        code: 'CIRCUIT_BREAKER_OPEN',
        message: `Circuit breaker is open. Next retry in ${Math.ceil(timeUntilRetry / 1000)} seconds`,
        severity: 'major',
        timestamp: Date.now(),
        context: { timeUntilRetry }
      }],
      warnings: ['Queue operations are temporarily disabled due to repeated failures'],
      recoveryMethod: 'graceful_degradation',
      duration: Date.now() - startTime
    };
  }

  /**
   * Handle resource overload with graceful degradation
   */
  private async handleResourceOverload(
    playerId: string, 
    resourceStatus: SystemResourceStatus, 
    startTime: number
  ): Promise<RecoveryResult> {
    const errors: RecoveryError[] = [];
    const warnings: string[] = [];

    try {
      // Apply degradation based on severity
      switch (resourceStatus.degradationLevel) {
        case 'minimal':
          warnings.push('System under light load - using cached data where possible');
          return await this.recoverWithMinimalDegradation(playerId, startTime);

        case 'moderate':
          warnings.push('System under moderate load - disabling non-essential features');
          return await this.recoverWithModerateDegradation(playerId, startTime);

        case 'severe':
          warnings.push('System under severe load - emergency fallback mode');
          return await this.recoverWithSevereDegradation(playerId, startTime);

        default:
          return await this.recoverQueue(playerId, { gracefulDegradation: false });
      }

    } catch (error: any) {
      errors.push({
        code: 'DEGRADATION_ERROR',
        message: `Graceful degradation failed: ${error.message}`,
        severity: 'major',
        timestamp: Date.now()
      });

      return {
        success: false,
        errors,
        warnings,
        recoveryMethod: 'graceful_degradation',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Recovery with minimal degradation
   */
  private async recoverWithMinimalDegradation(playerId: string, startTime: number): Promise<RecoveryResult> {
    // Try to use cached data first, then fallback to normal recovery
    try {
      const cachedQueue = this.getCachedQueue(playerId);
      if (cachedQueue) {
        return {
          success: true,
          recoveredQueue: cachedQueue,
          errors: [],
          warnings: ['Using cached queue data due to system load'],
          recoveryMethod: 'graceful_degradation',
          duration: Date.now() - startTime
        };
      }
    } catch (error) {
      // Continue with normal recovery if cache fails
    }

    return await this.recoverQueue(playerId, { 
      maxRetries: 1, 
      gracefulDegradation: false 
    });
  }

  /**
   * Recovery with moderate degradation
   */
  private async recoverWithModerateDegradation(playerId: string, startTime: number): Promise<RecoveryResult> {
    // Skip validation and use simplified recovery
    try {
      const queue = await this.persistenceService.loadQueue(playerId);
      if (queue) {
        // Skip validation to reduce load
        return {
          success: true,
          recoveredQueue: queue,
          errors: [],
          warnings: ['Skipped validation due to system load'],
          recoveryMethod: 'graceful_degradation',
          duration: Date.now() - startTime
        };
      }
    } catch (error) {
      // Continue to fallback creation
    }

    return await this.createFallbackQueue(playerId, startTime);
  }

  /**
   * Recovery with severe degradation
   */
  private async recoverWithSevereDegradation(playerId: string, startTime: number): Promise<RecoveryResult> {
    // Emergency mode - create minimal queue without persistence
    const emergencyQueue: TaskQueue = {
      playerId,
      currentTask: null,
      queuedTasks: [],
      isRunning: false,
      isPaused: true,
      pauseReason: 'System overload',
      canResume: false,
      totalTasksCompleted: 0,
      totalTimeSpent: 0,
      totalRewardsEarned: [],
      averageTaskDuration: 0,
      taskCompletionRate: 0,
      queueEfficiencyScore: 0,
      config: {
        maxQueueSize: 10, // Reduced capacity
        maxTaskDuration: 60 * 60 * 1000, // 1 hour max
        maxTotalQueueDuration: 24 * 60 * 60 * 1000, // 24 hours max
        autoStart: false,
        priorityHandling: false,
        retryEnabled: false,
        maxRetries: 0,
        validationEnabled: false,
        syncInterval: 30000, // Reduced sync frequency
        offlineProcessingEnabled: false,
        pauseOnError: true,
        resumeOnResourceAvailable: true,
        persistenceInterval: 300000, // Reduced persistence frequency
        integrityCheckInterval: 0, // Disabled
        maxHistorySize: 1
      },
      lastUpdated: Date.now(),
      lastSynced: 0,
      createdAt: Date.now(),
      version: 1,
      checksum: '',
      lastValidated: 0,
      stateHistory: [],
      maxHistorySize: 1
    };

    return {
      success: true,
      recoveredQueue: emergencyQueue,
      errors: [],
      warnings: [
        'Emergency mode activated due to severe system load',
        'Queue functionality is severely limited',
        'Normal operation will resume when system load decreases'
      ],
      recoveryMethod: 'graceful_degradation',
      duration: Date.now() - startTime
    };
  }

  /**
   * Circuit breaker management
   */
  private isCircuitBreakerOpen(playerId: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(playerId);
    
    if (!circuitBreaker) {
      return false;
    }

    const now = Date.now();
    
    if (circuitBreaker.isOpen) {
      if (now >= circuitBreaker.nextRetryTime) {
        // Move to half-open state
        circuitBreaker.isOpen = false;
        circuitBreaker.halfOpenAttempts = 0;
        return false;
      }
      return true;
    }

    return false;
  }

  private recordCircuitBreakerFailure(playerId: string): void {
    const circuitBreaker = this.circuitBreakers.get(playerId) || {
      isOpen: false,
      failureCount: 0,
      lastFailureTime: 0,
      nextRetryTime: 0,
      halfOpenAttempts: 0
    };

    circuitBreaker.failureCount++;
    circuitBreaker.lastFailureTime = Date.now();

    if (circuitBreaker.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
      circuitBreaker.isOpen = true;
      circuitBreaker.nextRetryTime = Date.now() + this.CIRCUIT_BREAKER_TIMEOUT;
    }

    this.circuitBreakers.set(playerId, circuitBreaker);
  }

  private resetCircuitBreaker(playerId: string): void {
    this.circuitBreakers.delete(playerId);
  }

  /**
   * Utility methods
   */
  private getCachedQueue(playerId: string): TaskQueue | null {
    try {
      const cacheKey = `taskQueue_cache_${playerId}`;
      const cachedData = sessionStorage.getItem(cacheKey);
      return cachedData ? JSON.parse(cachedData) : null;
    } catch (error) {
      return null;
    }
  }

  private calculateChecksum(queue: TaskQueue): string {
    const stableData = {
      playerId: queue.playerId,
      currentTaskId: queue.currentTask?.id || null,
      queuedTaskIds: queue.queuedTasks.map(t => t.id).sort(),
      isRunning: queue.isRunning,
      isPaused: queue.isPaused,
      totalTasksCompleted: queue.totalTasksCompleted
    };
    
    return require('crypto')
      .createHash('sha256')
      .update(JSON.stringify(stableData))
      .digest('hex');
  }

  private startResourceMonitoring(): void {
    // Start monitoring system resources
    setInterval(() => {
      this.resourceMonitor.updateStatus();
    }, 5000); // Update every 5 seconds
  }

  /**
   * Public methods for external monitoring
   */
  public getCircuitBreakerStatus(playerId: string): CircuitBreakerState | null {
    return this.circuitBreakers.get(playerId) || null;
  }

  public getSystemResourceStatus(): Promise<SystemResourceStatus> {
    return this.resourceMonitor.getStatus();
  }

  public async forceResetCircuitBreaker(playerId: string): Promise<void> {
    this.resetCircuitBreaker(playerId);
  }
}

/**
 * System Resource Monitor
 * Monitors system resources for graceful degradation
 */
class SystemResourceMonitor {
  private currentStatus: SystemResourceStatus = {
    memoryUsage: 0,
    cpuUsage: 0,
    databaseConnections: 0,
    activeOperations: 0,
    isOverloaded: false,
    degradationLevel: 'none'
  };

  async getStatus(): Promise<SystemResourceStatus> {
    return { ...this.currentStatus };
  }

  updateStatus(): void {
    try {
      // Get memory usage
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const memUsage = process.memoryUsage();
        this.currentStatus.memoryUsage = memUsage.heapUsed / memUsage.heapTotal;
      }

      // Estimate CPU usage (simplified)
      this.currentStatus.cpuUsage = Math.random() * 0.3; // Placeholder

      // Determine if system is overloaded
      this.currentStatus.isOverloaded = 
        this.currentStatus.memoryUsage > 0.8 || 
        this.currentStatus.cpuUsage > 0.7;

      // Determine degradation level
      if (this.currentStatus.memoryUsage > 0.9 || this.currentStatus.cpuUsage > 0.85) {
        this.currentStatus.degradationLevel = 'severe';
      } else if (this.currentStatus.memoryUsage > 0.8 || this.currentStatus.cpuUsage > 0.7) {
        this.currentStatus.degradationLevel = 'moderate';
      } else if (this.currentStatus.memoryUsage > 0.7 || this.currentStatus.cpuUsage > 0.6) {
        this.currentStatus.degradationLevel = 'minimal';
      } else {
        this.currentStatus.degradationLevel = 'none';
      }

    } catch (error) {
      console.warn('Failed to update resource status:', error);
    }
  }
}