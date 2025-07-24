/**
 * Capacity Planning Tools for Task Queue System
 * Provides scaling decisions and resource planning capabilities
 */

import { LoadTestResult } from './LoadTestFramework';
import { StressTestReport } from './StressTestRunner';
import { BenchmarkSuite } from './PerformanceBenchmark';

export interface ResourceRequirement {
  cpu: number; // CPU cores
  memory: number; // Memory in GB
  storage: number; // Storage in GB
  network: number; // Network bandwidth in Mbps
}

export interface ScalingProjection {
  targetUsers: number;
  currentCapacity: number;
  requiredInstances: number;
  resourceRequirements: ResourceRequirement;
  estimatedCost: number;
  scalingStrategy: 'vertical' | 'horizontal' | 'hybrid';
  timeline: string;
  risks: string[];
  recommendations: string[];
}

export interface CapacityModel {
  baselineUsers: number;
  baselineResources: ResourceRequirement;
  scalingFactors: {
    cpu: number; // CPU scaling factor per user
    memory: number; // Memory scaling factor per user
    storage: number; // Storage scaling factor per user
    network: number; // Network scaling factor per user
  };
  overheadFactors: {
    systemOverhead: number; // System overhead percentage
    redundancy: number; // Redundancy factor
    peakBuffer: number; // Peak load buffer percentage
  };
}

export interface GrowthScenario {
  name: string;
  description: string;
  timeframe: string;
  userGrowthRate: number; // Monthly growth rate percentage
  peakMultiplier: number; // Peak vs average load multiplier
  seasonalFactors: number[]; // Monthly seasonal factors (12 values)
}

export interface CostModel {
  instanceCosts: Map<string, number>; // Cost per instance type per hour
  storageCosts: Map<string, number>; // Cost per GB per month
  networkCosts: Map<string, number>; // Cost per GB transferred
  additionalServices: Map<string, number>; // Additional service costs
}

export interface CapacityPlan {
  planId: string;
  scenario: GrowthScenario;
  projections: ScalingProjection[];
  totalCost: number;
  riskAssessment: {
    technicalRisks: string[];
    businessRisks: string[];
    mitigationStrategies: string[];
  };
  milestones: {
    date: string;
    users: number;
    action: string;
    cost: number;
  }[];
  alternatives: {
    name: string;
    description: string;
    costDifference: number;
    tradeoffs: string[];
  }[];
}

export class CapacityPlanner {
  private capacityModel: CapacityModel;
  private costModel: CostModel;
  private historicalData: LoadTestResult[] = [];
  private stressTestData: StressTestReport[] = [];

  constructor() {
    this.capacityModel = this.createDefaultCapacityModel();
    this.costModel = this.createDefaultCostModel();
  }

  /**
   * Create default capacity model based on typical task queue system requirements
   */
  private createDefaultCapacityModel(): CapacityModel {
    return {
      baselineUsers: 100,
      baselineResources: {
        cpu: 2, // 2 CPU cores
        memory: 4, // 4 GB RAM
        storage: 20, // 20 GB storage
        network: 100 // 100 Mbps
      },
      scalingFactors: {
        cpu: 0.01, // 0.01 CPU cores per user
        memory: 0.02, // 0.02 GB RAM per user
        storage: 0.1, // 0.1 GB storage per user
        network: 0.5 // 0.5 Mbps per user
      },
      overheadFactors: {
        systemOverhead: 0.2, // 20% system overhead
        redundancy: 1.5, // 50% redundancy
        peakBuffer: 0.3 // 30% peak buffer
      }
    };
  }

  /**
   * Create default cost model (AWS-based pricing)
   */
  private createDefaultCostModel(): CostModel {
    return {
      instanceCosts: new Map([
        ['t3.small', 0.0208], // $0.0208/hour
        ['t3.medium', 0.0416], // $0.0416/hour
        ['t3.large', 0.0832], // $0.0832/hour
        ['t3.xlarge', 0.1664], // $0.1664/hour
        ['c5.large', 0.085], // $0.085/hour
        ['c5.xlarge', 0.17], // $0.17/hour
        ['m5.large', 0.096], // $0.096/hour
        ['m5.xlarge', 0.192] // $0.192/hour
      ]),
      storageCosts: new Map([
        ['gp3', 0.08], // $0.08/GB/month
        ['io2', 0.125] // $0.125/GB/month
      ]),
      networkCosts: new Map([
        ['data_transfer', 0.09] // $0.09/GB
      ]),
      additionalServices: new Map([
        ['load_balancer', 22.5], // $22.5/month
        ['database', 50], // $50/month base
        ['monitoring', 10] // $10/month
      ])
    };
  }

