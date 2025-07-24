/**
 * Stress Testing Runner for Task Queue System
 * Implements high-load stress testing scenarios
 */

import { LoadTestFramework, LoadTestConfig, LoadTestResult } from './LoadTestFramework';
import { ServerTaskQueueService } from '../../services/serverTaskQueueService';

export interface StressTestScenario {
  name: string;
  description: string;
  config: LoadTestConfig;
  expectedFailureThreshold: number; // Expected failure rate under stress
}

export interface StressTestSuite {
  name: string;
  scenarios: StressTestScenario[];
  maxConcurrentTests: number;
}

export interface StressTestReport {
  suiteId: string;
  suiteName: string;
  startTime: number;
  endTime: number;
  scenarioResults: Map<string, LoadTestResult>;
  overallMetrics: {
    totalRequests: number;
    totalFailures: number;
    averageResponseTime: number;
    peakMemoryUsage: number;
    peakCpuUsage: number;
  };
  stressAnalysis: {
    breakingPoint: number; // Number of concurrent players where system starts failing
    recoveryTime: number; // Time to recover after stress
    criticalBottlenecks: string[];
    stabilityScore: number; // 0-100 score based on performance under stress
  };
  recommendations: string[];
}

export class StressTestRunner {
  private loadTestFramework: LoadTestFramework;
  private isRunning = false;
  private currentSuite: StressTestSuite | null = null;

  constructor(taskQueueService: ServerTaskQueueService) {
    this.loadTestFramework = new LoadTestFramework(taskQueueService);
  }

  /**
   * Execute a complete stress test suite
   */
  async executeStressTestSuite(suite: StressTestSuite): Promise<StressTestReport> {
    if (this.isRunning) {
      throw new Error('Stress test suite is already running');
    }

    this.isRunning = true;
    this.currentSuite = suite;
    
    const suiteId = `stress-suite-${Date.now()}`;
    const startTime = Date.now();
    
    console.log(`Starting stress test suite: ${suite.name}`);
    
    const report: StressTestReport = {
      suiteId,
      suiteName: suite.name,
      startTime,
      endTime: 0,
      scenarioResults: new Map(),
      overallMetrics: {
        totalRequests: 0,
        totalFailures: 0,
        averageResponseTime: 0,
        peakMemoryUsage: 0,
        peakCpuUsage: 0
      },
      stressAnalysis: {
        breakingPoint: 0,
        recoveryTime: 0,
        criticalBottlenecks: [],
        stabilityScore: 0
      },
      recommendations: []
    };

    try {
      // Execute scenarios in batches to avoid overwhelming the system
      const batches = this.createScenarioBatches(suite.scenarios, suite.maxConcurrentTests);
      
      for (const batch of batches) {
        await this.executeBatch(batch, report);
        
        // Recovery period between batches
        await this.sleep(5000);
      }
      
      // Analyze overall results
      await this.analyzeStressResults(report);
      
    } catch (error) {
      console.error(`Stress test suite failed: ${error}`);
      report.recommendations.push(`Suite execution failed: ${error}`);
    } finally {
      this.isRunning = false;
      this.currentSuite = null;
      report.endTime = Date.now();
    }

    return report;
  }

  /**
   * Create predefined stress test scenarios
   */
  createStandardStressScenarios(): StressTestScenario[] {
    return [
      {
        name: 'Baseline Load',
        description: 'Normal operating conditions',
        config: {
          concurrentPlayers: 100,
          testDurationMs: 60000, // 1 minute
          tasksPerPlayer: 5,
          taskTypeDistribution: { harvesting: 40, crafting: 35, combat: 25 },
          maxResponseTimeMs: 1000,
          maxErrorRate: 0.01,
          maxMemoryUsageMB: 500,
          rampUpTimeMs: 10000,
          rampDownTimeMs: 5000
        },
        expectedFailureThreshold: 0.005
      },
      {
        name: 'High Load',
        description: 'Peak usage conditions',
        config: {
          concurrentPlayers: 500,
          testDurationMs: 120000, // 2 minutes
          tasksPerPlayer: 10,
          taskTypeDistribution: { harvesting: 40, crafting: 35, combat: 25 },
          maxResponseTimeMs: 2000,
          maxErrorRate: 0.02,
          maxMemoryUsageMB: 1000,
          rampUpTimeMs: 20000,
          rampDownTimeMs: 10000
        },
        expectedFailureThreshold: 0.015
      },
      {
        name: 'Extreme Load',
        description: 'Beyond normal capacity',
        config: {
          concurrentPlayers: 1000,
          testDurationMs: 180000, // 3 minutes
          tasksPerPlayer: 15,
          taskTypeDistribution: { harvesting: 40, crafting: 35, combat: 25 },
          maxResponseTimeMs: 5000,
          maxErrorRate: 0.05,
          maxMemoryUsageMB: 2000,
          rampUpTimeMs: 30000,
          rampDownTimeMs: 15000
        },
        expectedFailureThreshold: 0.03
      },
      {
        name: 'Burst Load',
        description: 'Sudden spike in concurrent users',
        config: {
          concurrentPlayers: 750,
          testDurationMs: 90000, // 1.5 minutes
          tasksPerPlayer: 20,
          taskTypeDistribution: { harvesting: 40, crafting: 35, combat: 25 },
          maxResponseTimeMs: 3000,
          maxErrorRate: 0.03,
          maxMemoryUsageMB: 1500,
          rampUpTimeMs: 5000, // Very fast ramp up
          rampDownTimeMs: 5000
        },
        expectedFailureThreshold: 0.025
      },
      {
        name: 'Queue Saturation',
        description: 'Maximum queue utilization',
        config: {
          concurrentPlayers: 300,
          testDurationMs: 240000, // 4 minutes
          tasksPerPlayer: 50, // Maximum queue size
          taskTypeDistribution: { harvesting: 40, crafting: 35, combat: 25 },
          maxResponseTimeMs: 2000,
          maxErrorRate: 0.02,
          maxMemoryUsageMB: 800,
          rampUpTimeMs: 15000,
          rampDownTimeMs: 10000
        },
        expectedFailureThreshold: 0.02
      },
      {
        name: 'Memory Stress',
        description: 'High memory utilization scenario',
        config: {
          concurrentPlayers: 400,
          testDurationMs: 300000, // 5 minutes
          tasksPerPlayer: 30,
          taskTypeDistribution: { harvesting: 20, crafting: 60, combat: 20 }, // Crafting uses more memory
          maxResponseTimeMs: 2500,
          maxErrorRate: 0.025,
          maxMemoryUsageMB: 1200,
          rampUpTimeMs: 20000,
          rampDownTimeMs: 15000
        },
        expectedFailureThreshold: 0.02
      }
    ];
  }

