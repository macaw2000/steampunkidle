/**
 * Comprehensive Load Test Runner
 * Orchestrates load testing, stress testing, benchmarking, and capacity planning
 */

import { LoadTestFramework, LoadTestConfig, LoadTestResult } from './LoadTestFramework';
import { StressTestRunner, StressTestSuite, StressTestReport } from './StressTestRunner';
import { PerformanceBenchmark, BenchmarkSuite, OptimizationValidation } from './PerformanceBenchmark';
import { CapacityPlanner, CapacityPlan, GrowthScenario } from './CapacityPlanner';
import { serverTaskQueueService } from '../../services/serverTaskQueueService';

export interface LoadTestSuite {
  name: string;
  description: string;
  loadTests: LoadTestConfig[];
  stressTests: StressTestSuite;
  benchmarkBaseline?: string;
  capacityScenarios: GrowthScenario[];
}

export interface ComprehensiveTestReport {
  suiteId: string;
  suiteName: string;
  startTime: number;
  endTime: number;
  
  // Test results
  loadTestResults: LoadTestResult[];
  stressTestReport: StressTestReport;
  benchmarkSuite: BenchmarkSuite;
  capacityPlans: CapacityPlan[];
  
  // Analysis
  performanceScore: number;
  scalabilityScore: number;
  reliabilityScore: number;
  
  // Recommendations
  immediateActions: string[];
  shortTermRecommendations: string[];
  longTermRecommendations: string[];
  
  // Optimization validation (if applicable)
  optimizationValidation?: OptimizationValidation;
}

export class LoadTestRunner {
  private loadTestFramework: LoadTestFramework;
  private stressTestRunner: StressTestRunner;
  private performanceBenchmark: PerformanceBenchmark;
  private capacityPlanner: CapacityPlanner;
  private isRunning = false;

  constructor(taskQueueService: typeof serverTaskQueueService) {
    this.loadTestFramework = new LoadTestFramework(taskQueueService);
    this.stressTestRunner = new StressTestRunner(taskQueueService);
    this.performanceBenchmark = new PerformanceBenchmark();
    this.capacityPlanner = new CapacityPlanner();
  }

  /**
   * Execute a comprehensive test suite
   */
  async executeComprehensiveTestSuite(
    suite: LoadTestSuite,
    version: string = '1.0.0',
    environment: string = 'test'
  ): Promise<ComprehensiveTestReport> {
    if (this.isRunning) {
      throw new Error('Load test suite is already running');
    }

    this.isRunning = true;
    const suiteId = `comprehensive-test-${Date.now()}`;
    const startTime = Date.now();

    console.log(`Starting comprehensive test suite: ${suite.name}`);

    const report: ComprehensiveTestReport = {
      suiteId,
      suiteName: suite.name,
      startTime,
      endTime: 0,
      loadTestResults: [],
      stressTestReport: {} as StressTestReport,
      benchmarkSuite: {} as BenchmarkSuite,
      capacityPlans: [],
      performanceScore: 0,
      scalabilityScore: 0,
      reliabilityScore: 0,
      immediateActions: [],
      shortTermRecommendations: [],
      longTermRecommendations: []
    };

    try {
      // Phase 1: Execute load tests
      console.log('Phase 1: Executing load tests...');
      report.loadTestResults = await this.executeLoadTests(suite.loadTests);

      // Phase 2: Execute stress tests
      console.log('Phase 2: Executing stress tests...');
      report.stressTestReport = await this.stressTestRunner.executeStressTestSuite(suite.stressTests);

      // Phase 3: Generate performance benchmark
      console.log('Phase 3: Generating performance benchmark...');
      report.benchmarkSuite = this.performanceBenchmark.createBenchmarkSuite(
        report.loadTestResults,
        report.stressTestReport,
        version,
        environment
      );

      // Phase 4: Create capacity plans
      console.log('Phase 4: Creating capacity plans...');
      report.capacityPlans = await this.createCapacityPlans(
        suite.capacityScenarios,
        report.loadTestResults,
        report.stressTestReport
      );

      // Phase 5: Analyze results and generate recommendations
      console.log('Phase 5: Analyzing results...');
      await this.analyzeResults(report);

      console.log(`Comprehensive test suite completed successfully`);

    } catch (error) {
      console.error(`Comprehensive test suite failed: ${error}`);
      report.immediateActions.push(`Test suite execution failed: ${error}`);
    } finally {
      this.isRunning = false;
      report.endTime = Date.now();
    }

    return report;
  }