  /**
   * Add historical performance data
   */
  addHistoricalData(results: LoadTestResult[]): void {
    this.historicalData.push(...results);
  }

  /**
   * Add stress test data
   */
  addStressTestData(reports: StressTestReport[]): void {
    this.stressTestData.push(...reports);
  }

  /**
   * Update capacity model based on actual performance data
   */
  calibrateCapacityModel(benchmarkSuites: BenchmarkSuite[]): void {
    if (benchmarkSuites.length === 0) return;
    
    // Analyze resource usage patterns
    const avgMemoryUsage = this.calculateAverageMetric(benchmarkSuites, 'Peak Memory Usage');
    const avgCpuUsage = this.calculateAverageMetric(benchmarkSuites, 'Average CPU Usage');
    const avgConcurrentUsers = this.calculateAverageMetric(benchmarkSuites, 'Concurrent User Limit');
    
    if (avgConcurrentUsers > 0) {
      // Update scaling factors based on observed data
      this.capacityModel.scalingFactors.memory = (avgMemoryUsage / 1024) / avgConcurrentUsers; // Convert MB to GB
      this.capacityModel.scalingFactors.cpu = (avgCpuUsage / 100) / avgConcurrentUsers; // Convert percentage to cores
      
      console.log('Capacity model calibrated based on performance data');
    }
  }

  /**
   * Calculate average metric value from benchmark suites
   */
  private calculateAverageMetric(suites: BenchmarkSuite[], metricName: string): number {
    const values = suites
      .map(suite => suite.metrics.find(m => m.name === metricName)?.value)
      .filter(value => value !== undefined) as number[];
    
    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
  }

  /**
   * Create scaling projection for target user count
   */
  createScalingProjection(targetUsers: number, currentUsers: number = 100): ScalingProjection {
    const currentCapacity = this.getCurrentCapacity();
    const requiredResources = this.calculateRequiredResources(targetUsers);
    const requiredInstances = this.calculateRequiredInstances(requiredResources);
    const estimatedCost = this.calculateMonthlyCost(requiredResources, requiredInstances);
    const scalingStrategy = this.determineScalingStrategy(targetUsers, currentUsers);
    
    return {
      targetUsers,
      currentCapacity,
      requiredInstances,
      resourceRequirements: requiredResources,
      estimatedCost,
      scalingStrategy,
      timeline: this.calculateScalingTimeline(targetUsers, currentUsers),
      risks: this.identifyScalingRisks(targetUsers, scalingStrategy),
      recommendations: this.generateScalingRecommendations(targetUsers, scalingStrategy)
    };
  }

  /**
   * Calculate required resources for target user count
   */
  private calculateRequiredResources(targetUsers: number): ResourceRequirement {
    const baseResources = this.capacityModel.baselineResources;
    const scalingFactors = this.capacityModel.scalingFactors;
    const overheadFactors = this.capacityModel.overheadFactors;
    
    // Calculate base requirements
    const baseCpu = baseResources.cpu + (targetUsers * scalingFactors.cpu);
    const baseMemory = baseResources.memory + (targetUsers * scalingFactors.memory);
    const baseStorage = baseResources.storage + (targetUsers * scalingFactors.storage);
    const baseNetwork = baseResources.network + (targetUsers * scalingFactors.network);
    
    // Apply overhead factors
    const totalOverhead = (1 + overheadFactors.systemOverhead) * overheadFactors.redundancy * (1 + overheadFactors.peakBuffer);
    
    return {
      cpu: Math.ceil(baseCpu * totalOverhead),
      memory: Math.ceil(baseMemory * totalOverhead),
      storage: Math.ceil(baseStorage * totalOverhead),
      network: Math.ceil(baseNetwork * totalOverhead)
    };
  }

