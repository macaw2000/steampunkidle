/**
 * Example usage of the Load Testing Framework
 * Demonstrates how to use all components of the load testing system
 */

import { LoadTestRunner } from '../LoadTestRunner';
import { ServerTaskQueueService } from '../../../services/serverTaskQueueService';

/**
 * Example: Basic Load Testing
 */
async function basicLoadTestExample() {
  console.log('=== Basic Load Test Example ===');
  
  const taskQueueService = new ServerTaskQueueService();
  const loadTestRunner = new LoadTestRunner(taskQueueService);
  
  // Create a simple test suite
  const testSuite = {
    name: 'Basic Task Queue Load Test',
    description: 'Simple load test to verify basic functionality',
    loadTests: [
      {
        concurrentPlayers: 10,
        testDurationMs: 30000, // 30 seconds
        tasksPerPlayer: 5,
        taskTypeDistribution: { harvesting: 50, crafting: 30, combat: 20 },
        maxResponseTimeMs: 1000,
        maxErrorRate: 0.01,
        maxMemoryUsageMB: 500,
        rampUpTimeMs: 5000,
        rampDownTimeMs: 5000
      }
    ],
    stressTests: {
      name: 'Basic Stress Test',
      scenarios: [
        {
          name: 'Moderate Load',
          description: 'Test system under moderate load',
          config: {
            concurrentPlayers: 25,
            testDurationMs: 60000,
            tasksPerPlayer: 8,
            taskTypeDistribution: { harvesting: 40, crafting: 35, combat: 25 },
            maxResponseTimeMs: 1500,
            maxErrorRate: 0.02,
            maxMemoryUsageMB: 750,
            rampUpTimeMs: 10000,
            rampDownTimeMs: 5000
          },
          expectedFailureThreshold: 0.015
        }
      ],
      maxConcurrentTests: 1
    },
    capacityScenarios: [
      {
        name: 'Conservative Growth',
        description: 'Steady growth over 12 months',
        timeframe: '12 months',
        userGrowthRate: 5,
        peakMultiplier: 1.5,
        seasonalFactors: [1.0, 1.0, 1.1, 1.1, 1.2, 1.2, 1.3, 1.3, 1.2, 1.1, 1.0, 1.0]
      }
    ]
  };
  
  try {
    const report = await loadTestRunner.executeComprehensiveTestSuite(
      testSuite,
      '1.0.0',
      'development'
    );
    
    console.log(`Test completed successfully!`);
    console.log(`Performance Score: ${report.performanceScore}/100`);
    console.log(`Scalability Score: ${report.scalabilityScore}/100`);
    console.log(`Reliability Score: ${report.reliabilityScore}/100`);
    
    if (report.immediateActions.length > 0) {
      console.log('\nImmediate Actions Required:');
      report.immediateActions.forEach(action => console.log(`- ${action}`));
    }
    
    // Generate and save report
    const textReport = loadTestRunner.generateTestReport(report);
    console.log('\n=== Generated Report ===');
    console.log(textReport.substring(0, 500) + '...');
    
  } catch (error) {
    console.error('Load test failed:', error);
  }
}

/**
 * Example: Comprehensive Performance Testing
 */
async function comprehensiveTestExample() {
  console.log('\n=== Comprehensive Performance Test Example ===');
  
  const taskQueueService = new ServerTaskQueueService();
  const loadTestRunner = new LoadTestRunner(taskQueueService);
  
  // Use the standard comprehensive test suite
  const standardSuite = loadTestRunner.createStandardLoadTestSuite();
  
  try {
    const report = await loadTestRunner.executeComprehensiveTestSuite(
      standardSuite,
      '2.0.0',
      'staging'
    );
    
    console.log(`Comprehensive test completed!`);
    console.log(`Suite: ${report.suiteName}`);
    console.log(`Duration: ${Math.round((report.endTime - report.startTime) / 1000 / 60)} minutes`);
    
    // Analyze results
    console.log('\n=== Performance Analysis ===');
    console.log(`Overall Performance: ${report.performanceScore}/100`);
    console.log(`System Scalability: ${report.scalabilityScore}/100`);
    console.log(`Service Reliability: ${report.reliabilityScore}/100`);
    
    // Show capacity planning results
    console.log('\n=== Capacity Planning ===');
    for (const plan of report.capacityPlans) {
      console.log(`${plan.scenario.name}: $${plan.totalCost.toLocaleString()}/year`);
      console.log(`  Growth Rate: ${plan.scenario.userGrowthRate}% monthly`);
      console.log(`  Milestones: ${plan.milestones.length}`);
    }
    
    // Show recommendations
    if (report.shortTermRecommendations.length > 0) {
      console.log('\n=== Short-term Recommendations ===');
      report.shortTermRecommendations.forEach(rec => console.log(`- ${rec}`));
    }
    
  } catch (error) {
    console.error('Comprehensive test failed:', error);
  }
}

