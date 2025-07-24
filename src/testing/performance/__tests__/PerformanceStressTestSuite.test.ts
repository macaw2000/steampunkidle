import { PerformanceStressTestSuite } from '../PerformanceStressTestSuite';
import { TaskType } from '../../../types/taskQueue';

describe('PerformanceStressTestSuite', () => {
  let testSuite: PerformanceStressTestSuite;

  beforeEach(() => {
    testSuite = new PerformanceStressTestSuite();
  });

  afterEach(() => {
    // Ensure tests are stopped
    (testSuite as any).isRunning = false;
  });

  describe('Concurrent Player Performance Testing', () => {
    it('should test system performance with 1000+ concurrent players', async () => {
      const config = {
        maxConcurrentUsers: 1000,
        testDurationMinutes: 1, // Short duration for testing
        rampUpTimeMinutes: 0.5,
        taskTypesDistribution: {
          [TaskType.HARVESTING]: 0.4,
          [TaskType.CRAFTING]: 0.3,
          [TaskType.COMBAT]: 0.3
        },
        memoryThresholdMB: 500,
        responseTimeThresholdMs: 1000
      };

      const results = await testSuite.testConcurrentPlayerPerformance(config);

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('responseTime');
      expect(results[0]).toHaveProperty('throughput');
      expect(results[0]).toHaveProperty('memoryUsage');
      expect(results[0]).toHaveProperty('concurrentUsers');
    }, 30000);

    it('should handle ramp-up scenarios correctly', async () => {
      const config = {
        maxConcurrentUsers: 100,
        testDurationMinutes: 0.1,
        rampUpTimeMinutes: 0.05,
        taskTypesDistribution: {
          [TaskType.HARVESTING]: 1.0
        },
        memoryThresholdMB: 200,
        responseTimeThresholdMs: 500
      };

      const results = await testSuite.testConcurrentPlayerPerformance(config);

      // Should have metrics from ramp-up and sustained phases
      expect(results.length).toBeGreaterThan(5);
      
      // Concurrent users should increase over time during ramp-up
      const userCounts = results.map(r => r.concurrentUsers);
      expect(Math.max(...userCounts)).toBe(config.maxConcurrentUsers);
    }, 15000);
  });

  describe('Queue Processing Time Validation', () => {
    it('should validate queue processing times under various load conditions', async () => {
      const results = await testSuite.validateQueueProcessingTimes();

      expect(results).toHaveProperty('lightLoad');
      expect(results).toHaveProperty('mediumLoad');
      expect(results).toHaveProperty('heavyLoad');
      expect(results).toHaveProperty('peakLoad');

      // Each load level should have metrics
      expect(results.lightLoad.length).toBeGreaterThan(0);
      expect(results.mediumLoad.length).toBeGreaterThan(0);
      expect(results.heavyLoad.length).toBeGreaterThan(0);
      expect(results.peakLoad.length).toBeGreaterThan(0);

      // Processing times should generally increase with load
      const avgLightTime = results.lightLoad.reduce((sum, m) => sum + m.queueProcessingTime, 0) / results.lightLoad.length;
      const avgPeakTime = results.peakLoad.reduce((sum, m) => sum + m.queueProcessingTime, 0) / results.peakLoad.length;
      
      expect(avgPeakTime).toBeGreaterThanOrEqual(avgLightTime);
    }, 45000);

    it('should measure queue processing performance accurately', async () => {
      const lightLoadResults = await (testSuite as any).testQueueProcessingUnderLoad(50, 'test');

      expect(lightLoadResults).toBeDefined();
      expect(lightLoadResults.length).toBeGreaterThan(0);
      
      lightLoadResults.forEach(metric => {
        expect(metric.queueProcessingTime).toBeGreaterThan(0);
        expect(metric.timestamp).toBeGreaterThan(0);
        expect(metric.memoryUsage).toBeGreaterThan(0);
      });
    }, 15000);
  });

  describe('Extended Resource Consumption Testing', () => {
    it('should test memory usage over extended periods', async () => {
      // Use very short duration for testing
      const results = await testSuite.testExtendedResourceConsumption(0.01); // ~36 seconds

      expect(results).toHaveProperty('memoryProfile');
      expect(results).toHaveProperty('resourceLeaks');
      expect(results).toHaveProperty('stabilityReport');

      expect(results.memoryProfile.length).toBeGreaterThan(0);
      expect(typeof results.resourceLeaks).toBe('boolean');
      expect(typeof results.stabilityReport).toBe('string');
      expect(results.stabilityReport).toContain('Stability Report');
    }, 45000);

    it('should detect memory trends correctly', async () => {
      const mockMetrics = [
        { memoryUsage: 100, responseTime: 50, throughput: 10, errorRate: 0, cpuUsage: 20, queueProcessingTime: 30, concurrentUsers: 100, timestamp: Date.now() },
        { memoryUsage: 110, responseTime: 50, throughput: 10, errorRate: 0, cpuUsage: 20, queueProcessingTime: 30, concurrentUsers: 100, timestamp: Date.now() },
        { memoryUsage: 120, responseTime: 50, throughput: 10, errorRate: 0, cpuUsage: 20, queueProcessingTime: 30, concurrentUsers: 100, timestamp: Date.now() }
      ];

      const trend = (testSuite as any).calculateMemoryTrend(mockMetrics);
      expect(trend).toBe(0.2); // 20% increase
    });
  });

  describe('Peak Usage Stability Testing', () => {
    it('should verify system stability during peak usage scenarios', async () => {
      const results = await testSuite.verifyPeakUsageStability();

      expect(results).toHaveProperty('stabilityScore');
      expect(results).toHaveProperty('failurePoints');
      expect(results).toHaveProperty('recoveryTime');
      expect(results).toHaveProperty('recommendations');

      expect(typeof results.stabilityScore).toBe('number');
      expect(results.stabilityScore).toBeGreaterThanOrEqual(0);
      expect(results.stabilityScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(results.failurePoints)).toBe(true);
      expect(Array.isArray(results.recommendations)).toBe(true);
      expect(typeof results.recoveryTime).toBe('number');
    }, 30000);

    it('should handle traffic spike scenarios', async () => {
      const spikeResults = await (testSuite as any).testTrafficSpike(100, 5000);

      expect(spikeResults).toHaveProperty('maxResponseTime');
      expect(spikeResults).toHaveProperty('errorCount');
      expect(spikeResults).toHaveProperty('recoveryTimeMs');

      expect(spikeResults.maxResponseTime).toBeGreaterThan(0);
      expect(spikeResults.errorCount).toBeGreaterThanOrEqual(0);
      expect(spikeResults.recoveryTimeMs).toBeGreaterThan(0);
    }, 15000);
  });

  describe('Performance Reporting', () => {
    it('should generate comprehensive performance reports', () => {
      const mockMetrics = [
        { responseTime: 100, throughput: 10, errorRate: 0, memoryUsage: 50, cpuUsage: 30, queueProcessingTime: 80, concurrentUsers: 100, timestamp: Date.now() },
        { responseTime: 150, throughput: 8, errorRate: 0.1, memoryUsage: 60, cpuUsage: 40, queueProcessingTime: 90, concurrentUsers: 150, timestamp: Date.now() + 1000 },
        { responseTime: 200, throughput: 6, errorRate: 0.2, memoryUsage: 70, cpuUsage: 50, queueProcessingTime: 100, concurrentUsers: 200, timestamp: Date.now() + 2000 }
      ];

      const report = testSuite.generatePerformanceReport(mockMetrics);

      expect(report).toContain('Performance Test Report');
      expect(report).toContain('Response Time');
      expect(report).toContain('Throughput');
      expect(report).toContain('Resource Usage');
      expect(report).toContain('Average: 150.00ms'); // Average response time
      expect(report).toContain('Maximum: 200.00ms'); // Max response time
    });
  });

  describe('Utility Methods', () => {
    it('should create simulated users correctly', async () => {
      const users = await (testSuite as any).createSimulatedUsers(10);

      expect(users).toHaveLength(10);
      users.forEach((user, index) => {
        expect(user.id).toBe(`test-user-${index}`);
        expect(user.stats).toHaveProperty('level');
        expect(user.stats).toHaveProperty('experience');
        expect(user.stats).toHaveProperty('harvestingLevel');
        expect(user.stats).toHaveProperty('craftingLevel');
        expect(user.stats).toHaveProperty('combatLevel');
      });
    });

    it('should select random task types based on distribution', () => {
      const distribution = {
        [TaskType.HARVESTING]: 0.5,
        [TaskType.CRAFTING]: 0.3,
        [TaskType.COMBAT]: 0.2
      };

      // Test multiple selections to verify distribution logic
      const selections = [];
      for (let i = 0; i < 100; i++) {
        const taskType = (testSuite as any).selectRandomTaskType(distribution);
        selections.push(taskType);
      }

      // Should contain all task types
      expect(selections).toContain(TaskType.HARVESTING);
      expect(selections).toContain(TaskType.CRAFTING);
      expect(selections).toContain(TaskType.COMBAT);
    });

    it('should collect system metrics correctly', async () => {
      const metrics = await (testSuite as any).collectSystemMetrics(100);

      expect(metrics).toHaveProperty('responseTime');
      expect(metrics).toHaveProperty('throughput');
      expect(metrics).toHaveProperty('errorRate');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('cpuUsage');
      expect(metrics).toHaveProperty('queueProcessingTime');
      expect(metrics).toHaveProperty('concurrentUsers');
      expect(metrics).toHaveProperty('timestamp');

      expect(metrics.concurrentUsers).toBe(100);
      expect(metrics.responseTime).toBeGreaterThan(0);
      expect(metrics.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle test interruption gracefully', async () => {
      const config = {
        maxConcurrentUsers: 100,
        testDurationMinutes: 10, // Long duration
        rampUpTimeMinutes: 1,
        taskTypesDistribution: {
          [TaskType.HARVESTING]: 1.0
        },
        memoryThresholdMB: 500,
        responseTimeThresholdMs: 1000
      };

      // Start test and immediately stop it
      const testPromise = testSuite.testConcurrentPlayerPerformance(config);
      
      // Stop the test after a short delay
      setTimeout(() => {
        (testSuite as any).isRunning = false;
      }, 1000);

      const results = await testPromise;

      // Should still return some results even when interrupted
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    }, 15000);

    it('should handle invalid configurations gracefully', async () => {
      const invalidConfig = {
        maxConcurrentUsers: 0,
        testDurationMinutes: 0,
        rampUpTimeMinutes: 0,
        taskTypesDistribution: {},
        memoryThresholdMB: 0,
        responseTimeThresholdMs: 0
      };

      // Should not throw an error, but handle gracefully
      await expect(testSuite.testConcurrentPlayerPerformance(invalidConfig)).resolves.toBeDefined();
    });
  });
});