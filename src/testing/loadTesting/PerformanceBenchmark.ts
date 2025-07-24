/**
 * Performance Benchmarking Tools for Task Queue System
 * Provides detailed performance analysis and optimization validation
 */

import { LoadTestResult, LoadTestConfig } from './LoadTestFramework';
import { StressTestReport } from './StressTestRunner';

export interface BenchmarkMetric {
  name: string;
  value: number;
  unit: string;
  threshold: number;
  status: 'pass' | 'warning' | 'fail';
  trend: 'improving' | 'stable' | 'degrading';
}

export interface BenchmarkSuite {
  id: string;
  name: string;
  timestamp: number;
  version: string;
  environment: string;
  metrics: BenchmarkMetric[];
  overallScore: number;
  previousScore?: number;
}

export interface PerformanceBaseline {
  version: string;
  timestamp: number;
  metrics: Map<string, number>;
  environment: string;
}

export interface OptimizationValidation {
  optimizationName: string;
  beforeMetrics: BenchmarkSuite;
  afterMetrics: BenchmarkSuite;
  improvement: Map<string, number>; // Percentage improvement per metric
  regressions: string[];
  overallImprovement: number;
  recommendation: 'deploy' | 'investigate' | 'rollback';
}

export class PerformanceBenchmark {
  private baselines: Map<string, PerformanceBaseline> = new Map();
  private benchmarkHistory: BenchmarkSuite[] = [];

  /**
   * Create a comprehensive benchmark suite from load test results
   */
  createBenchmarkSuite(
    results: LoadTestResult[],
    stressReport?: StressTestReport,
    version: string = '1.0.0',
    environment: string = 'test'
  ): BenchmarkSuite {
    const suiteId = `benchmark-${Date.now()}`;
    const timestamp = Date.now();
    
    const metrics: BenchmarkMetric[] = [];
    
    // Response Time Metrics
    metrics.push(...this.createResponseTimeMetrics(results));
    
    // Throughput Metrics
    metrics.push(...this.createThroughputMetrics(results));
    
    // Resource Utilization Metrics
    metrics.push(...this.createResourceMetrics(results));
    
    // Reliability Metrics
    metrics.push(...this.createReliabilityMetrics(results));
    
    // Scalability Metrics
    if (stressReport) {
      metrics.push(...this.createScalabilityMetrics(stressReport));
    }
    
    // Queue Performance Metrics
    metrics.push(...this.createQueueMetrics(results));
    
    // Calculate overall score
    const overallScore = this.calculateOverallScore(metrics);
    
    const suite: BenchmarkSuite = {
      id: suiteId,
      name: `Performance Benchmark ${version}`,
      timestamp,
      version,
      environment,
      metrics,
      overallScore,
      previousScore: this.getPreviousScore(version, environment)
    };
    
    this.benchmarkHistory.push(suite);
    return suite;
  }

  /**
   * Create response time metrics
   */
  private createResponseTimeMetrics(results: LoadTestResult[]): BenchmarkMetric[] {
    const metrics: BenchmarkMetric[] = [];
    
    if (results.length === 0) return metrics;
    
    // Average Response Time
    const avgResponseTime = results.reduce((sum, r) => sum + r.averageResponseTime, 0) / results.length;
    metrics.push({
      name: 'Average Response Time',
      value: Math.round(avgResponseTime),
      unit: 'ms',
      threshold: 1000,
      status: avgResponseTime <= 1000 ? 'pass' : avgResponseTime <= 2000 ? 'warning' : 'fail',
      trend: this.calculateTrend('avg_response_time', avgResponseTime)
    });
    
    // P95 Response Time
    const avgP95 = results.reduce((sum, r) => sum + r.p95ResponseTime, 0) / results.length;
    metrics.push({
      name: 'P95 Response Time',
      value: Math.round(avgP95),
      unit: 'ms',
      threshold: 2000,
      status: avgP95 <= 2000 ? 'pass' : avgP95 <= 3000 ? 'warning' : 'fail',
      trend: this.calculateTrend('p95_response_time', avgP95)
    });
    
    // P99 Response Time
    const avgP99 = results.reduce((sum, r) => sum + r.p99ResponseTime, 0) / results.length;
    metrics.push({
      name: 'P99 Response Time',
      value: Math.round(avgP99),
      unit: 'ms',
      threshold: 5000,
      status: avgP99 <= 5000 ? 'pass' : avgP99 <= 8000 ? 'warning' : 'fail',
      trend: this.calculateTrend('p99_response_time', avgP99)
    });
    
    return metrics;
  }