  /**
   * Calculate required number of instances
   */
  private calculateRequiredInstances(resources: ResourceRequirement): number {
    // Assume m5.xlarge instances (4 vCPU, 16 GB RAM) as baseline
    const instanceCpu = 4;
    const instanceMemory = 16;
    
    const instancesForCpu = Math.ceil(resources.cpu / instanceCpu);
    const instancesForMemory = Math.ceil(resources.memory / instanceMemory);
    
    return Math.max(instancesForCpu, instancesForMemory);
  }

  /**
   * Calculate monthly cost
   */
  private calculateMonthlyCost(resources: ResourceRequirement, instances: number): number {
    const hoursPerMonth = 24 * 30; // 720 hours
    
    // Instance costs (using m5.xlarge as default)
    const instanceCost = (this.costModel.instanceCosts.get('m5.xlarge') || 0.192) * instances * hoursPerMonth;
    
    // Storage costs
    const storageCost = (this.costModel.storageCosts.get('gp3') || 0.08) * resources.storage;
    
    // Additional services
    const additionalCosts = Array.from(this.costModel.additionalServices.values()).reduce((sum, cost) => sum + cost, 0);
    
    return Math.round((instanceCost + storageCost + additionalCosts) * 100) / 100;
  }

  /**
   * Determine optimal scaling strategy
   */
  private determineScalingStrategy(targetUsers: number, currentUsers: number): 'vertical' | 'horizontal' | 'hybrid' {
    const scalingRatio = targetUsers / currentUsers;
    
    if (scalingRatio <= 2) {
      return 'vertical'; // Scale up existing instances
    } else if (scalingRatio <= 5) {
      return 'hybrid'; // Combination of vertical and horizontal scaling
    } else {
      return 'horizontal'; // Scale out with more instances
    }
  }

  /**
   * Calculate scaling timeline
   */
  private calculateScalingTimeline(targetUsers: number, currentUsers: number): string {
    const scalingRatio = targetUsers / currentUsers;
    
    if (scalingRatio <= 1.5) {
      return '1-2 weeks';
    } else if (scalingRatio <= 3) {
      return '3-4 weeks';
    } else if (scalingRatio <= 5) {
      return '1-2 months';
    } else {
      return '2-3 months';
    }
  }

  /**
   * Identify scaling risks
   */
  private identifyScalingRisks(targetUsers: number, strategy: string): string[] {
    const risks: string[] = [];
    
    if (targetUsers > 1000) {
      risks.push('Database performance bottlenecks at high user counts');
      risks.push('Network bandwidth limitations during peak usage');
    }
    
    if (strategy === 'vertical') {
      risks.push('Single point of failure with larger instances');
      risks.push('Limited scaling headroom with vertical scaling');
    }
    
    if (strategy === 'horizontal') {
      risks.push('Increased complexity in load balancing and data consistency');
      risks.push('Higher operational overhead with multiple instances');
    }
    
    if (targetUsers > 5000) {
      risks.push('Potential need for database sharding or clustering');
      risks.push('Cache invalidation complexity at scale');
    }
    
    return risks;
  }

  /**
   * Generate scaling recommendations
   */
  private generateScalingRecommendations(targetUsers: number, strategy: string): string[] {
    const recommendations: string[] = [];
    
    recommendations.push('Implement auto-scaling policies to handle traffic spikes');
    recommendations.push('Set up comprehensive monitoring and alerting');
    
    if (strategy === 'horizontal') {
      recommendations.push('Implement database read replicas for better performance');
      recommendations.push('Use Redis cluster for distributed caching');
    }
    
    if (targetUsers > 1000) {
      recommendations.push('Consider implementing CDN for static assets');
      recommendations.push('Optimize database queries and add appropriate indexes');
    }
    
    if (targetUsers > 5000) {
      recommendations.push('Plan for database partitioning or sharding');
      recommendations.push('Implement circuit breakers for external dependencies');
    }
    
    return recommendations;
  }