  /**
   * Create scenario batches for controlled execution
   */
  private createScenarioBatches(scenarios: StressTestScenario[], maxConcurrent: number): StressTestScenario[][] {
    const batches: StressTestScenario[][] = [];
    
    for (let i = 0; i < scenarios.length; i += maxConcurrent) {
      batches.push(scenarios.slice(i, i + maxConcurrent));
    }
    
    return batches;
  }

  /**
   * Execute a batch of scenarios
   */
  private async executeBatch(batch: StressTestScenario[], report: StressTestReport): Promise<void> {
    console.log(`Executing batch of ${batch.length} stress scenarios`);
    
    const promises = batch.map(async (scenario) => {
      try {
        console.log(`Starting stress scenario: ${scenario.name}`);
        const result = await this.loadTestFramework.executeLoadTest(scenario.config);
        
        report.scenarioResults.set(scenario.name, result);
        this.updateOverallMetrics(report, result);
        
        console.log(`Completed stress scenario: ${scenario.name}`);
        return result;
      } catch (error) {
        console.error(`Stress scenario ${scenario.name} failed: ${error}`);
        throw error;
      }
    });
    
    await Promise.allSettled(promises);
  }

  /**
   * Update overall metrics with scenario results
   */
  private updateOverallMetrics(report: StressTestReport, result: LoadTestResult): void {
    report.overallMetrics.totalRequests += result.totalRequests;
    report.overallMetrics.totalFailures += result.failedRequests;
    report.overallMetrics.peakMemoryUsage = Math.max(report.overallMetrics.peakMemoryUsage, result.peakMemoryUsage);
    report.overallMetrics.peakCpuUsage = Math.max(report.overallMetrics.peakCpuUsage, result.peakCpuUsage);
    
    // Calculate weighted average response time
    const totalRequests = report.overallMetrics.totalRequests;
    if (totalRequests > 0) {
      report.overallMetrics.averageResponseTime = 
        ((report.overallMetrics.averageResponseTime * (totalRequests - result.totalRequests)) + 
         (result.averageResponseTime * result.totalRequests)) / totalRequests;
    }
  }

  /**
   * Analyze stress test results and determine system limits
   */
  private async analyzeStressResults(report: StressTestReport): Promise<void> {
    const results = Array.from(report.scenarioResults.values());
    
    // Find breaking point
    report.stressAnalysis.breakingPoint = this.findBreakingPoint(results);
    
    // Calculate stability score
    report.stressAnalysis.stabilityScore = this.calculateStabilityScore(results);
    
    // Identify critical bottlenecks
    report.stressAnalysis.criticalBottlenecks = this.identifyBottlenecks(results);
    
    // Estimate recovery time (simplified)
    report.stressAnalysis.recoveryTime = this.estimateRecoveryTime(results);
    
    // Generate recommendations
    report.recommendations = this.generateStressRecommendations(report);
    
    console.log(`Stress analysis complete. Breaking point: ${report.stressAnalysis.breakingPoint} players`);
    console.log(`Stability score: ${report.stressAnalysis.stabilityScore}/100`);
  }

