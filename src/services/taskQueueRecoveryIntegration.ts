/**
 * Task Queue Recovery Integration Service
 * Integrates all recovery and error handling components
 */

import { TaskQueueRecoveryService, RecoveryOptions, RecoveryResult } from './taskQueueRecoveryService';
import { TaskQueueRetryService, RetryOptions } from './taskQueueRetryService';
import { TaskQueueErrorHandler, ErrorContext, ErrorHandlingResult } from './taskQueueErrorHandler';
import { TaskQueuePersistenceService } from './taskQueuePersistence';
import { AtomicQueueStateManager } from './atomicQueueStateManager';
import { TaskQueue, Task } from '../types/taskQueue';

export interface RecoveryIntegrationConfig {
  enableRecovery: boolean;
  enableRetry: boolean;
  enableErrorHandling: boolean;
  enableCircuitBreaker: boolean;
  enableGracefulDegradation: boolean;
  enableMonitoring: boolean;
  notificationCallback?: (notification: RecoveryNotification) => void;
}

export interface RecoveryNotification {
  type: 'recovery_started' | 'recovery_completed' | 'recovery_failed' | 'degradation_applied' | 'circuit_breaker_opened';
  playerId: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  timestamp: number;
  details?: any;
}

export interface IntegratedRecoveryResult {
  success: boolean;
  recovered: boolean;
  retryAttempted: boolean;
  errorHandled: boolean;
  fallbackApplied: boolean;
  circuitBreakerTriggered: boolean;
  finalResult?: any;
  recoveryDetails: RecoveryResult;
  errorDetails: ErrorHandlingResult;
  notifications: RecoveryNotification[];
  duration: number;
}

export class TaskQueueRecoveryIntegration {
  private recoveryService: TaskQueueRecoveryService;
  private retryService: TaskQueueRetryService;
  private errorHandler: TaskQueueErrorHandler;
  private config: RecoveryIntegrationConfig;
  private notifications: RecoveryNotification[] = [];

  constructor(
    persistenceService: TaskQueuePersistenceService,
    atomicManager: AtomicQueueStateManager,
    config: Partial<RecoveryIntegrationConfig> = {}
  ) {
    this.config = {
      enableRecovery: true,
      enableRetry: true,
      enableErrorHandling: true,
      enableCircuitBreaker: true,
      enableGracefulDegradation: true,
      enableMonitoring: true,
      ...config
    };

    this.recoveryService = new TaskQueueRecoveryService(persistenceService, atomicManager);
    this.retryService = new TaskQueueRetryService();
    this.errorHandler = new TaskQueueErrorHandler(this.recoveryService);
  }

