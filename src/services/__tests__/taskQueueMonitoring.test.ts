/**
 * Tests for Task Queue Monitoring System
 * Covers logging, metrics, alerting, and integration components
 */

import { taskQueueLogger, LogLevel, LogCategory } from '../taskQueueLogger';
import { taskQueueMetrics } from '../taskQueueMetrics';
import { taskQueueAlerting, AlertType, AlertSeverity } from '../taskQueueAlerting';
import { taskQueueMonitoring } from '../taskQueueMonitoringIntegration';
import { TaskType } from '../../types/taskQueue';

// Mock fetch for testing
global.fetch = jest.fn();

describe('TaskQueueLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should log queue operations correctly', () => {
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
    
    taskQueueLogger.logQueueOperation(
      'addTask',
      'player123',
      true,
      150,
      { taskType: 'harvesting' }
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[INFO] [queue_operation] [player123] Queue operation addTask completed (150ms)')
    );

    consoleSpy.mockRestore();
  });

  test('should log task processing events', () => {
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
    
    taskQueueLogger.logTaskProcessing(
      'task456',
      'player123',
      'start',
      true,
      undefined,
      { taskType: 'crafting' }
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[INFO] [task_processing] [player123][task456] Task start completed')
    );

    consoleSpy.mockRestore();
  });

  test('should log errors with stack traces', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const error = new Error('Test error');
    
    taskQueueLogger.logError(
      'Task validation failed',
      error,
      'player123',
      'task456'
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[ERROR] [error] [player123][task456] Task validation failed')
    );
    expect(consoleSpy).toHaveBeenCalledWith(error);

    consoleSpy.mockRestore();
  });

  test('should log security events with appropriate severity', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    taskQueueLogger.logSecurity(
      'Suspicious queue activity detected',
      'player123',
      'high',
      { attempts: 5 }
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[WARN] [security] [player123] Security event: Suspicious queue activity detected')
    );

    consoleSpy.mockRestore();
  });
});

describe('TaskQueueMetrics', () => {
  beforeEach(() => {
    // Clear metrics between tests
    (taskQueueMetrics as any).metrics.clear();
    (taskQueueMetrics as any).counters.clear();
    (taskQueueMetrics as any).gauges.clear();
    (taskQueueMetrics as any).histograms.clear();
  });

  test('should record task processing time correctly', () => {
    taskQueueMetrics.recordTaskProcessingTime(1500, 'harvesting', 'player123');
    
    const metrics = taskQueueMetrics.exportMetrics();
    expect(metrics.averageTaskProcessingTime).toBe(1500);
  });

  test('should track queue length changes', () => {
    taskQueueMetrics.recordQueueLength(5, 'player123');
    taskQueueMetrics.recordQueueLength(3, 'player456');
    
    const metrics = taskQueueMetrics.exportMetrics();
    expect(metrics.averageQueueLength).toBe(4); // (5 + 3) / 2
  });

  test('should calculate error rates correctly', () => {
    // Record some successful tasks
    taskQueueMetrics.incrementCounter('task.processed.total', 10);
    
    // Record some failures
    taskQueueMetrics.recordTaskFailure('harvesting', 'validation_error', 'player123');
    taskQueueMetrics.recordTaskFailure('crafting', 'resource_shortage', 'player456');
    
    const metrics = taskQueueMetrics.exportMetrics();
    expect(metrics.errorRate).toBeGreaterThan(0);
  });

  test('should track player activity', () => {
    taskQueueMetrics.recordPlayerActivity('player123', 'addTask');
    taskQueueMetrics.recordPlayerActivity('player456', 'removeTask');
    taskQueueMetrics.recordPlayerActivity('player789', 'syncQueue');
    
    const metrics = taskQueueMetrics.exportMetrics();
    expect(metrics.activePlayerCount).toBe(3);
  });

  test('should calculate percentiles correctly', () => {
    const values = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    
    const p95 = taskQueueMetrics.calculatePercentile(values, 95);
    const p99 = taskQueueMetrics.calculatePercentile(values, 99);
    
    expect(p95).toBe(950); // 95th percentile
    expect(p99).toBe(990); // 99th percentile
  });

  test('should export time series data', () => {
    taskQueueMetrics.recordGauge('test.metric', 100);
    taskQueueMetrics.recordGauge('test.metric', 200);
    
    const timeSeries = taskQueueMetrics.exportTimeSeries('test.metric', 60000);
    
    expect(timeSeries.metric).toBe('test.metric');
    expect(timeSeries.dataPoints).toHaveLength(2);
    expect(timeSeries.dataPoints[0].value).toBe(100);
    expect(timeSeries.dataPoints[1].value).toBe(200);
  });
});