  /**
   * Find the breaking point where system performance degrades significantly
   */
  private findBreakingPoint(results: LoadTestResult[]): number {
    // Sort results by concurrent players
    const sortedResults = results.sort((a, b) => a.config.concurrentPlayers - b.config.concurrentPlayers);
    
    for (const result of sortedResults) {
      const errorRate = result.failedRequests / result.totalRequests;
      const responseTimeExceeded = result.averageResponseTime > result.config.maxResponseTimeMs;
      const memoryExceeded = result.peakMemoryUsage > result.config.maxMemoryUsageMB;
      
      if (errorRate > result.config.maxErrorRate || responseTimeExceeded || memoryExceeded) {
        return result.config.concurrentPlayers;
      }
    }
    
    // If no breaking point found, return the highest tested value
    return sortedResults[sortedResults.length - 1]?.config.concurrentPlayers || 0;
  }

  /**
   * Calculate overall system stability score
   */
  private calculateStabilityScore(results: LoadTestResult[]): number {
    if (results.length === 0) return 0;
    
    let totalScore = 0;
    
    for (const result of results) {
      let scenarioScore = 100;
      
      // Deduct points for high error rate
      const errorRate = result.failedRequests / result.totalRequests;
      scenarioScore -= Math.min(50, errorRate * 1000); // Max 50 points deduction
      
      // Deduct points for slow response times
      const responseTimeRatio = result.averageResponseTime / result.config.maxResponseTimeMs;
      if (responseTimeRatio > 1) {
        scenarioScore -= Math.min(30, (responseTimeRatio - 1) * 30);
      }
      
      // Deduct points for high memory usage
      const memoryRatio = result.peakMemoryUsage / result.config.maxMemoryUsageMB;
      if (memoryRatio > 1) {
        scenarioScore -= Math.min(20, (memoryRatio - 1) * 20);
      }
      
      totalScore += Math.max(0, scenarioScore);
    }
    
    return Math.round(totalScore / results.length);
  }

  /**
   * Identify critical system bottlenecks
   */
  private identifyBottlenecks(results: LoadTestResult[]): string[] {
    const bottlenecks = new Set<string>();
    
    for (const result of results) {
      bottlenecks.add(...result.bottleneckComponents);
    }
    
    // Add additional analysis
    const highErrorRateResults = results.filter(r => (r.failedRequests / r.totalRequests) > 0.02);
    if (highErrorRateResults.length > results.length / 2) {
      bottlenecks.add('Error Handling');
    }
    
    const slowResponseResults = results.filter(r => r.averageResponseTime > 2000);
    if (slowResponseResults.length > results.length / 2) {
      bottlenecks.add('Processing Speed');
    }
    
    return Array.from(bottlenecks);
  }

  /**
   * Estimate system recovery time after stress
   */
  private estimateRecoveryTime(results: LoadTestResult[]): number {
    // Simplified estimation based on peak resource usage
    const maxMemoryResult = results.reduce((max, current) => 
      current.peakMemoryUsage > max.peakMemoryUsage ? current : max
    );
    
    // Estimate recovery time based on memory usage (simplified formula)
    const memoryRatio = maxMemoryResult.peakMemoryUsage / maxMemoryResult.config.maxMemoryUsageMB;
    return Math.max(5000, memoryRatio * 10000); // 5-30 seconds based on memory pressure
  }

  /**
   * Generate stress-specific recommendations
   */
  private generateStressRecommendations(report: StressTestReport): string[] {
    const recommendations: string[] = [];
    
    // Breaking point recommendations
    if (report.stressAnalysis.breakingPoint < 500) {
      recommendations.push('Consider horizontal scaling to support more concurrent users');
      recommendations.push('Implement load balancing across multiple server instances');
    }
    
    // Stability recommendations
    if (report.stressAnalysis.stabilityScore < 70) {
      recommendations.push('Improve error handling and recovery mechanisms');
      recommendations.push('Add circuit breakers to prevent cascade failures');
    }
    
    // Bottleneck-specific recommendations
    for (const bottleneck of report.stressAnalysis.criticalBottlenecks) {
      switch (bottleneck) {
        case 'Response Time':
          recommendations.push('Optimize database queries and add caching layers');
          break;
        case 'Memory Usage':
          recommendations.push('Implement memory pooling and garbage collection optimization');
          break;
        case 'Error Rate':
          recommendations.push('Add retry mechanisms with exponential backoff');
          break;
        case 'Processing Speed':
          recommendations.push('Consider async processing for non-critical operations');
          break;
      }
    }
    
    // Recovery time recommendations
    if (report.stressAnalysis.recoveryTime > 30000) {
      recommendations.push('Implement faster resource cleanup and recovery procedures');
      recommendations.push('Add health checks and automatic recovery mechanisms');
    }
    
    return recommendations;
  }

  /**
   * Create a comprehensive stress test suite
   */
  createComprehensiveStressSuite(): StressTestSuite {
    return {
      name: 'Comprehensive Task Queue Stress Test',
      scenarios: this.createStandardStressScenarios(),
      maxConcurrentTests: 2 // Run 2 scenarios concurrently to avoid overwhelming test environment
    };
  }

  /**
   * Stop current stress test
   */
  stopStressTest(): void {
    this.isRunning = false;
    this.loadTestFramework.stopCurrentTest();
  }

  /**
   * Check if stress test is running
   */
  isStressTestRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get current stress test suite
   */
  getCurrentSuite(): StressTestSuite | null {
    return this.currentSuite;
  }

  /**
   * Utility function to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}