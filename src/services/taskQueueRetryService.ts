/**
 * Task Queue Retry Service
 * Implements automatic retry mechanisms with circuit breaker patterns
 */

import { TaskQueue, Task } from '../types/taskQueue';

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterEnabled: boolean;
  retryableErrors: string[];
  circuitBreakerEnabled: boolean;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attemptCount: number;
  totalDuration: number;
  circuitBreakerTriggered: boolean;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeoutMs: number;
  halfOpenMaxAttempts: number;
  monitoringWindowMs: number;
}

export interface CircuitBreakerMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  failureRate: number;
  averageResponseTime: number;
  lastFailureTime: number;
}

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class TaskQueueRetryService {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private defaultRetryOptions: RetryOptions = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitterEnabled: true,
    retryableErrors: [
      'NETWORK_ERROR',
      'TIMEOUT_ERROR',
      'TEMPORARY_FAILURE',
      'RATE_LIMIT_EXCEEDED',
      'SERVICE_UNAVAILABLE',
      'CONNECTION_ERROR'
    ],
    circuitBreakerEnabled: true
  };

  private defaultCircuitBreakerConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    recoveryTimeoutMs: 60000, // 1 minute
    halfOpenMaxAttempts: 3,
    monitoringWindowMs: 300000 // 5 minutes
  };

  /**
   * Execute operation with retry logic and circuit breaker protection
   */
  async executeWithRetry<T>(
    operationId: string,
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<RetryResult<T>> {
    const opts = { ...this.defaultRetryOptions, ...options };
    const startTime = Date.now();
    let attemptCount = 0;
    let lastError: Error | undefined;

    // Get or create circuit breaker
    const circuitBreaker = this.getCircuitBreaker(operationId);

    // Check circuit breaker state
    if (opts.circuitBreakerEnabled && circuitBreaker.getState() === 'OPEN') {
      return {
        success: false,
        error: new Error('Circuit breaker is OPEN - operation blocked'),
        attemptCount: 0,
        totalDuration: Date.now() - startTime,
        circuitBreakerTriggered: true
      };
    }

    while (attemptCount <= opts.maxRetries) {
      attemptCount++;

      try {
        // Execute the operation
        const operationStartTime = Date.now();
        const result = await operation();
        const operationDuration = Date.now() - operationStartTime;

        // Record success in circuit breaker
        if (opts.circuitBreakerEnabled) {
          circuitBreaker.recordSuccess(operationDuration);
        }

        return {
          success: true,
          result,
          attemptCount,
          totalDuration: Date.now() - startTime,
          circuitBreakerTriggered: false
        };

      } catch (error: any) {
        lastError = error;
        const operationStartTime = Date.now();
        const operationDuration = Date.now() - operationStartTime;

        // Record failure in circuit breaker
        if (opts.circuitBreakerEnabled) {
          circuitBreaker.recordFailure(operationDuration);
        }

        // Check if error is retryable
        if (!this.isRetryableError(error, opts.retryableErrors)) {
          break;
        }

        // Check if we've exhausted retries
        if (attemptCount > opts.maxRetries) {
          break;
        }

        // Check circuit breaker state after failure
        if (opts.circuitBreakerEnabled && circuitBreaker.getState() === 'OPEN') {
          return {
            success: false,
            error: new Error('Circuit breaker opened during retry attempts'),
            attemptCount,
            totalDuration: Date.now() - startTime,
            circuitBreakerTriggered: true
          };
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(attemptCount, opts);
        await this.delay(delay);
      }
    }

    return {
      success: false,
      error: lastError || new Error('Operation failed after all retry attempts'),
      attemptCount,
      totalDuration: Date.now() - startTime,
      circuitBreakerTriggered: false
    };
  }

  /**
   * Retry queue operations with specific error handling
   */
  async retryQueueOperation<T>(
    playerId: string,
    operationType: string,
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<RetryResult<T>> {
    const operationId = `${playerId}_${operationType}`;
    
    const queueSpecificOptions: Partial<RetryOptions> = {
      maxRetries: 5,
      baseDelayMs: 500,
      maxDelayMs: 10000,
      retryableErrors: [
        'QUEUE_LOCKED',
        'VERSION_CONFLICT',
        'NETWORK_ERROR',
        'TIMEOUT_ERROR',
        'TEMPORARY_FAILURE',
        'RATE_LIMIT_EXCEEDED',
        'SERVICE_UNAVAILABLE',
        'CONNECTION_ERROR',
        'VALIDATION_ERROR'
      ],
      ...options
    };

    return await this.executeWithRetry(operationId, operation, queueSpecificOptions);
  }

  /**
   * Retry task processing with exponential backoff
   */
  async retryTaskProcessing(
    taskId: string,
    processTask: () => Promise<Task>,
    options: Partial<RetryOptions> = {}
  ): Promise<RetryResult<Task>> {
    const operationId = `task_processing_${taskId}`;
    
    const taskSpecificOptions: Partial<RetryOptions> = {
      maxRetries: 3,
      baseDelayMs: 2000,
      maxDelayMs: 60000,
      backoffMultiplier: 3,
      retryableErrors: [
        'RESOURCE_UNAVAILABLE',
        'PREREQUISITE_NOT_MET',
        'TEMPORARY_FAILURE',
        'NETWORK_ERROR',
        'TIMEOUT_ERROR'
      ],
      ...options
    };

    return await this.executeWithRetry(operationId, processTask, taskSpecificOptions);
  }

  /**
   * Retry persistence operations with database-specific handling
   */
  async retryPersistenceOperation<T>(
    operationType: string,
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<RetryResult<T>> {
    const operationId = `persistence_${operationType}`;
    
    const persistenceSpecificOptions: Partial<RetryOptions> = {
      maxRetries: 5,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      jitterEnabled: true,
      retryableErrors: [
        'CONNECTION_ERROR',
        'TIMEOUT_ERROR',
        'THROTTLING_ERROR',
        'TEMPORARY_FAILURE',
        'CONDITIONAL_CHECK_FAILED',
        'PROVISIONED_THROUGHPUT_EXCEEDED',
        'SERVICE_UNAVAILABLE'
      ],
      ...options
    };

    return await this.executeWithRetry(operationId, operation, persistenceSpecificOptions);
  }

  /**
   * Get circuit breaker for operation
   */
  private getCircuitBreaker(operationId: string): CircuitBreaker {
    if (!this.circuitBreakers.has(operationId)) {
      this.circuitBreakers.set(
        operationId, 
        new CircuitBreaker(operationId, this.defaultCircuitBreakerConfig)
      );
    }
    return this.circuitBreakers.get(operationId)!;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error, retryableErrors: string[]): boolean {
    const errorMessage = error.message.toUpperCase();
    const errorName = error.name.toUpperCase();
    
    return retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError) || 
      errorName.includes(retryableError)
    );
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(attemptCount: number, options: RetryOptions): number {
    const exponentialDelay = options.baseDelayMs * Math.pow(options.backoffMultiplier, attemptCount - 1);
    const cappedDelay = Math.min(exponentialDelay, options.maxDelayMs);
    
    if (options.jitterEnabled) {
      // Add random jitter (±25%)
      const jitter = cappedDelay * 0.25 * (Math.random() - 0.5);
      return Math.max(0, cappedDelay + jitter);
    }
    
    return cappedDelay;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get circuit breaker status for monitoring
   */
  public getCircuitBreakerStatus(operationId: string): {
    state: CircuitBreakerState;
    metrics: CircuitBreakerMetrics;
  } | null {
    const circuitBreaker = this.circuitBreakers.get(operationId);
    if (!circuitBreaker) {
      return null;
    }

    return {
      state: circuitBreaker.getState(),
      metrics: circuitBreaker.getMetrics()
    };
  }

  /**
   * Get all circuit breaker statuses
   */
  public getAllCircuitBreakerStatuses(): Map<string, {
    state: CircuitBreakerState;
    metrics: CircuitBreakerMetrics;
  }> {
    const statuses = new Map();
    
    for (const [operationId, circuitBreaker] of this.circuitBreakers) {
      statuses.set(operationId, {
        state: circuitBreaker.getState(),
        metrics: circuitBreaker.getMetrics()
      });
    }
    
    return statuses;
  }

  /**
   * Reset circuit breaker (admin function)
   */
  public resetCircuitBreaker(operationId: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(operationId);
    if (circuitBreaker) {
      circuitBreaker.reset();
      return true;
    }
    return false;
  }

  /**
   * Reset all circuit breakers
   */
  public resetAllCircuitBreakers(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.reset();
    }
  }
}

/**
 * Circuit Breaker Implementation
 */
class CircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private lastSuccessTime = 0;
  private halfOpenAttempts = 0;
  private metrics: CircuitBreakerMetrics;
  private requestHistory: Array<{ timestamp: number; success: boolean; duration: number }> = [];

  constructor(
    private operationId: string,
    private config: CircuitBreakerConfig
  ) {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      failureRate: 0,
      averageResponseTime: 0,
      lastFailureTime: 0
    };
  }

  /**
   * Record successful operation
   */
  recordSuccess(duration: number): void {
    const now = Date.now();
    this.lastSuccessTime = now;
    this.successCount++;
    this.metrics.totalRequests++;
    this.metrics.successfulRequests++;
    
    // Add to request history
    this.requestHistory.push({ timestamp: now, success: true, duration });
    this.cleanupOldHistory();
    
    // Update metrics
    this.updateMetrics();

    // Handle state transitions
    if (this.state === 'HALF_OPEN') {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.config.halfOpenMaxAttempts) {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.halfOpenAttempts = 0;
        console.log(`Circuit breaker ${this.operationId} transitioned to CLOSED`);
      }
    } else if (this.state === 'OPEN') {
      // Success during OPEN state shouldn't happen, but handle gracefully
      this.state = 'HALF_OPEN';
      this.halfOpenAttempts = 1;
      console.log(`Circuit breaker ${this.operationId} transitioned to HALF_OPEN`);
    }
  }

  /**
   * Record failed operation
   */
  recordFailure(duration: number): void {
    const now = Date.now();
    this.lastFailureTime = now;
    this.failureCount++;
    this.metrics.totalRequests++;
    this.metrics.failedRequests++;
    this.metrics.lastFailureTime = now;
    
    // Add to request history
    this.requestHistory.push({ timestamp: now, success: false, duration });
    this.cleanupOldHistory();
    
    // Update metrics
    this.updateMetrics();

    // Handle state transitions
    if (this.state === 'CLOSED' || this.state === 'HALF_OPEN') {
      if (this.failureCount >= this.config.failureThreshold) {
        this.state = 'OPEN';
        this.halfOpenAttempts = 0;
        console.log(`Circuit breaker ${this.operationId} transitioned to OPEN`);
      }
    }
  }

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitBreakerState {
    // Check if OPEN circuit breaker should transition to HALF_OPEN
    if (this.state === 'OPEN') {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure >= this.config.recoveryTimeoutMs) {
        this.state = 'HALF_OPEN';
        this.halfOpenAttempts = 0;
        console.log(`Circuit breaker ${this.operationId} transitioned to HALF_OPEN`);
      }
    }

    return this.state;
  }

  /**
   * Get circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.lastSuccessTime = 0;
    this.halfOpenAttempts = 0;
    this.requestHistory = [];
    
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      failureRate: 0,
      averageResponseTime: 0,
      lastFailureTime: 0
    };

    console.log(`Circuit breaker ${this.operationId} reset`);
  }

  /**
   * Update metrics based on request history
   */
  private updateMetrics(): void {
    if (this.requestHistory.length === 0) {
      return;
    }

    // Calculate failure rate
    const recentRequests = this.requestHistory.filter(
      req => Date.now() - req.timestamp <= this.config.monitoringWindowMs
    );

    if (recentRequests.length > 0) {
      const failures = recentRequests.filter(req => !req.success).length;
      this.metrics.failureRate = failures / recentRequests.length;
    }

    // Calculate average response time
    const totalDuration = this.requestHistory.reduce((sum, req) => sum + req.duration, 0);
    this.metrics.averageResponseTime = totalDuration / this.requestHistory.length;
  }

  /**
   * Clean up old request history
   */
  private cleanupOldHistory(): void {
    const cutoffTime = Date.now() - this.config.monitoringWindowMs;
    this.requestHistory = this.requestHistory.filter(req => req.timestamp > cutoffTime);
  }
}

// Export singleton instance
export const taskQueueRetryService = new TaskQueueRetryService();