  /**
   * Create throughput metrics
   */
  private createThroughputMetrics(results: LoadTestResult[]): BenchmarkMetric[] {
    const metrics: BenchmarkMetric[] = [];
    
    if (results.length === 0) return metrics;
    
    // Requests Per Second
    const totalRequests = results.reduce((sum, r) => sum + r.totalRequests, 0);
    const totalDuration = results.reduce((sum, r) => sum + (r.endTime - r.startTime), 0) / 1000; // Convert to seconds
    const requestsPerSecond = totalDuration > 0 ? totalRequests / totalDuration : 0;
    
    metrics.push({
      name: 'Requests Per Second',
      value: Math.round(requestsPerSecond * 100) / 100,
      unit: 'req/s',
      threshold: 100,
      status: requestsPerSecond >= 100 ? 'pass' : requestsPerSecond >= 50 ? 'warning' : 'fail',
      trend: this.calculateTrend('requests_per_second', requestsPerSecond)
    });
    
    // Task Processing Rate
    const avgTaskRate = results.reduce((sum, r) => sum + r.taskProcessingRate, 0) / results.length;
    metrics.push({
      name: 'Task Processing Rate',
      value: Math.round(avgTaskRate * 100) / 100,
      unit: 'tasks/s',
      threshold: 50,
      status: avgTaskRate >= 50 ? 'pass' : avgTaskRate >= 25 ? 'warning' : 'fail',
      trend: this.calculateTrend('task_processing_rate', avgTaskRate)
    });
    
    return metrics;
  }

  /**
   * Create resource utilization metrics
   */
  private createResourceMetrics(results: LoadTestResult[]): BenchmarkMetric[] {
    const metrics: BenchmarkMetric[] = [];
    
    if (results.length === 0) return metrics;
    
    // Peak Memory Usage
    const maxMemory = Math.max(...results.map(r => r.peakMemoryUsage));
    metrics.push({
      name: 'Peak Memory Usage',
      value: Math.round(maxMemory),
      unit: 'MB',
      threshold: 1000,
      status: maxMemory <= 1000 ? 'pass' : maxMemory <= 1500 ? 'warning' : 'fail',
      trend: this.calculateTrend('peak_memory', maxMemory)
    });
    
    // Average CPU Usage
    const avgCpu = results.reduce((sum, r) => sum + r.averageCpuUsage, 0) / results.length;
    metrics.push({
      name: 'Average CPU Usage',
      value: Math.round(avgCpu * 10) / 10,
      unit: '%',
      threshold: 70,
      status: avgCpu <= 70 ? 'pass' : avgCpu <= 85 ? 'warning' : 'fail',
      trend: this.calculateTrend('avg_cpu', avgCpu)
    });
    
    // Peak CPU Usage
    const maxCpu = Math.max(...results.map(r => r.peakCpuUsage));
    metrics.push({
      name: 'Peak CPU Usage',
      value: Math.round(maxCpu * 10) / 10,
      unit: '%',
      threshold: 90,
      status: maxCpu <= 90 ? 'pass' : maxCpu <= 95 ? 'warning' : 'fail',
      trend: this.calculateTrend('peak_cpu', maxCpu)
    });
    
    return metrics;
  }