/**
 * Example: Optimization Validation
 */
async function optimizationValidationExample() {
  console.log('\n=== Optimization Validation Example ===');
  
  const taskQueueService = new ServerTaskQueueService();
  const loadTestRunner = new LoadTestRunner(taskQueueService);
  
  // Define "before" optimization test suite
  const beforeSuite = {
    name: 'Before Database Optimization',
    description: 'Performance baseline before database optimization',
    loadTests: [
      {
        concurrentPlayers: 20,
        testDurationMs: 45000,
        tasksPerPlayer: 8,
        taskTypeDistribution: { harvesting: 40, crafting: 35, combat: 25 },
        maxResponseTimeMs: 2000,
        maxErrorRate: 0.03,
        maxMemoryUsageMB: 800,
        rampUpTimeMs: 8000,
        rampDownTimeMs: 5000
      }
    ],
    stressTests: {
      name: 'Before Optimization Stress',
      scenarios: [
        {
          name: 'Database Load Test',
          description: 'Test database performance before optimization',
          config: {
            concurrentPlayers: 50,
            testDurationMs: 90000,
            tasksPerPlayer: 12,
            taskTypeDistribution: { harvesting: 30, crafting: 50, combat: 20 },
            maxResponseTimeMs: 3000,
            maxErrorRate: 0.05,
            maxMemoryUsageMB: 1200,
            rampUpTimeMs: 15000,
            rampDownTimeMs: 10000
          },
          expectedFailureThreshold: 0.04
        }
      ],
      maxConcurrentTests: 1
    },
    capacityScenarios: [
      {
        name: 'Pre-optimization Growth',
        description: 'Growth projections before optimization',
        timeframe: '12 months',
        userGrowthRate: 8,
        peakMultiplier: 2.0,
        seasonalFactors: [1.0, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.4, 1.3, 1.2, 1.1, 1.0]
      }
    ]
  };
  
  // Define "after" optimization test suite
  const afterSuite = {
    name: 'After Database Optimization',
    description: 'Performance after database optimization',
    loadTests: [
      {
        concurrentPlayers: 20,
        testDurationMs: 45000,
        tasksPerPlayer: 8,
        taskTypeDistribution: { harvesting: 40, crafting: 35, combat: 25 },
        maxResponseTimeMs: 1000, // Improved response time expectation
        maxErrorRate: 0.015, // Lower error rate expectation
        maxMemoryUsageMB: 600, // Better memory efficiency
        rampUpTimeMs: 8000,
        rampDownTimeMs: 5000
      }
    ],
    stressTests: {
      name: 'After Optimization Stress',
      scenarios: [
        {
          name: 'Optimized Database Load Test',
          description: 'Test database performance after optimization',
          config: {
            concurrentPlayers: 50,
            testDurationMs: 90000,
            tasksPerPlayer: 12,
            taskTypeDistribution: { harvesting: 30, crafting: 50, combat: 20 },
            maxResponseTimeMs: 1500, // Improved response time
            maxErrorRate: 0.025, // Lower error rate
            maxMemoryUsageMB: 900, // Better memory usage
            rampUpTimeMs: 15000,
            rampDownTimeMs: 10000
          },
          expectedFailureThreshold: 0.02
        }
      ],
      maxConcurrentTests: 1
    },
    capacityScenarios: [
      {
        name: 'Post-optimization Growth',
        description: 'Growth projections after optimization',
        timeframe: '12 months',
        userGrowthRate: 8,
        peakMultiplier: 2.0,
        seasonalFactors: [1.0, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.4, 1.3, 1.2, 1.1, 1.0]
      }
    ]
  };
  
  try {
    const validation = await loadTestRunner.validateOptimization(
      'Database Query Optimization',
      beforeSuite,
      afterSuite,
      '2.1.0',
      'optimization-test'
    );
    
    console.log(`Optimization validation completed!`);
    console.log(`Optimization: ${validation.optimizationName}`);
    console.log(`Overall Improvement: ${validation.overallImprovement.toFixed(1)} points`);
    console.log(`Recommendation: ${validation.recommendation.toUpperCase()}`);
    
    if (validation.regressions.length > 0) {
      console.log('\n=== Detected Regressions ===');
      validation.regressions.forEach(regression => console.log(`- ${regression}`));
    }
    
    console.log('\n=== Performance Improvements ===');
    for (const [metric, improvement] of validation.improvement) {
      const sign = improvement > 0 ? '+' : '';
      console.log(`${metric}: ${sign}${improvement.toFixed(1)}%`);
    }
    
  } catch (error) {
    console.error('Optimization validation failed:', error);
  }
}

