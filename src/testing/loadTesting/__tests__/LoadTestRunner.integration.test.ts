/**
 * Integration Tests for Load Test Runner
 * Tests the complete load testing workflow
 */

import { LoadTestRunner } from '../LoadTestRunner';
import { ServerTaskQueueService } from '../../../services/serverTaskQueueService';

// Mock the ServerTaskQueueService
jest.mock('../../../services/serverTaskQueueService', () => {
  return {
    ServerTaskQueueService: jest.fn().mockImplementation(() => ({
      addHarvestingTask: jest.fn().mockResolvedValue({ id: 'task-1' }),
      addCraftingTask: jest.fn().mockResolvedValue({ id: 'task-2' }),
      addCombatTask: jest.fn().mockResolvedValue({ id: 'task-3' }),
      getQueueStatus: jest.fn().mockReturnValue({ queueLength: 0 }),
      stopAllTasks: jest.fn().mockResolvedValue(undefined),
      reorderTasks: jest.fn().mockResolvedValue(undefined)
    }))
  };
});

describe('LoadTestRunner Integration', () => {
  let loadTestRunner: LoadTestRunner;
  let mockTaskQueueService: jest.Mocked<ServerTaskQueueService>;

  beforeEach(() => {
    mockTaskQueueService = new ServerTaskQueueService() as jest.Mocked<ServerTaskQueueService>;
    loadTestRunner = new LoadTestRunner(mockTaskQueueService);
  });

  afterEach(() => {
    if (loadTestRunner) {
      loadTestRunner.stopCurrentTest();
    }
  });

  describe('executeComprehensiveTestSuite', () => {
    it('should execute a complete test suite successfully', async () => {
      const suite = {
        name: 'Integration Test Suite',
        description: 'Complete integration test',
        loadTests: [
          {
            concurrentPlayers: 5,
            testDurationMs: 2000,
            tasksPerPlayer: 2,
            taskTypeDistribution: { harvesting: 100, crafting: 0, combat: 0 },
            maxResponseTimeMs: 1000,
            maxErrorRate: 0.05,
            maxMemoryUsageMB: 500,
            rampUpTimeMs: 500,
            rampDownTimeMs: 500
          }
        ],
        stressTests: {
          name: 'Quick Stress Test',
          scenarios: [
            {
              name: 'Light Stress',
              description: 'Light stress scenario',
              config: {
                concurrentPlayers: 3,
                testDurationMs: 1500,
                tasksPerPlayer: 2,
                taskTypeDistribution: { harvesting: 100, crafting: 0, combat: 0 },
                maxResponseTimeMs: 1000,
                maxErrorRate: 0.05,
                maxMemoryUsageMB: 500,
                rampUpTimeMs: 300,
                rampDownTimeMs: 300
              },
              expectedFailureThreshold: 0.02
            }
          ],
          maxConcurrentTests: 1
        },
        capacityScenarios: [
          {
            name: 'Test Growth',
            description: 'Simple growth scenario',
            timeframe: '6 months',
            userGrowthRate: 10,
            peakMultiplier: 1.5,
            seasonalFactors: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
          }
        ]
      };

      const report = await loadTestRunner.executeComprehensiveTestSuite(
        suite,
        '1.0.0',
        'integration-test'
      );

      expect(report).toBeDefined();
      expect(report.suiteId).toMatch(/^comprehensive-test-\d+$/);
      expect(report.suiteName).toBe(suite.name);
      expect(report.endTime).toBeGreaterThan(report.startTime);
      
      // Verify all phases completed
      expect(report.loadTestResults.length).toBe(1);
      expect(report.stressTestReport).toBeDefined();
      expect(report.benchmarkSuite).toBeDefined();
      expect(report.capacityPlans.length).toBe(1);
      
      // Verify scores are calculated
      expect(report.performanceScore).toBeGreaterThanOrEqual(0);
      expect(report.performanceScore).toBeLessThanOrEqual(100);
      expect(report.scalabilityScore).toBeGreaterThanOrEqual(0);
      expect(report.scalabilityScore).toBeLessThanOrEqual(100);
      expect(report.reliabilityScore).toBeGreaterThanOrEqual(0);
      expect(report.reliabilityScore).toBeLessThanOrEqual(100);
      
      // Verify recommendations are generated
      expect(Array.isArray(report.immediateActions)).toBe(true);
      expect(Array.isArray(report.shortTermRecommendations)).toBe(true);
      expect(Array.isArray(report.longTermRecommendations)).toBe(true);
    }, 30000); // 30 second timeout for integration test

    it('should handle multiple load tests in sequence', async () => {
      const suite = {
        name: 'Multi-Load Test Suite',
        description: 'Multiple load tests',
        loadTests: [
          {
            concurrentPlayers: 2,
            testDurationMs: 1000,
            tasksPerPlayer: 1,
            taskTypeDistribution: { harvesting: 100, crafting: 0, combat: 0 },
            maxResponseTimeMs: 1000,
            maxErrorRate: 0.05,
            maxMemoryUsageMB: 500,
            rampUpTimeMs: 200,
            rampDownTimeMs: 200
          },
          {
            concurrentPlayers: 4,
            testDurationMs: 1000,
            tasksPerPlayer: 2,
            taskTypeDistribution: { harvesting: 50, crafting: 50, combat: 0 },
            maxResponseTimeMs: 1000,
            maxErrorRate: 0.05,
            maxMemoryUsageMB: 500,
            rampUpTimeMs: 200,
            rampDownTimeMs: 200
          }
        ],
        stressTests: {
          name: 'Minimal Stress Test',
          scenarios: [
            {
              name: 'Basic Stress',
              description: 'Basic stress scenario',
              config: {
                concurrentPlayers: 3,
                testDurationMs: 1000,
                tasksPerPlayer: 1,
                taskTypeDistribution: { harvesting: 100, crafting: 0, combat: 0 },
                maxResponseTimeMs: 1000,
                maxErrorRate: 0.05,
                maxMemoryUsageMB: 500,
                rampUpTimeMs: 200,
                rampDownTimeMs: 200
              },
              expectedFailureThreshold: 0.02
            }
          ],
          maxConcurrentTests: 1
        },
        capacityScenarios: [
          {
            name: 'Simple Growth',
            description: 'Basic growth',
            timeframe: '3 months',
            userGrowthRate: 5,
            peakMultiplier: 1.2,
            seasonalFactors: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
          }
        ]
      };

      const report = await loadTestRunner.executeComprehensiveTestSuite(suite);

      expect(report.loadTestResults.length).toBe(2);
      expect(report.loadTestResults[0].config.concurrentPlayers).toBe(2);
      expect(report.loadTestResults[1].config.concurrentPlayers).toBe(4);
    }, 25000);

    it('should generate comprehensive performance analysis', async () => {
      const suite = {
        name: 'Performance Analysis Suite',
        description: 'Detailed performance analysis',
        loadTests: [
          {
            concurrentPlayers: 8,
            testDurationMs: 3000,
            tasksPerPlayer: 4,
            taskTypeDistribution: { harvesting: 40, crafting: 30, combat: 30 },
            maxResponseTimeMs: 1000,
            maxErrorRate: 0.02,
            maxMemoryUsageMB: 600,
            rampUpTimeMs: 600,
            rampDownTimeMs: 600
          }
        ],
        stressTests: {
          name: 'Analysis Stress Test',
          scenarios: [
            {
              name: 'Performance Stress',
              description: 'Performance-focused stress test',
              config: {
                concurrentPlayers: 10,
                testDurationMs: 2000,
                tasksPerPlayer: 3,
                taskTypeDistribution: { harvesting: 33, crafting: 33, combat: 34 },
                maxResponseTimeMs: 800,
                maxErrorRate: 0.03,
                maxMemoryUsageMB: 700,
                rampUpTimeMs: 400,
                rampDownTimeMs: 400
              },
              expectedFailureThreshold: 0.025
            }
          ],
          maxConcurrentTests: 1
        },
        capacityScenarios: [
          {
            name: 'Moderate Growth',
            description: 'Moderate growth scenario',
            timeframe: '12 months',
            userGrowthRate: 8,
            peakMultiplier: 1.8,
            seasonalFactors: [1.0, 1.0, 1.1, 1.1, 1.2, 1.2, 1.3, 1.3, 1.2, 1.1, 1.0, 1.0]
          }
        ]
      };

      const report = await loadTestRunner.executeComprehensiveTestSuite(suite);

      // Verify benchmark suite has comprehensive metrics
      expect(report.benchmarkSuite.metrics.length).toBeGreaterThan(5);
      
      const metricNames = report.benchmarkSuite.metrics.map(m => m.name);
      expect(metricNames).toContain('Average Response Time');
      expect(metricNames).toContain('Peak Memory Usage');
      expect(metricNames).toContain('Error Rate');
      
      // Verify stress analysis
      expect(report.stressTestReport.stressAnalysis.breakingPoint).toBeGreaterThan(0);
      expect(report.stressTestReport.stressAnalysis.stabilityScore).toBeGreaterThanOrEqual(0);
      
      // Verify capacity planning
      expect(report.capacityPlans[0].projections.length).toBe(12); // 12 months
      expect(report.capacityPlans[0].totalCost).toBeGreaterThan(0);
    }, 35000);

    it('should provide actionable recommendations', async () => {
      const suite = {
        name: 'Recommendation Test Suite',
        description: 'Test recommendation generation',
        loadTests: [
          {
            concurrentPlayers: 15,
            testDurationMs: 2500,
            tasksPerPlayer: 6,
            taskTypeDistribution: { harvesting: 30, crafting: 40, combat: 30 },
            maxResponseTimeMs: 500, // Strict response time
            maxErrorRate: 0.005, // Very low error tolerance
            maxMemoryUsageMB: 300, // Low memory limit
            rampUpTimeMs: 500,
            rampDownTimeMs: 500
          }
        ],
        stressTests: {
          name: 'Recommendation Stress Test',
          scenarios: [
            {
              name: 'High Demand Stress',
              description: 'High demand scenario',
              config: {
                concurrentPlayers: 20,
                testDurationMs: 2000,
                tasksPerPlayer: 8,
                taskTypeDistribution: { harvesting: 25, crafting: 50, combat: 25 },
                maxResponseTimeMs: 400,
                maxErrorRate: 0.01,
                maxMemoryUsageMB: 400,
                rampUpTimeMs: 400,
                rampDownTimeMs: 400
              },
              expectedFailureThreshold: 0.015
            }
          ],
          maxConcurrentTests: 1
        },
        capacityScenarios: [
          {
            name: 'Aggressive Growth',
            description: 'Rapid expansion',
            timeframe: '12 months',
            userGrowthRate: 20,
            peakMultiplier: 2.5,
            seasonalFactors: [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.6, 1.4, 1.2, 1.1]
          }
        ]
      };

      const report = await loadTestRunner.executeComprehensiveTestSuite(suite);

      // Should generate recommendations due to strict thresholds
      expect(report.immediateActions.length + report.shortTermRecommendations.length + report.longTermRecommendations.length)
        .toBeGreaterThan(0);
      
      // Check for specific types of recommendations
      const allRecommendations = [
        ...report.immediateActions,
        ...report.shortTermRecommendations,
        ...report.longTermRecommendations
      ].join(' ').toLowerCase();
      
      // Should contain performance-related recommendations
      expect(
        allRecommendations.includes('performance') ||
        allRecommendations.includes('optimize') ||
        allRecommendations.includes('memory') ||
        allRecommendations.includes('response') ||
        allRecommendations.includes('scaling')
      ).toBe(true);
    }, 30000);
  });

  describe('createStandardLoadTestSuite', () => {
    it('should create a comprehensive standard test suite', () => {
      const suite = loadTestRunner.createStandardLoadTestSuite();

      expect(suite).toBeDefined();
      expect(suite.name).toBeDefined();
      expect(suite.description).toBeDefined();
      expect(suite.loadTests.length).toBeGreaterThan(0);
      expect(suite.stressTests).toBeDefined();
      expect(suite.capacityScenarios.length).toBeGreaterThan(0);
      
      // Verify load tests have escalating complexity
      for (let i = 1; i < suite.loadTests.length; i++) {
        expect(suite.loadTests[i].concurrentPlayers).toBeGreaterThan(suite.loadTests[i-1].concurrentPlayers);
      }
      
      // Verify stress tests are comprehensive
      expect(suite.stressTests.scenarios.length).toBeGreaterThan(3);
      
      // Verify capacity scenarios cover different growth patterns
      const scenarioNames = suite.capacityScenarios.map(s => s.name);
      expect(scenarioNames.length).toBeGreaterThan(2);
    });
  });

  describe('validateOptimization', () => {
    it('should validate optimization improvements', async () => {
      const beforeSuite = {
        name: 'Before Optimization',
        description: 'Performance before optimization',
        loadTests: [
          {
            concurrentPlayers: 5,
            testDurationMs: 1500,
            tasksPerPlayer: 3,
            taskTypeDistribution: { harvesting: 100, crafting: 0, combat: 0 },
            maxResponseTimeMs: 2000, // Generous limits for "before"
            maxErrorRate: 0.1,
            maxMemoryUsageMB: 1000,
            rampUpTimeMs: 300,
            rampDownTimeMs: 300
          }
        ],
        stressTests: {
          name: 'Before Stress Test',
          scenarios: [
            {
              name: 'Before Stress',
              description: 'Stress test before optimization',
              config: {
                concurrentPlayers: 8,
                testDurationMs: 1500,
                tasksPerPlayer: 2,
                taskTypeDistribution: { harvesting: 100, crafting: 0, combat: 0 },
                maxResponseTimeMs: 2000,
                maxErrorRate: 0.1,
                maxMemoryUsageMB: 1000,
                rampUpTimeMs: 300,
                rampDownTimeMs: 300
              },
              expectedFailureThreshold: 0.05
            }
          ],
          maxConcurrentTests: 1
        },
        capacityScenarios: [
          {
            name: 'Before Growth',
            description: 'Growth scenario before optimization',
            timeframe: '6 months',
            userGrowthRate: 5,
            peakMultiplier: 1.2,
            seasonalFactors: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
          }
        ]
      };

      const afterSuite = {
        name: 'After Optimization',
        description: 'Performance after optimization',
        loadTests: [
          {
            concurrentPlayers: 5,
            testDurationMs: 1500,
            tasksPerPlayer: 3,
            taskTypeDistribution: { harvesting: 100, crafting: 0, combat: 0 },
            maxResponseTimeMs: 1000, // Stricter limits for "after"
            maxErrorRate: 0.02,
            maxMemoryUsageMB: 500,
            rampUpTimeMs: 300,
            rampDownTimeMs: 300
          }
        ],
        stressTests: {
          name: 'After Stress Test',
          scenarios: [
            {
              name: 'After Stress',
              description: 'Stress test after optimization',
              config: {
                concurrentPlayers: 8,
                testDurationMs: 1500,
                tasksPerPlayer: 2,
                taskTypeDistribution: { harvesting: 100, crafting: 0, combat: 0 },
                maxResponseTimeMs: 1000,
                maxErrorRate: 0.02,
                maxMemoryUsageMB: 500,
                rampUpTimeMs: 300,
                rampDownTimeMs: 300
              },
              expectedFailureThreshold: 0.02
            }
          ],
          maxConcurrentTests: 1
        },
        capacityScenarios: [
          {
            name: 'After Growth',
            description: 'Growth scenario after optimization',
            timeframe: '6 months',
            userGrowthRate: 5,
            peakMultiplier: 1.2,
            seasonalFactors: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
          }
        ]
      };

      const validation = await loadTestRunner.validateOptimization(
        'Performance Optimization Test',
        beforeSuite,
        afterSuite,
        '1.0.0',
        'optimization-test'
      );

      expect(validation).toBeDefined();
      expect(validation.optimizationName).toBe('Performance Optimization Test');
      expect(validation.beforeMetrics).toBeDefined();
      expect(validation.afterMetrics).toBeDefined();
      expect(validation.improvement).toBeDefined();
      expect(validation.improvement.size).toBeGreaterThan(0);
      expect(Array.isArray(validation.regressions)).toBe(true);
      expect(['deploy', 'investigate', 'rollback']).toContain(validation.recommendation);
    }, 45000); // Longer timeout for optimization validation
  });

  describe('generateTestReport', () => {
    it('should generate a comprehensive test report', async () => {
      const suite = {
        name: 'Report Generation Test',
        description: 'Test report generation',
        loadTests: [
          {
            concurrentPlayers: 6,
            testDurationMs: 2000,
            tasksPerPlayer: 3,
            taskTypeDistribution: { harvesting: 50, crafting: 50, combat: 0 },
            maxResponseTimeMs: 1000,
            maxErrorRate: 0.02,
            maxMemoryUsageMB: 500,
            rampUpTimeMs: 400,
            rampDownTimeMs: 400
          }
        ],
        stressTests: {
          name: 'Report Stress Test',
          scenarios: [
            {
              name: 'Report Stress',
              description: 'Stress test for report',
              config: {
                concurrentPlayers: 8,
                testDurationMs: 1500,
                tasksPerPlayer: 2,
                taskTypeDistribution: { harvesting: 100, crafting: 0, combat: 0 },
                maxResponseTimeMs: 1000,
                maxErrorRate: 0.03,
                maxMemoryUsageMB: 600,
                rampUpTimeMs: 300,
                rampDownTimeMs: 300
              },
              expectedFailureThreshold: 0.025
            }
          ],
          maxConcurrentTests: 1
        },
        capacityScenarios: [
          {
            name: 'Report Growth',
            description: 'Growth for report',
            timeframe: '6 months',
            userGrowthRate: 10,
            peakMultiplier: 1.5,
            seasonalFactors: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
          }
        ]
      };

      const report = await loadTestRunner.executeComprehensiveTestSuite(suite);
      const textReport = loadTestRunner.generateTestReport(report);

      expect(textReport).toBeDefined();
      expect(typeof textReport).toBe('string');
      expect(textReport.length).toBeGreaterThan(100);
      
      // Check for key sections
      expect(textReport).toContain('Comprehensive Load Test Report');
      expect(textReport).toContain('Executive Summary');
      expect(textReport).toContain('Load Test Results');
      expect(textReport).toContain('Stress Test Summary');
      expect(textReport).toContain('Performance Benchmark');
      expect(textReport).toContain('Capacity Planning');
      expect(textReport).toContain('Recommendations');
      
      // Check for specific metrics
      expect(textReport).toContain('Performance Score');
      expect(textReport).toContain('Scalability Score');
      expect(textReport).toContain('Reliability Score');
    }, 25000);
  });

  describe('test control and monitoring', () => {
    it('should be able to stop a running test', async () => {
      const suite = {
        name: 'Long Running Test',
        description: 'Test that can be stopped',
        loadTests: [
          {
            concurrentPlayers: 5,
            testDurationMs: 15000, // 15 seconds
            tasksPerPlayer: 10,
            taskTypeDistribution: { harvesting: 100, crafting: 0, combat: 0 },
            maxResponseTimeMs: 1000,
            maxErrorRate: 0.05,
            maxMemoryUsageMB: 500,
            rampUpTimeMs: 2000,
            rampDownTimeMs: 2000
          }
        ],
        stressTests: {
          name: 'Long Stress Test',
          scenarios: [
            {
              name: 'Long Stress',
              description: 'Long running stress test',
              config: {
                concurrentPlayers: 8,
                testDurationMs: 10000,
                tasksPerPlayer: 8,
                taskTypeDistribution: { harvesting: 100, crafting: 0, combat: 0 },
                maxResponseTimeMs: 1000,
                maxErrorRate: 0.05,
                maxMemoryUsageMB: 500,
                rampUpTimeMs: 1000,
                rampDownTimeMs: 1000
              },
              expectedFailureThreshold: 0.03
            }
          ],
          maxConcurrentTests: 1
        },
        capacityScenarios: [
          {
            name: 'Quick Growth',
            description: 'Quick growth scenario',
            timeframe: '3 months',
            userGrowthRate: 5,
            peakMultiplier: 1.2,
            seasonalFactors: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
          }
        ]
      };

      // Start the test and stop it after a short delay
      const testPromise = loadTestRunner.executeComprehensiveTestSuite(suite);
      
      setTimeout(() => {
        loadTestRunner.stopCurrentTest();
      }, 2000);

      const report = await testPromise;
      
      // Test should complete even when stopped
      expect(report).toBeDefined();
      expect(report.endTime - report.startTime).toBeLessThan(15000); // Should be stopped before full duration
    }, 20000);

    it('should track running state correctly', () => {
      expect(loadTestRunner.isTestRunning()).toBe(false);
      
      // Note: Testing the running state during execution would require
      // more complex async handling, but we can verify initial state
    });
  });
});