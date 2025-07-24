/**
 * Load Testing Framework for Task Queue System
 * Provides automated load testing, stress testing, and performance benchmarking
 */

import { TaskQueue, Task, TaskType } from '../../types/taskQueue';
import { ServerTaskQueueService } from '../../services/serverTaskQueueService';

export interface LoadTestConfig {
  // Test parameters
  concurrentPlayers: number;
  testDurationMs: number;
  tasksPerPlayer: number;
  
  // Task distribution
  taskTypeDistribution: {
    harvesting: number;
    crafting: number;
    combat: number;
  };
  
  // Performance thresholds
  maxResponseTimeMs: number;
  maxErrorRate: number;
  maxMemoryUsageMB: number;
  
  // Scaling parameters
  rampUpTimeMs: number;
  rampDownTimeMs: number;
}

export interface LoadTestResult {
  // Test metadata
  testId: string;
  startTime: number;
  endTime: number;
  config: LoadTestConfig;
  
  // Performance metrics
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  
  // Resource utilization
  peakMemoryUsage: number;
  averageCpuUsage: number;
  peakCpuUsage: number;
  
  // Queue metrics
  averageQueueLength: number;
  maxQueueLength: number;
  totalTasksProcessed: number;
  taskProcessingRate: number;
  
  // Error analysis
  errorsByType: Map<string, number>;
  criticalErrors: string[];
  
  // Capacity insights
  recommendedMaxPlayers: number;
  bottleneckComponents: string[];
  scalingRecommendations: string[];
}

export interface PlayerSimulator {
  playerId: string;
  taskQueue: TaskQueue;
  isActive: boolean;
  requestCount: number;
  errorCount: number;
  responseTimeSum: number;
}

export class LoadTestFramework {
  private taskQueueService: ServerTaskQueueService;
  private activeSimulators: Map<string, PlayerSimulator> = new Map();
  private testResults: LoadTestResult[] = [];
  private isRunning = false;
  
  constructor(taskQueueService: ServerTaskQueueService) {
    this.taskQueueService = taskQueueService;
  }

  /**
   * Execute a comprehensive load test
   */
  async executeLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
    const testId = `load-test-${Date.now()}`;
    const startTime = Date.now();
    
    console.log(`Starting load test ${testId} with ${config.concurrentPlayers} concurrent players`);
    
    this.isRunning = true;
    const result: LoadTestResult = {
      testId,
      startTime,
      endTime: 0,
      config,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      peakMemoryUsage: 0,
      averageCpuUsage: 0,
      peakCpuUsage: 0,
      averageQueueLength: 0,
      maxQueueLength: 0,
      totalTasksProcessed: 0,
      taskProcessingRate: 0,
      errorsByType: new Map(),
      criticalErrors: [],
      recommendedMaxPlayers: 0,
      bottleneckComponents: [],
      scalingRecommendations: []
    };

    try {
      // Phase 1: Ramp up players
      await this.rampUpPlayers(config);
      
      // Phase 2: Sustained load testing
      await this.executeSustainedLoad(config, result);
      
      // Phase 3: Ramp down players
      await this.rampDownPlayers(config);
      
      // Phase 4: Analyze results
      await this.analyzeResults(result);
      
    } catch (error) {
      result.criticalErrors.push(`Load test failed: ${error}`);
    } finally {
      this.isRunning = false;
      result.endTime = Date.now();
      this.testResults.push(result);
    }

