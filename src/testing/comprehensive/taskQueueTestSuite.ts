/**
 * Comprehensive Task Queue Test Suite
 * 
 * This file orchestrates all task queue tests including:
 * - Unit tests for all components
 * - Integration tests for client-server sync
 * - End-to-end tests for complete task lifecycle
 * - Regression tests for critical functionality
 */

import { TaskQueueUnitTests } from './unit/taskQueueUnitTests';
import { TaskQueueIntegrationTests } from './integration/taskQueueIntegrationTests';
import { TaskQueueE2ETests } from './e2e/taskQueueE2ETests';
import { TaskQueueRegressionTests } from './regression/taskQueueRegressionTests';

export class TaskQueueTestSuite {
  private unitTests: TaskQueueUnitTests;
  private integrationTests: TaskQueueIntegrationTests;
  private e2eTests: TaskQueueE2ETests;
  private regressionTests: TaskQueueRegressionTests;

  constructor() {
    this.unitTests = new TaskQueueUnitTests();
    this.integrationTests = new TaskQueueIntegrationTests();
    this.e2eTests = new TaskQueueE2ETests();
    this.regressionTests = new TaskQueueRegressionTests();
  }

  /**
   * Run all test suites
   */
  async runAllTests(): Promise<TestSuiteResults> {
    console.log('🧪 Starting Comprehensive Task Queue Test Suite...');
    
    const results: TestSuiteResults = {
      unit: await this.runUnitTests(),
      integration: await this.runIntegrationTests(),
      e2e: await this.runE2ETests(),
      regression: await this.runRegressionTests(),
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0
      }
    };

    // Calculate summary
    const allResults = [results.unit, results.integration, results.e2e, results.regression];
    results.summary = allResults.reduce((acc, curr) => ({
      totalTests: acc.totalTests + curr.totalTests,
      passed: acc.passed + curr.passed,
      failed: acc.failed + curr.failed,
      skipped: acc.skipped + curr.skipped,
      duration: acc.duration + curr.duration
    }), results.summary);

    this.printSummary(results);
    return results;
  }

  /**
   * Run only unit tests
   */
  async runUnitTests(): Promise<TestResults> {
    console.log('🔬 Running Unit Tests...');
    const startTime = Date.now();
    
    try {
      const results = await this.unitTests.runAll();
      const duration = Date.now() - startTime;
      
      console.log(`✅ Unit Tests completed in ${duration}ms`);
      return { ...results, duration };
    } catch (error) {
      console.error('❌ Unit Tests failed:', error);
      return {
        totalTests: 0,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration: Date.now() - startTime,
        errors: [error as Error]
      };
    }
  }

  /**
   * Run only integration tests
   */
  async runIntegrationTests(): Promise<TestResults> {
    console.log('🔗 Running Integration Tests...');
    const startTime = Date.now();
    
    try {
      const results = await this.integrationTests.runAll();
      const duration = Date.now() - startTime;
      
      console.log(`✅ Integration Tests completed in ${duration}ms`);
      return { ...results, duration };
    } catch (error) {
      console.error('❌ Integration Tests failed:', error);
      return {
        totalTests: 0,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration: Date.now() - startTime,
        errors: [error as Error]
      };
    }
  }

  /**
   * Run only end-to-end tests
   */
  async runE2ETests(): Promise<TestResults> {
    console.log('🎯 Running End-to-End Tests...');
    const startTime = Date.now();
    
    try {
      const results = await this.e2eTests.runAll();
      const duration = Date.now() - startTime;
      
      console.log(`✅ E2E Tests completed in ${duration}ms`);
      return { ...results, duration };
    } catch (error) {
      console.error('❌ E2E Tests failed:', error);
      return {
        totalTests: 0,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration: Date.now() - startTime,
        errors: [error as Error]
      };
    }
  }

  /**
   * Run only regression tests
   */
  async runRegressionTests(): Promise<TestResults> {
    console.log('🔄 Running Regression Tests...');
    const startTime = Date.now();
    
    try {
      const results = await this.regressionTests.runAll();
      const duration = Date.now() - startTime;
      
      console.log(`✅ Regression Tests completed in ${duration}ms`);
      return { ...results, duration };
    } catch (error) {
      console.error('❌ Regression Tests failed:', error);
      return {
        totalTests: 0,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration: Date.now() - startTime,
        errors: [error as Error]
      };
    }
  }

  /**
   * Run tests by category
   */
  async runTestsByCategory(categories: TestCategory[]): Promise<TestSuiteResults> {
    const results: Partial<TestSuiteResults> = {};
    
    for (const category of categories) {
      switch (category) {
        case 'unit':
          results.unit = await this.runUnitTests();
          break;
        case 'integration':
          results.integration = await this.runIntegrationTests();
          break;
        case 'e2e':
          results.e2e = await this.runE2ETests();
          break;
        case 'regression':
          results.regression = await this.runRegressionTests();
          break;
      }
    }

    return results as TestSuiteResults;
  }

  /**
   * Print test results summary
   */
  private printSummary(results: TestSuiteResults): void {
    console.log('\n📊 Test Suite Summary:');
    console.log('='.repeat(50));
    
    console.log(`Unit Tests:        ${results.unit.passed}/${results.unit.totalTests} passed`);
    console.log(`Integration Tests: ${results.integration.passed}/${results.integration.totalTests} passed`);
    console.log(`E2E Tests:         ${results.e2e.passed}/${results.e2e.totalTests} passed`);
    console.log(`Regression Tests:  ${results.regression.passed}/${results.regression.totalTests} passed`);
    
    console.log('-'.repeat(50));
    console.log(`Total:             ${results.summary.passed}/${results.summary.totalTests} passed`);
    console.log(`Failed:            ${results.summary.failed}`);
    console.log(`Skipped:           ${results.summary.skipped}`);
    console.log(`Duration:          ${results.summary.duration}ms`);
    
    const successRate = (results.summary.passed / results.summary.totalTests) * 100;
    console.log(`Success Rate:      ${successRate.toFixed(1)}%`);
    
    if (results.summary.failed > 0) {
      console.log('\n❌ Some tests failed. Check individual test outputs for details.');
    } else {
      console.log('\n✅ All tests passed!');
    }
  }
}

// Type definitions
export interface TestResults {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  errors?: Error[];
}

export interface TestSuiteResults {
  unit: TestResults;
  integration: TestResults;
  e2e: TestResults;
  regression: TestResults;
  summary: TestResults;
}

export type TestCategory = 'unit' | 'integration' | 'e2e' | 'regression';

// Export singleton instance
export const taskQueueTestSuite = new TaskQueueTestSuite();