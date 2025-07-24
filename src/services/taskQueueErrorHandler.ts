/**
 * Task Queue Error Handler
 * Provides comprehensive error handling for all failure scenarios
 */

import { TaskQueue, Task } from '../types/taskQueue';
import { TaskQueueRecoveryService } from './taskQueueRecoveryService';
import { taskQueueRetryService } from './taskQueueRetryService';

export interface ErrorContext {
  playerId: string;
  operationType: string;
  taskId?: string;
  queueState?: Partial<TaskQueue>;
  timestamp: number;
  userAgent?: string;
  sessionId?: string;
  additionalData?: any;
}

export interface ErrorHandlingResult {
  handled: boolean;
  recovered: boolean;
  fallbackApplied: boolean;
  userNotificationRequired: boolean;
  retryRecommended: boolean;
  errorCode: string;
  message: string;
  technicalDetails?: string;
  suggestedActions: string[];
  recoveryActions: string[];
}

export interface ErrorPattern {
  pattern: RegExp;
  category: ErrorCategory;
  severity: ErrorSeverity;
  retryable: boolean;
  recoverable: boolean;
  userFriendlyMessage: string;
  technicalMessage: string;
  suggestedActions: string[];
  recoveryStrategy: RecoveryStrategy;
}

export type ErrorCategory = 
  | 'NETWORK' 
  | 'VALIDATION' 
  | 'PERSISTENCE' 
  | 'BUSINESS_LOGIC' 
  | 'SYSTEM' 
  | 'SECURITY' 
  | 'RESOURCE' 
  | 'TIMEOUT';

export type ErrorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type RecoveryStrategy = 
  | 'RETRY' 
  | 'FALLBACK' 
  | 'RECOVERY_SERVICE' 
  | 'USER_INTERVENTION' 
  | 'SYSTEM_RESTART';

export class TaskQueueErrorHandler {
  private recoveryService: TaskQueueRecoveryService;
  private errorPatterns: ErrorPattern[] = [];
  private errorHistory: Map<string, Array<{ error: Error; timestamp: number; context: ErrorContext }>> = new Map();
  private readonly MAX_ERROR_HISTORY = 100;

  constructor(recoveryService: TaskQueueRecoveryService) {
    this.recoveryService = recoveryService;
    this.initializeErrorPatterns();
  }

  /**
   * Handle any error that occurs in the task queue system
   */
  async handleError(
    error: Error, 
    context: ErrorContext
  ): Promise<ErrorHandlingResult> {
    try {
      // Log error for debugging
      this.logError(error, context);
      
      // Record error in history
      this.recordError(error, context);
      
      // Classify the error
      const errorPattern = this.classifyError(error);
      
      // Generate base result
      const result: ErrorHandlingResult = {
        handled: true,
        recovered: false,
        fallbackApplied: false,
        userNotificationRequired: true,
        retryRecommended: errorPattern.retryable,
        errorCode: this.generateErrorCode(error, errorPattern),
        message: errorPattern.userFriendlyMessage,
        technicalDetails: errorPattern.technicalMessage,
        suggestedActions: [...errorPattern.suggestedActions],
        recoveryActions: []
      };

      // Apply error-specific handling
      switch (errorPattern.category) {
        case 'NETWORK':
          return await this.handleNetworkError(error, context, result, errorPattern);
          
        case 'VALIDATION':
          return await this.handleValidationError(error, context, result, errorPattern);
          
        case 'PERSISTENCE':
          return await this.handlePersistenceError(error, context, result, errorPattern);
          
        case 'BUSINESS_LOGIC':
          return await this.handleBusinessLogicError(error, context, result, errorPattern);
          
        case 'SYSTEM':
          return await this.handleSystemError(error, context, result, errorPattern);
          
        case 'SECURITY':
          return await this.handleSecurityError(error, context, result, errorPattern);
          
        case 'RESOURCE':
          return await this.handleResourceError(error, context, result, errorPattern);
          
        case 'TIMEOUT':
          return await this.handleTimeoutError(error, context, result, errorPattern);
          
        default:
          return await this.handleUnknownError(error, context, result);
      }

    } catch (handlingError: any) {
      console.error('Error occurred while handling error:', handlingError);
      
      return {
        handled: false,
        recovered: false,
        fallbackApplied: false,
        userNotificationRequired: true,
        retryRecommended: false,
        errorCode: 'ERROR_HANDLER_FAILURE',
        message: 'An unexpected error occurred while processing your request',
        technicalDetails: `Original error: ${error.message}, Handler error: ${handlingError.message}`,
        suggestedActions: ['Please try again later', 'Contact support if the problem persists'],
        recoveryActions: ['Restart the application']
      };
    }
  }

