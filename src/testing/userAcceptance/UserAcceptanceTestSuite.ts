import { PlayerUsagePatternTests } from './scenarios/PlayerUsagePatternTests';
import { OfflineOnlineTransitionTests } from './scenarios/OfflineOnlineTransitionTests';
import { PerformanceValidationTests } from './scenarios/PerformanceValidationTests';
import { UsabilityTests } from './scenarios/UsabilityTests';
import { TestDataGenerator } from './utils/TestDataGenerator';
import { TestReporter } from './utils/TestReporter';

/**
 * Main User Acceptance Test Suite
 * Orchestrates all user acceptance testing scenarios
 */
export class UserAcceptanceTestSuite {
  private testDataGenerator: TestDataGenerator;
  private testReporter: TestReporter;
  private playerUsageTests: PlayerUsagePatternTests;
  private offlineOnlineTests: OfflineOnlineTransitionTests;
  private performanceTests: PerformanceValidationTests;
  private usabilityTests: UsabilityTests;

  constructor() {
    this.testDataGenerator = new TestDataGenerator();
    this.testReporter = new TestReporter();
    this.playerUsageTests = new PlayerUsagePatternTests(this.testDataGenerator);
    this.offlineOnlineTests = new OfflineOnlineTransitionTests(this.testDataGenerator);
    this.performanceTests = new PerformanceValidationTests(this.testDataGenerator);
    this.usabilityTests = new UsabilityTests(this.testDataGenerator);
  }

  /**
   * Run all user acceptance tests
   */
  async runAllTests(): Promise<UserAcceptanceTestResults> {
    console.log('🚀 Starting User Acceptance Test Suite...');
    
    const startTime = Date.now();
    const results: UserAcceptanceTestResults = {
      playerUsagePatterns: null,
      offlineOnlineTransitions: null,
      performanceValidation: null,
      usabilityTesting: null,
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        duration: 0,
        overallStatus: 'PENDING'
      }
    };

    try {
      // Run player usage pattern tests
      console.log('📋 Running Player Usage Pattern Tests...');
      results.playerUsagePatterns = await this.playerUsageTests.runAllTests();

      // Run offline/online transition tests
      console.log('🔄 Running Offline/Online Transition Tests...');
      results.offlineOnlineTransitions = await this.offlineOnlineTests.runAllTests();

      // Run performance validation tests
      console.log('⚡ Running Performance Validation Tests...');
      results.performanceValidation = await this.performanceTests.runAllTests();

      // Run usability tests
      console.log('👤 Running Usability Tests...');
      results.usabilityTesting = await this.usabilityTests.runAllTests();

      // Calculate summary
      results.summary = this.calculateSummary(results, Date.now() - startTime);

      // Generate report
      await this.testReporter.generateReport(results);

      console.log('✅ User Acceptance Test Suite completed successfully!');
      return results;

    } catch (error) {
      console.error('❌ User Acceptance Test Suite failed:', error);
      results.summary.overallStatus = 'FAILED';
      results.summary.duration = Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Run specific test category
   */
  async runTestCategory(category: UserAcceptanceTestCategory): Promise<any> {
    switch (category) {
      case 'PLAYER_USAGE_PATTERNS':
        return await this.playerUsageTests.runAllTests();
      case 'OFFLINE_ONLINE_TRANSITIONS':
        return await this.offlineOnlineTests.runAllTests();
      case 'PERFORMANCE_VALIDATION':
        return await this.performanceTests.runAllTests();
      case 'USABILITY_TESTING':
        return await this.usabilityTests.runAllTests();
      default:
        throw new Error(`Unknown test category: ${category}`);
    }
  }

  private calculateSummary(results: UserAcceptanceTestResults, duration: number): TestSummary {
    const allResults = [
      results.playerUsagePatterns,
      results.offlineOnlineTransitions,
      results.performanceValidation,
      results.usabilityTesting
    ].filter(Boolean);

    const totalTests = allResults.reduce((sum, result) => sum + (result?.totalTests || 0), 0);
    const passedTests = allResults.reduce((sum, result) => sum + (result?.passedTests || 0), 0);
    const failedTests = totalTests - passedTests;

    return {
      totalTests,
      passedTests,
      failedTests,
      duration,
      overallStatus: failedTests === 0 ? 'PASSED' : 'FAILED'
    };
  }
}

export interface UserAcceptanceTestResults {
  playerUsagePatterns: PlayerUsageTestResults | null;
  offlineOnlineTransitions: OfflineOnlineTestResults | null;
  performanceValidation: PerformanceTestResults | null;
  usabilityTesting: UsabilityTestResults | null;
  summary: TestSummary;
}

export interface TestSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  duration: number;
  overallStatus: 'PASSED' | 'FAILED' | 'PENDING';
}

export type UserAcceptanceTestCategory = 
  | 'PLAYER_USAGE_PATTERNS'
  | 'OFFLINE_ONLINE_TRANSITIONS' 
  | 'PERFORMANCE_VALIDATION'
  | 'USABILITY_TESTING';

export interface PlayerUsageTestResults {
  totalTests: number;
  passedTests: number;
  scenarios: PlayerUsageScenarioResult[];
}

export interface OfflineOnlineTestResults {
  totalTests: number;
  passedTests: number;
  scenarios: OfflineOnlineScenarioResult[];
}

export interface PerformanceTestResults {
  totalTests: number;
  passedTests: number;
  scenarios: PerformanceScenarioResult[];
}

export interface UsabilityTestResults {
  totalTests: number;
  passedTests: number;
  scenarios: UsabilityScenarioResult[];
}

export interface PlayerUsageScenarioResult {
  name: string;
  status: 'PASSED' | 'FAILED';
  duration: number;
  details: string;
  metrics?: any;
}

export interface OfflineOnlineScenarioResult {
  name: string;
  status: 'PASSED' | 'FAILED';
  duration: number;
  details: string;
  syncMetrics?: any;
}

export interface PerformanceScenarioResult {
  name: string;
  status: 'PASSED' | 'FAILED';
  duration: number;
  details: string;
  performanceMetrics?: any;
}

export interface UsabilityScenarioResult {
  name: string;
  status: 'PASSED' | 'FAILED';
  duration: number;
  details: string;
  usabilityMetrics?: any;
}