  /**
   * Create growth scenarios
   */
  createGrowthScenarios(): GrowthScenario[] {
    return [
      {
        name: 'Conservative Growth',
        description: 'Steady, predictable growth pattern',
        timeframe: '12 months',
        userGrowthRate: 5, // 5% monthly growth
        peakMultiplier: 1.5,
        seasonalFactors: [1.0, 1.0, 1.1, 1.1, 1.2, 1.2, 1.3, 1.3, 1.2, 1.1, 1.0, 1.0]
      },
      {
        name: 'Aggressive Growth',
        description: 'Rapid expansion with marketing campaigns',
        timeframe: '12 months',
        userGrowthRate: 15, // 15% monthly growth
        peakMultiplier: 2.0,
        seasonalFactors: [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.6, 1.4, 1.2, 1.1]
      },
      {
        name: 'Viral Growth',
        description: 'Exponential growth from viral adoption',
        timeframe: '6 months',
        userGrowthRate: 30, // 30% monthly growth
        peakMultiplier: 3.0,
        seasonalFactors: [1.0, 1.2, 1.5, 2.0, 2.5, 3.0, 3.0, 3.0, 2.5, 2.0, 1.5, 1.2]
      },
      {
        name: 'Seasonal Business',
        description: 'High seasonal variation in usage',
        timeframe: '12 months',
        userGrowthRate: 8, // 8% monthly growth
        peakMultiplier: 2.5,
        seasonalFactors: [0.8, 0.8, 0.9, 1.0, 1.2, 1.5, 2.0, 2.5, 2.0, 1.5, 1.0, 0.9]
      }
    ];
  }