  /**
   * Handle network-related errors
   */
  private async handleNetworkError(
    error: Error,
    context: ErrorContext,
    result: ErrorHandlingResult,
    pattern: ErrorPattern
  ): Promise<ErrorHandlingResult> {
    // Check if this is a recurring network issue
    const recentNetworkErrors = this.getRecentErrors(context.playerId, 'NETWORK', 300000); // 5 minutes
    
    if (recentNetworkErrors.length >= 3) {
      result.message = 'You appear to be experiencing connectivity issues';
      result.suggestedActions = [
        'Check your internet connection',
        'Try refreshing the page',
        'Switch to offline mode if available'
      ];
      result.fallbackApplied = true;
    }

    // Attempt automatic retry for transient network errors
    if (pattern.retryable && context.operationType !== 'user_initiated') {
      try {
        const retryResult = await taskQueueRetryService.retryQueueOperation(
          context.playerId,
          context.operationType,
          async () => {
            throw error; // This would be replaced with the actual operation
          }
        );

        if (retryResult.success) {
          result.recovered = true;
          result.userNotificationRequired = false;
          result.message = 'Connection restored automatically';
          result.recoveryActions.push('Automatic retry succeeded');
        }
      } catch (retryError) {
        result.recoveryActions.push('Automatic retry failed');
      }
    }

    return result;
  }

  /**
   * Handle validation errors
   */
  private async handleValidationError(
    error: Error,
    context: ErrorContext,
    result: ErrorHandlingResult,
    pattern: ErrorPattern
  ): Promise<ErrorHandlingResult> {
    result.retryRecommended = false; // Validation errors usually don't benefit from retry
    
    // Try to extract specific validation details
    const validationDetails = this.extractValidationDetails(error);
    
    if (validationDetails) {
      result.message = `Invalid data: ${validationDetails.field}`;
      result.suggestedActions = [
        `Please check your ${validationDetails.field}`,
        'Ensure all required fields are filled',
        'Verify data format is correct'
      ];
    } else {
      result.message = pattern.userFriendlyMessage;
    }

    // For queue validation errors, attempt repair
    if (error.message.includes('queue') || error.message.includes('Queue')) {
      try {
        const recoveryResult = await this.recoveryService.recoverQueue(context.playerId, {
          maxRetries: 1,
          gracefulDegradation: true
        });

        if (recoveryResult.success) {
          result.recovered = true;
          result.message = 'Queue data has been automatically repaired';
          result.recoveryActions.push('Queue validation repair succeeded');
        }
      } catch (recoveryError) {
        result.recoveryActions.push('Queue validation repair failed');
      }
    }

    return result;
  }

