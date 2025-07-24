/**
 * Task Queue Retry Service Tests
 */

import { TaskQueueRetryService, RetryOptions, RetryResult } from '../taskQueueRetryService';

describe('TaskQueueRetryService', () => {
  let retryService: TaskQueueRetryService;

  beforeEach(() => {
    retryService = new TaskQueueRetryService();
    jest.clearAllMocks();
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      const result = await retryService.executeWithRetry('test-op', mockOperation);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attemptCount).toBe(1);
      expect(result.circuitBreakerTriggered).toBe(false);
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('NETWORK_ERROR'))
        .mockRejectedValueOnce(new Error('TIMEOUT_ERROR'))
        .mockResolvedValue('success');

      const result = await retryService.executeWithRetry('test-op', mockOperation, {
        maxRetries: 3,
        baseDelayMs: 10 // Short delay for testing
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attemptCount).toBe(3);
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable errors', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('VALIDATION_FAILED'));

      const result = await retryService.executeWithRetry('test-op', mockOperation, {
        retryableErrors: ['NETWORK_ERROR', 'TIMEOUT_ERROR']
      });

      expect(result.success).toBe(false);
      expect(result.attemptCount).toBe(1);
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should respect maximum retry attempts', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('NETWORK_ERROR'));

      const result = await retryService.executeWithRetry('test-op', mockOperation, {
        maxRetries: 2,
        baseDelayMs: 10
      });

      expect(result.success).toBe(false);
      expect(result.attemptCount).toBe(3); // Initial attempt + 2 retries
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should apply exponential backoff', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('NETWORK_ERROR'))
        .mockRejectedValueOnce(new Error('NETWORK_ERROR'))
        .mockResolvedValue('success');

      const startTime = Date.now();
      
      const result = await retryService.executeWithRetry('test-op', mockOperation, {
        maxRetries: 2,
        baseDelayMs: 100,
        backoffMultiplier: 2,
        jitterEnabled: false
      });

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(result.success).toBe(true);
      expect(totalTime).toBeGreaterThan(300); // 100ms + 200ms delays
      expect(totalTime).toBeLessThan(500); // Allow some tolerance
    });

    it('should apply jitter when enabled', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('NETWORK_ERROR'))
        .mockResolvedValue('success');

      const delays: number[] = [];
      const originalDelay = (retryService as any).delay;
      (retryService as any).delay = jest.fn().mockImplementation((ms: number) => {
        delays.push(ms);
        return originalDelay.call(retryService, 1); // Use minimal delay for testing
      });

      await retryService.executeWithRetry('test-op', mockOperation, {
        maxRetries: 1,
        baseDelayMs: 1000,
        jitterEnabled: true
      });

      expect(delays.length).toBe(1);
      // With jitter, delay should be within ±25% of base delay
      expect(delays[0]).toBeGreaterThan(750);
      expect(delays[0]).toBeLessThan(1250);
    });

    it('should handle circuit breaker open state', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('SERVICE_UNAVAILABLE'));

      // Trigger circuit breaker by causing multiple failures
      for (let i = 0; i < 6; i++) {
        await retryService.executeWithRetry('test-op', mockOperation, {
          maxRetries: 0,
          circuitBreakerEnabled: true
        });
      }

      // Now circuit breaker should be open
      const result = await retryService.executeWithRetry('test-op', mockOperation, {
        circuitBreakerEnabled: true
      });

      expect(result.success).toBe(false);
      expect(result.circuitBreakerTriggered).toBe(true);
      expect(result.error?.message).toContain('Circuit breaker is OPEN');
    });

    it('should transition circuit breaker from open to half-open', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('SERVICE_UNAVAILABLE'));

      // Trigger circuit breaker
      for (let i = 0; i < 6; i++) {
        await retryService.executeWithRetry('test-op', mockOperation, {
          maxRetries: 0,
          circuitBreakerEnabled: true
        });
      }

      // Wait for recovery timeout (mocked)
      const circuitBreaker = (retryService as any).getCircuitBreaker('test-op');
      circuitBreaker.lastFailureTime = Date.now() - 61000; // 61 seconds ago

      // Now operation should be allowed (half-open state)
      mockOperation.mockResolvedValueOnce('success');
      
      const result = await retryService.executeWithRetry('test-op', mockOperation, {
        circuitBreakerEnabled: true
      });

      expect(result.success).toBe(true);
      expect(result.circuitBreakerTriggered).toBe(false);
    });
  });

  describe('retryQueueOperation', () => {
    it('should use queue-specific retry options', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('QUEUE_LOCKED'))
        .mockResolvedValue('success');

      const result = await retryService.retryQueueOperation(
        'player-1',
        'add_task',
        mockOperation
      );

      expect(result.success).toBe(true);
      expect(result.attemptCount).toBe(2);
    });

    it('should handle version conflicts', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('VERSION_CONFLICT'))
        .mockRejectedValueOnce(new Error('VERSION_CONFLICT'))
        .mockResolvedValue('success');

      const result = await retryService.retryQueueOperation(
        'player-1',
        'update_queue',
        mockOperation
      );

      expect(result.success).toBe(true);
      expect(result.attemptCount).toBe(3);
    });
  });

  describe('retryTaskProcessing', () => {
    it('should use task-specific retry options', async () => {
      const mockTask = { id: 'task-1', type: 'harvesting' } as any;
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('RESOURCE_UNAVAILABLE'))
        .mockResolvedValue(mockTask);

      const result = await retryService.retryTaskProcessing(
        'task-1',
        mockOperation
      );

      expect(result.success).toBe(true);
      expect(result.result).toEqual(mockTask);
      expect(result.attemptCount).toBe(2);
    });

    it('should handle prerequisite failures', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('PREREQUISITE_NOT_MET'));

      const result = await retryService.retryTaskProcessing(
        'task-1',
        mockOperation,
        { maxRetries: 2 }
      );

      expect(result.success).toBe(false);
      expect(result.attemptCount).toBe(3); // Initial + 2 retries
    });
  });

  describe('retryPersistenceOperation', () => {
    it('should use persistence-specific retry options', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('CONNECTION_ERROR'))
        .mockRejectedValueOnce(new Error('TIMEOUT_ERROR'))
        .mockResolvedValue('saved');

      const result = await retryService.retryPersistenceOperation(
        'save_queue',
        mockOperation
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe('saved');
      expect(result.attemptCount).toBe(3);
    });

    it('should handle DynamoDB throttling', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('PROVISIONED_THROUGHPUT_EXCEEDED'))
        .mockRejectedValueOnce(new Error('THROTTLING_ERROR'))
        .mockResolvedValue('saved');

      const result = await retryService.retryPersistenceOperation(
        'save_queue',
        mockOperation
      );

      expect(result.success).toBe(true);
      expect(result.attemptCount).toBe(3);
    });

    it('should handle conditional check failures', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('CONDITIONAL_CHECK_FAILED'))
        .mockResolvedValue('saved');

      const result = await retryService.retryPersistenceOperation(
        'atomic_update',
        mockOperation
      );

      expect(result.success).toBe(true);
      expect(result.attemptCount).toBe(2);
    });
  });

  describe('circuit breaker management', () => {
    it('should provide circuit breaker status', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('SERVICE_UNAVAILABLE'));

      // Cause some failures
      await retryService.executeWithRetry('test-op', mockOperation, {
        maxRetries: 0,
        circuitBreakerEnabled: true
      });

      const status = retryService.getCircuitBreakerStatus('test-op');
      
      expect(status).toBeDefined();
      expect(status?.state).toBe('CLOSED'); // Not enough failures yet
      expect(status?.metrics.totalRequests).toBe(1);
      expect(status?.metrics.failedRequests).toBe(1);
    });

    it('should provide all circuit breaker statuses', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('SERVICE_UNAVAILABLE'));

      await retryService.executeWithRetry('op-1', mockOperation, { maxRetries: 0 });
      await retryService.executeWithRetry('op-2', mockOperation, { maxRetries: 0 });

      const allStatuses = retryService.getAllCircuitBreakerStatuses();
      
      expect(allStatuses.size).toBe(2);
      expect(allStatuses.has('op-1')).toBe(true);
      expect(allStatuses.has('op-2')).toBe(true);
    });

    it('should reset circuit breaker', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('SERVICE_UNAVAILABLE'));

      // Trigger circuit breaker
      for (let i = 0; i < 6; i++) {
        await retryService.executeWithRetry('test-op', mockOperation, {
          maxRetries: 0,
          circuitBreakerEnabled: true
        });
      }

      let status = retryService.getCircuitBreakerStatus('test-op');
      expect(status?.state).toBe('OPEN');

      // Reset circuit breaker
      const resetResult = retryService.resetCircuitBreaker('test-op');
      expect(resetResult).toBe(true);

      status = retryService.getCircuitBreakerStatus('test-op');
      expect(status?.state).toBe('CLOSED');
    });

    it('should reset all circuit breakers', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('SERVICE_UNAVAILABLE'));

      // Create multiple circuit breakers with failures
      for (let i = 0; i < 6; i++) {
        await retryService.executeWithRetry('op-1', mockOperation, { maxRetries: 0 });
        await retryService.executeWithRetry('op-2', mockOperation, { maxRetries: 0 });
      }

      retryService.resetAllCircuitBreakers();

      const allStatuses = retryService.getAllCircuitBreakerStatuses();
      for (const [, status] of allStatuses) {
        expect(status.state).toBe('CLOSED');
        expect(status.metrics.totalRequests).toBe(0);
      }
    });
  });

  describe('error classification', () => {
    it('should correctly identify retryable errors', async () => {
      const retryableErrors = [
        'NETWORK_ERROR',
        'TIMEOUT_ERROR',
        'SERVICE_UNAVAILABLE',
        'CONNECTION_ERROR'
      ];

      for (const errorType of retryableErrors) {
        const mockOperation = jest.fn()
          .mockRejectedValueOnce(new Error(errorType))
          .mockResolvedValue('success');

        const result = await retryService.executeWithRetry('test-op', mockOperation, {
          maxRetries: 1,
          baseDelayMs: 1
        });

        expect(result.success).toBe(true);
        expect(result.attemptCount).toBe(2);
      }
    });

    it('should correctly identify non-retryable errors', async () => {
      const nonRetryableErrors = [
        'VALIDATION_ERROR',
        'AUTHENTICATION_ERROR',
        'AUTHORIZATION_ERROR'
      ];

      for (const errorType of nonRetryableErrors) {
        const mockOperation = jest.fn().mockRejectedValue(new Error(errorType));

        const result = await retryService.executeWithRetry('test-op', mockOperation, {
          retryableErrors: ['NETWORK_ERROR', 'TIMEOUT_ERROR']
        });

        expect(result.success).toBe(false);
        expect(result.attemptCount).toBe(1);
      }
    });
  });

  describe('delay calculation', () => {
    it('should calculate exponential backoff correctly', async () => {
      const calculateDelay = (retryService as any).calculateDelay.bind(retryService);
      
      const options: RetryOptions = {
        maxRetries: 5,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2,
        jitterEnabled: false,
        retryableErrors: [],
        circuitBreakerEnabled: false
      };

      expect(calculateDelay(1, options)).toBe(1000);   // 1000 * 2^0
      expect(calculateDelay(2, options)).toBe(2000);   // 1000 * 2^1
      expect(calculateDelay(3, options)).toBe(4000);   // 1000 * 2^2
      expect(calculateDelay(4, options)).toBe(8000);   // 1000 * 2^3
      expect(calculateDelay(5, options)).toBe(16000);  // 1000 * 2^4
    });

    it('should respect maximum delay', async () => {
      const calculateDelay = (retryService as any).calculateDelay.bind(retryService);
      
      const options: RetryOptions = {
        maxRetries: 10,
        baseDelayMs: 1000,
        maxDelayMs: 5000,
        backoffMultiplier: 2,
        jitterEnabled: false,
        retryableErrors: [],
        circuitBreakerEnabled: false
      };

      expect(calculateDelay(10, options)).toBe(5000); // Capped at maxDelayMs
    });

    it('should apply jitter when enabled', async () => {
      const calculateDelay = (retryService as any).calculateDelay.bind(retryService);
      
      const options: RetryOptions = {
        maxRetries: 5,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2,
        jitterEnabled: true,
        retryableErrors: [],
        circuitBreakerEnabled: false
      };

      const delays = [];
      for (let i = 0; i < 10; i++) {
        delays.push(calculateDelay(2, options));
      }

      // All delays should be different due to jitter
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);

      // All delays should be within jitter range (±25% of 2000ms)
      for (const delay of delays) {
        expect(delay).toBeGreaterThan(1500);
        expect(delay).toBeLessThan(2500);
      }
    });
  });

  describe('performance and metrics', () => {
    it('should track operation duration', async () => {
      const mockOperation = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('success'), 50))
      );

      const result = await retryService.executeWithRetry('test-op', mockOperation);

      expect(result.success).toBe(true);
      expect(result.totalDuration).toBeGreaterThan(40);
      expect(result.totalDuration).toBeLessThan(100);
    });

    it('should track circuit breaker metrics', async () => {
      const mockOperation = jest.fn()
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('NETWORK_ERROR'))
        .mockResolvedValueOnce('success');

      // Execute operations to generate metrics
      await retryService.executeWithRetry('test-op', mockOperation);
      await retryService.executeWithRetry('test-op', mockOperation, { maxRetries: 0 });
      await retryService.executeWithRetry('test-op', mockOperation);

      const status = retryService.getCircuitBreakerStatus('test-op');
      
      expect(status?.metrics.totalRequests).toBe(3);
      expect(status?.metrics.successfulRequests).toBe(2);
      expect(status?.metrics.failedRequests).toBe(1);
      expect(status?.metrics.failureRate).toBeCloseTo(0.33, 1);
    });
  });
});