describe('TaskQueueAlerting', () => {
  beforeEach(() => {
    // Clear alerts between tests
    (taskQueueAlerting as any).activeAlerts.clear();
    (taskQueueAlerting as any).alertHistory = [];
    (taskQueueAlerting as any).lastAlertTime.clear();
    jest.clearAllMocks();
  });

  test('should trigger alert when error rate exceeds threshold', async () => {
    const mockMetrics = {
      errorRate: 10, // Above 5% threshold
      averageTaskProcessingTime: 1000,
      maxQueueLength: 50,
      memoryUsage: 100 * 1024 * 1024,
      cpuUsage: 30,
      syncFailureRate: 2,
      validationFailureRate: 5,
      cacheHitRate: 85
    } as any;

    // Simulate metrics check
    await (taskQueueAlerting as any).evaluateRule(
      (taskQueueAlerting as any).alertRules.find((r: any) => r.type === AlertType.HIGH_ERROR_RATE),
      mockMetrics
    );

    const activeAlerts = taskQueueAlerting.getActiveAlerts();
    expect(activeAlerts).toHaveLength(1);
    expect(activeAlerts[0].type).toBe(AlertType.HIGH_ERROR_RATE);
    expect(activeAlerts[0].severity).toBe(AlertSeverity.HIGH);
  });

  test('should auto-resolve alerts when conditions improve', async () => {
    // First trigger an alert
    const highErrorMetrics = {
      errorRate: 10,
      averageTaskProcessingTime: 1000,
      maxQueueLength: 50,
      memoryUsage: 100 * 1024 * 1024,
      cpuUsage: 30,
      syncFailureRate: 2,
      validationFailureRate: 5,
      cacheHitRate: 85
    } as any;

    const rule = (taskQueueAlerting as any).alertRules.find((r: any) => r.type === AlertType.HIGH_ERROR_RATE);
    await (taskQueueAlerting as any).evaluateRule(rule, highErrorMetrics);

    expect(taskQueueAlerting.getActiveAlerts()).toHaveLength(1);

    // Then improve conditions
    const improvedMetrics = {
      ...highErrorMetrics,
      errorRate: 1 // Below resolve threshold of 2%
    };

    await (taskQueueAlerting as any).evaluateRule(rule, improvedMetrics);

    const activeAlerts = taskQueueAlerting.getActiveAlerts();
    expect(activeAlerts).toHaveLength(0); // Should be auto-resolved
  });

  test('should acknowledge alerts correctly', async () => {
    // Create a test alert
    const alert = (taskQueueAlerting as any).createAlert(
      {
        type: AlertType.PERFORMANCE_DEGRADATION,
        severity: AlertSeverity.MEDIUM,
        title: 'Test Alert',
        messageTemplate: 'Test message'
      },
      { averageTaskProcessingTime: 35000 } as any
    );

    (taskQueueAlerting as any).activeAlerts.set('test_alert', alert);

    const success = await taskQueueAlerting.acknowledgeAlert(alert.id, 'admin');
    
    expect(success).toBe(true);
    expect(alert.acknowledged).toBe(true);
    expect(alert.acknowledgedBy).toBe('admin');
  });

  test('should resolve alerts correctly', async () => {
    // Create a test alert
    const alert = (taskQueueAlerting as any).createAlert(
      {
        type: AlertType.QUEUE_BACKUP,
        severity: AlertSeverity.HIGH,
        title: 'Test Alert',
        messageTemplate: 'Test message'
      },
      { maxQueueLength: 1500 } as any
    );

    (taskQueueAlerting as any).activeAlerts.set('test_alert', alert);

    const success = await taskQueueAlerting.resolveAlert(alert.id, 'admin');
    
    expect(success).toBe(true);
    expect(alert.resolved).toBe(true);
    expect(alert.resolvedAt).toBeDefined();
  });

  test('should respect cooldown periods', async () => {
    const mockMetrics = {
      errorRate: 10,
      averageTaskProcessingTime: 1000,
      maxQueueLength: 50,
      memoryUsage: 100 * 1024 * 1024,
      cpuUsage: 30,
      syncFailureRate: 2,
      validationFailureRate: 5,
      cacheHitRate: 85
    } as any;

    const rule = (taskQueueAlerting as any).alertRules.find((r: any) => r.type === AlertType.HIGH_ERROR_RATE);
    
    // First alert should be created
    await (taskQueueAlerting as any).evaluateRule(rule, mockMetrics);
    expect(taskQueueAlerting.getActiveAlerts()).toHaveLength(1);

    // Resolve the alert
    const alert = taskQueueAlerting.getActiveAlerts()[0];
    await taskQueueAlerting.resolveAlert(alert.id, 'system');

    // Immediately try to trigger again - should be blocked by cooldown
    await (taskQueueAlerting as any).evaluateRule(rule, mockMetrics);
    expect(taskQueueAlerting.getActiveAlerts()).toHaveLength(0);
  });
});