  /**
   * Execute operation with full recovery and error handling integration
   */
  async executeWithFullRecovery<T>(
    playerId: string,
    operationType: string,
    operation: () => Promise<T>,
    options: {
      retryOptions?: Partial<RetryOptions>;
      recoveryOptions?: Partial<RecoveryOptions>;
      taskId?: string;
      additionalContext?: any;
    } = {}
  ): Promise<IntegratedRecoveryResult> {
    const startTime = Date.now();
    const notifications: RecoveryNotification[] = [];
    let finalResult: any;
    let recovered = false;
    let retryAttempted = false;
    let errorHandled = false;
    let fallbackApplied = false;
    let circuitBreakerTriggered = false;

    // Initialize recovery and error details
    let recoveryDetails: RecoveryResult = {
      success: false,
      errors: [],
      warnings: [],
      recoveryMethod: 'fallback_creation',
      duration: 0
    };

    let errorDetails: ErrorHandlingResult = {
      handled: false,
      recovered: false,
      fallbackApplied: false,
      userNotificationRequired: false,
      retryRecommended: false,
      errorCode: '',
      message: '',
      suggestedActions: [],
      recoveryActions: []
    };

    try {
      // First attempt: Try the operation with retry logic
      if (this.config.enableRetry) {
        this.addNotification(notifications, {
          type: 'recovery_started',
          playerId,
          message: 'Starting operation with retry protection',
          severity: 'info',
          timestamp: Date.now()
        });

        const retryResult = await this.retryService.retryQueueOperation(
          playerId,
          operationType,
          operation,
          options.retryOptions
        );

        retryAttempted = true;
        circuitBreakerTriggered = retryResult.circuitBreakerTriggered;

        if (retryResult.success) {
          finalResult = retryResult.result;
          
          this.addNotification(notifications, {
            type: 'recovery_completed',
            playerId,
            message: `Operation succeeded after ${retryResult.attemptCount} attempts`,
            severity: 'info',
            timestamp: Date.now(),
            details: { attemptCount: retryResult.attemptCount }
          });

          return {
            success: true,
            recovered: false,
            retryAttempted: true,
            errorHandled: false,
            fallbackApplied: false,
            circuitBreakerTriggered,
            finalResult,
            recoveryDetails,
            errorDetails,
            notifications,
            duration: Date.now() - startTime
          };
        }

        // If retry failed, continue to error handling and recovery
        if (retryResult.error) {
          throw retryResult.error;
        }
        
        // If retry didn't succeed and no error, throw a generic error
        throw new Error('Operation failed after retry attempts');
      } else {
        // Direct operation without retry
        finalResult = await operation();
        return {
          success: true,
          recovered: false,
          retryAttempted: false,
          errorHandled: false,
          fallbackApplied: false,
          circuitBreakerTriggered: false,
          finalResult,
          recoveryDetails,
          errorDetails,
          notifications,
          duration: Date.now() - startTime
        };
      }

    } catch (error: any) {
      // Error occurred - handle with integrated error handling and recovery
      
      if (this.config.enableErrorHandling) {
        const errorContext: ErrorContext = {
          playerId,
          operationType,
          taskId: options.taskId,
          timestamp: Date.now(),
          additionalData: options.additionalContext
        };

        errorDetails = await this.errorHandler.handleError(error, errorContext);
        errorHandled = true;

        this.addNotification(notifications, {
          type: 'recovery_started',
          playerId,
          message: `Error detected: ${errorDetails.message}`,
          severity: errorDetails.errorCode.includes('CRITICAL') ? 'critical' : 'error',
          timestamp: Date.now(),
          details: { errorCode: errorDetails.errorCode }
        });

        // If error handler recommends recovery, attempt it
        if (errorDetails.recovered || (this.config.enableRecovery && this.shouldAttemptRecovery(errorDetails))) {
          try {
            recoveryDetails = await this.recoveryService.recoverQueue(
              playerId,
              options.recoveryOptions
            );

            recovered = recoveryDetails.success;
            fallbackApplied = recoveryDetails.fallbackQueue !== undefined;

            if (recovered) {
              this.addNotification(notifications, {
                type: 'recovery_completed',
                playerId,
                message: `Recovery successful using ${recoveryDetails.recoveryMethod}`,
                severity: 'info',
                timestamp: Date.now(),
                details: { recoveryMethod: recoveryDetails.recoveryMethod }
              });

              // Try the operation again after recovery
              try {
                finalResult = await operation();
                
                return {
                  success: true,
                  recovered: true,
                  retryAttempted,
                  errorHandled: true,
                  fallbackApplied,
                  circuitBreakerTriggered,
                  finalResult,
                  recoveryDetails,
                  errorDetails,
                  notifications,
                  duration: Date.now() - startTime
                };
              } catch (postRecoveryError: any) {
                // Operation still failed after recovery
                this.addNotification(notifications, {
                  type: 'recovery_failed',
                  playerId,
                  message: 'Operation failed even after successful recovery',
                  severity: 'error',
                  timestamp: Date.now()
                });
              }
            } else {
              this.addNotification(notifications, {
                type: 'recovery_failed',
                playerId,
                message: `Recovery failed: ${recoveryDetails.errors.map(e => e.message).join(', ')}`,
                severity: 'error',
                timestamp: Date.now()
              });
            }
          } catch (recoveryError: any) {
            this.addNotification(notifications, {
              type: 'recovery_failed',
              playerId,
              message: `Recovery service error: ${recoveryError.message}`,
              severity: 'critical',
              timestamp: Date.now()
            });
          }
        }

        // Apply graceful degradation if enabled and recommended
        if (this.config.enableGracefulDegradation && this.shouldApplyDegradation(errorDetails)) {
          fallbackApplied = true;
          
          this.addNotification(notifications, {
            type: 'degradation_applied',
            playerId,
            message: 'Graceful degradation applied due to system constraints',
            severity: 'warning',
            timestamp: Date.now()
          });

          // Return a degraded but functional result
          finalResult = this.createDegradedResult(operationType, error);
        }
      }

      // Check circuit breaker status
      if (this.config.enableCircuitBreaker) {
        const circuitStatus = this.retryService.getCircuitBreakerStatus(`${playerId}_${operationType}`);
        if (circuitStatus?.state === 'OPEN') {
          circuitBreakerTriggered = true;
          
          this.addNotification(notifications, {
            type: 'circuit_breaker_opened',
            playerId,
            message: 'Circuit breaker opened due to repeated failures',
            severity: 'warning',
            timestamp: Date.now()
          });
        }
      }

      return {
        success: false,
        recovered,
        retryAttempted,
        errorHandled,
        fallbackApplied,
        circuitBreakerTriggered,
        finalResult,
        recoveryDetails,
        errorDetails,
        notifications,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Recover queue with full integration
   */
  async recoverQueueWithIntegration(
    playerId: string,
    options: Partial<RecoveryOptions> = {}
  ): Promise<IntegratedRecoveryResult> {
    const startTime = Date.now();
    const notifications: RecoveryNotification[] = [];

    this.addNotification(notifications, {
      type: 'recovery_started',
      playerId,
      message: 'Starting comprehensive queue recovery',
      severity: 'info',
      timestamp: Date.now()
    });

    try {
      const recoveryDetails = await this.recoveryService.recoverQueue(playerId, options);

      if (recoveryDetails.success) {
        this.addNotification(notifications, {
          type: 'recovery_completed',
          playerId,
          message: `Queue recovery completed using ${recoveryDetails.recoveryMethod}`,
          severity: 'info',
          timestamp: Date.now(),
          details: { recoveryMethod: recoveryDetails.recoveryMethod }
        });
      } else {
        this.addNotification(notifications, {
          type: 'recovery_failed',
          playerId,
          message: `Queue recovery failed: ${recoveryDetails.errors.map(e => e.message).join(', ')}`,
          severity: 'error',
          timestamp: Date.now()
        });
      }

      return {
        success: recoveryDetails.success,
        recovered: recoveryDetails.success,
        retryAttempted: false,
        errorHandled: false,
        fallbackApplied: recoveryDetails.fallbackQueue !== undefined,
        circuitBreakerTriggered: false,
        finalResult: recoveryDetails.recoveredQueue || recoveryDetails.fallbackQueue,
        recoveryDetails,
        errorDetails: {
          handled: false,
          recovered: recoveryDetails.success,
          fallbackApplied: recoveryDetails.fallbackQueue !== undefined,
          userNotificationRequired: !recoveryDetails.success,
          retryRecommended: false,
          errorCode: recoveryDetails.success ? 'RECOVERY_SUCCESS' : 'RECOVERY_FAILED',
          message: recoveryDetails.success ? 'Recovery completed' : 'Recovery failed',
          suggestedActions: recoveryDetails.success ? [] : ['Contact support', 'Try again later'],
          recoveryActions: []
        },
        notifications,
        duration: Date.now() - startTime
      };

    } catch (error: any) {
      this.addNotification(notifications, {
        type: 'recovery_failed',
        playerId,
        message: `Recovery service error: ${error.message}`,
        severity: 'critical',
        timestamp: Date.now()
      });

      return {
        success: false,
        recovered: false,
        retryAttempted: false,
        errorHandled: false,
        fallbackApplied: false,
        circuitBreakerTriggered: false,
        recoveryDetails: {
          success: false,
          errors: [{ code: 'RECOVERY_SERVICE_ERROR', message: error.message, severity: 'critical', timestamp: Date.now() }],
          warnings: [],
          recoveryMethod: 'fallback_creation',
          duration: Date.now() - startTime
        },
        errorDetails: {
          handled: true,
          recovered: false,
          fallbackApplied: false,
          userNotificationRequired: true,
          retryRecommended: false,
          errorCode: 'RECOVERY_SERVICE_ERROR',
          message: 'Recovery service encountered an error',
          suggestedActions: ['Contact support', 'Restart application'],
          recoveryActions: []
        },
        notifications,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Get comprehensive system health status
   */
  async getSystemHealthStatus(): Promise<{
    overall: 'healthy' | 'degraded' | 'critical';
    components: {
      recovery: 'healthy' | 'degraded' | 'critical';
      retry: 'healthy' | 'degraded' | 'critical';
      errorHandling: 'healthy' | 'degraded' | 'critical';
      circuitBreakers: 'healthy' | 'degraded' | 'critical';
    };
    metrics: {
      totalRecoveries: number;
      successfulRecoveries: number;
      activeCircuitBreakers: number;
      systemResourceUsage: any;
    };
    recommendations: string[];
  }> {
    const recommendations: string[] = [];
    
    // Get system resource status
    const resourceStatus = await this.recoveryService.getSystemResourceStatus();
    
    // Get circuit breaker statuses
    const circuitBreakerStatuses = this.retryService.getAllCircuitBreakerStatuses();
    const openCircuitBreakers = Array.from(circuitBreakerStatuses.values())
      .filter(status => status.state === 'OPEN').length;
    
    // Determine component health
    const components = {
      recovery: resourceStatus.degradationLevel === 'none' ? 'healthy' as const : 
                resourceStatus.degradationLevel === 'severe' ? 'critical' as const : 'degraded' as const,
      retry: openCircuitBreakers === 0 ? 'healthy' as const : 
             openCircuitBreakers > 5 ? 'critical' as const : 'degraded' as const,
      errorHandling: 'healthy' as const, // Would be determined by error rates
      circuitBreakers: openCircuitBreakers === 0 ? 'healthy' as const : 
                      openCircuitBreakers > 10 ? 'critical' as const : 'degraded' as const
    };

    // Determine overall health
    const criticalComponents = Object.values(components).filter(status => status === 'critical').length;
    const degradedComponents = Object.values(components).filter(status => status === 'degraded').length;
    
    const overall = criticalComponents > 0 ? 'critical' as const : 
                   degradedComponents > 1 ? 'degraded' as const : 'healthy' as const;

    // Generate recommendations
    if (resourceStatus.isOverloaded) {
      recommendations.push('System resources are under pressure - consider scaling');
    }
    
    if (openCircuitBreakers > 0) {
      recommendations.push(`${openCircuitBreakers} circuit breakers are open - investigate failing operations`);
    }
    
    if (overall !== 'healthy') {
      recommendations.push('Monitor system closely and consider maintenance');
    }

    return {
      overall,
      components,
      metrics: {
        totalRecoveries: 0, // Would be tracked in real implementation
        successfulRecoveries: 0, // Would be tracked in real implementation
        activeCircuitBreakers: openCircuitBreakers,
        systemResourceUsage: resourceStatus
      },
      recommendations
    };
  }

  /**
   * Reset all recovery systems (admin function)
   */
  async resetAllSystems(): Promise<void> {
    // Reset all circuit breakers
    this.retryService.resetAllCircuitBreakers();
    
    // Clear notifications
    this.notifications = [];
    
    console.log('All recovery systems have been reset');
  }

  /**
   * Get recent notifications
   */
  getRecentNotifications(limit: number = 50): RecoveryNotification[] {
    return this.notifications
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Private helper methods
   */
  private shouldAttemptRecovery(errorDetails: ErrorHandlingResult): boolean {
    return errorDetails.errorCode.includes('SYS') || 
           errorDetails.errorCode.includes('PER') ||
           errorDetails.errorCode.includes('NET');
  }

  private shouldApplyDegradation(errorDetails: ErrorHandlingResult): boolean {
    return errorDetails.errorCode.includes('RES') || 
           errorDetails.errorCode.includes('TIM') ||
           errorDetails.errorCode.includes('SYS');
  }

  private createDegradedResult(operationType: string, error: Error): any {
    // Create a minimal, safe result for degraded operations
    switch (operationType) {
      case 'add_task':
        return { success: false, message: 'Task queued for later processing', degraded: true };
      case 'get_queue':
        return { tasks: [], degraded: true, message: 'Queue temporarily unavailable' };
      case 'process_task':
        return { processed: false, message: 'Task processing delayed', degraded: true };
      default:
        return { success: false, degraded: true, message: 'Operation temporarily unavailable' };
    }
  }

  private addNotification(notifications: RecoveryNotification[], notification: RecoveryNotification): void {
    notifications.push(notification);
    this.notifications.push(notification);
    
    // Limit notification history
    if (this.notifications.length > 1000) {
      this.notifications = this.notifications.slice(-500);
    }
    
    // Call notification callback if provided
    if (this.config.notificationCallback) {
      this.config.notificationCallback(notification);
    }
  }
}

// Export singleton instance factory
export function createRecoveryIntegration(
  persistenceService: TaskQueuePersistenceService,
  atomicManager: AtomicQueueStateManager,
  config?: Partial<RecoveryIntegrationConfig>
): TaskQueueRecoveryIntegration {
  return new TaskQueueRecoveryIntegration(persistenceService, atomicManager, config);
}