  /**
   * Create reliability metrics
   */
  private createReliabilityMetrics(results: LoadTestResult[]): BenchmarkMetric[] {
    const metrics: BenchmarkMetric[] = [];
    
    if (results.length === 0) return metrics;
    
    // Error Rate
    const totalRequests = results.reduce((sum, r) => sum + r.totalRequests, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.failedRequests, 0);
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
    
    metrics.push({
      name: 'Error Rate',
      value: Math.round(errorRate * 1000) / 1000,
      unit: '%',
      threshold: 1,
      status: errorRate <= 1 ? 'pass' : errorRate <= 2 ? 'warning' : 'fail',
      trend: this.calculateTrend('error_rate', errorRate)
    });
    
    // Success Rate
    const successRate = totalRequests > 0 ? ((totalRequests - totalErrors) / totalRequests) * 100 : 0;
    metrics.push({
      name: 'Success Rate',
      value: Math.round(successRate * 100) / 100,
      unit: '%',
      threshold: 99,
      status: successRate >= 99 ? 'pass' : successRate >= 95 ? 'warning' : 'fail',
      trend: this.calculateTrend('success_rate', successRate)
    });
    
    return metrics;
  }

  /**
   * Create scalability metrics from stress test results
   */
  private createScalabilityMetrics(stressReport: StressTestReport): BenchmarkMetric[] {
    const metrics: BenchmarkMetric[] = [];
    
    // Breaking Point
    metrics.push({
      name: 'Concurrent User Limit',
      value: stressReport.stressAnalysis.breakingPoint,
      unit: 'users',
      threshold: 500,
      status: stressReport.stressAnalysis.breakingPoint >= 500 ? 'pass' : 
              stressReport.stressAnalysis.breakingPoint >= 250 ? 'warning' : 'fail',
      trend: this.calculateTrend('breaking_point', stressReport.stressAnalysis.breakingPoint)
    });
    
    // Stability Score
    metrics.push({
      name: 'System Stability',
      value: stressReport.stressAnalysis.stabilityScore,
      unit: 'score',
      threshold: 80,
      status: stressReport.stressAnalysis.stabilityScore >= 80 ? 'pass' : 
              stressReport.stressAnalysis.stabilityScore >= 60 ? 'warning' : 'fail',
      trend: this.calculateTrend('stability_score', stressReport.stressAnalysis.stabilityScore)
    });
    
    // Recovery Time
    metrics.push({
      name: 'Recovery Time',
      value: Math.round(stressReport.stressAnalysis.recoveryTime / 1000),
      unit: 'seconds',
      threshold: 30,
      status: stressReport.stressAnalysis.recoveryTime <= 30000 ? 'pass' : 
              stressReport.stressAnalysis.recoveryTime <= 60000 ? 'warning' : 'fail',
      trend: this.calculateTrend('recovery_time', stressReport.stressAnalysis.recoveryTime)
    });
    
    return metrics;
  }

  /**
   * Create queue-specific performance metrics
   */
  private createQueueMetrics(results: LoadTestResult[]): BenchmarkMetric[] {
    const metrics: BenchmarkMetric[] = [];
    
    if (results.length === 0) return metrics;
    
    // Average Queue Length
    const avgQueueLength = results.reduce((sum, r) => sum + r.averageQueueLength, 0) / results.length;
    metrics.push({
      name: 'Average Queue Length',
      value: Math.round(avgQueueLength * 10) / 10,
      unit: 'tasks',
      threshold: 10,
      status: avgQueueLength <= 10 ? 'pass' : avgQueueLength <= 20 ? 'warning' : 'fail',
      trend: this.calculateTrend('avg_queue_length', avgQueueLength)
    });
    
    // Maximum Queue Length
    const maxQueueLength = Math.max(...results.map(r => r.maxQueueLength));
    metrics.push({
      name: 'Maximum Queue Length',
      value: maxQueueLength,
      unit: 'tasks',
      threshold: 50,
      status: maxQueueLength <= 50 ? 'pass' : maxQueueLength <= 75 ? 'warning' : 'fail',
      trend: this.calculateTrend('max_queue_length', maxQueueLength)
    });
    
    // Total Tasks Processed
    const totalTasks = results.reduce((sum, r) => sum + r.totalTasksProcessed, 0);
    metrics.push({
      name: 'Total Tasks Processed',
      value: totalTasks,
      unit: 'tasks',
      threshold: 1000,
      status: totalTasks >= 1000 ? 'pass' : totalTasks >= 500 ? 'warning' : 'fail',
      trend: this.calculateTrend('total_tasks', totalTasks)
    });
    
    return metrics;
  }