  /**
   * Execute multiple load tests
   */
  private async executeLoadTests(configs: LoadTestConfig[]): Promise<LoadTestResult[]> {
    const results: LoadTestResult[] = [];

    for (const config of configs) {
      try {
        console.log(`Executing load test with ${config.concurrentPlayers} concurrent players`);
        const result = await this.loadTestFramework.executeLoadTest(config);
        results.push(result);
        
        // Brief pause between tests
        await this.sleep(5000);
      } catch (error) {
        console.error(`Load test failed: ${error}`);
        // Continue with other tests
      }
    }

    return results;
  }

  /**
   * Create capacity plans for different growth scenarios
   */
  private async createCapacityPlans(
    scenarios: GrowthScenario[],
    loadTestResults: LoadTestResult[],
    stressTestReport: StressTestReport
  ): Promise<CapacityPlan[]> {
    // Add historical data to capacity planner
    this.capacityPlanner.addHistoricalData(loadTestResults);
    this.capacityPlanner.addStressTestData([stressTestReport]);

    const plans: CapacityPlan[] = [];
    const currentUsers = this.getCurrentUserCount(stressTestReport);

    for (const scenario of scenarios) {
      try {
        const plan = this.capacityPlanner.createCapacityPlan(scenario, currentUsers);
        plans.push(plan);
      } catch (error) {
        console.error(`Failed to create capacity plan for ${scenario.name}: ${error}`);
      }
    }

    return plans;
  }

  /**
   * Analyze comprehensive test results
   */
  private async analyzeResults(report: ComprehensiveTestReport): Promise<void> {
    // Calculate performance scores
    report.performanceScore = report.benchmarkSuite.overallScore;
    report.scalabilityScore = this.calculateScalabilityScore(report.stressTestReport);
    report.reliabilityScore = this.calculateReliabilityScore(report.loadTestResults);

    // Generate recommendations based on analysis
    report.immediateActions = this.generateImmediateActions(report);
    report.shortTermRecommendations = this.generateShortTermRecommendations(report);
    report.longTermRecommendations = this.generateLongTermRecommendations(report);
  }

  /**
   * Calculate scalability score from stress test results
   */
  private calculateScalabilityScore(stressReport: StressTestReport): number {
    const stabilityScore = stressReport.stressAnalysis.stabilityScore;
    const breakingPoint = stressReport.stressAnalysis.breakingPoint;
    
    // Score based on stability and capacity
    let score = stabilityScore * 0.7; // 70% weight on stability
    
    // Add points based on breaking point
    if (breakingPoint >= 1000) score += 30;
    else if (breakingPoint >= 500) score += 20;
    else if (breakingPoint >= 250) score += 10;
    
    return Math.min(100, Math.round(score));
  }

  /**
   * Calculate reliability score from load test results
   */
  private calculateReliabilityScore(loadResults: LoadTestResult[]): number {
    if (loadResults.length === 0) return 0;

    const totalRequests = loadResults.reduce((sum, r) => sum + r.totalRequests, 0);
    const totalErrors = loadResults.reduce((sum, r) => sum + r.failedRequests, 0);
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    // Score based on error rate
    if (errorRate <= 0.1) return 100;
    if (errorRate <= 0.5) return 90;
    if (errorRate <= 1.0) return 80;
    if (errorRate <= 2.0) return 70;
    if (errorRate <= 5.0) return 60;
    return 40;
  }

  /**
   * Generate immediate action items
   */
  private generateImmediateActions(report: ComprehensiveTestReport): string[] {
    const actions: string[] = [];

    // Performance-based actions
    if (report.performanceScore < 70) {
      actions.push('Investigate performance bottlenecks immediately');
    }

    // Reliability-based actions
    if (report.reliabilityScore < 80) {
      actions.push('Review and fix error handling mechanisms');
    }

    // Resource-based actions
    const avgMemoryUsage = this.getAverageMetric(report.benchmarkSuite, 'Peak Memory Usage');
    if (avgMemoryUsage > 1500) {
      actions.push('Optimize memory usage to prevent out-of-memory errors');
    }

    // Response time actions
    const avgResponseTime = this.getAverageMetric(report.benchmarkSuite, 'Average Response Time');
    if (avgResponseTime > 2000) {
      actions.push('Optimize response times to improve user experience');
    }

    return actions;
  }