    return result;
  }

  /**
   * Gradually increase the number of active players
   */
  private async rampUpPlayers(config: LoadTestConfig): Promise<void> {
    const playersPerStep = Math.max(1, Math.floor(config.concurrentPlayers / 10));
    const stepInterval = config.rampUpTimeMs / 10;
    
    for (let i = 0; i < config.concurrentPlayers; i += playersPerStep) {
      const playersToAdd = Math.min(playersPerStep, config.concurrentPlayers - i);
      
      for (let j = 0; j < playersToAdd; j++) {
        const playerId = `load-test-player-${i + j}`;
        await this.createPlayerSimulator(playerId, config);
      }
      
      if (i + playersPerStep < config.concurrentPlayers) {
        await this.sleep(stepInterval);
      }
    }
    
    console.log(`Ramped up to ${config.concurrentPlayers} concurrent players`);
  }

  /**
   * Execute sustained load for the specified duration
   */
  private async executeSustainedLoad(config: LoadTestConfig, result: LoadTestResult): Promise<void> {
    const startTime = Date.now();
    const endTime = startTime + config.testDurationMs;
    
    // Start monitoring
    const monitoringInterval = setInterval(() => {
      this.collectMetrics(result);
    }, 1000);
    
    // Keep all simulators active
    while (Date.now() < endTime && this.isRunning) {
      const promises = Array.from(this.activeSimulators.values()).map(simulator => 
        this.simulatePlayerActivity(simulator, config)
      );
      
      await Promise.allSettled(promises);
      await this.sleep(100); // Brief pause between activity cycles
    }
    
    clearInterval(monitoringInterval);
    console.log(`Completed sustained load phase`);
  }

  /**
   * Gradually reduce the number of active players
   */
  private async rampDownPlayers(config: LoadTestConfig): Promise<void> {
    const playersPerStep = Math.max(1, Math.floor(config.concurrentPlayers / 10));
    const stepInterval = config.rampDownTimeMs / 10;
    
    const playerIds = Array.from(this.activeSimulators.keys());
    
    for (let i = 0; i < playerIds.length; i += playersPerStep) {
      const playersToRemove = Math.min(playersPerStep, playerIds.length - i);
      
      for (let j = 0; j < playersToRemove; j++) {
        const playerId = playerIds[i + j];
        await this.removePlayerSimulator(playerId);
      }
      
      if (i + playersPerStep < playerIds.length) {
        await this.sleep(stepInterval);
      }
    }
    
    console.log(`Ramped down all players`);
  }

  /**
   * Create a new player simulator
   */
  private async createPlayerSimulator(playerId: string, config: LoadTestConfig): Promise<void> {
    const simulator: PlayerSimulator = {
      playerId,
      taskQueue: {
        playerId,
        currentTask: null,
        queuedTasks: [],
        isRunning: false,
        isPaused: false,
        totalTasksCompleted: 0,
        totalTimeSpent: 0,
        totalRewardsEarned: [],
        maxQueueSize: 50,
        autoStart: true,
        lastUpdated: Date.now(),
        lastSynced: Date.now(),
        createdAt: Date.now()
      },
      isActive: true,
      requestCount: 0,
      errorCount: 0,
      responseTimeSum: 0
    };
    
    this.activeSimulators.set(playerId, simulator);
    
    // Initialize with some tasks
    await this.populateInitialTasks(simulator, config);
  }

  /**
   * Remove a player simulator
   */
  private async removePlayerSimulator(playerId: string): Promise<void> {
    const simulator = this.activeSimulators.get(playerId);
    if (simulator) {
      simulator.isActive = false;
      try {
        await this.taskQueueService.stopAllTasks(playerId);
      } catch (error) {
        // Ignore cleanup errors during ramp down
      }
      this.activeSimulators.delete(playerId);
    }
  }

  /**
   * Populate initial tasks for a player simulator
   */
  private async populateInitialTasks(simulator: PlayerSimulator, config: LoadTestConfig): Promise<void> {
    const taskTypes = this.generateTaskTypes(config.tasksPerPlayer, config.taskTypeDistribution);
    
    for (const taskType of taskTypes) {
      try {
        const task = this.createMockTask(simulator.playerId, taskType);
        await this.measureRequest(async () => {
          // Simulate adding task to queue
          simulator.taskQueue.queuedTasks.push(task);
        }, simulator);
      } catch (error) {
        simulator.errorCount++;
      }
    }
  }

  /**
   * Simulate realistic player activity
   */
  private async simulatePlayerActivity(simulator: PlayerSimulator, config: LoadTestConfig): Promise<void> {
    if (!simulator.isActive) return;
    
    // Randomly choose an action
    const actions = ['addTask', 'checkQueue', 'reorderTasks', 'cancelTask'];
    const action = actions[Math.floor(Math.random() * actions.length)];
    
    try {
      switch (action) {
        case 'addTask':
          await this.simulateAddTask(simulator, config);
          break;
        case 'checkQueue':
          await this.simulateCheckQueue(simulator);
          break;
        case 'reorderTasks':
          await this.simulateReorderTasks(simulator);
          break;
        case 'cancelTask':
          await this.simulateCancelTask(simulator);
          break;
      }
    } catch (error) {
      simulator.errorCount++;
    }
  }

  /**
   * Simulate adding a task
   */
  private async simulateAddTask(simulator: PlayerSimulator, config: LoadTestConfig): Promise<void> {
    if (simulator.taskQueue.queuedTasks.length >= simulator.taskQueue.maxQueueSize) {
      return; // Queue is full
    }
    
    const taskTypes = Object.keys(config.taskTypeDistribution) as TaskType[];
    const taskType = taskTypes[Math.floor(Math.random() * taskTypes.length)];
    const task = this.createMockTask(simulator.playerId, taskType);
    
    await this.measureRequest(async () => {
      simulator.taskQueue.queuedTasks.push(task);
    }, simulator);
  }

  /**
   * Simulate checking queue status
   */
  private async simulateCheckQueue(simulator: PlayerSimulator): Promise<void> {
    await this.measureRequest(async () => {
      // Simulate queue status check
      return {
        queueLength: simulator.taskQueue.queuedTasks.length,
        currentTask: simulator.taskQueue.currentTask,
        isRunning: simulator.taskQueue.isRunning
      };
    }, simulator);
  }

  /**
   * Simulate reordering tasks
   */
  private async simulateReorderTasks(simulator: PlayerSimulator): Promise<void> {
    if (simulator.taskQueue.queuedTasks.length < 2) return;
    
    await this.measureRequest(async () => {
      // Randomly shuffle some tasks
      const tasks = [...simulator.taskQueue.queuedTasks];
      const shuffleCount = Math.min(3, tasks.length);
      
      for (let i = 0; i < shuffleCount; i++) {
        const idx1 = Math.floor(Math.random() * tasks.length);
        const idx2 = Math.floor(Math.random() * tasks.length);
        [tasks[idx1], tasks[idx2]] = [tasks[idx2], tasks[idx1]];
      }
      
      simulator.taskQueue.queuedTasks = tasks;
    }, simulator);
  }

  /**
   * Simulate canceling a task
   */
  private async simulateCancelTask(simulator: PlayerSimulator): Promise<void> {
    if (simulator.taskQueue.queuedTasks.length === 0) return;
    
    await this.measureRequest(async () => {
      const randomIndex = Math.floor(Math.random() * simulator.taskQueue.queuedTasks.length);
      simulator.taskQueue.queuedTasks.splice(randomIndex, 1);
    }, simulator);
  }

  /**
   * Measure request performance
   */
  private async measureRequest<T>(operation: () => Promise<T>, simulator: PlayerSimulator): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      const responseTime = Date.now() - startTime;
      
      simulator.requestCount++;
      simulator.responseTimeSum += responseTime;
      
      return result;
    } catch (error) {
      simulator.errorCount++;
      throw error;
    }
  }

  /**
   * Generate task types based on distribution
   */
  private generateTaskTypes(count: number, distribution: LoadTestConfig['taskTypeDistribution']): TaskType[] {
    const types: TaskType[] = [];
    const total = distribution.harvesting + distribution.crafting + distribution.combat;
    
    const harvestingCount = Math.floor((distribution.harvesting / total) * count);
    const craftingCount = Math.floor((distribution.crafting / total) * count);
    const combatCount = count - harvestingCount - craftingCount;
    
    for (let i = 0; i < harvestingCount; i++) types.push('harvesting');
    for (let i = 0; i < craftingCount; i++) types.push('crafting');
    for (let i = 0; i < combatCount; i++) types.push('combat');
    
    return this.shuffleArray(types);
  }

  /**
   * Create a mock task for testing
   */
  private createMockTask(playerId: string, taskType: TaskType): Task {
    return {
      id: `task-${Date.now()}-${Math.random()}`,
      type: taskType,
      name: `Mock ${taskType} task`,
      description: `Load test ${taskType} task`,
      icon: `${taskType}-icon`,
      duration: Math.floor(Math.random() * 30000) + 5000, // 5-35 seconds
      startTime: 0,
      playerId,
      activityData: this.createMockActivityData(taskType),
      prerequisites: [],
      resourceRequirements: [],
      progress: 0,
      completed: false,
      rewards: [],
      priority: Math.floor(Math.random() * 5),
      estimatedCompletion: 0,
      retryCount: 0,
      maxRetries: 3
    };
  }

  /**
   * Create mock activity data
   */
  private createMockActivityData(taskType: TaskType): any {
    switch (taskType) {
      case 'harvesting':
        return {
          activity: { id: 'wood', name: 'Chop Wood' },
          location: { id: 'forest', name: 'Forest' },
          tools: []
        };
      case 'crafting':
        return {
          recipe: { id: 'sword', name: 'Iron Sword' },
          materials: [],
          craftingStation: { id: 'forge', name: 'Forge' }
        };
      case 'combat':
        return {
          enemy: { id: 'goblin', name: 'Goblin' },
          equipment: []
        };
      default:
        return {};
    }
  }

  /**
   * Collect performance metrics
   */
  private collectMetrics(result: LoadTestResult): void {
    // Calculate current metrics
    let totalRequests = 0;
    let totalErrors = 0;
    let totalResponseTime = 0;
    let totalQueueLength = 0;
    
    for (const simulator of this.activeSimulators.values()) {
      totalRequests += simulator.requestCount;
      totalErrors += simulator.errorCount;
      totalResponseTime += simulator.responseTimeSum;
      totalQueueLength += simulator.taskQueue.queuedTasks.length;
    }
    
    // Update result metrics
    result.totalRequests = totalRequests;
    result.failedRequests = totalErrors;
    result.successfulRequests = totalRequests - totalErrors;
    result.averageResponseTime = totalRequests > 0 ? totalResponseTime / totalRequests : 0;
    result.averageQueueLength = this.activeSimulators.size > 0 ? totalQueueLength / this.activeSimulators.size : 0;
    result.maxQueueLength = Math.max(result.maxQueueLength, Math.max(...Array.from(this.activeSimulators.values()).map(s => s.taskQueue.queuedTasks.length)));
    
    // Simulate resource usage (in real implementation, this would come from system monitoring)
    result.peakMemoryUsage = Math.max(result.peakMemoryUsage, this.simulateMemoryUsage());
    result.averageCpuUsage = this.simulateCpuUsage();
    result.peakCpuUsage = Math.max(result.peakCpuUsage, result.averageCpuUsage);
  }

  /**
   * Analyze test results and provide recommendations
   */
  private async analyzeResults(result: LoadTestResult): Promise<void> {
    // Calculate percentiles (simplified for mock data)
    result.p95ResponseTime = result.averageResponseTime * 1.5;
    result.p99ResponseTime = result.averageResponseTime * 2.0;
    
    // Calculate task processing rate
    const testDurationSeconds = (result.endTime - result.startTime) / 1000;
    result.taskProcessingRate = result.totalRequests / testDurationSeconds;
    
    // Analyze bottlenecks
    if (result.averageResponseTime > result.config.maxResponseTimeMs) {
      result.bottleneckComponents.push('Response Time');
    }
    
    if (result.failedRequests / result.totalRequests > result.config.maxErrorRate) {
      result.bottleneckComponents.push('Error Rate');
    }
    
    if (result.peakMemoryUsage > result.config.maxMemoryUsageMB) {
      result.bottleneckComponents.push('Memory Usage');
    }
    
    // Generate scaling recommendations
    result.recommendedMaxPlayers = this.calculateRecommendedMaxPlayers(result);
    result.scalingRecommendations = this.generateScalingRecommendations(result);
    
    console.log(`Load test analysis complete. Recommended max players: ${result.recommendedMaxPlayers}`);
  }

  /**
   * Calculate recommended maximum players based on performance
   */
  private calculateRecommendedMaxPlayers(result: LoadTestResult): number {
    const responseTimeFactor = result.config.maxResponseTimeMs / Math.max(result.averageResponseTime, 1);
    const errorRateFactor = result.config.maxErrorRate / Math.max(result.failedRequests / result.totalRequests, 0.001);
    const memoryFactor = result.config.maxMemoryUsageMB / Math.max(result.peakMemoryUsage, 1);
    
    const limitingFactor = Math.min(responseTimeFactor, errorRateFactor, memoryFactor);
    return Math.floor(result.config.concurrentPlayers * limitingFactor * 0.8); // 20% safety margin
  }

  /**
   * Generate scaling recommendations
   */
  private generateScalingRecommendations(result: LoadTestResult): string[] {
    const recommendations: string[] = [];
    
    if (result.averageResponseTime > result.config.maxResponseTimeMs) {
      recommendations.push('Consider increasing server CPU allocation');
      recommendations.push('Implement response caching for frequently accessed data');
    }
    
    if (result.peakMemoryUsage > result.config.maxMemoryUsageMB) {
      recommendations.push('Increase server memory allocation');
      recommendations.push('Implement memory-efficient data structures');
    }
    
    if (result.failedRequests / result.totalRequests > result.config.maxErrorRate) {
      recommendations.push('Improve error handling and retry mechanisms');
      recommendations.push('Add circuit breakers for external dependencies');
    }
    
    if (result.maxQueueLength > 100) {
      recommendations.push('Consider implementing queue size limits per player');
      recommendations.push('Add queue processing optimization');
    }
    
    return recommendations;
  }

  /**
   * Simulate memory usage (in real implementation, use actual system metrics)
   */
  private simulateMemoryUsage(): number {
    const baseMemory = 100; // MB
    const perPlayerMemory = 0.5; // MB per player
    const randomVariation = Math.random() * 20; // Random variation
    
    return baseMemory + (this.activeSimulators.size * perPlayerMemory) + randomVariation;
  }

  /**
   * Simulate CPU usage (in real implementation, use actual system metrics)
   */
  private simulateCpuUsage(): number {
    const baseCpu = 10; // %
    const perPlayerCpu = 0.1; // % per player
    const randomVariation = Math.random() * 10; // Random variation
    
    return Math.min(100, baseCpu + (this.activeSimulators.size * perPlayerCpu) + randomVariation);
  }

  /**
   * Utility function to shuffle array
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Utility function to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get test results history
   */
  getTestResults(): LoadTestResult[] {
    return [...this.testResults];
  }

  /**
   * Stop current test
   */
  stopCurrentTest(): void {
    this.isRunning = false;
  }
}