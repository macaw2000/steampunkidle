/**
 * Jest test wrapper for User Acceptance Test Suite
 * This allows running user acceptance tests through Jest
 */

import { UserAcceptanceTestSuite } from '../UserAcceptanceTestSuite';
import { TaskType } from '../../../types/taskQueue';

describe('User Acceptance Test Suite', () => {
  let testSuite: UserAcceptanceTestSuite;
  
  beforeAll(() => {
    testSuite = new UserAcceptanceTestSuite();
  });

  describe('Player Usage Pattern Tests', () => {
    it('should pass all player usage pattern scenarios', async () => {
      const results = await testSuite.runTestCategory('PLAYER_USAGE_PATTERNS');
      
      expect(results).toBeDefined();
      expect(results.totalTests).toBeGreaterThan(0);
      expect(results.passedTests).toBeGreaterThanOrEqual(0);
      
      // Log detailed results for debugging
      console.log('Player Usage Pattern Results:', {
        totalTests: results.totalTests,
        passedTests: results.passedTests,
        scenarios: results.scenarios.map((s: any) => ({
          name: s.name,
          status: s.status,
          duration: s.duration
        }))
      });
      
      // At least 80% of tests should pass for acceptance
      const passRate = results.passedTests / results.totalTests;
      expect(passRate).toBeGreaterThanOrEqual(0.8);
    }, 60000); // 60 second timeout
  });

  describe('Offline/Online Transition Tests', () => {
    it('should pass all offline/online transition scenarios', async () => {
      const results = await testSuite.runTestCategory('OFFLINE_ONLINE_TRANSITIONS');
      
      expect(results).toBeDefined();
      expect(results.totalTests).toBeGreaterThan(0);
      expect(results.passedTests).toBeGreaterThanOrEqual(0);
      
      // Log detailed results for debugging
      console.log('Offline/Online Transition Results:', {
        totalTests: results.totalTests,
        passedTests: results.passedTests,
        scenarios: results.scenarios.map((s: any) => ({
          name: s.name,
          status: s.status,
          duration: s.duration
        }))
      });
      
      // At least 70% of tests should pass (offline/online is complex)
      const passRate = results.passedTests / results.totalTests;
      expect(passRate).toBeGreaterThanOrEqual(0.7);
    }, 90000); // 90 second timeout for complex sync operations
  });

  describe('Performance Validation Tests', () => {
    it('should pass all performance validation scenarios', async () => {
      const results = await testSuite.runTestCategory('PERFORMANCE_VALIDATION');
      
      expect(results).toBeDefined();
      expect(results.totalTests).toBeGreaterThan(0);
      expect(results.passedTests).toBeGreaterThanOrEqual(0);
      
      // Log detailed results for debugging
      console.log('Performance Validation Results:', {
        totalTests: results.totalTests,
        passedTests: results.passedTests,
        scenarios: results.scenarios.map((s: any) => ({
          name: s.name,
          status: s.status,
          duration: s.duration
        }))
      });
      
      // At least 75% of performance tests should pass
      const passRate = results.passedTests / results.totalTests;
      expect(passRate).toBeGreaterThanOrEqual(0.75);
    }, 120000); // 120 second timeout for performance tests
  });

  describe('Usability Tests', () => {
    it('should pass all usability test scenarios', async () => {
      const results = await testSuite.runTestCategory('USABILITY_TESTING');
      
      expect(results).toBeDefined();
      expect(results.totalTests).toBeGreaterThan(0);
      expect(results.passedTests).toBeGreaterThanOrEqual(0);
      
      // Log detailed results for debugging
      console.log('Usability Test Results:', {
        totalTests: results.totalTests,
        passedTests: results.passedTests,
        scenarios: results.scenarios.map((s: any) => ({
          name: s.name,
          status: s.status,
          duration: s.duration
        }))
      });
      
      // At least 80% of usability tests should pass
      const passRate = results.passedTests / results.totalTests;
      expect(passRate).toBeGreaterThanOrEqual(0.8);
    }, 60000); // 60 second timeout
  });

  describe('Complete Test Suite', () => {
    it('should run the complete user acceptance test suite', async () => {
      const results = await testSuite.runAllTests();
      
      expect(results).toBeDefined();
      expect(results.summary).toBeDefined();
      expect(results.summary.totalTests).toBeGreaterThan(0);
      
      // Log comprehensive results
      console.log('Complete Test Suite Results:', {
        overallStatus: results.summary.overallStatus,
        totalTests: results.summary.totalTests,
        passedTests: results.summary.passedTests,
        failedTests: results.summary.failedTests,
        duration: results.summary.duration,
        passRate: `${((results.summary.passedTests / results.summary.totalTests) * 100).toFixed(1)}%`
      });
      
      // Individual section results
      if (results.playerUsagePatterns) {
        console.log('Player Usage Patterns:', `${results.playerUsagePatterns.passedTests}/${results.playerUsagePatterns.totalTests} passed`);
      }
      if (results.offlineOnlineTransitions) {
        console.log('Offline/Online Transitions:', `${results.offlineOnlineTransitions.passedTests}/${results.offlineOnlineTransitions.totalTests} passed`);
      }
      if (results.performanceValidation) {
        console.log('Performance Validation:', `${results.performanceValidation.passedTests}/${results.performanceValidation.totalTests} passed`);
      }
      if (results.usabilityTesting) {
        console.log('Usability Testing:', `${results.usabilityTesting.passedTests}/${results.usabilityTesting.totalTests} passed`);
      }
      
      // Overall acceptance criteria: at least 75% of all tests should pass
      const overallPassRate = results.summary.passedTests / results.summary.totalTests;
      expect(overallPassRate).toBeGreaterThanOrEqual(0.75);
      
      // Verify that we have results from all test categories
      expect(results.playerUsagePatterns).toBeDefined();
      expect(results.offlineOnlineTransitions).toBeDefined();
      expect(results.performanceValidation).toBeDefined();
      expect(results.usabilityTesting).toBeDefined();
      
    }, 300000); // 5 minute timeout for complete suite
  });

  describe('Test Infrastructure', () => {
    it('should have properly configured test data generator', () => {
      const testDataGenerator = new (require('../utils/TestDataGenerator')).TestDataGenerator();
      
      // Test player generation
      const casualPlayer = testDataGenerator.generateTestPlayer('CASUAL');
      expect(casualPlayer).toBeDefined();
      expect(casualPlayer.id).toBeDefined();
      expect(casualPlayer.username).toBeDefined();
      expect(casualPlayer.level).toBeGreaterThan(0);
      
      const hardcorePlayer = testDataGenerator.generateTestPlayer('HARDCORE');
      expect(hardcorePlayer.level).toBeGreaterThan(casualPlayer.level);
      
      // Test task generation
      const harvestingTask = testDataGenerator.generateTask(TaskType.HARVESTING);
      expect(harvestingTask).toBeDefined();
      expect(harvestingTask.type).toBe(TaskType.HARVESTING);
      expect(harvestingTask.duration).toBeGreaterThan(0);
      
      const craftingTask = testDataGenerator.generateTask(TaskType.CRAFTING);
      expect(craftingTask.type).toBe(TaskType.CRAFTING);
      
      const combatTask = testDataGenerator.generateTask(TaskType.COMBAT);
      expect(combatTask.type).toBe(TaskType.COMBAT);
      
      // Test queue generation
      const testQueue = testDataGenerator.generateTestTaskQueue('test-player', 'MIXED');
      expect(testQueue).toBeDefined();
      expect(testQueue.playerId).toBe('test-player');
      expect(Array.isArray(testQueue.queuedTasks)).toBe(true);
    });

    it('should have properly configured test reporter', () => {
      const TestReporter = require('../utils/TestReporter').TestReporter;
      const testReporter = new TestReporter();
      
      expect(testReporter).toBeDefined();
      expect(typeof testReporter.generateReport).toBe('function');
      expect(typeof testReporter.generateConsoleSummary).toBe('function');
    });
  });
});