  /**
   * Calculate overall performance score
   */
  private calculateOverallScore(metrics: BenchmarkMetric[]): number {
    if (metrics.length === 0) return 0;
    
    let totalScore = 0;
    let weightedSum = 0;
    
    for (const metric of metrics) {
      let score = 0;
      let weight = 1;
      
      // Assign scores based on status
      switch (metric.status) {
        case 'pass':
          score = 100;
          break;
        case 'warning':
          score = 70;
          break;
        case 'fail':
          score = 30;
          break;
      }
      
      // Assign weights based on metric importance
      if (metric.name.includes('Response Time') || metric.name.includes('Error Rate')) {
        weight = 2; // Critical metrics
      } else if (metric.name.includes('CPU') || metric.name.includes('Memory')) {
        weight = 1.5; // Important metrics
      }
      
      totalScore += score * weight;
      weightedSum += weight;
    }
    
    return weightedSum > 0 ? Math.round(totalScore / weightedSum) : 0;
  }

  /**
   * Calculate trend for a metric
   */
  private calculateTrend(metricName: string, currentValue: number): 'improving' | 'stable' | 'degrading' {
    const recentSuites = this.benchmarkHistory.slice(-3); // Last 3 benchmarks
    const historicalValues = recentSuites
      .map(suite => suite.metrics.find(m => m.name.toLowerCase().replace(/\s+/g, '_') === metricName))
      .filter(m => m !== undefined)
      .map(m => m!.value);
    
    if (historicalValues.length < 2) return 'stable';
    
    const trend = this.calculateLinearTrend(historicalValues.concat(currentValue));
    
    // For metrics where lower is better (response time, error rate, memory usage)
    const lowerIsBetter = ['response_time', 'error_rate', 'memory', 'cpu', 'recovery_time'].some(
      keyword => metricName.includes(keyword)
    );
    
    if (Math.abs(trend) < 0.05) return 'stable'; // Less than 5% change
    
    if (lowerIsBetter) {
      return trend < 0 ? 'improving' : 'degrading';
    } else {
      return trend > 0 ? 'improving' : 'degrading';
    }
  }

