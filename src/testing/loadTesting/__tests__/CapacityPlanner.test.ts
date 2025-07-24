/**
 * Tests for Capacity Planner
 */

import { CapacityPlanner, GrowthScenario, ScalingProjection } from '../CapacityPlanner';
import { LoadTestResult } from '../LoadTestFramework';
import { StressTestReport } from '../StressTestRunner';
import { BenchmarkSuite } from '../PerformanceBenchmark';

describe('CapacityPlanner', () => {
  let capacityPlanner: CapacityPlanner;

  beforeEach(() => {
    capacityPlanner = new CapacityPlanner();
  });

  describe('createScalingProjection', () => {
    it('should create a scaling projection for target user count', () => {
      const projection = capacityPlanner.createScalingProjection(500, 100);

      expect(projection).toBeDefined();
      expect(projection.targetUsers).toBe(500);
      expect(projection.currentCapacity).toBeGreaterThan(0);
      expect(projection.requiredInstances).toBeGreaterThan(0);
      expect(projection.resourceRequirements).toBeDefined();
      expect(projection.resourceRequirements.cpu).toBeGreaterThan(0);
      expect(projection.resourceRequirements.memory).toBeGreaterThan(0);
      expect(projection.resourceRequirements.storage).toBeGreaterThan(0);
      expect(projection.resourceRequirements.network).toBeGreaterThan(0);
      expect(projection.estimatedCost).toBeGreaterThan(0);
      expect(['vertical', 'horizontal', 'hybrid']).toContain(projection.scalingStrategy);
      expect(projection.timeline).toBeDefined();
      expect(Array.isArray(projection.risks)).toBe(true);
      expect(Array.isArray(projection.recommendations)).toBe(true);
    });

    it('should scale resources proportionally with user count', () => {
      const projection100 = capacityPlanner.createScalingProjection(100, 50);
      const projection200 = capacityPlanner.createScalingProjection(200, 50);

      expect(projection200.resourceRequirements.cpu).toBeGreaterThan(projection100.resourceRequirements.cpu);
      expect(projection200.resourceRequirements.memory).toBeGreaterThan(projection100.resourceRequirements.memory);
      expect(projection200.estimatedCost).toBeGreaterThan(projection100.estimatedCost);
    });

    it('should recommend appropriate scaling strategies', () => {
      const smallScale = capacityPlanner.createScalingProjection(150, 100); // 1.5x
      const mediumScale = capacityPlanner.createScalingProjection(400, 100); // 4x
      const largeScale = capacityPlanner.createScalingProjection(1000, 100); // 10x

      expect(smallScale.scalingStrategy).toBe('vertical');
      expect(mediumScale.scalingStrategy).toBe('hybrid');
      expect(largeScale.scalingStrategy).toBe('horizontal');
    });

    it('should provide realistic timelines', () => {
      const quickScale = capacityPlanner.createScalingProjection(120, 100);
      const majorScale = capacityPlanner.createScalingProjection(800, 100);

      expect(quickScale.timeline).toMatch(/week/i);
      expect(majorScale.timeline).toMatch(/month/i);
    });

    it('should identify risks for high user counts', () => {
      const highUserProjection = capacityPlanner.createScalingProjection(2000, 100);

      expect(highUserProjection.risks.length).toBeGreaterThan(0);
      expect(highUserProjection.risks.some(risk => 
        risk.toLowerCase().includes('database') || 
        risk.toLowerCase().includes('performance')
      )).toBe(true);
    });
  });

  describe('createGrowthScenarios', () => {
    it('should create standard growth scenarios', () => {
      const scenarios = capacityPlanner.createGrowthScenarios();

      expect(scenarios).toBeDefined();
      expect(scenarios.length).toBeGreaterThan(0);
      
      const scenarioNames = scenarios.map(s => s.name);
      expect(scenarioNames).toContain('Conservative Growth');
      expect(scenarioNames).toContain('Aggressive Growth');
      expect(scenarioNames).toContain('Viral Growth');
      expect(scenarioNames).toContain('Seasonal Business');
    });

    it('should have properly configured growth scenarios', () => {
      const scenarios = capacityPlanner.createGrowthScenarios();

      for (const scenario of scenarios) {
        expect(scenario.name).toBeDefined();
        expect(scenario.description).toBeDefined();
        expect(scenario.timeframe).toBeDefined();
        expect(scenario.userGrowthRate).toBeGreaterThan(0);
        expect(scenario.peakMultiplier).toBeGreaterThan(1);
        expect(scenario.seasonalFactors).toBeDefined();
        expect(scenario.seasonalFactors.length).toBe(12); // 12 months
        
        // All seasonal factors should be positive
        for (const factor of scenario.seasonalFactors) {
          expect(factor).toBeGreaterThan(0);
        }
      }
    });

    it('should have escalating growth rates', () => {
      const scenarios = capacityPlanner.createGrowthScenarios();
      
      const conservative = scenarios.find(s => s.name === 'Conservative Growth');
      const aggressive = scenarios.find(s => s.name === 'Aggressive Growth');
      const viral = scenarios.find(s => s.name === 'Viral Growth');

      expect(conservative).toBeDefined();
      expect(aggressive).toBeDefined();
      expect(viral).toBeDefined();

      expect(aggressive!.userGrowthRate).toBeGreaterThan(conservative!.userGrowthRate);
      expect(viral!.userGrowthRate).toBeGreaterThan(aggressive!.userGrowthRate);
    });
  });

  describe('createCapacityPlan', () => {
    it('should create a comprehensive capacity plan', () => {
      const scenario: GrowthScenario = {
        name: 'Test Growth',
        description: 'Test scenario',
        timeframe: '12 months',
        userGrowthRate: 10,
        peakMultiplier: 2.0,
        seasonalFactors: [1.0, 1.0, 1.1, 1.1, 1.2, 1.2, 1.3, 1.3, 1.2, 1.1, 1.0, 1.0]
      };

      const plan = capacityPlanner.createCapacityPlan(scenario, 100);

      expect(plan).toBeDefined();
      expect(plan.planId).toMatch(/^capacity-plan-\d+$/);
      expect(plan.scenario).toBe(scenario);
      expect(plan.projections.length).toBe(12); // 12 monthly projections
      expect(plan.totalCost).toBeGreaterThan(0);
      expect(plan.riskAssessment).toBeDefined();
      expect(plan.riskAssessment.technicalRisks).toBeDefined();
      expect(plan.riskAssessment.businessRisks).toBeDefined();
      expect(plan.riskAssessment.mitigationStrategies).toBeDefined();
      expect(Array.isArray(plan.milestones)).toBe(true);
      expect(Array.isArray(plan.alternatives)).toBe(true);
    });

    it('should show progressive scaling over time', () => {
      const scenario: GrowthScenario = {
        name: 'Progressive Growth',
        description: 'Steady growth scenario',
        timeframe: '12 months',
        userGrowthRate: 15,
        peakMultiplier: 1.5,
        seasonalFactors: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
      };

      const plan = capacityPlanner.createCapacityPlan(scenario, 100);

      // Each month should have more users than the previous
      for (let i = 1; i < plan.projections.length; i++) {
        expect(plan.projections[i].targetUsers).toBeGreaterThan(plan.projections[i-1].targetUsers);
      }
    });

    it('should account for seasonal variations', () => {
      const scenario: GrowthScenario = {
        name: 'Seasonal Growth',
        description: 'Growth with seasonal peaks',
        timeframe: '12 months',
        userGrowthRate: 5,
        peakMultiplier: 1.5,
        seasonalFactors: [1.0, 1.0, 1.0, 1.0, 2.0, 2.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0] // Peak in months 5-6
      };

      const plan = capacityPlanner.createCapacityPlan(scenario, 100);

      // Months 4 and 5 (index 4 and 5) should have higher user counts due to seasonal factors
      expect(plan.projections[4].targetUsers).toBeGreaterThan(plan.projections[3].targetUsers * 1.5);
      expect(plan.projections[5].targetUsers).toBeGreaterThan(plan.projections[4].targetUsers * 0.9);
    });

    it('should generate milestones for significant scaling events', () => {
      const scenario: GrowthScenario = {
        name: 'Rapid Growth',
        description: 'Fast growth requiring scaling',
        timeframe: '12 months',
        userGrowthRate: 25,
        peakMultiplier: 2.0,
        seasonalFactors: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
      };

      const plan = capacityPlanner.createCapacityPlan(scenario, 50);

      expect(plan.milestones.length).toBeGreaterThan(0);
      
      for (const milestone of plan.milestones) {
        expect(milestone.date).toBeDefined();
        expect(milestone.users).toBeGreaterThan(0);
        expect(milestone.action).toBeDefined();
        expect(milestone.cost).toBeGreaterThan(0);
      }
    });

    it('should provide alternative approaches', () => {
      const scenario: GrowthScenario = {
        name: 'Alternative Test',
        description: 'Test alternatives',
        timeframe: '12 months',
        userGrowthRate: 20,
        peakMultiplier: 2.0,
        seasonalFactors: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
      };

      const plan = capacityPlanner.createCapacityPlan(scenario, 100);

      expect(plan.alternatives.length).toBeGreaterThan(0);
      
      const alternativeNames = plan.alternatives.map(a => a.name);
      expect(alternativeNames).toContain('Serverless Architecture');
      expect(alternativeNames).toContain('Kubernetes Deployment');
      
      for (const alternative of plan.alternatives) {
        expect(alternative.name).toBeDefined();
        expect(alternative.description).toBeDefined();
        expect(typeof alternative.costDifference).toBe('number');
        expect(Array.isArray(alternative.tradeoffs)).toBe(true);
      }
    });
  });

  describe('calibrateCapacityModel', () => {
    it('should calibrate capacity model based on benchmark data', () => {
      const benchmarkSuites: BenchmarkSuite[] = [
        {
          id: 'benchmark-1',
          name: 'Test Benchmark',
          timestamp: Date.now(),
          version: '1.0.0',
          environment: 'test',
          metrics: [
            {
              name: 'Peak Memory Usage',
              value: 512,
              unit: 'MB',
              threshold: 1000,
              status: 'pass',
              trend: 'stable'
            },
            {
              name: 'Average CPU Usage',
              value: 60,
              unit: '%',
              threshold: 70,
              status: 'pass',
              trend: 'stable'
            },
            {
              name: 'Concurrent User Limit',
              value: 200,
              unit: 'users',
              threshold: 500,
              status: 'pass',
              trend: 'stable'
            }
          ],
          overallScore: 85
        }
      ];

      const originalModel = capacityPlanner.getCapacityModel();
      
      capacityPlanner.calibrateCapacityModel(benchmarkSuites);
      
      const calibratedModel = capacityPlanner.getCapacityModel();
      
      // Model should be updated based on the benchmark data
      expect(calibratedModel).toBeDefined();
      expect(calibratedModel.scalingFactors.memory).toBeGreaterThan(0);
      expect(calibratedModel.scalingFactors.cpu).toBeGreaterThan(0);
    });

    it('should handle empty benchmark data gracefully', () => {
      const originalModel = capacityPlanner.getCapacityModel();
      
      capacityPlanner.calibrateCapacityModel([]);
      
      const unchangedModel = capacityPlanner.getCapacityModel();
      
      // Model should remain unchanged
      expect(unchangedModel).toEqual(originalModel);
    });
  });

  describe('addHistoricalData', () => {
    it('should accept and store historical load test data', () => {
      const loadTestResults: LoadTestResult[] = [
        {
          testId: 'historical-test-1',
          startTime: Date.now() - 86400000, // 1 day ago
          endTime: Date.now() - 86400000 + 60000,
          config: {
            concurrentPlayers: 100,
            testDurationMs: 60000,
            tasksPerPlayer: 5,
            taskTypeDistribution: { harvesting: 50, crafting: 30, combat: 20 },
            maxResponseTimeMs: 1000,
            maxErrorRate: 0.01,
            maxMemoryUsageMB: 500,
            rampUpTimeMs: 5000,
            rampDownTimeMs: 5000
          },
          totalRequests: 500,
          successfulRequests: 485,
          failedRequests: 15,
          averageResponseTime: 750,
          p95ResponseTime: 1100,
          p99ResponseTime: 1400,
          peakMemoryUsage: 450,
          averageCpuUsage: 65,
          peakCpuUsage: 85,
          averageQueueLength: 4.2,
          maxQueueLength: 10,
          totalTasksProcessed: 242,
          taskProcessingRate: 4.03,
          errorsByType: new Map(),
          criticalErrors: [],
          recommendedMaxPlayers: 120,
          bottleneckComponents: [],
          scalingRecommendations: []
        }
      ];

      // Should not throw an error
      expect(() => {
        capacityPlanner.addHistoricalData(loadTestResults);
      }).not.toThrow();
    });
  });

  describe('addStressTestData', () => {
    it('should accept and store stress test data', () => {
      const stressTestReports: StressTestReport[] = [
        {
          suiteId: 'stress-suite-1',
          suiteName: 'Historical Stress Test',
          startTime: Date.now() - 86400000,
          endTime: Date.now() - 86400000 + 300000,
          scenarioResults: new Map(),
          overallMetrics: {
            totalRequests: 1000,
            totalFailures: 50,
            averageResponseTime: 800,
            peakMemoryUsage: 600,
            peakCpuUsage: 90
          },
          stressAnalysis: {
            breakingPoint: 300,
            recoveryTime: 20000,
            criticalBottlenecks: ['Memory Usage'],
            stabilityScore: 75
          },
          recommendations: ['Increase memory allocation']
        }
      ];

      // Should not throw an error
      expect(() => {
        capacityPlanner.addStressTestData(stressTestReports);
      }).not.toThrow();
    });
  });

  describe('updateCostModel', () => {
    it('should update cost model with new pricing', () => {
      const originalCostModel = capacityPlanner.getCostModel();
      
      const newCosts = {
        instanceCosts: new Map([
          ['t3.large', 0.1000], // Updated price
          ['new-instance-type', 0.2000] // New instance type
        ]),
        storageCosts: new Map([
          ['gp3', 0.10] // Updated storage price
        ])
      };

      capacityPlanner.updateCostModel(newCosts);
      
      const updatedCostModel = capacityPlanner.getCostModel();
      
      expect(updatedCostModel.instanceCosts.get('t3.large')).toBe(0.1000);
      expect(updatedCostModel.instanceCosts.get('new-instance-type')).toBe(0.2000);
      expect(updatedCostModel.storageCosts.get('gp3')).toBe(0.10);
      
      // Other costs should remain unchanged
      expect(updatedCostModel.instanceCosts.get('t3.small')).toBe(originalCostModel.instanceCosts.get('t3.small'));
    });
  });

  describe('cost calculations', () => {
    it('should calculate realistic monthly costs', () => {
      const smallProjection = capacityPlanner.createScalingProjection(100, 50);
      const largeProjection = capacityPlanner.createScalingProjection(1000, 50);

      expect(smallProjection.estimatedCost).toBeGreaterThan(0);
      expect(largeProjection.estimatedCost).toBeGreaterThan(smallProjection.estimatedCost);
      
      // Costs should be in a reasonable range (not too low or too high)
      expect(smallProjection.estimatedCost).toBeLessThan(10000); // Less than $10k/month
      expect(largeProjection.estimatedCost).toBeLessThan(100000); // Less than $100k/month
    });

    it('should account for different cost components', () => {
      const projection = capacityPlanner.createScalingProjection(500, 100);
      
      // Cost should be positive and reasonable
      expect(projection.estimatedCost).toBeGreaterThan(100); // At least $100/month
      expect(projection.estimatedCost).toBeLessThan(50000); // Less than $50k/month
    });
  });

  describe('risk assessment', () => {
    it('should identify appropriate risks for different scales', () => {
      const smallScale = capacityPlanner.createScalingProjection(200, 100);
      const largeScale = capacityPlanner.createScalingProjection(5000, 100);

      expect(smallScale.risks.length).toBeLessThan(largeScale.risks.length);
      
      // Large scale should have database and complexity risks
      expect(largeScale.risks.some(risk => 
        risk.toLowerCase().includes('database') || 
        risk.toLowerCase().includes('shard')
      )).toBe(true);
    });

    it('should provide relevant recommendations for scaling strategy', () => {
      const horizontalScale = capacityPlanner.createScalingProjection(2000, 100);
      
      expect(horizontalScale.scalingStrategy).toBe('horizontal');
      expect(horizontalScale.recommendations.some(rec => 
        rec.toLowerCase().includes('auto-scaling') || 
        rec.toLowerCase().includes('monitoring')
      )).toBe(true);
    });
  });
});