  /**
   * Generate short-term recommendations (1-3 months)
   */
  private generateShortTermRecommendations(report: ComprehensiveTestReport): string[] {
    const recommendations: string[] = [];

    // Scalability recommendations
    if (report.scalabilityScore < 80) {
      recommendations.push('Implement horizontal scaling capabilities');
      recommendations.push('Add load balancing and auto-scaling policies');
    }

    // Capacity recommendations
    const nearestCapacityPlan = report.capacityPlans.find(p => p.scenario.name === 'Conservative Growth');
    if (nearestCapacityPlan && nearestCapacityPlan.projections.length > 0) {
      const nextQuarterProjection = nearestCapacityPlan.projections[2]; // 3 months out
      if (nextQuarterProjection.requiredInstances > 5) {
        recommendations.push('Plan infrastructure scaling for next quarter growth');
      }
    }

    // Performance optimization
    if (report.performanceScore < 85) {
      recommendations.push('Implement caching layer for frequently accessed data');
      recommendations.push('Optimize database queries and add appropriate indexes');
    }

    return recommendations;
  }

  /**
   * Generate long-term recommendations (6-12 months)
   */
  private generateLongTermRecommendations(report: ComprehensiveTestReport): string[] {
    const recommendations: string[] = [];

    // Architecture recommendations
    const aggressiveGrowthPlan = report.capacityPlans.find(p => p.scenario.name === 'Aggressive Growth');
    if (aggressiveGrowthPlan) {
      const yearEndProjection = aggressiveGrowthPlan.projections[aggressiveGrowthPlan.projections.length - 1];
      if (yearEndProjection.targetUsers > 10000) {
        recommendations.push('Consider microservices architecture for better scalability');
        recommendations.push('Plan for database sharding or clustering');
      }
    }

    // Technology recommendations
    if (report.stressTestReport.stressAnalysis.breakingPoint < 1000) {
      recommendations.push('Evaluate serverless architecture for better auto-scaling');
      recommendations.push('Consider container orchestration (Kubernetes) for resource efficiency');
    }

    // Monitoring and observability
    recommendations.push('Implement comprehensive APM (Application Performance Monitoring)');
    recommendations.push('Set up predictive scaling based on usage patterns');

    return recommendations;
  }

  /**
   * Validate optimization impact
   */
  async validateOptimization(
    optimizationName: string,
    beforeSuite: LoadTestSuite,
    afterSuite: LoadTestSuite,
    version: string = '1.0.0',
    environment: string = 'test'
  ): Promise<OptimizationValidation> {
    console.log(`Validating optimization: ${optimizationName}`);

    // Execute before and after test suites
    const beforeReport = await this.executeComprehensiveTestSuite(beforeSuite, `${version}-before`, environment);
    const afterReport = await this.executeComprehensiveTestSuite(afterSuite, `${version}-after`, environment);

    // Validate optimization using performance benchmark
    const validation = this.performanceBenchmark.validateOptimization(
      optimizationName,
      beforeReport.benchmarkSuite,
      afterReport.benchmarkSuite
    );

    console.log(`Optimization validation complete. Recommendation: ${validation.recommendation}`);
    return validation;
  }

  /**
   * Create standard load test suite
   */
  createStandardLoadTestSuite(): LoadTestSuite {
    return {
      name: 'Standard Task Queue Load Test Suite',
      description: 'Comprehensive testing of task queue system under various load conditions',
      loadTests: [
        {
          concurrentPlayers: 50,
          testDurationMs: 60000,
          tasksPerPlayer: 5,
          taskTypeDistribution: { harvesting: 40, crafting: 35, combat: 25 },
          maxResponseTimeMs: 1000,
          maxErrorRate: 0.01,
          maxMemoryUsageMB: 500,
          rampUpTimeMs: 10000,
          rampDownTimeMs: 5000
        },
        {
          concurrentPlayers: 100,
          testDurationMs: 120000,
          tasksPerPlayer: 10,
          taskTypeDistribution: { harvesting: 40, crafting: 35, combat: 25 },
          maxResponseTimeMs: 1500,
          maxErrorRate: 0.015,
          maxMemoryUsageMB: 750,
          rampUpTimeMs: 15000,
          rampDownTimeMs: 10000
        },
        {
          concurrentPlayers: 250,
          testDurationMs: 180000,
          tasksPerPlayer: 15,
          taskTypeDistribution: { harvesting: 40, crafting: 35, combat: 25 },
          maxResponseTimeMs: 2000,
          maxErrorRate: 0.02,
          maxMemoryUsageMB: 1000,
          rampUpTimeMs: 20000,
          rampDownTimeMs: 15000
        }
      ],
      stressTests: this.stressTestRunner.createComprehensiveStressSuite(),
      capacityScenarios: this.capacityPlanner.createGrowthScenarios()
    };
  }