describe('TaskQueueMonitoringIntegration', () => {
  test('should wrap service methods with monitoring', async () => {
    const mockService = {
      testMethod: jest.fn().mockResolvedValue('success')
    };

    const wrappedMethod = taskQueueMonitoring.wrapServiceMethod(
      'TestService',
      'testMethod',
      mockService.testMethod,
      mockService
    );

    const result = await wrappedMethod('player123', { taskId: 'task456' });

    expect(result).toBe('success');
    expect(mockService.testMethod).toHaveBeenCalledWith('player123', { taskId: 'task456' });
  });

  test('should handle service method errors correctly', async () => {
    const mockError = new Error('Service error');
    const mockService = {
      failingMethod: jest.fn().mockRejectedValue(mockError)
    };

    const wrappedMethod = taskQueueMonitoring.wrapServiceMethod(
      'TestService',
      'failingMethod',
      mockService.failingMethod,
      mockService
    );

    await expect(wrappedMethod('player123')).rejects.toThrow('Service error');
    expect(mockService.failingMethod).toHaveBeenCalledWith('player123');
  });

  test('should monitor task processing correctly', () => {
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation();

    taskQueueMonitoring.monitorTaskProcessing(
      'task123',
      'player456',
      TaskType.HARVESTING,
      'complete',
      2500,
      { reward: 'iron_ore' }
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[INFO] [task_processing] [player456][task123] Task complete completed (2500ms)')
    );

    consoleSpy.mockRestore();
  });

  test('should create performance timers', () => {
    const timer = taskQueueMonitoring.createPerformanceTimer('test_operation', 'player123');
    
    // Simulate some work
    setTimeout(() => {
      timer(); // This should log the duration
    }, 100);

    expect(typeof timer).toBe('function');
  });

  test('should monitor security events', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    taskQueueMonitoring.monitorSecurity(
      'Invalid task submission',
      'player123',
      'high',
      { attempts: 3 }
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[WARN] [security] [player123] Security event: Invalid task submission')
    );

    consoleSpy.mockRestore();
  });
});

describe('Integration Tests', () => {
  test('should integrate logging, metrics, and alerting', async () => {
    // Simulate a high error rate scenario
    for (let i = 0; i < 10; i++) {
      taskQueueMetrics.incrementCounter('task.processed.total', 1);
    }
    
    for (let i = 0; i < 6; i++) {
      taskQueueMetrics.recordTaskFailure('harvesting', 'validation_error', `player${i}`);
    }

    // Check that metrics reflect the error rate
    const metrics = taskQueueMetrics.exportMetrics();
    expect(metrics.errorRate).toBeGreaterThan(5);

    // Simulate alert check (would normally be done by the alerting system)
    const rule = (taskQueueAlerting as any).alertRules.find((r: any) => r.type === AlertType.HIGH_ERROR_RATE);
    if (rule && rule.condition(metrics)) {
      const alert = (taskQueueAlerting as any).createAlert(rule, metrics);
      (taskQueueAlerting as any).activeAlerts.set('test_alert', alert);
    }

    // Verify alert was created
    const activeAlerts = taskQueueAlerting.getActiveAlerts();
    expect(activeAlerts).toHaveLength(1);
    expect(activeAlerts[0].type).toBe(AlertType.HIGH_ERROR_RATE);
  });

  test('should handle monitoring system lifecycle', () => {
    // Test that monitoring components can be created and destroyed
    expect(taskQueueLogger).toBeDefined();
    expect(taskQueueMetrics).toBeDefined();
    expect(taskQueueAlerting).toBeDefined();
    expect(taskQueueMonitoring).toBeDefined();

    // Test cleanup
    taskQueueLogger.destroy();
    taskQueueMetrics.destroy();
    taskQueueAlerting.destroy();

    // Should not throw errors
    expect(true).toBe(true);
  });
});