  /**
   * Handle persistence/database errors
   */
  private async handlePersistenceError(
    error: Error,
    context: ErrorContext,
    result: ErrorHandlingResult,
    pattern: ErrorPattern
  ): Promise<ErrorHandlingResult> {
    // Check for specific database error types
    if (error.message.includes('ConditionalCheckFailed')) {
      result.message = 'Data was modified by another session';
      result.suggestedActions = [
        'Refresh the page',
        'Try your action again'
      ];
      result.retryRecommended = true;
    } else if (error.message.includes('ProvisionedThroughputExceeded')) {
      result.message = 'System is temporarily busy';
      result.suggestedActions = [
        'Please wait a moment and try again',
        'The system will automatically retry'
      ];
      
      // Apply exponential backoff retry
      try {
        const retryResult = await taskQueueRetryService.retryPersistenceOperation(
          context.operationType,
          async () => {
            throw error; // This would be replaced with the actual operation
          }
        );

        if (retryResult.success) {
          result.recovered = true;
          result.userNotificationRequired = false;
          result.recoveryActions.push('Automatic retry with backoff succeeded');
        }
      } catch (retryError) {
        result.recoveryActions.push('Automatic retry with backoff failed');
      }
    }

    // For critical persistence errors, attempt recovery
    if (pattern.severity === 'CRITICAL' || pattern.severity === 'HIGH') {
      try {
        const recoveryResult = await this.recoveryService.recoverQueue(context.playerId, {
          enableCircuitBreaker: true,
          gracefulDegradation: true
        });

        if (recoveryResult.success) {
          result.recovered = true;
          result.recoveryActions.push('Queue recovery from persistence error succeeded');
        }
      } catch (recoveryError) {
        result.recoveryActions.push('Queue recovery from persistence error failed');
      }
    }

    return result;
  }

  /**
   * Handle business logic errors
   */
  private async handleBusinessLogicError(
    error: Error,
    context: ErrorContext,
    result: ErrorHandlingResult,
    pattern: ErrorPattern
  ): Promise<ErrorHandlingResult> {
    result.retryRecommended = false; // Business logic errors usually indicate user action needed

    // Handle specific business logic scenarios
    if (error.message.includes('level') || error.message.includes('skill')) {
      result.message = 'Your level or skill is too low for this action';
      result.suggestedActions = [
        'Level up your character',
        'Improve relevant skills',
        'Try easier tasks first'
      ];
    } else if (error.message.includes('prerequisite') || error.message.includes('requirement')) {
      result.message = 'Requirements not met for this action';
      result.suggestedActions = [
        'Check if you meet all requirements',
        'Complete prerequisite tasks first',
        'Verify you have necessary resources'
      ];
    } else if (error.message.includes('resource') || error.message.includes('insufficient')) {
      result.message = 'Insufficient resources to complete this action';
      result.suggestedActions = [
        'Gather more resources',
        'Complete other tasks to earn resources',
        'Check your inventory'
      ];
    }

    return result;
  }

  /**
   * Handle system errors
   */
  private async handleSystemError(
    error: Error,
    context: ErrorContext,
    result: ErrorHandlingResult,
    pattern: ErrorPattern
  ): Promise<ErrorHandlingResult> {
    // System errors are usually serious and may require recovery
    result.message = 'A system error occurred';
    result.suggestedActions = [
      'Please try again in a few moments',
      'Refresh the page if the problem persists',
      'Contact support if the issue continues'
    ];

    // Attempt system recovery
    try {
      const recoveryResult = await this.recoveryService.recoverQueue(context.playerId, {
        enableCircuitBreaker: true,
        gracefulDegradation: true,
        backupToLocalStorage: true
      });

      if (recoveryResult.success) {
        result.recovered = true;
        result.message = 'System error resolved automatically';
        result.recoveryActions.push('System recovery succeeded');
      } else {
        result.fallbackApplied = true;
        result.recoveryActions.push('System recovery failed, fallback applied');
      }
    } catch (recoveryError) {
      result.recoveryActions.push('System recovery failed completely');
    }

    return result;
  }

  /**
   * Handle security errors
   */
  private async handleSecurityError(
    error: Error,
    context: ErrorContext,
    result: ErrorHandlingResult,
    pattern: ErrorPattern
  ): Promise<ErrorHandlingResult> {
    result.retryRecommended = false;
    result.message = 'Access denied';
    result.suggestedActions = [
      'Please log in again',
      'Check your permissions',
      'Contact support if you believe this is an error'
    ];

    // Log security errors for monitoring
    console.warn('Security error detected:', {
      error: error.message,
      context,
      timestamp: Date.now()
    });

    return result;
  }

