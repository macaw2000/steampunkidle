/**
 * Tests for Stress Test Runner
 */

import { StressTestRunner, StressTestScenario } from '../StressTestRunner';
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

describe('StressTestRunner', () => {
  let stressTestRunner: StressTestRunner;
  let mockTaskQueueService: jest.Mocked<ServerTaskQueueService>;

  beforeEach(() => {
    mockTaskQueueService = new ServerTaskQueueService() as jest.Mocked<ServerTaskQueueService>;
    stressTestRunner = new StressTestRunner(mockTaskQueueService);
  });

  afterEach(() => {
    if (stressTestRunner) {
      stressTestRunner.stopStressTest();
    }
  });

  describe('createStandardStressScenarios', () => {
    it('should create a comprehensive set of stress scenarios', () => {
      const scenarios = stressTestRunner.createStandardStressScenarios();

      expect(scenarios).toBeDefined();
      expect(scenarios.length).toBeGreaterThan(0);
      
      // Check for key scenarios
      const scenarioNames = scenarios.map(s => s.name);
      expect(scenarioNames).toContain('Baseline Load');
      expect(scenarioNames).toContain('High Load');
      expect(scenarioNames).toContain('Extreme Load');
      expect(scenarioNames).toContain('Burst Load');
    });

    it('should have properly configured scenario parameters', () => {
      const scenarios = stressTestRunner.createStandardStressScenarios();

      for (const scenario of scenarios) {
        expect(scenario.name).toBeDefined();
        expect(scenario.description).toBeDefined();
        expect(scenario.config).toBeDefined();
        expect(scenario.expectedFailureThreshold).toBeGreaterThan(0);
        
        // Validate config parameters
        expect(scenario.config.concurrentPlayers).toBeGreaterThan(0);
        expect(scenario.config.testDurationMs).toBeGreaterThan(0);
        expect(scenario.config.tasksPerPlayer).toBeGreaterThan(0);
        expect(scenario.config.rampUpTimeMs).toBeGreaterThan(0);
        expect(scenario.config.rampDownTimeMs).toBeGreaterThan(0);
      }
    });

    it('should have escalating load levels', () => {
      const scenarios = stressTestRunner.createStandardStressScenarios();
      
      // Sort by concurrent players to check escalation
      const sortedScenarios = scenarios
        .filter(s => !s.name.includes('Burst') && !s.name.includes('Queue') && !s.name.includes('Memory'))
        .sort((a, b) => a.config.concurrentPlayers - b.config.concurrentPlayers);

      for (let i = 1; i < sortedScenarios.length; i++) {
        expect(sortedScenarios[i].config.concurrentPlayers)
          .toBeGreaterThan(sortedScenarios[i-1].config.concurrentPlayers);
      }
    });
  });

  describe('executeStressTestSuite', () => {
    it('should execute a simple stress test suite', async () => {
      const suite = {
        name: 'Simple Stress Test',
        scenarios: [
          {
            name: 'Light Load',
            description: 'Basic stress test',
            config: {
              concurrentPlayers: 5,
              testDurationMs: 2000,
              tasksPerPlayer: 2,
              taskTypeDistribution: { harvesting: 100, crafting: 0, combat: 0 },
              maxResponseTimeMs: 1000,
              maxErrorRate: 0.05,
              maxMemoryUsageMB: 500,
              rampUpTimeMs: 500,
              rampDownTimeMs: 500
            },
            expectedFailureThreshold: 0.01
          }
        ],
        maxConcurrentTests: 1
      };

      const report = await stressTestRunner.executeStressTestSuite(suite);

      expect(report).toBeDefined();
      expect(report.suiteId).toMatch(/^stress-suite-\d+$/);
      expect(report.suiteName).toBe(suite.name);
      expect(report.scenarioResults.size).toBe(1);
      expect(report.scenarioResults.has('Light Load')).toBe(true);
      expect(report.endTime).toBeGreaterThan(report.startTime);
    });

    it('should calculate overall metrics from scenario results', async () => {
      const suite = {
        name: 'Multi-Scenario Stress Test',
        scenarios: [
          {
            name: 'Scenario 1',
            description: 'First scenario',
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
            expectedFailureThreshold: 0.01
          },
          {
            name: 'Scenario 2',
            description: 'Second scenario',
            config: {
              concurrentPlayers: 4,
              testDurationMs: 1500,
              tasksPerPlayer: 3,
              taskTypeDistribution: { harvesting: 50, crafting: 50, combat: 0 },
              maxResponseTimeMs: 1000,
              maxErrorRate: 0.05,
              maxMemoryUsageMB: 500,
              rampUpTimeMs: 300,
              rampDownTimeMs: 300
            },
            expectedFailureThreshold: 0.015
          }
        ],
        maxConcurrentTests: 2
      };

      const report = await stressTestRunner.executeStressTestSuite(suite);

      expect(report.overallMetrics.totalRequests).toBeGreaterThan(0);
      expect(report.overallMetrics.totalFailures).toBeGreaterThanOrEqual(0);
      expect(report.overallMetrics.averageResponseTime).toBeGreaterThan(0);
      expect(report.overallMetrics.peakMemoryUsage).toBeGreaterThan(0);
      expect(report.overallMetrics.peakCpuUsage).toBeGreaterThan(0);
    });

    it('should perform stress analysis', async () => {
      const suite = {
        name: 'Stress Analysis Test',
        scenarios: [
          {
            name: 'Low Stress',
            description: 'Low stress scenario',
            config: {
              concurrentPlayers: 2,
              testDurationMs: 1000,
              tasksPerPlayer: 1,
              taskTypeDistribution: { harvesting: 100, crafting: 0, combat: 0 },
              maxResponseTimeMs: 2000,
              maxErrorRate: 0.1,
              maxMemoryUsageMB: 1000,
              rampUpTimeMs: 200,
              rampDownTimeMs: 200
            },
            expectedFailureThreshold: 0.05
          }
        ],
        maxConcurrentTests: 1
      };

      const report = await stressTestRunner.executeStressTestSuite(suite);

      expect(report.stressAnalysis).toBeDefined();
      expect(report.stressAnalysis.breakingPoint).toBeGreaterThan(0);
      expect(report.stressAnalysis.stabilityScore).toBeGreaterThanOrEqual(0);
      expect(report.stressAnalysis.stabilityScore).toBeLessThanOrEqual(100);
      expect(report.stressAnalysis.recoveryTime).toBeGreaterThan(0);
      expect(Array.isArray(report.stressAnalysis.criticalBottlenecks)).toBe(true);
    });

    it('should generate recommendations', async () => {
      const suite = {
        name: 'Recommendation Test',
        scenarios: [
          {
            name: 'High Load Scenario',
            description: 'Scenario to trigger recommendations',
            config: {
              concurrentPlayers: 10,
              testDurationMs: 2000,
              tasksPerPlayer: 5,
              taskTypeDistribution: { harvesting: 40, crafting: 30, combat: 30 },
              maxResponseTimeMs: 500, // Strict limit
              maxErrorRate: 0.01, // Low tolerance
              maxMemoryUsageMB: 200, // Low memory limit
              rampUpTimeMs: 400,
              rampDownTimeMs: 400
            },
            expectedFailureThreshold: 0.02
          }
        ],
        maxConcurrentTests: 1
      };

      const report = await stressTestRunner.executeStressTestSuite(suite);

      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('createComprehensiveStressSuite', () => {
    it('should create a comprehensive stress test suite', () => {
      const suite = stressTestRunner.createComprehensiveStressSuite();

      expect(suite).toBeDefined();
      expect(suite.name).toBeDefined();
      expect(suite.scenarios).toBeDefined();
      expect(suite.scenarios.length).toBeGreaterThan(0);
      expect(suite.maxConcurrentTests).toBeGreaterThan(0);
    });

    it('should include all standard stress scenarios', () => {
      const suite = stressTestRunner.createComprehensiveStressSuite();
      const standardScenarios = stressTestRunner.createStandardStressScenarios();

      expect(suite.scenarios.length).toBe(standardScenarios.length);
      
      const suiteScenarioNames = suite.scenarios.map(s => s.name);
      const standardScenarioNames = standardScenarios.map(s => s.name);
      
      for (const name of standardScenarioNames) {
        expect(suiteScenarioNames).toContain(name);
      }
    });
  });

  describe('stress test control', () => {
    it('should be able to stop a running stress test', async () => {
      const suite = {
        name: 'Long Running Test',
        scenarios: [
          {
            name: 'Long Scenario',
            description: 'Long running scenario',
            config: {
              concurrentPlayers: 5,
              testDurationMs: 10000, // 10 seconds
              tasksPerPlayer: 10,
              taskTypeDistribution: { harvesting: 100, crafting: 0, combat: 0 },
              maxResponseTimeMs: 1000,
              maxErrorRate: 0.05,
              maxMemoryUsageMB: 500,
              rampUpTimeMs: 1000,
              rampDownTimeMs: 1000
            },
            expectedFailureThreshold: 0.01
          }
        ],
        maxConcurrentTests: 1
      };

      // Start the test and stop it quickly
      const testPromise = stressTestRunner.executeStressTestSuite(suite);
      
      setTimeout(() => {
        stressTestRunner.stopStressTest();
      }, 1000);

      const report = await testPromise;
      
      // Test should complete even when stopped
      expect(report).toBeDefined();
      expect(report.endTime - report.startTime).toBeLessThan(suite.scenarios[0].config.testDurationMs);
    });

    it('should track running state correctly', () => {
      expect(stressTestRunner.isStressTestRunning()).toBe(false);
      
      // Note: We can't easily test the running state during execution
      // without making the test more complex, but we can verify initial state
    });

    it('should return current suite when running', () => {
      const currentSuite = stressTestRunner.getCurrentSuite();
      expect(currentSuite).toBeNull(); // Should be null when not running
    });
  });

  describe('stress analysis algorithms', () => {
    it('should identify breaking points correctly', async () => {
      const suite = {
        name: 'Breaking Point Test',
        scenarios: [
          {
            name: 'Low Load',
            description: 'Should pass',
            config: {
              concurrentPlayers: 2,
              testDurationMs: 1000,
              tasksPerPlayer: 1,
              taskTypeDistribution: { harvesting: 100, crafting: 0, combat: 0 },
              maxResponseTimeMs: 2000,
              maxErrorRate: 0.1,
              maxMemoryUsageMB: 1000,
              rampUpTimeMs: 200,
              rampDownTimeMs: 200
            },
            expectedFailureThreshold: 0.05
          },
          {
            name: 'High Load',
            description: 'Should stress the system',
            config: {
              concurrentPlayers: 20,
              testDurationMs: 1000,
              tasksPerPlayer: 10,
              taskTypeDistribution: { harvesting: 100, crafting: 0, combat: 0 },
              maxResponseTimeMs: 100, // Very strict
              maxErrorRate: 0.001, // Very low tolerance
              maxMemoryUsageMB: 50, // Very low memory
              rampUpTimeMs: 200,
              rampDownTimeMs: 200
            },
            expectedFailureThreshold: 0.05
          }
        ],
        maxConcurrentTests: 1
      };

      const report = await stressTestRunner.executeStressTestSuite(suite);

      // Breaking point should be identified
      expect(report.stressAnalysis.breakingPoint).toBeGreaterThan(0);
      expect(report.stressAnalysis.breakingPoint).toBeLessThanOrEqual(20);
    });

    it('should calculate stability scores appropriately', async () => {
      const suite = {
        name: 'Stability Test',
        scenarios: [
          {
            name: 'Stable Scenario',
            description: 'Should be stable',
            config: {
              concurrentPlayers: 3,
              testDurationMs: 1500,
              tasksPerPlayer: 2,
              taskTypeDistribution: { harvesting: 100, crafting: 0, combat: 0 },
              maxResponseTimeMs: 5000, // Generous limits
              maxErrorRate: 0.2,
              maxMemoryUsageMB: 2000,
              rampUpTimeMs: 300,
              rampDownTimeMs: 300
            },
            expectedFailureThreshold: 0.1
          }
        ],
        maxConcurrentTests: 1
      };

      const report = await stressTestRunner.executeStressTestSuite(suite);

      expect(report.stressAnalysis.stabilityScore).toBeGreaterThan(50); // Should be reasonably stable
      expect(report.stressAnalysis.stabilityScore).toBeLessThanOrEqual(100);
    });
  });
});