/**
 * Example: Custom Capacity Planning
 */
async function capacityPlanningExample() {
  console.log('\n=== Capacity Planning Example ===');
  
  const taskQueueService = new ServerTaskQueueService();
  const loadTestRunner = new LoadTestRunner(taskQueueService);
  
  // Get the capacity planner
  const capacityPlanner = (loadTestRunner as any).capacityPlanner;
  
  // Create custom growth scenarios
  const customScenarios = [
    {
      name: 'Launch Scenario',
      description: 'Product launch with marketing campaign',
      timeframe: '6 months',
      userGrowthRate: 25,
      peakMultiplier: 3.0,
      seasonalFactors: [1.0, 1.5, 2.0, 2.5, 2.0, 1.5, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
    },
    {
      name: 'Steady State',
      description: 'Post-launch steady growth',
      timeframe: '12 months',
      userGrowthRate: 8,
      peakMultiplier: 1.8,
      seasonalFactors: [1.0, 1.0, 1.1, 1.1, 1.2, 1.3, 1.4, 1.3, 1.2, 1.1, 1.0, 1.0]
    }
  ];
  
  console.log('Creating capacity plans for custom scenarios...');
  
  for (const scenario of customScenarios) {
    const plan = capacityPlanner.createCapacityPlan(scenario, 200); // Starting with 200 users
    
    console.log(`\n=== ${scenario.name} ===`);
    console.log(`Total Annual Cost: $${plan.totalCost.toLocaleString()}`);
    console.log(`Peak Users (Year End): ${plan.projections[plan.projections.length - 1].targetUsers.toLocaleString()}`);
    console.log(`Required Instances: ${plan.projections[plan.projections.length - 1].requiredInstances}`);
    
    if (plan.milestones.length > 0) {
      console.log('\nKey Milestones:');
      plan.milestones.slice(0, 3).forEach(milestone => {
        console.log(`  ${milestone.date}: ${milestone.action} ($${milestone.cost.toLocaleString()}/month)`);
      });
    }
    
    if (plan.riskAssessment.technicalRisks.length > 0) {
      console.log('\nTechnical Risks:');
      plan.riskAssessment.technicalRisks.slice(0, 2).forEach(risk => {
        console.log(`  - ${risk}`);
      });
    }
  }
}

/**
 * Main execution function
 */
async function runExamples() {
  console.log('Task Queue Load Testing Framework Examples');
  console.log('==========================================');
  
  try {
    // Run basic example
    await basicLoadTestExample();
    
    // Wait between examples
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Run comprehensive example
    await comprehensiveTestExample();
    
    // Wait between examples
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Run optimization validation example
    await optimizationValidationExample();
    
    // Wait between examples
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Run capacity planning example
    await capacityPlanningExample();
    
    console.log('\n=== All Examples Completed Successfully! ===');
    
  } catch (error) {
    console.error('Example execution failed:', error);
  }
}

// Export examples for individual use
export {
  basicLoadTestExample,
  comprehensiveTestExample,
  optimizationValidationExample,
  capacityPlanningExample,
  runExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}