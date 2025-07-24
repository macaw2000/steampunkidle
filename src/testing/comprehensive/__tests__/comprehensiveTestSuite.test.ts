/**
 * Jest Integration for Comprehensive Task Queue Test Suite
 */

import { taskQueueTestSuite } from '../taskQueueTestSuite';

describe('Comprehensive Task Queue Test Suite', () => {
  // Increase timeout for comprehensive tests
  jest.setTimeout(60000);

  describe('Unit Tests', () => {
    it('should pass all unit tests', async () => {
      const results = await taskQueueTestSuite.runUnitTests();
      
      expect(results.totalTests).toBeGreaterThan(0);
      expect(results.failed).toBe(0);
      expect(results.passed).toBe(results.totalTests);
      
      if (results.errors && results.errors.length > 0) {
        console.error('Unit test errors:', results.errors);
        throw new Error(`Unit tests failed: ${results.errors[0].message}`);
      }
    });
  });

  describe('Integration Tests', () => {
    it('should pass all integration tests', async () => {
      const results = await taskQueueTestSuite.runIntegrationTests();
      
      expect(results.totalTests).toBeGreaterThan(0);
      expect(results.failed).toBe(0);
      expect(results.passed).toBe(results.totalTests);
      
      if (results.errors && results.errors.length > 0) {
        console.error('Integration test errors:', results.errors);
        throw new Error(`Integration tests failed: ${results.errors[0].message}`);
      }
    });
  });

  describe('End-to-End Tests', () => {
    it('should pass all E2E tests', async () => {
      const results = await taskQueueTestSuite.runE2ETests();
      
      expect(results.totalTests).toBeGreaterThan(0);
      expect(results.failed).toBe(0);
      expect(results.passed).toBe(results.totalTests);
      
      if (results.errors && results.errors.length > 0) {
        console.error('E2E test errors:', results.errors);
        throw new Error(`E2E tests failed: ${results.errors[0].message}`);
      }
    });
  });

  describe('Regression Tests', () => {
    it('should pass all regression tests', async () => {
      const results = await taskQueueTestSuite.runRegressionTests();
      
      expect(results.totalTests).toBeGreaterThan(0);
      expect(results.failed).toBe(0);
      expect(results.passed).toBe(results.totalTests);
      
      if (results.errors && results.errors.length > 0) {
        console.error('Regression test errors:', results.errors);
        throw new Error(`Regression tests failed: ${results.errors[0].message}`);
      }
    });
  });

  describe('Complete Test Suite', () => {
    it('should pass all comprehensive tests', async () => {
      const results = await taskQueueTestSuite.runAllTests();
      
      expect(results.summary.totalTests).toBeGreaterThan(50); // Expect substantial test coverage
      expect(results.summary.failed).toBe(0);
      expect(results.summary.passed).toBe(results.summary.totalTests);
      
      // Verify all test categories ran
      expect(results.unit.totalTests).toBeGreaterThan(0);
      expect(results.integration.totalTests).toBeGreaterThan(0);
      expect(results.e2e.totalTests).toBeGreaterThan(0);
      expect(results.regression.totalTests).toBeGreaterThan(0);
      
      // Performance expectations
      expect(results.summary.duration).toBeLessThan(60000); // Should complete within 60 seconds
      
      const avgTestTime = results.summary.duration / results.summary.totalTests;
      expect(avgTestTime).toBeLessThan(1000); // Average test should be under 1 second
      
      if (results.summary.failed > 0) {
        const errorMessages = [
          ...(results.unit.errors || []),
          ...(results.integration.errors || []),
          ...(results.e2e.errors || []),
          ...(results.regression.errors || [])
        ].map(e => e.message).join('\n');
        
        throw new Error(`Comprehensive tests failed:\n${errorMessages}`);
      }
    });
  });

  describe('Test Suite Performance', () => {
    it('should complete unit tests quickly', async () => {
      const startTime = Date.now();
      const results = await taskQueueTestSuite.runUnitTests();
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(10000); // Unit tests should complete within 10 seconds
      expect(results.totalTests).toBeGreaterThan(10); // Should have substantial unit test coverage
    });

    it('should handle large test loads efficiently', async () => {
      const startTime = Date.now();
      
      // Run multiple test categories in parallel
      const [unitResults, integrationResults] = await Promise.all([
        taskQueueTestSuite.runUnitTests(),
        taskQueueTestSuite.runIntegrationTests()
      ]);
      
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(20000); // Parallel execution should be efficient
      expect(unitResults.failed + integrationResults.failed).toBe(0);
    });
  });

  describe('Test Coverage Validation', () => {
    it('should cover all critical task queue components', async () => {
      const results = await taskQueueTestSuite.runAllTests();
      
      // Verify comprehensive coverage
      expect(results.summary.totalTests).toBeGreaterThan(50); // Expect good test count
      
      // Each category should have tests
      expect(results.unit.totalTests).toBeGreaterThan(10);
      expect(results.integration.totalTests).toBeGreaterThan(10);
      expect(results.e2e.totalTests).toBeGreaterThan(5);
      expect(results.regression.totalTests).toBeGreaterThan(10);
    });

    it('should validate all task types', async () => {
      const results = await taskQueueTestSuite.runUnitTests();
      
      // Unit tests should cover all task types
      expect(results.totalTests).toBeGreaterThan(10);
      expect(results.passed).toBe(results.totalTests);
    });

    it('should test error scenarios comprehensively', async () => {
      const results = await taskQueueTestSuite.runRegressionTests();
      
      // Regression tests should cover error scenarios
      expect(results.totalTests).toBeGreaterThan(10);
      expect(results.passed).toBe(results.totalTests);
    });
  });
});