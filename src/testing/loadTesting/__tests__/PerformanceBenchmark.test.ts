/**
 * Tests for Performance Benchmark
 */

import { PerformanceBenchmark, BenchmarkMetric } from '../PerformanceBenchmark';
import { LoadTestResult } from '../LoadTestFramework';
import { StressTestReport } from '../StressTestRunner';

describe('PerformanceBenchmark', () => {
  let performanceBenchmark: PerformanceBenchmark;

  beforeEach(() => {
    performanceBenchmark = new PerformanceBenchmark();
  });

  describe('createBenchmarkSuite', () => {
    it('should create a benchmark suite from load test results', () => {
      const loadTestResults: LoadTestResult[] = [
        {
          testId: 'test-1',
          startTime: Date.now() - 60000,
          endTime: Date.now(),
          config: {
            concurrentPlayers: 10,
            testDurationMs: 60000,
            tasksPerPlayer: 5,
            taskTypeDistribution: { harvesting: 50, crafting: 30, combat: 20 },
            maxResponseTimeMs: 1000,
            maxErrorRate: 0.01,
            maxMemoryUsageMB: 500,
            rampUpTimeMs: 5000,
            rampDownTimeMs: 5000
          },
          totalRequests: 100,
          successfulRequests: 95,
          failedRequests: 5,
          averageResponseTime: 800,
          p95ResponseTime: 1200,
          p99ResponseTime: 1500,
          peakMemoryUsage: 400,
          averageCpuUsage: 60,
          peakCpuUsage: 80,
          averageQueueLength: 3.5,
          maxQueueLength: 8,
          totalTasksProcessed: 50,
          taskProcessingRate: 0.83,
          errorsByType: new Map(),
          criticalErrors: [],
          recommendedMaxPlayers: 15,
          bottleneckComponents: [],
          scalingRecommendations: []
        }
      ];

      const suite = performanceBenchmark.createBenchmarkSuite(
        loadTestResults,
        undefined,
        '1.0.0',
        'test'
      );

      expect(suite).toBeDefined();
      expect(suite.id).toMatch(/^benchmark-\d+$/);
      expect(suite.name).toContain('Performance Benchmark');
      expect(suite.version).toBe('1.0.0');
      expect(suite.environment).toBe('test');
      expect(suite.metrics.length).toBeGreaterThan(0);
      expect(suite.overallScore).toBeGreaterThan(0);
      expect(suite.overallScore).toBeLessThanOrEqual(100);
    });

    it('should include response time metrics', () => {
      const loadTestResults: LoadTestResult[] = [
        {
          testId: 'test-1',
          startTime: Date.now() - 30000,
          endTime: Date.now(),
          config: {
            concurrentPlayers: 5,
            testDurationMs: 30000,
            tasksPerPlayer: 3,
            taskTypeDistribution: { harvesting: 100, crafting: 0, combat: 0 },
            maxResponseTimeMs: 1000,
            maxErrorRate: 0.01,
            maxMemoryUsageMB: 500,
            rampUpTimeMs: 2000,
            rampDownTimeMs: 2000
          },
          totalRequests: 50,
          successfulRequests: 48,
          failedRequests: 2,
          averageResponseTime: 600,
          p95ResponseTime: 900,
          p99ResponseTime: 1100,
          peakMemoryUsage: 300,
          averageCpuUsage: 40,
          peakCpuUsage: 60,
          averageQueueLength: 2.0,
          maxQueueLength: 5,
          totalTasksProcessed: 25,
          taskProcessingRate: 0.83,
          errorsByType: new Map(),
          criticalErrors: [],
          recommendedMaxPlayers: 10,
          bottleneckComponents: [],
          scalingRecommendations: []
        }
      ];

      const suite = performanceBenchmark.createBenchmarkSuite(loadTestResults);

      const responseTimeMetrics = suite.metrics.filter(m => 
        m.name.includes('Response Time')
      );

      expect(responseTimeMetrics.length).toBeGreaterThan(0);
      
      const avgResponseTime = responseTimeMetrics.find(m => m.name === 'Average Response Time');
      expect(avgResponseTime).toBeDefined();
      expect(avgResponseTime!.value).toBe(600);
      expect(avgResponseTime!.unit).toBe('ms');
      expect(avgResponseTime!.status).toBe('pass');
    });

    it('should include throughput metrics', () => {
      const loadTestResults: LoadTestResult[] = [
        {
          testId: 'test-1',
          startTime: Date.now() - 60000,
          endTime: Date.now(),
          config: {
            concurrentPlayers: 10,
            testDurationMs: 60000,
            tasksPerPlayer: 5,
            taskTypeDistribution: { harvesting: 50, crafting: 50, combat: 0 },
            maxResponseTimeMs: 1000,
            maxErrorRate: 0.01,
            maxMemoryUsageMB: 500,
            rampUpTimeMs: 5000,
            rampDownTimeMs: 5000
          },
          totalRequests: 200,
          successfulRequests: 195,
          failedRequests: 5,
          averageResponseTime: 500,
          p95ResponseTime: 750,
          p99ResponseTime: 900,
          peakMemoryUsage: 350,
          averageCpuUsage: 50,
          peakCpuUsage: 70,
          averageQueueLength: 4.0,
          maxQueueLength: 10,
          totalTasksProcessed: 100,
          taskProcessingRate: 1.67,
          errorsByType: new Map(),
          criticalErrors: [],
          recommendedMaxPlayers: 20,
          bottleneckComponents: [],
          scalingRecommendations: []
        }
      ];

      const suite = performanceBenchmark.createBenchmarkSuite(loadTestResults);

      const throughputMetrics = suite.metrics.filter(m => 
        m.name.includes('Per Second') || m.name.includes('Rate')
      );

      expect(throughputMetrics.length).toBeGreaterThan(0);
      
      const rpsMetric = throughputMetrics.find(m => m.name === 'Requests Per Second');
      expect(rpsMetric).toBeDefined();
      expect(rpsMetric!.value).toBeGreaterThan(0);
      expect(rpsMetric!.unit).toBe('req/s');
    });

    it('should include resource utilization metrics', () => {
      const loadTestResults: LoadTestResult[] = [
        {
          testId: 'test-1',
          startTime: Date.now() - 30000,
          endTime: Date.now(),
          config: {
            concurrentPlayers: 8,
            testDurationMs: 30000,
            tasksPerPlayer: 4,
            taskTypeDistribution: { harvesting: 40, crafting: 30, combat: 30 },
            maxResponseTimeMs: 1000,
            maxErrorRate: 0.01,
            maxMemoryUsageMB: 500,
            rampUpTimeMs: 3000,
            rampDownTimeMs: 3000
          },
          totalRequests: 80,
          successfulRequests: 78,
          failedRequests: 2,
          averageResponseTime: 700,
          p95ResponseTime: 1000,
          p99ResponseTime: 1200,
          peakMemoryUsage: 450,
          averageCpuUsage: 65,
          peakCpuUsage: 85,
          averageQueueLength: 3.2,
          maxQueueLength: 7,
          totalTasksProcessed: 40,
          taskProcessingRate: 1.33,
          errorsByType: new Map(),
          criticalErrors: [],
          recommendedMaxPlayers: 12,
          bottleneckComponents: [],
          scalingRecommendations: []
        }
      ];

      const suite = performanceBenchmark.createBenchmarkSuite(loadTestResults);

      const resourceMetrics = suite.metrics.filter(m => 
        m.name.includes('Memory') || m.name.includes('CPU')
      );

      expect(resourceMetrics.length).toBeGreaterThan(0);
      
      const memoryMetric = resourceMetrics.find(m => m.name === 'Peak Memory Usage');
      expect(memoryMetric).toBeDefined();
      expect(memoryMetric!.value).toBe(450);
      expect(memoryMetric!.unit).toBe('MB');
    });

    it('should include scalability metrics when stress report is provided', () => {
      const loadTestResults: LoadTestResult[] = [
        {
          testId: 'test-1',
          startTime: Date.now() - 30000,
          endTime: Date.now(),
          config: {
            concurrentPlayers: 5,
            testDurationMs: 30000,
            tasksPerPlayer: 3,
            taskTypeDistribution: { harvesting: 100, crafting: 0, combat: 0 },
            maxResponseTimeMs: 1000,
            maxErrorRate: 0.01,
            maxMemoryUsageMB: 500,
            rampUpTimeMs: 2000,
            rampDownTimeMs: 2000
          },
          totalRequests: 50,
          successfulRequests: 49,
          failedRequests: 1,
          averageResponseTime: 500,
          p95ResponseTime: 750,
          p99ResponseTime: 900,
          peakMemoryUsage: 300,
          averageCpuUsage: 40,
          peakCpuUsage: 60,
          averageQueueLength: 2.0,
          maxQueueLength: 5,
          totalTasksProcessed: 25,
          taskProcessingRate: 0.83,
          errorsByType: new Map(),
          criticalErrors: [],
          recommendedMaxPlayers: 10,
          bottleneckComponents: [],
          scalingRecommendations: []
        }
      ];

      const stressReport: StressTestReport = {
        suiteId: 'stress-1',
        suiteName: 'Test Stress Suite',
        startTime: Date.now() - 60000,
        endTime: Date.now(),
        scenarioResults: new Map(),
        overallMetrics: {
          totalRequests: 100,
          totalFailures: 5,
          averageResponseTime: 600,
          peakMemoryUsage: 400,
          peakCpuUsage: 70
        },
        stressAnalysis: {
          breakingPoint: 500,
          recoveryTime: 15000,
          criticalBottlenecks: ['Response Time'],
          stabilityScore: 85
        },
        recommendations: []
      };

      const suite = performanceBenchmark.createBenchmarkSuite(
        loadTestResults,
        stressReport
      );

      const scalabilityMetrics = suite.metrics.filter(m => 
        m.name.includes('User Limit') || m.name.includes('Stability') || m.name.includes('Recovery')
      );

      expect(scalabilityMetrics.length).toBeGreaterThan(0);
      
      const userLimitMetric = scalabilityMetrics.find(m => m.name === 'Concurrent User Limit');
      expect(userLimitMetric).toBeDefined();
      expect(userLimitMetric!.value).toBe(500);
      expect(userLimitMetric!.unit).toBe('users');
    });
  });

  describe('setBaseline and compareToBaseline', () => {
    it('should set and compare against performance baseline', () => {
      const loadTestResults: LoadTestResult[] = [
        {
          testId: 'baseline-test',
          startTime: Date.now() - 30000,
          endTime: Date.now(),
          config: {
            concurrentPlayers: 10,
            testDurationMs: 30000,
            tasksPerPlayer: 5,
            taskTypeDistribution: { harvesting: 50, crafting: 50, combat: 0 },
            maxResponseTimeMs: 1000,
            maxErrorRate: 0.01,
            maxMemoryUsageMB: 500,
            rampUpTimeMs: 3000,
            rampDownTimeMs: 3000
          },
          totalRequests: 100,
          successfulRequests: 98,
          failedRequests: 2,
          averageResponseTime: 600,
          p95ResponseTime: 900,
          p99ResponseTime: 1100,
          peakMemoryUsage: 400,
          averageCpuUsage: 50,
          peakCpuUsage: 70,
          averageQueueLength: 3.0,
          maxQueueLength: 8,
          totalTasksProcessed: 50,
          taskProcessingRate: 1.67,
          errorsByType: new Map(),
          criticalErrors: [],
          recommendedMaxPlayers: 15,
          bottleneckComponents: [],
          scalingRecommendations: []
        }
      ];

      const baselineSuite = performanceBenchmark.createBenchmarkSuite(
        loadTestResults,
        undefined,
        '1.0.0',
        'test'
      );

      // Set baseline
      performanceBenchmark.setBaseline('1.0.0', baselineSuite);

      // Create comparison suite with different performance
      const comparisonResults: LoadTestResult[] = [
        {
          ...loadTestResults[0],
          testId: 'comparison-test',
          averageResponseTime: 500, // 100ms improvement
          peakMemoryUsage: 450, // 50MB increase
          successfulRequests: 99, // 1 more success
          failedRequests: 1
        }
      ];

      const comparisonSuite = performanceBenchmark.createBenchmarkSuite(
        comparisonResults,
        undefined,
        '1.1.0',
        'test'
      );

      // Compare to baseline
      const comparison = performanceBenchmark.compareToBaseline(comparisonSuite, '1.0.0');

      expect(comparison).toBeDefined();
      expect(comparison.size).toBeGreaterThan(0);
      
      // Response time should show improvement (negative percentage)
      const responseTimeChange = comparison.get('Average Response Time');
      expect(responseTimeChange).toBeDefined();
      expect(responseTimeChange!).toBeLessThan(0); // Improvement
      
      // Memory usage should show increase (positive percentage)
      const memoryChange = comparison.get('Peak Memory Usage');
      expect(memoryChange).toBeDefined();
      expect(memoryChange!).toBeGreaterThan(0); // Increase
    });

    it('should throw error when baseline not found', () => {
      const loadTestResults: LoadTestResult[] = [
        {
          testId: 'test-1',
          startTime: Date.now() - 30000,
          endTime: Date.now(),
          config: {
            concurrentPlayers: 5,
            testDurationMs: 30000,
            tasksPerPlayer: 3,
            taskTypeDistribution: { harvesting: 100, crafting: 0, combat: 0 },
            maxResponseTimeMs: 1000,
            maxErrorRate: 0.01,
            maxMemoryUsageMB: 500,
            rampUpTimeMs: 2000,
            rampDownTimeMs: 2000
          },
          totalRequests: 50,
          successfulRequests: 49,
          failedRequests: 1,
          averageResponseTime: 500,
          p95ResponseTime: 750,
          p99ResponseTime: 900,
          peakMemoryUsage: 300,
          averageCpuUsage: 40,
          peakCpuUsage: 60,
          averageQueueLength: 2.0,
          maxQueueLength: 5,
          totalTasksProcessed: 25,
          taskProcessingRate: 0.83,
          errorsByType: new Map(),
          criticalErrors: [],
          recommendedMaxPlayers: 10,
          bottleneckComponents: [],
          scalingRecommendations: []
        }
      ];

      const suite = performanceBenchmark.createBenchmarkSuite(loadTestResults);

      expect(() => {
        performanceBenchmark.compareToBaseline(suite, 'nonexistent-version');
      }).toThrow('Baseline not found');
    });
  });

  describe('validateOptimization', () => {
    it('should validate optimization improvements', () => {
      // Create "before" suite with poor performance
      const beforeResults: LoadTestResult[] = [
        {
          testId: 'before-test',
          startTime: Date.now() - 60000,
          endTime: Date.now() - 30000,
          config: {
            concurrentPlayers: 10,
            testDurationMs: 30000,
            tasksPerPlayer: 5,
            taskTypeDistribution: { harvesting: 50, crafting: 50, combat: 0 },
            maxResponseTimeMs: 1000,
            maxErrorRate: 0.01,
            maxMemoryUsageMB: 500,
            rampUpTimeMs: 3000,
            rampDownTimeMs: 3000
          },
          totalRequests: 100,
          successfulRequests: 90,
          failedRequests: 10,
          averageResponseTime: 1200,
          p95ResponseTime: 1800,
          p99ResponseTime: 2200,
          peakMemoryUsage: 600,
          averageCpuUsage: 80,
          peakCpuUsage: 95,
          averageQueueLength: 5.0,
          maxQueueLength: 12,
          totalTasksProcessed: 45,
          taskProcessingRate: 1.5,
          errorsByType: new Map(),
          criticalErrors: [],
          recommendedMaxPlayers: 8,
          bottleneckComponents: ['Response Time', 'Memory Usage'],
          scalingRecommendations: []
        }
      ];

      // Create "after" suite with improved performance
      const afterResults: LoadTestResult[] = [
        {
          testId: 'after-test',
          startTime: Date.now() - 30000,
          endTime: Date.now(),
          config: {
            concurrentPlayers: 10,
            testDurationMs: 30000,
            tasksPerPlayer: 5,
            taskTypeDistribution: { harvesting: 50, crafting: 50, combat: 0 },
            maxResponseTimeMs: 1000,
            maxErrorRate: 0.01,
            maxMemoryUsageMB: 500,
            rampUpTimeMs: 3000,
            rampDownTimeMs: 3000
          },
          totalRequests: 100,
          successfulRequests: 98,
          failedRequests: 2,
          averageResponseTime: 600,
          p95ResponseTime: 900,
          p99ResponseTime: 1100,
          peakMemoryUsage: 400,
          averageCpuUsage: 50,
          peakCpuUsage: 70,
          averageQueueLength: 3.0,
          maxQueueLength: 7,
          totalTasksProcessed: 49,
          taskProcessingRate: 1.63,
          errorsByType: new Map(),
          criticalErrors: [],
          recommendedMaxPlayers: 15,
          bottleneckComponents: [],
          scalingRecommendations: []
        }
      ];

      const beforeSuite = performanceBenchmark.createBenchmarkSuite(beforeResults);
      const afterSuite = performanceBenchmark.createBenchmarkSuite(afterResults);

      const validation = performanceBenchmark.validateOptimization(
        'Response Time Optimization',
        beforeSuite,
        afterSuite
      );

      expect(validation).toBeDefined();
      expect(validation.optimizationName).toBe('Response Time Optimization');
      expect(validation.beforeMetrics).toBe(beforeSuite);
      expect(validation.afterMetrics).toBe(afterSuite);
      expect(validation.overallImprovement).toBeGreaterThan(0);
      expect(validation.recommendation).toBe('deploy');
      expect(validation.regressions.length).toBe(0);
    });

    it('should detect regressions in optimization', () => {
      // Create "before" suite
      const beforeResults: LoadTestResult[] = [
        {
          testId: 'before-test',
          startTime: Date.now() - 60000,
          endTime: Date.now() - 30000,
          config: {
            concurrentPlayers: 10,
            testDurationMs: 30000,
            tasksPerPlayer: 5,
            taskTypeDistribution: { harvesting: 50, crafting: 50, combat: 0 },
            maxResponseTimeMs: 1000,
            maxErrorRate: 0.01,
            maxMemoryUsageMB: 500,
            rampUpTimeMs: 3000,
            rampDownTimeMs: 3000
          },
          totalRequests: 100,
          successfulRequests: 95,
          failedRequests: 5,
          averageResponseTime: 800,
          p95ResponseTime: 1200,
          p99ResponseTime: 1500,
          peakMemoryUsage: 400,
          averageCpuUsage: 60,
          peakCpuUsage: 80,
          averageQueueLength: 3.5,
          maxQueueLength: 8,
          totalTasksProcessed: 47,
          taskProcessingRate: 1.57,
          errorsByType: new Map(),
          criticalErrors: [],
          recommendedMaxPlayers: 12,
          bottleneckComponents: [],
          scalingRecommendations: []
        }
      ];

      // Create "after" suite with some regressions
      const afterResults: LoadTestResult[] = [
        {
          testId: 'after-test',
          startTime: Date.now() - 30000,
          endTime: Date.now(),
          config: {
            concurrentPlayers: 10,
            testDurationMs: 30000,
            tasksPerPlayer: 5,
            taskTypeDistribution: { harvesting: 50, crafting: 50, combat: 0 },
            maxResponseTimeMs: 1000,
            maxErrorRate: 0.01,
            maxMemoryUsageMB: 500,
            rampUpTimeMs: 3000,
            rampDownTimeMs: 3000
          },
          totalRequests: 100,
          successfulRequests: 85, // Regression: fewer successful requests
          failedRequests: 15, // More failures
          averageResponseTime: 600, // Improvement
          p95ResponseTime: 900,
          p99ResponseTime: 1100,
          peakMemoryUsage: 600, // Regression: more memory usage
          averageCpuUsage: 50,
          peakCpuUsage: 70,
          averageQueueLength: 3.0,
          maxQueueLength: 7,
          totalTasksProcessed: 42, // Regression: fewer tasks processed
          taskProcessingRate: 1.4,
          errorsByType: new Map(),
          criticalErrors: [],
          recommendedMaxPlayers: 10,
          bottleneckComponents: [],
          scalingRecommendations: []
        }
      ];

      const beforeSuite = performanceBenchmark.createBenchmarkSuite(beforeResults);
      const afterSuite = performanceBenchmark.createBenchmarkSuite(afterResults);

      const validation = performanceBenchmark.validateOptimization(
        'Mixed Results Optimization',
        beforeSuite,
        afterSuite
      );

      expect(validation.regressions.length).toBeGreaterThan(0);
      expect(validation.recommendation).not.toBe('deploy');
    });
  });

  describe('generatePerformanceReport', () => {
    it('should generate a comprehensive performance report', () => {
      const loadTestResults: LoadTestResult[] = [
        {
          testId: 'report-test',
          startTime: Date.now() - 30000,
          endTime: Date.now(),
          config: {
            concurrentPlayers: 10,
            testDurationMs: 30000,
            tasksPerPlayer: 5,
            taskTypeDistribution: { harvesting: 40, crafting: 30, combat: 30 },
            maxResponseTimeMs: 1000,
            maxErrorRate: 0.01,
            maxMemoryUsageMB: 500,
            rampUpTimeMs: 3000,
            rampDownTimeMs: 3000
          },
          totalRequests: 100,
          successfulRequests: 96,
          failedRequests: 4,
          averageResponseTime: 700,
          p95ResponseTime: 1050,
          p99ResponseTime: 1300,
          peakMemoryUsage: 450,
          averageCpuUsage: 55,
          peakCpuUsage: 75,
          averageQueueLength: 3.8,
          maxQueueLength: 9,
          totalTasksProcessed: 48,
          taskProcessingRate: 1.6,
          errorsByType: new Map(),
          criticalErrors: [],
          recommendedMaxPlayers: 14,
          bottleneckComponents: [],
          scalingRecommendations: []
        }
      ];

      const suite = performanceBenchmark.createBenchmarkSuite(
        loadTestResults,
        undefined,
        '1.0.0',
        'production'
      );

      const report = performanceBenchmark.generatePerformanceReport(suite);

      expect(report).toBeDefined();
      expect(typeof report).toBe('string');
      expect(report).toContain('Performance Benchmark Report');
      expect(report).toContain('Version: 1.0.0');
      expect(report).toContain('Environment: production');
      expect(report).toContain('Overall Score');
      expect(report).toContain('Response Times');
      expect(report).toContain('Throughput');
      expect(report).toContain('Resource Usage');
      expect(report).toContain('Reliability');
    });

    it('should include trend indicators in report', () => {
      const loadTestResults: LoadTestResult[] = [
        {
          testId: 'trend-test',
          startTime: Date.now() - 30000,
          endTime: Date.now(),
          config: {
            concurrentPlayers: 5,
            testDurationMs: 30000,
            tasksPerPlayer: 3,
            taskTypeDistribution: { harvesting: 100, crafting: 0, combat: 0 },
            maxResponseTimeMs: 1000,
            maxErrorRate: 0.01,
            maxMemoryUsageMB: 500,
            rampUpTimeMs: 2000,
            rampDownTimeMs: 2000
          },
          totalRequests: 50,
          successfulRequests: 49,
          failedRequests: 1,
          averageResponseTime: 500,
          p95ResponseTime: 750,
          p99ResponseTime: 900,
          peakMemoryUsage: 300,
          averageCpuUsage: 40,
          peakCpuUsage: 60,
          averageQueueLength: 2.0,
          maxQueueLength: 5,
          totalTasksProcessed: 25,
          taskProcessingRate: 0.83,
          errorsByType: new Map(),
          criticalErrors: [],
          recommendedMaxPlayers: 10,
          bottleneckComponents: [],
          scalingRecommendations: []
        }
      ];

      const suite = performanceBenchmark.createBenchmarkSuite(loadTestResults);
      const report = performanceBenchmark.generatePerformanceReport(suite);

      expect(report).toContain('📈'); // Improving trend
      expect(report).toContain('➡️'); // Stable trend
    });
  });

  describe('getBenchmarkHistory', () => {
    it('should track benchmark history', () => {
      const loadTestResults: LoadTestResult[] = [
        {
          testId: 'history-test-1',
          startTime: Date.now() - 30000,
          endTime: Date.now(),
          config: {
            concurrentPlayers: 5,
            testDurationMs: 30000,
            tasksPerPlayer: 3,
            taskTypeDistribution: { harvesting: 100, crafting: 0, combat: 0 },
            maxResponseTimeMs: 1000,
            maxErrorRate: 0.01,
            maxMemoryUsageMB: 500,
            rampUpTimeMs: 2000,
            rampDownTimeMs: 2000
          },
          totalRequests: 50,
          successfulRequests: 49,
          failedRequests: 1,
          averageResponseTime: 500,
          p95ResponseTime: 750,
          p99ResponseTime: 900,
          peakMemoryUsage: 300,
          averageCpuUsage: 40,
          peakCpuUsage: 60,
          averageQueueLength: 2.0,
          maxQueueLength: 5,
          totalTasksProcessed: 25,
          taskProcessingRate: 0.83,
          errorsByType: new Map(),
          criticalErrors: [],
          recommendedMaxPlayers: 10,
          bottleneckComponents: [],
          scalingRecommendations: []
        }
      ];

      // Create first benchmark
      const suite1 = performanceBenchmark.createBenchmarkSuite(loadTestResults, undefined, '1.0.0');
      
      // Create second benchmark
      const suite2 = performanceBenchmark.createBenchmarkSuite(loadTestResults, undefined, '1.1.0');

      const history = performanceBenchmark.getBenchmarkHistory();
      expect(history.length).toBe(2);
      expect(history[0].version).toBe('1.0.0');
      expect(history[1].version).toBe('1.1.0');
    });
  });
});