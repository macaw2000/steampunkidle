/**
 * Task Queue Error Handler Tests
 */

import { TaskQueueErrorHandler, ErrorContext, ErrorHandlingResult } from '../taskQueueErrorHandler';
import { TaskQueueRecoveryService } from '../taskQueueRecoveryService';

// Mock dependencies
jest.mock('../taskQueueRecoveryService');
jest.mock('../taskQueueRetryService');

describe('TaskQueueErrorHandler', () => {
  let errorHandler: TaskQueueErrorHandler;
  let mockRecoveryService: jest.Mocked<TaskQueueRecoveryService>;

  const mockContext: ErrorContext = {
    playerId: 'test-player',
    operationType: 'add_task',
    taskId: 'task-1',
    timestamp: Date.now(),
    sessionId: 'session-1'
  };

  beforeEach(() => {
    mockRecoveryService = {
      recoverQueue: jest.fn(),
      getSystemResourceStatus: jest.fn(),
      getCircuitBreakerStatus: jest.fn(),
      forceResetCircuitBreaker: jest.fn()
    } as any;

    errorHandler = new TaskQueueErrorHandler(mockRecoveryService);
  });

  describe('handleError', () => {
    it('should handle network errors correctly', async () => {
      const networkError = new Error('Network connection failed');
      
      const result = await errorHandler.handleError(networkError, mockContext);

      expect(result.handled).toBe(true);
      expect(result.errorCode).toContain('NET');
      expect(result.message).toContain('Connection issue detected');
      expect(result.retryRecommended).toBe(true);
      expect(result.suggestedActions).toContain('Check internet connection');
    });

    it('should handle validation errors correctly', async () => {
      const validationError = new Error('Validation failed: field name is required');
      
      const result = await errorHandler.handleError(validationError, mockContext);

      expect(result.handled).toBe(true);
      expect(result.errorCode).toContain('VAL');
      expect(result.message).toContain('Invalid input detected');
      expect(result.retryRecommended).toBe(false);
      expect(result.suggestedActions).toContain('Check your input');
    });

    it('should handle persistence errors correctly', async () => {
      const persistenceError = new Error('DynamoDB ConditionalCheckFailed');
      
      const result = await errorHandler.handleError(persistenceError, mockContext);

      expect(result.handled).toBe(true);
      expect(result.errorCode).toContain('PER');
      expect(result.message).toContain('Data was modified by another session');
      expect(result.retryRecommended).toBe(true);
      expect(result.suggestedActions).toContain('Refresh the page');
    });

    it('should handle business logic errors correctly', async () => {
      const businessError = new Error('Insufficient resources to complete task');
      
      const result = await errorHandler.handleError(businessError, mockContext);

      expect(result.handled).toBe(true);
      expect(result.errorCode).toContain('BUS');
      expect(result.message).toContain('Insufficient resources');
      expect(result.retryRecommended).toBe(false);
      expect(result.suggestedActions).toContain('Gather more resources');
    });

    it('should handle system errors with recovery', async () => {
      const systemError = new Error('Internal server error occurred');
      
      mockRecoveryService.recoverQueue.mockResolvedValue({
        success: true,
        recoveredQueue: {} as any,
        errors: [],
        warnings: [],
        recoveryMethod: 'state_repair',
        duration: 1000
      });

      const result = await errorHandler.handleError(systemError, mockContext);

      expect(result.handled).toBe(true);
      expect(result.recovered).toBe(true);
      expect(result.message).toBe('System error resolved automatically');
      expect(mockRecoveryService.recoverQueue).toHaveBeenCalledWith('test-player', {
        enableCircuitBreaker: true,
        gracefulDegradation: true,
        backupToLocalStorage: true
      });
    });

    it('should handle security errors correctly', async () => {
      const securityError = new Error('Unauthorized access denied');
      
      const result = await errorHandler.handleError(securityError, mockContext);

      expect(result.handled).toBe(true);
      expect(result.errorCode).toContain('SEC');
      expect(result.message).toBe('Access denied');
      expect(result.retryRecommended).toBe(false);
      expect(result.suggestedActions).toContain('Please log in again');
    });

    it('should handle resource errors with graceful degradation', async () => {
      const resourceError = new Error('Memory limit exceeded');
      
      mockRecoveryService.getSystemResourceStatus.mockResolvedValue({
        memoryUsage: 0.95,
        cpuUsage: 0.8,
        databaseConnections: 100,
        activeOperations: 50,
        isOverloaded: true,
        degradationLevel: 'moderate'
      });

      mockRecoveryService.recoverQueue.mockResolvedValue({
        success: true,
        fallbackQueue: {} as any,
        errors: [],
        warnings: [],
        recoveryMethod: 'graceful_degradation',
        duration: 500
      });

      const result = await errorHandler.handleError(resourceError, mockContext);

      expect(result.handled).toBe(true);
      expect(result.recovered).toBe(true);
      expect(result.fallbackApplied).toBe(true);
      expect(result.message).toBe('Switched to simplified mode due to system load');
    });

    it('should handle timeout errors with retry', async () => {
      const timeoutError = new Error('Operation timed out after 30 seconds');
      
      const result = await errorHandler.handleError(timeoutError, mockContext);

      expect(result.handled).toBe(true);
      expect(result.errorCode).toContain('TIM');
      expect(result.message).toBe('Operation timed out');
      expect(result.retryRecommended).toBe(true);
      expect(result.suggestedActions).toContain('Please try again');
    });

    it('should handle unknown errors with generic recovery', async () => {
      const unknownError = new Error('Something completely unexpected happened');
      
      mockRecoveryService.recoverQueue.mockResolvedValue({
        success: true,
        recoveredQueue: {} as any,
        errors: [],
        warnings: [],
        recoveryMethod: 'fallback_creation',
        duration: 800
      });

      const result = await errorHandler.handleError(unknownError, mockContext);

      expect(result.handled).toBe(true);
      expect(result.recovered).toBe(true);
      expect(result.message).toBe('An unexpected error occurred');
      expect(result.technicalDetails).toContain('Unknown error');
      expect(result.suggestedActions).toContain('Contact support');
    });

    it('should handle recurring network errors', async () => {
      const networkError = new Error('Network connection failed');
      
      // Simulate multiple network errors
      for (let i = 0; i < 3; i++) {
        await errorHandler.handleError(networkError, mockContext);
      }

      const result = await errorHandler.handleError(networkError, mockContext);

      expect(result.message).toBe('You appear to be experiencing connectivity issues');
      expect(result.fallbackApplied).toBe(true);
      expect(result.suggestedActions).toContain('Switch to offline mode if available');
    });

    it('should extract validation field details', async () => {
      const validationError = new Error('Validation failed: field email is invalid format');
      
      const result = await errorHandler.handleError(validationError, mockContext);

      expect(result.message).toContain('email');
      expect(result.suggestedActions).toContain('Please check your email');
    });

    it('should handle queue validation errors with repair', async () => {
      const queueError = new Error('Queue validation failed: checksum mismatch');
      
      mockRecoveryService.recoverQueue.mockResolvedValue({
        success: true,
        recoveredQueue: {} as any,
        errors: [],
        warnings: [],
        recoveryMethod: 'state_repair',
        duration: 300
      });

      const result = await errorHandler.handleError(queueError, mockContext);

      expect(result.recovered).toBe(true);
      expect(result.message).toBe('Queue data has been automatically repaired');
      expect(result.recoveryActions).toContain('Queue validation repair succeeded');
    });

    it('should handle DynamoDB throttling errors', async () => {
      const throttlingError = new Error('ProvisionedThroughputExceeded: Request rate too high');
      
      const result = await errorHandler.handleError(throttlingError, mockContext);

      expect(result.message).toBe('System is temporarily busy');
      expect(result.suggestedActions).toContain('Please wait a moment and try again');
    });

    it('should handle prerequisite errors', async () => {
      const prerequisiteError = new Error('Prerequisite not met: player level too low');
      
      const result = await errorHandler.handleError(prerequisiteError, mockContext);

      expect(result.message).toBe('Requirements not met for this action');
      expect(result.suggestedActions).toContain('Check if you meet all requirements');
    });

    it('should handle level requirement errors', async () => {
      const levelError = new Error('Player level is too low for this action');
      
      const result = await errorHandler.handleError(levelError, mockContext);

      expect(result.message).toBe('Your level or skill is too low for this action');
      expect(result.suggestedActions).toContain('Level up your character');
    });

    it('should handle error handler failures gracefully', async () => {
      // Mock the recovery service to throw an error
      mockRecoveryService.recoverQueue.mockRejectedValue(new Error('Recovery service failed'));
      
      const originalError = new Error('Original error');
      
      // Mock the error handler to throw during processing
      const originalMethod = errorHandler.handleError;
      errorHandler.handleError = jest.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });

      const result = await originalMethod.call(errorHandler, originalError, mockContext);

      expect(result.handled).toBe(false);
      expect(result.errorCode).toBe('ERROR_HANDLER_FAILURE');
      expect(result.technicalDetails).toContain('Original error');
      expect(result.technicalDetails).toContain('Handler error');
    });
  });

  describe('error classification', () => {
    it('should classify errors by category correctly', async () => {
      const testCases = [
        { error: new Error('network timeout'), expectedCategory: 'NET' },
        { error: new Error('validation required field'), expectedCategory: 'VAL' },
        { error: new Error('dynamodb error'), expectedCategory: 'PER' },
        { error: new Error('insufficient resources'), expectedCategory: 'BUS' },
        { error: new Error('system internal error'), expectedCategory: 'SYS' },
        { error: new Error('unauthorized access'), expectedCategory: 'SEC' },
        { error: new Error('memory overload'), expectedCategory: 'RES' },
        { error: new Error('operation timed out'), expectedCategory: 'TIM' }
      ];

      for (const testCase of testCases) {
        const result = await errorHandler.handleError(testCase.error, mockContext);
        expect(result.errorCode).toContain(testCase.expectedCategory);
      }
    });

    it('should determine retryability correctly', async () => {
      const retryableErrors = [
        new Error('network connection failed'),
        new Error('timeout occurred'),
        new Error('system error'),
        new Error('resource limit')
      ];

      const nonRetryableErrors = [
        new Error('validation failed'),
        new Error('unauthorized access'),
        new Error('insufficient resources')
      ];

      for (const error of retryableErrors) {
        const result = await errorHandler.handleError(error, mockContext);
        expect(result.retryRecommended).toBe(true);
      }

      for (const error of nonRetryableErrors) {
        const result = await errorHandler.handleError(error, mockContext);
        expect(result.retryRecommended).toBe(false);
      }
    });
  });

  describe('error statistics', () => {
    it('should track error statistics for a player', async () => {
      const errors = [
        new Error('network error'),
        new Error('validation error'),
        new Error('network error'),
        new Error('system error')
      ];

      for (const error of errors) {
        await errorHandler.handleError(error, mockContext);
      }

      const stats = errorHandler.getErrorStatistics('test-player');

      expect(stats.totalErrors).toBe(4);
      expect(stats.errorsByCategory.NETWORK).toBe(2);
      expect(stats.errorsByCategory.VALIDATION).toBe(1);
      expect(stats.errorsByCategory.SYSTEM).toBe(1);
    });

    it('should track global error statistics', async () => {
      const contexts = [
        { ...mockContext, playerId: 'player-1' },
        { ...mockContext, playerId: 'player-2' }
      ];

      await errorHandler.handleError(new Error('network error'), contexts[0]);
      await errorHandler.handleError(new Error('validation error'), contexts[1]);

      const stats = errorHandler.getErrorStatistics();

      expect(stats.totalErrors).toBe(2);
      expect(stats.errorsByCategory.NETWORK).toBe(1);
      expect(stats.errorsByCategory.VALIDATION).toBe(1);
    });

    it('should calculate recent error rate', async () => {
      // Add some old errors (simulated)
      const oldContext = { ...mockContext, timestamp: Date.now() - 7200000 }; // 2 hours ago
      await errorHandler.handleError(new Error('old error'), oldContext);

      // Add recent errors
      await errorHandler.handleError(new Error('recent error 1'), mockContext);
      await errorHandler.handleError(new Error('recent error 2'), mockContext);

      const stats = errorHandler.getErrorStatistics('test-player');

      expect(stats.totalErrors).toBe(3);
      expect(stats.recentErrorRate).toBeCloseTo(0.67, 1); // 2 recent out of 3 total
    });
  });

  describe('error history and patterns', () => {
    it('should maintain error history per player', async () => {
      const errors = Array.from({ length: 5 }, (_, i) => new Error(`Error ${i}`));

      for (const error of errors) {
        await errorHandler.handleError(error, mockContext);
      }

      // Check that history is maintained (this would be tested through internal methods in real implementation)
      const stats = errorHandler.getErrorStatistics('test-player');
      expect(stats.totalErrors).toBe(5);
    });

    it('should limit error history size', async () => {
      // Generate more errors than the maximum history size
      const maxHistory = 100; // Assuming this is the limit
      const errors = Array.from({ length: maxHistory + 10 }, (_, i) => new Error(`Error ${i}`));

      for (const error of errors) {
        await errorHandler.handleError(error, mockContext);
      }

      const stats = errorHandler.getErrorStatistics('test-player');
      expect(stats.totalErrors).toBeLessThanOrEqual(maxHistory);
    });
  });

  describe('error code generation', () => {
    it('should generate unique error codes', async () => {
      const error = new Error('Test error');
      
      const result1 = await errorHandler.handleError(error, mockContext);
      const result2 = await errorHandler.handleError(error, { ...mockContext, timestamp: Date.now() + 1000 });

      expect(result1.errorCode).toBeDefined();
      expect(result2.errorCode).toBeDefined();
      expect(result1.errorCode).not.toBe(result2.errorCode);
    });

    it('should include category in error code', async () => {
      const networkError = new Error('Network connection failed');
      const validationError = new Error('Validation failed');

      const networkResult = await errorHandler.handleError(networkError, mockContext);
      const validationResult = await errorHandler.handleError(validationError, mockContext);

      expect(networkResult.errorCode).toContain('NET');
      expect(validationResult.errorCode).toContain('VAL');
    });
  });

  describe('recovery integration', () => {
    it('should call recovery service for recoverable errors', async () => {
      const systemError = new Error('System failure');
      
      mockRecoveryService.recoverQueue.mockResolvedValue({
        success: true,
        recoveredQueue: {} as any,
        errors: [],
        warnings: [],
        recoveryMethod: 'snapshot_restore',
        duration: 1000
      });

      await errorHandler.handleError(systemError, mockContext);

      expect(mockRecoveryService.recoverQueue).toHaveBeenCalledWith('test-player', {
        enableCircuitBreaker: true,
        gracefulDegradation: true,
        backupToLocalStorage: true
      });
    });

    it('should handle recovery service failures', async () => {
      const systemError = new Error('System failure');
      
      mockRecoveryService.recoverQueue.mockRejectedValue(new Error('Recovery failed'));

      const result = await errorHandler.handleError(systemError, mockContext);

      expect(result.recovered).toBe(false);
      expect(result.recoveryActions).toContain('System recovery failed completely');
    });

    it('should apply fallback when recovery partially succeeds', async () => {
      const systemError = new Error('System failure');
      
      mockRecoveryService.recoverQueue.mockResolvedValue({
        success: false,
        errors: [{ code: 'RECOVERY_FAILED', message: 'Could not recover', severity: 'major', timestamp: Date.now() }],
        warnings: [],
        recoveryMethod: 'fallback_creation',
        duration: 1000
      });

      const result = await errorHandler.handleError(systemError, mockContext);

      expect(result.recovered).toBe(false);
      expect(result.fallbackApplied).toBe(true);
      expect(result.recoveryActions).toContain('System recovery failed, fallback applied');
    });
  });
});