  /**
   * Create comprehensive capacity plan
   */
  createCapacityPlan(scenario: GrowthScenario, currentUsers: number = 100): CapacityPlan {
    const planId = `capacity-plan-${Date.now()}`;
    const projections: ScalingProjection[] = [];
    const milestones: CapacityPlan['milestones'] = [];
    
    let users = currentUsers;
    let totalCost = 0;
    
    // Create monthly projections
    for (let month = 1; month <= 12; month++) {
      users = Math.round(users * (1 + scenario.userGrowthRate / 100));
      const seasonalUsers = Math.round(users * scenario.seasonalFactors[month - 1]);
      const peakUsers = Math.round(seasonalUsers * scenario.peakMultiplier);
      
      const projection = this.createScalingProjection(peakUsers, currentUsers);
      projections.push(projection);
      totalCost += projection.estimatedCost;
      
      // Add milestone if significant scaling is needed
      if (projection.requiredInstances > (projections[projections.length - 2]?.requiredInstances || 1)) {
        milestones.push({
          date: new Date(Date.now() + month * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          users: peakUsers,
          action: `Scale to ${projection.requiredInstances} instances`,
          cost: projection.estimatedCost
        });
      }
    }
    
    return {
      planId,
      scenario,
      projections,
      totalCost,
      riskAssessment: {
        technicalRisks: this.assessTechnicalRisks(projections),
        businessRisks: this.assessBusinessRisks(scenario, totalCost),
        mitigationStrategies: this.generateMitigationStrategies(projections)
      },
      milestones,
      alternatives: this.generateAlternatives(scenario, projections)
    };
  }

  /**
   * Assess technical risks
   */
  private assessTechnicalRisks(projections: ScalingProjection[]): string[] {
    const risks: string[] = [];
    const maxUsers = Math.max(...projections.map(p => p.targetUsers));
    const maxInstances = Math.max(...projections.map(p => p.requiredInstances));
    
    if (maxUsers > 10000) {
      risks.push('Database scalability challenges at 10K+ users');
      risks.push('Complex data synchronization requirements');
    }
    
    if (maxInstances > 20) {
      risks.push('Operational complexity with 20+ instances');
      risks.push('Increased deployment and monitoring overhead');
    }
    
    const hasRapidGrowth = projections.some((p, i) => 
      i > 0 && p.targetUsers / projections[i-1].targetUsers > 2
    );
    
    if (hasRapidGrowth) {
      risks.push('Rapid scaling may cause performance instability');
      risks.push('Potential for cascading failures during growth spikes');
    }
    
    return risks;
  }

  /**
   * Assess business risks
   */
  private assessBusinessRisks(scenario: GrowthScenario, totalCost: number): string[] {
    const risks: string[] = [];
    
    if (totalCost > 100000) {
      risks.push('High infrastructure costs may impact profitability');
    }
    
    if (scenario.userGrowthRate > 20) {
      risks.push('Aggressive growth assumptions may not materialize');
      risks.push('Over-provisioning risk if growth targets are missed');
    }
    
    if (scenario.peakMultiplier > 2.5) {
      risks.push('High peak multiplier increases infrastructure waste during off-peak');
    }
    
    return risks;
  }

  /**
   * Generate mitigation strategies
   */
  private generateMitigationStrategies(projections: ScalingProjection[]): string[] {
    const strategies: string[] = [];
    
    strategies.push('Implement gradual scaling with monitoring at each stage');
    strategies.push('Use auto-scaling to optimize resource utilization');
    strategies.push('Establish performance baselines and SLA monitoring');
    
    const maxUsers = Math.max(...projections.map(p => p.targetUsers));
    if (maxUsers > 5000) {
      strategies.push('Plan database optimization and potential sharding');
      strategies.push('Implement comprehensive caching strategy');
    }
    
    return strategies;
  }

  /**
   * Generate alternative approaches
   */
  private generateAlternatives(scenario: GrowthScenario, projections: ScalingProjection[]): CapacityPlan['alternatives'] {
    const alternatives: CapacityPlan['alternatives'] = [];
    
    // Serverless alternative
    alternatives.push({
      name: 'Serverless Architecture',
      description: 'Use AWS Lambda and managed services for automatic scaling',
      costDifference: -0.3, // 30% cost reduction
      tradeoffs: ['Cold start latency', 'Vendor lock-in', 'Limited execution time']
    });
    
    // Container orchestration alternative
    alternatives.push({
      name: 'Kubernetes Deployment',
      description: 'Use container orchestration for better resource utilization',
      costDifference: -0.15, // 15% cost reduction
      tradeoffs: ['Increased operational complexity', 'Learning curve', 'Initial setup overhead']
    });
    
    // Multi-cloud alternative
    if (projections.some(p => p.targetUsers > 10000)) {
      alternatives.push({
        name: 'Multi-Cloud Strategy',
        description: 'Distribute load across multiple cloud providers',
        costDifference: 0.1, // 10% cost increase
        tradeoffs: ['Increased complexity', 'Data synchronization challenges', 'Better disaster recovery']
      });
    }
    
    return alternatives;
  }

  /**
   * Get current system capacity
   */
  private getCurrentCapacity(): number {
    // This would typically come from monitoring data
    // For now, return a default based on stress test data
    if (this.stressTestData.length > 0) {
      const latestStressTest = this.stressTestData[this.stressTestData.length - 1];
      return latestStressTest.stressAnalysis.breakingPoint;
    }
    
    return this.capacityModel.baselineUsers;
  }

  /**
   * Update cost model
   */
  updateCostModel(costModel: Partial<CostModel>): void {
    if (costModel.instanceCosts) {
      for (const [key, value] of costModel.instanceCosts) {
        this.costModel.instanceCosts.set(key, value);
      }
    }
    
    if (costModel.storageCosts) {
      for (const [key, value] of costModel.storageCosts) {
        this.costModel.storageCosts.set(key, value);
      }
    }
    
    if (costModel.networkCosts) {
      for (const [key, value] of costModel.networkCosts) {
        this.costModel.networkCosts.set(key, value);
      }
    }
    
    if (costModel.additionalServices) {
      for (const [key, value] of costModel.additionalServices) {
        this.costModel.additionalServices.set(key, value);
      }
    }
  }

  /**
   * Get capacity model
   */
  getCapacityModel(): CapacityModel {
    return { ...this.capacityModel };
  }

  /**
   * Get cost model
   */
  getCostModel(): CostModel {
    return {
      instanceCosts: new Map(this.costModel.instanceCosts),
      storageCosts: new Map(this.costModel.storageCosts),
      networkCosts: new Map(this.costModel.networkCosts),
      additionalServices: new Map(this.costModel.additionalServices)
    };
  }
}