  /**
   * Get current user count from stress test results
   */
  private getCurrentUserCount(stressReport: StressTestReport): number {
    // Use the baseline scenario's concurrent players as current capacity
    const baselineResult = Array.from(stressReport.scenarioResults.values())
      .find(result => result.config.concurrentPlayers <= 200);
    
    return baselineResult?.config.concurrentPlayers || 100;
  }

  /**
   * Get average metric value from benchmark suite
   */
  private getAverageMetric(suite: BenchmarkSuite, metricName: string): number {
    const metric = suite.metrics.find(m => m.name === metricName);
    return metric?.value || 0;
  }

  /**
   * Generate comprehensive test report
   */
  generateTestReport(report: ComprehensiveTestReport): string {
    let output = `# Comprehensive Load Test Report\n\n`;
    output += `**Suite:** ${report.suiteName}\n`;
    output += `**Suite ID:** ${report.suiteId}\n`;
    output += `**Duration:** ${Math.round((report.endTime - report.startTime) / 1000 / 60)} minutes\n`;
    output += `**Timestamp:** ${new Date(report.startTime).toISOString()}\n\n`;

    // Executive Summary
    output += `## Executive Summary\n\n`;
    output += `- **Performance Score:** ${report.performanceScore}/100\n`;
    output += `- **Scalability Score:** ${report.scalabilityScore}/100\n`;
    output += `- **Reliability Score:** ${report.reliabilityScore}/100\n\n`;

    // Load Test Results
    output += `## Load Test Results\n\n`;
    output += `| Test | Users | Requests | Success Rate | Avg Response Time |\n`;
    output += `|------|-------|----------|--------------|-------------------|\n`;
    for (const result of report.loadTestResults) {
      const successRate = ((result.successfulRequests / result.totalRequests) * 100).toFixed(1);
      output += `| ${result.config.concurrentPlayers} users | ${result.config.concurrentPlayers} | ${result.totalRequests} | ${successRate}% | ${result.averageResponseTime}ms |\n`;
    }
    output += `\n`;

    // Stress Test Summary
    output += `## Stress Test Summary\n\n`;
    output += `- **Breaking Point:** ${report.stressTestReport.stressAnalysis.breakingPoint} concurrent users\n`;
    output += `- **Stability Score:** ${report.stressTestReport.stressAnalysis.stabilityScore}/100\n`;
    output += `- **Recovery Time:** ${Math.round(report.stressTestReport.stressAnalysis.recoveryTime / 1000)}s\n\n`;

    // Performance Benchmark
    output += this.performanceBenchmark.generatePerformanceReport(report.benchmarkSuite);

    // Capacity Planning
    output += `## Capacity Planning\n\n`;
    for (const plan of report.capacityPlans) {
      output += `### ${plan.scenario.name}\n`;
      output += `- **Growth Rate:** ${plan.scenario.userGrowthRate}% monthly\n`;
      output += `- **Total Cost:** $${plan.totalCost.toLocaleString()}/year\n`;
      output += `- **Key Milestones:** ${plan.milestones.length}\n\n`;
    }

    // Recommendations
    output += `## Recommendations\n\n`;
    
    if (report.immediateActions.length > 0) {
      output += `### Immediate Actions\n`;
      for (const action of report.immediateActions) {
        output += `- ${action}\n`;
      }
      output += `\n`;
    }

    if (report.shortTermRecommendations.length > 0) {
      output += `### Short-term (1-3 months)\n`;
      for (const rec of report.shortTermRecommendations) {
        output += `- ${rec}\n`;
      }
      output += `\n`;
    }

    if (report.longTermRecommendations.length > 0) {
      output += `### Long-term (6-12 months)\n`;
      for (const rec of report.longTermRecommendations) {
        output += `- ${rec}\n`;
      }
      output += `\n`;
    }

    return output;
  }

  /**
   * Stop current test execution
   */
  stopCurrentTest(): void {
    this.isRunning = false;
    this.loadTestFramework.stopCurrentTest();
    this.stressTestRunner.stopStressTest();
  }

  /**
   * Check if test is running
   */
  isTestRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Utility function to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}