  /**
   * Handle resource errors (memory, CPU, etc.)
   */
  private async handleResourceError(
    error: Error,
    context: ErrorContext,
    result: ErrorHandlingResult,
    pattern: ErrorPattern
  ): Promise<ErrorHandlingResult> {
    result.message = 'System resources are temporarily limited';
    result.suggestedActions = [
      'Please wait a moment and try again',
      'Close other browser tabs to free up memory',
      'Try using a simpler operation'
    ];

    // Apply graceful degradation
    try {
      const resourceStatus = await this.recoveryService.getSystemResourceStatus();
      
      if (resourceStatus.isOverloaded) {
        const recoveryResult = await this.recoveryService.recoverQueue(context.playerId, {
          gracefulDegradation: true,
          maxRetries: 1
        });

        if (recoveryResult.success) {
          result.recovered = true;
          result.fallbackApplied = true;
          result.message = 'Switched to simplified mode due to system load';
          result.recoveryActions.push('Graceful degradation applied');
        }
      }
    } catch (recoveryError) {
      result.recoveryActions.push('Graceful degradation failed');
    }

    return result;
  }

  /**
   * Handle timeout errors
   */
  private async handleTimeoutError(
    error: Error,
    context: ErrorContext,
    result: ErrorHandlingResult,
    pattern: ErrorPattern
  ): Promise<ErrorHandlingResult> {
    result.message = 'Operation timed out';
    result.suggestedActions = [
      'Please try again',
      'Check your internet connection',
      'Try a smaller operation if possible'
    ];

    // Attempt retry with longer timeout
    if (pattern.retryable) {
      try {
        const retryResult = await taskQueueRetryService.retryQueueOperation(
          context.playerId,
          context.operationType,
          async () => {
            throw error; // This would be replaced with the actual operation
          },
          {
            maxRetries: 2,
            baseDelayMs: 2000,
            maxDelayMs: 10000
          }
        );

        if (retryResult.success) {
          result.recovered = true;
          result.userNotificationRequired = false;
          result.recoveryActions.push('Retry with extended timeout succeeded');
        }
      } catch (retryError) {
        result.recoveryActions.push('Retry with extended timeout failed');
      }
    }

    return result;
  }

  /**
   * Handle unknown/unclassified errors
   */
  private async handleUnknownError(
    error: Error,
    context: ErrorContext,
    result: ErrorHandlingResult
  ): Promise<ErrorHandlingResult> {
    result.message = 'An unexpected error occurred';
    result.suggestedActions = [
      'Please try again',
      'Refresh the page if the problem persists',
      'Contact support with error details'
    ];
    result.technicalDetails = `Unknown error: ${error.message}`;

    // Attempt generic recovery
    try {
      const recoveryResult = await this.recoveryService.recoverQueue(context.playerId, {
        gracefulDegradation: true
      });

      if (recoveryResult.success) {
        result.recovered = true;
        result.recoveryActions.push('Generic recovery succeeded');
      }
    } catch (recoveryError) {
      result.recoveryActions.push('Generic recovery failed');
    }

    return result;
  }