  /**
   * Calculate linear trend from values
   */
  private calculateLinearTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = (n * (n - 1)) / 2; // Sum of indices
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, idx) => sum + (idx * val), 0);
    const sumX2 = values.reduce((sum, _, idx) => sum + (idx * idx), 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgY = sumY / n;
    
    return avgY !== 0 ? slope / avgY : 0; // Normalized slope
  }

  /**
   * Get previous score for comparison
   */
  private getPreviousScore(version: string, environment: string): number | undefined {
    const previousSuites = this.benchmarkHistory
      .filter(suite => suite.environment === environment && suite.version !== version)
      .sort((a, b) => b.timestamp - a.timestamp);
    
    return previousSuites[0]?.overallScore;
  }

  /**
   * Set performance baseline
   */
  setBaseline(version: string, suite: BenchmarkSuite): void {
    const baseline: PerformanceBaseline = {
      version,
      timestamp: suite.timestamp,
      environment: suite.environment,
      metrics: new Map(suite.metrics.map(m => [m.name, m.value]))
    };
    
    this.baselines.set(`${version}-${suite.environment}`, baseline);
  }

  /**
   * Compare performance against baseline
   */
  compareToBaseline(suite: BenchmarkSuite, baselineVersion: string): Map<string, number> {
    const baselineKey = `${baselineVersion}-${suite.environment}`;
    const baseline = this.baselines.get(baselineKey);
    
    if (!baseline) {
      throw new Error(`Baseline not found for version ${baselineVersion} in ${suite.environment}`);
    }
    
    const comparison = new Map<string, number>();
    
    for (const metric of suite.metrics) {
      const baselineValue = baseline.metrics.get(metric.name);
      if (baselineValue !== undefined) {
        const percentChange = ((metric.value - baselineValue) / baselineValue) * 100;
        comparison.set(metric.name, percentChange);
      }
    }
    
    return comparison;
  }

  /**
   * Validate optimization impact
   */
  validateOptimization(
    optimizationName: string,
    beforeSuite: BenchmarkSuite,
    afterSuite: BenchmarkSuite
  ): OptimizationValidation {
    const improvement = new Map<string, number>();
    const regressions: string[] = [];
    
    for (const afterMetric of afterSuite.metrics) {
      const beforeMetric = beforeSuite.metrics.find(m => m.name === afterMetric.name);
      if (beforeMetric) {
        const percentChange = ((afterMetric.value - beforeMetric.value) / beforeMetric.value) * 100;
        improvement.set(afterMetric.name, percentChange);
        
        // Check for regressions (considering whether lower or higher is better)
        const lowerIsBetter = ['Response Time', 'Error Rate', 'Memory', 'CPU', 'Recovery Time'].some(
          keyword => afterMetric.name.includes(keyword)
        );
        
        const isRegression = lowerIsBetter ? percentChange > 5 : percentChange < -5;
        if (isRegression) {
          regressions.push(`${afterMetric.name}: ${percentChange.toFixed(1)}% ${lowerIsBetter ? 'increase' : 'decrease'}`);
        }
      }
    }
    
    const overallImprovement = afterSuite.overallScore - beforeSuite.overallScore;
    
    let recommendation: 'deploy' | 'investigate' | 'rollback';
    if (regressions.length > 0 && overallImprovement < 5) {
      recommendation = 'rollback';
    } else if (overallImprovement < 2 || regressions.length > 2) {
      recommendation = 'investigate';
    } else {
      recommendation = 'deploy';
    }
    
    return {
      optimizationName,
      beforeMetrics: beforeSuite,
      afterMetrics: afterSuite,
      improvement,
      regressions,
      overallImprovement,
      recommendation
    };
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(suite: BenchmarkSuite): string {
    let report = `# Performance Benchmark Report\n\n`;
    report += `**Suite:** ${suite.name}\n`;
    report += `**Version:** ${suite.version}\n`;
    report += `**Environment:** ${suite.environment}\n`;
    report += `**Timestamp:** ${new Date(suite.timestamp).toISOString()}\n`;
    report += `**Overall Score:** ${suite.overallScore}/100`;
    
    if (suite.previousScore !== undefined) {
      const change = suite.overallScore - suite.previousScore;
      const changeStr = change > 0 ? `+${change}` : `${change}`;
      report += ` (${changeStr} from previous)\n\n`;
    } else {
      report += `\n\n`;
    }
    
    // Group metrics by category
    const categories = new Map<string, BenchmarkMetric[]>();
    for (const metric of suite.metrics) {
      const category = this.getMetricCategory(metric.name);
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(metric);
    }
    
    // Generate category sections
    for (const [category, metrics] of categories) {
      report += `## ${category}\n\n`;
      report += `| Metric | Value | Status | Trend |\n`;
      report += `|--------|-------|--------|-------|\n`;
      
      for (const metric of metrics) {
        const statusIcon = metric.status === 'pass' ? '✅' : metric.status === 'warning' ? '⚠️' : '❌';
        const trendIcon = metric.trend === 'improving' ? '📈' : metric.trend === 'degrading' ? '📉' : '➡️';
        report += `| ${metric.name} | ${metric.value} ${metric.unit} | ${statusIcon} ${metric.status} | ${trendIcon} ${metric.trend} |\n`;
      }
      
      report += `\n`;
    }
    
    return report;
  }

  /**
   * Get metric category for grouping
   */
  private getMetricCategory(metricName: string): string {
    if (metricName.includes('Response Time')) return 'Response Times';
    if (metricName.includes('Rate') || metricName.includes('Per Second')) return 'Throughput';
    if (metricName.includes('Memory') || metricName.includes('CPU')) return 'Resource Usage';
    if (metricName.includes('Error') || metricName.includes('Success')) return 'Reliability';
    if (metricName.includes('User') || metricName.includes('Stability') || metricName.includes('Recovery')) return 'Scalability';
    if (metricName.includes('Queue') || metricName.includes('Task')) return 'Queue Performance';
    return 'Other';
  }

  /**
   * Get benchmark history
   */
  getBenchmarkHistory(): BenchmarkSuite[] {
    return [...this.benchmarkHistory];
  }

  /**
   * Get available baselines
   */
  getBaselines(): Map<string, PerformanceBaseline> {
    return new Map(this.baselines);
  }
}