  /**
   * Initialize error patterns for classification
   */
  private initializeErrorPatterns(): void {
    this.errorPatterns = [
      // Network errors
      {
        pattern: /network|connection|fetch|timeout|offline/i,
        category: 'NETWORK',
        severity: 'MEDIUM',
        retryable: true,
        recoverable: true,
        userFriendlyMessage: 'Connection issue detected',
        technicalMessage: 'Network connectivity problem',
        suggestedActions: ['Check internet connection', 'Try again'],
        recoveryStrategy: 'RETRY'
      },
      
      // Validation errors
      {
        pattern: /validation|invalid|required|format|constraint/i,
        category: 'VALIDATION',
        severity: 'LOW',
        retryable: false,
        recoverable: true,
        userFriendlyMessage: 'Invalid input detected',
        technicalMessage: 'Data validation failed',
        suggestedActions: ['Check your input', 'Ensure all fields are correct'],
        recoveryStrategy: 'USER_INTERVENTION'
      },
      
      // Database/persistence errors
      {
        pattern: /dynamodb|database|persistence|conditional.*check|throughput/i,
        category: 'PERSISTENCE',
        severity: 'HIGH',
        retryable: true,
        recoverable: true,
        userFriendlyMessage: 'Data storage issue',
        technicalMessage: 'Database operation failed',
        suggestedActions: ['Try again in a moment'],
        recoveryStrategy: 'RECOVERY_SERVICE'
      },
      
      // Business logic errors
      {
        pattern: /prerequisite|requirement|insufficient|level.*low|skill.*low/i,
        category: 'BUSINESS_LOGIC',
        severity: 'LOW',
        retryable: false,
        recoverable: false,
        userFriendlyMessage: 'Action requirements not met',
        technicalMessage: 'Business rule violation',
        suggestedActions: ['Meet requirements first', 'Check prerequisites'],
        recoveryStrategy: 'USER_INTERVENTION'
      },
      
      // System errors
      {
        pattern: /system|internal.*error|server.*error|unexpected/i,
        category: 'SYSTEM',
        severity: 'HIGH',
        retryable: true,
        recoverable: true,
        userFriendlyMessage: 'System error occurred',
        technicalMessage: 'Internal system failure',
        suggestedActions: ['Try again', 'Contact support if persistent'],
        recoveryStrategy: 'RECOVERY_SERVICE'
      },
      
      // Security errors
      {
        pattern: /unauthorized|forbidden|access.*denied|authentication|permission/i,
        category: 'SECURITY',
        severity: 'MEDIUM',
        retryable: false,
        recoverable: false,
        userFriendlyMessage: 'Access denied',
        technicalMessage: 'Security validation failed',
        suggestedActions: ['Log in again', 'Check permissions'],
        recoveryStrategy: 'USER_INTERVENTION'
      },
      
      // Resource errors
      {
        pattern: /memory|cpu|resource|overload|capacity|limit/i,
        category: 'RESOURCE',
        severity: 'MEDIUM',
        retryable: true,
        recoverable: true,
        userFriendlyMessage: 'System temporarily busy',
        technicalMessage: 'Resource constraint encountered',
        suggestedActions: ['Wait and try again', 'Close other applications'],
        recoveryStrategy: 'FALLBACK'
      },
      
      // Timeout errors
      {
        pattern: /timeout|timed.*out|deadline.*exceeded/i,
        category: 'TIMEOUT',
        severity: 'MEDIUM',
        retryable: true,
        recoverable: true,
        userFriendlyMessage: 'Operation took too long',
        technicalMessage: 'Timeout exceeded',
        suggestedActions: ['Try again', 'Check connection'],
        recoveryStrategy: 'RETRY'
      }
    ];
  }

  /**
   * Classify error based on patterns
   */
  private classifyError(error: Error): ErrorPattern {
    const errorText = `${error.name} ${error.message}`;
    
    for (const pattern of this.errorPatterns) {
      if (pattern.pattern.test(errorText)) {
        return pattern;
      }
    }

    // Default pattern for unclassified errors
    return {
      pattern: /.*/,
      category: 'SYSTEM',
      severity: 'MEDIUM',
      retryable: true,
      recoverable: true,
      userFriendlyMessage: 'An unexpected error occurred',
      technicalMessage: 'Unclassified error',
      suggestedActions: ['Try again', 'Contact support'],
      recoveryStrategy: 'RECOVERY_SERVICE'
    };
  }

  /**
   * Generate error code for tracking
   */
  private generateErrorCode(error: Error, pattern: ErrorPattern): string {
    const timestamp = Date.now().toString(36);
    const category = pattern.category.substring(0, 3);
    const hash = this.simpleHash(error.message).toString(36);
    const random = Math.random().toString(36).substring(2, 5);
    
    return `${category}_${hash}_${timestamp}_${random}`.toUpperCase();
  }

  /**
   * Simple hash function for error codes
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Extract validation details from error
   */
  private extractValidationDetails(error: Error): { field: string; issue: string } | null {
    const message = error.message;
    
    // Try to extract field name and issue
    const fieldMatch = message.match(/field[:\s]+([a-zA-Z_][a-zA-Z0-9_]*)/i);
    const issueMatch = message.match(/(required|invalid|format|constraint|missing)/i);
    
    if (fieldMatch && issueMatch) {
      return {
        field: fieldMatch[1],
        issue: issueMatch[1]
      };
    }
    
    return null;
  }

  /**
   * Log error for debugging and monitoring
   */
  private logError(error: Error, context: ErrorContext): void {
    const logEntry = {
      timestamp: Date.now(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context,
      userAgent: navigator?.userAgent,
      url: window?.location?.href
    };

    console.error('Task Queue Error:', logEntry);
    
    // In production, this would send to monitoring service
    // this.sendToMonitoringService(logEntry);
  }

  /**
   * Record error in history for pattern analysis
   */
  private recordError(error: Error, context: ErrorContext): void {
    const playerId = context.playerId;
    
    if (!this.errorHistory.has(playerId)) {
      this.errorHistory.set(playerId, []);
    }
    
    const playerErrors = this.errorHistory.get(playerId)!;
    playerErrors.push({
      error,
      timestamp: Date.now(),
      context
    });
    
    // Limit history size
    if (playerErrors.length > this.MAX_ERROR_HISTORY) {
      playerErrors.splice(0, playerErrors.length - this.MAX_ERROR_HISTORY);
    }
  }

  /**
   * Get recent errors for pattern analysis
   */
  private getRecentErrors(
    playerId: string, 
    category?: ErrorCategory, 
    timeWindowMs: number = 300000
  ): Array<{ error: Error; timestamp: number; context: ErrorContext }> {
    const playerErrors = this.errorHistory.get(playerId) || [];
    const cutoffTime = Date.now() - timeWindowMs;
    
    return playerErrors
      .filter(entry => entry.timestamp > cutoffTime)
      .filter(entry => {
        if (!category) return true;
        const pattern = this.classifyError(entry.error);
        return pattern.category === category;
      });
  }

  /**
   * Get error statistics for monitoring
   */
  public getErrorStatistics(playerId?: string): {
    totalErrors: number;
    errorsByCategory: Record<ErrorCategory, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    recentErrorRate: number;
  } {
    const allErrors = playerId 
      ? this.errorHistory.get(playerId) || []
      : Array.from(this.errorHistory.values()).flat();

    const oneHourAgo = Date.now() - 3600000;
    const recentErrors = allErrors.filter(
      entry => entry.timestamp > oneHourAgo
    );

    const errorsByCategory: Record<ErrorCategory, number> = {
      NETWORK: 0,
      VALIDATION: 0,
      PERSISTENCE: 0,
      BUSINESS_LOGIC: 0,
      SYSTEM: 0,
      SECURITY: 0,
      RESOURCE: 0,
      TIMEOUT: 0
    };

    const errorsBySeverity: Record<ErrorSeverity, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0
    };

    for (const entry of allErrors) {
      const pattern = this.classifyError(entry.error);
      errorsByCategory[pattern.category]++;
      errorsBySeverity[pattern.severity]++;
    }

    return {
      totalErrors: allErrors.length,
      errorsByCategory,
      errorsBySeverity,
      recentErrorRate: recentErrors.length / Math.max(1, allErrors.length)
    };
  }
}

// Export singleton instance
export const taskQueueErrorHandler = new TaskQueueErrorHandler(
  // This would be injected in real implementation
  {} as TaskQueueRecoveryService
);