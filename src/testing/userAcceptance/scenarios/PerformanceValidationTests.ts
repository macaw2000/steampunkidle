import { TestDataGenerator, Player } from '../utils/TestDataGenerator';
import { PerformanceTestResults, PerformanceScenarioResult } from '../UserAcceptanceTestSuite';
import { serverTaskQueueService } from '../../../services/serverTaskQueueService';
import { HarvestingCategory } from '../../../types/harvesting';
import { LoadTestFramework } from '../../loadTesting/LoadTestFramework';
import { PerformanceBenchmark } from '../../loadTesting/PerformanceBenchmark';
import { TaskType } from '../../../types/taskQueue';

/**
 * Tests queue performance under realistic load conditions
 * Validates Requirements: 10.1, 10.2, 10.3
 */
export class PerformanceValidationTests {
  private testDataGenerator: TestDataGenerator;
  private serverTaskQueueService: typeof serverTaskQueueService;
  private loadTestFramework: LoadTestFramework;
  private performanceBenchmark: PerformanceBenchmark;

  constructor(testDataGenerator: TestDataGenerator) {
    this.testDataGenerator = testDataGenerator;
    this.serverTaskQueueService = serverTaskQueueService;
    this.loadTestFramework = new LoadTestFramework(serverTaskQueueService);
    this.performanceBenchmark = new PerformanceBenchmark();
  }

  /**
   * Run all performance validation tests
   */
  async runAllTests(): Promise<PerformanceTestResults> {
    const scenarios: PerformanceScenarioResult[] = [];
    
    try {
      // Test concurrent player load
      scenarios.push(await this.testConcurrentPlayerLoad());
      
      // Test queue processing speed
      scenarios.push(await this.testQueueProcessingSpeed());
      
      // Test UI responsiveness under load
      scenarios.push(await this.testUIResponsivenessUnderLoad());
      
      // Test memory usage patterns
      scenarios.push(await this.testMemoryUsagePatterns());
      
      // Test database performance
      scenarios.push(await this.testDatabasePerformance());
      
      // Test scalability limits
      scenarios.push(await this.testScalabilityLimits());

      const passedTests = scenarios.filter(s => s.status === 'PASSED').length;
      
      return {
        totalTests: scenarios.length,
        passedTests,
        scenarios
      };
      
    } catch (error) {
      console.error('Performance Validation Tests failed:', error);
      throw error;
    }
  }

  /**
   * Test performance with multiple concurrent players
   */
  private async testConcurrentPlayerLoad(): Promise<PerformanceScenarioResult> {
    const startTime = Date.now();
    const testName = 'Concurrent Player Load';
    
    try {
      const concurrentPlayers = 100; // Realistic concurrent load
      const players = this.testDataGenerator.generateTestPlayers(concurrentPlayers);
      
      // Prepare load test configuration
      const loadTestConfig = {
        concurrentPlayers: concurrentPlayers,
        testDurationMs: 30000, // 30 seconds
        tasksPerPlayer: 5,
        taskTypeDistribution: {
          harvesting: 40,
          crafting: 30,
          combat: 30
        },
        maxResponseTimeMs: 1000,
        maxErrorRate: 0.05,
        maxMemoryUsageMB: 500,
        rampUpTimeMs: 5000, // 5 seconds
        rampDownTimeMs: 2000 // 2 seconds
      };
      
      // Run concurrent load test
      const loadTestStartTime = Date.now();
      const loadTestResults = await this.loadTestFramework.executeLoadTest(loadTestConfig);
      const loadTestDuration = Date.now() - loadTestStartTime;
      
      // Analyze results
      const avgResponseTime = loadTestResults.averageResponseTime;
      const maxResponseTime = loadTestResults.p99ResponseTime;
      const errorRate = loadTestResults.failedRequests / loadTestResults.totalRequests;
      const throughput = loadTestResults.taskProcessingRate;
      
      // Performance criteria
      const responseTimeThreshold = 100; // 100ms
      const errorRateThreshold = 0.05; // 5%
      const throughputThreshold = 50; // 50 operations per second
      
      const performanceMetrics = {
        concurrentPlayers,
        loadTestDuration,
        averageResponseTime: avgResponseTime,
        maxResponseTime,
        errorRate,
        throughput,
        responseTimeAcceptable: avgResponseTime <= responseTimeThreshold,
        errorRateAcceptable: errorRate <= errorRateThreshold,
        throughputAcceptable: throughput >= throughputThreshold
      };
      
      const allCriteriaMet = performanceMetrics.responseTimeAcceptable && 
                            performanceMetrics.errorRateAcceptable && 
                            performanceMetrics.throughputAcceptable;
      
      return {
        name: testName,
        status: allCriteriaMet ? 'PASSED' : 'FAILED',
        duration: Date.now() - startTime,
        details: `Concurrent load test with ${concurrentPlayers} players: ${avgResponseTime}ms avg response, ${errorRate * 100}% error rate, ${throughput} ops/sec`,
        performanceMetrics
      };
      
    } catch (error) {
      return {
        name: testName,
        status: 'FAILED',
        duration: Date.now() - startTime,
        details: `Failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Test queue processing speed under various conditions
   */
  private async testQueueProcessingSpeed(): Promise<PerformanceScenarioResult> {
    const startTime = Date.now();
    const testName = 'Queue Processing Speed';
    
    try {
      const player = this.testDataGenerator.generateTestPlayer('HARDCORE');
      
      // Test different queue sizes
      const queueSizes = [10, 25, 50];
      const processingResults = [];
      
      for (const queueSize of queueSizes) {
        // Create queue with specified size
        const tasks = [];
        for (let i = 0; i < queueSize; i++) {
          tasks.push(this.testDataGenerator.generateTask(
            ['HARVESTING', 'CRAFTING', 'COMBAT'][i % 3] as any
          ));
        }
        
        // Add all tasks
        const addStartTime = Date.now();
        for (const task of tasks) {
          await this.addTaskToService(player.id, task);
        }
        const addDuration = Date.now() - addStartTime;
        
        // Measure queue status retrieval
        const statusStartTime = Date.now();
        const queueStatus = await this.serverTaskQueueService.getQueueStatus(player.id);
        const statusDuration = Date.now() - statusStartTime;
        
        // Measure task processing simulation
        const processStartTime = Date.now();
        let processedTasks = 0;
        const maxProcessTime = 5000; // 5 seconds max
        
        while (processedTasks < Math.min(5, queueSize) && (Date.now() - processStartTime) < maxProcessTime) {
          // Simulate task completion
          if (queueStatus.queuedTasks[processedTasks]) {
            await this.serverTaskQueueService.removeTask(player.id, queueStatus.queuedTasks[processedTasks].id);
            processedTasks++;
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const processDuration = Date.now() - processStartTime;
        
        processingResults.push({
          queueSize,
          addDuration,
          statusDuration,
          processDuration,
          processedTasks,
          avgAddTime: addDuration / queueSize,
          avgProcessTime: processedTasks > 0 ? processDuration / processedTasks : 0
        });
        
        // Clean up for next test
        await this.serverTaskQueueService.stopAllTasks(player.id);
      }
      
      // Analyze performance trends
      const avgAddTime = processingResults.reduce((sum, r) => sum + r.avgAddTime, 0) / processingResults.length;
      const avgStatusTime = processingResults.reduce((sum, r) => sum + r.statusDuration, 0) / processingResults.length;
      const avgProcessTime = processingResults.reduce((sum, r) => sum + r.avgProcessTime, 0) / processingResults.length;
      
      const performanceMetrics = {
        queueSizesTested: queueSizes,
        averageAddTime: avgAddTime,
        averageStatusTime: avgStatusTime,
        averageProcessTime: avgProcessTime,
        processingResults,
        addTimeAcceptable: avgAddTime <= 50, // 50ms per task
        statusTimeAcceptable: avgStatusTime <= 100, // 100ms for status
        processTimeAcceptable: avgProcessTime <= 1000 // 1s per task
      };
      
      const allCriteriaMet = performanceMetrics.addTimeAcceptable && 
                            performanceMetrics.statusTimeAcceptable && 
                            performanceMetrics.processTimeAcceptable;
      
      return {
        name: testName,
        status: allCriteriaMet ? 'PASSED' : 'FAILED',
        duration: Date.now() - startTime,
        details: `Queue processing: ${avgAddTime.toFixed(1)}ms add, ${avgStatusTime.toFixed(1)}ms status, ${avgProcessTime.toFixed(1)}ms process`,
        performanceMetrics
      };
      
    } catch (error) {
      return {
        name: testName,
        status: 'FAILED',
        duration: Date.now() - startTime,
        details: `Failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Test UI responsiveness under load
   */
  private async testUIResponsivenessUnderLoad(): Promise<PerformanceScenarioResult> {
    const startTime = Date.now();
    const testName = 'UI Responsiveness Under Load';
    
    try {
      const player = this.testDataGenerator.generateTestPlayer('CASUAL');
      
      // Create a large queue to stress the UI
      const largeQueueSize = 100;
      const tasks = [];
      
      for (let i = 0; i < largeQueueSize; i++) {
        tasks.push(this.testDataGenerator.generateTask(
          ['HARVESTING', 'CRAFTING', 'COMBAT'][i % 3] as any
        ));
      }
      
      // Add tasks and measure UI update times
      const uiUpdateTimes = [];
      
      for (let i = 0; i < tasks.length; i += 10) {
        const batch = tasks.slice(i, i + 10);
        
        // Add batch of tasks
        const batchStartTime = Date.now();
        for (const task of batch) {
          await this.addTaskToService(player.id, task);
        }
        
        // Simulate UI update (queue status fetch + render time)
        const uiUpdateStartTime = Date.now();
        const queueStatus = await this.serverTaskQueueService.getQueueStatus(player.id);
        
        // Simulate rendering time based on queue size
        const renderTime = Math.min(queueStatus.queuedTasks.length * 2, 100); // Max 100ms render
        await new Promise(resolve => setTimeout(resolve, renderTime));
        
        const uiUpdateDuration = Date.now() - uiUpdateStartTime;
        uiUpdateTimes.push(uiUpdateDuration);
      }
      
      // Test rapid interactions
      const rapidInteractionTimes = [];
      for (let i = 0; i < 10; i++) {
        const interactionStartTime = Date.now();
        
        // Simulate rapid queue status checks
        await this.serverTaskQueueService.getQueueStatus(player.id);
        
        const interactionDuration = Date.now() - interactionStartTime;
        rapidInteractionTimes.push(interactionDuration);
        
        // Small delay between interactions
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Analyze UI performance
      const avgUIUpdateTime = uiUpdateTimes.reduce((sum, time) => sum + time, 0) / uiUpdateTimes.length;
      const maxUIUpdateTime = Math.max(...uiUpdateTimes);
      const avgInteractionTime = rapidInteractionTimes.reduce((sum, time) => sum + time, 0) / rapidInteractionTimes.length;
      
      const performanceMetrics = {
        largeQueueSize,
        uiUpdateCount: uiUpdateTimes.length,
        averageUIUpdateTime: avgUIUpdateTime,
        maxUIUpdateTime,
        averageInteractionTime: avgInteractionTime,
        uiResponsive: avgUIUpdateTime <= 200, // 200ms threshold
        interactionsResponsive: avgInteractionTime <= 100, // 100ms threshold
        noUIFreeze: maxUIUpdateTime <= 500 // No freeze longer than 500ms
      };
      
      const allCriteriaMet = performanceMetrics.uiResponsive && 
                            performanceMetrics.interactionsResponsive && 
                            performanceMetrics.noUIFreeze;
      
      return {
        name: testName,
        status: allCriteriaMet ? 'PASSED' : 'FAILED',
        duration: Date.now() - startTime,
        details: `UI responsiveness: ${avgUIUpdateTime.toFixed(1)}ms avg update, ${avgInteractionTime.toFixed(1)}ms avg interaction`,
        performanceMetrics
      };
      
    } catch (error) {
      return {
        name: testName,
        status: 'FAILED',
        duration: Date.now() - startTime,
        details: `Failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Test memory usage patterns over time
   */
  private async testMemoryUsagePatterns(): Promise<PerformanceScenarioResult> {
    const startTime = Date.now();
    const testName = 'Memory Usage Patterns';
    
    try {
      const initialMemory = process.memoryUsage();
      const memorySnapshots = [initialMemory];
      
      const player = this.testDataGenerator.generateTestPlayer('HARDCORE');
      
      // Simulate extended usage with memory monitoring
      const testDuration = 10000; // 10 seconds
      const snapshotInterval = 1000; // 1 second
      const testStartTime = Date.now();
      
      let operationCount = 0;
      
      const memoryMonitor = setInterval(() => {
        memorySnapshots.push(process.memoryUsage());
      }, snapshotInterval);
      
      // Perform continuous operations
      while ((Date.now() - testStartTime) < testDuration) {
        // Add tasks
        const task = this.testDataGenerator.generateTask(
          ['HARVESTING', 'CRAFTING', 'COMBAT'][operationCount % 3] as any
        );
        await this.addTaskToService(player.id, task);
        
        // Get status
        await this.serverTaskQueueService.getQueueStatus(player.id);
        
        // Occasionally remove tasks
        if (operationCount % 10 === 0) {
          await this.serverTaskQueueService.removeTask(player.id, task.id);
        }
        
        operationCount++;
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      clearInterval(memoryMonitor);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      memorySnapshots.push(finalMemory);
      
      // Analyze memory usage
      const heapUsages = memorySnapshots.map(m => m.heapUsed);
      const maxHeapUsage = Math.max(...heapUsages);
      const minHeapUsage = Math.min(...heapUsages);
      const avgHeapUsage = heapUsages.reduce((sum, usage) => sum + usage, 0) / heapUsages.length;
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      
      const performanceMetrics = {
        testDuration,
        operationCount,
        initialHeapUsage: initialMemory.heapUsed,
        finalHeapUsage: finalMemory.heapUsed,
        maxHeapUsage,
        minHeapUsage,
        averageHeapUsage: avgHeapUsage,
        memoryGrowth,
        memoryGrowthPerOperation: operationCount > 0 ? memoryGrowth / operationCount : 0,
        memoryStable: memoryGrowth < (10 * 1024 * 1024), // Less than 10MB growth
        noMemoryLeaks: (memoryGrowth / operationCount) < 1024 // Less than 1KB per operation
      };
      
      const memoryHealthy = performanceMetrics.memoryStable && performanceMetrics.noMemoryLeaks;
      
      return {
        name: testName,
        status: memoryHealthy ? 'PASSED' : 'FAILED',
        duration: Date.now() - startTime,
        details: `Memory usage: ${(memoryGrowth / 1024 / 1024).toFixed(1)}MB growth over ${operationCount} operations`,
        performanceMetrics
      };
      
    } catch (error) {
      return {
        name: testName,
        status: 'FAILED',
        duration: Date.now() - startTime,
        details: `Failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Test database performance under load
   */
  private async testDatabasePerformance(): Promise<PerformanceScenarioResult> {
    const startTime = Date.now();
    const testName = 'Database Performance';
    
    try {
      const players = this.testDataGenerator.generateTestPlayers(20);
      
      // Test database operations
      const dbOperationTimes = {
        writes: [] as number[],
        reads: [] as number[],
        updates: [] as number[],
        deletes: [] as number[]
      };
      
      // Test write performance
      for (const player of players) {
        const task = this.testDataGenerator.generateTask(TaskType.HARVESTING);
        
        const writeStartTime = Date.now();
        await this.addTaskToService(player.id, task);
        const writeDuration = Date.now() - writeStartTime;
        
        dbOperationTimes.writes.push(writeDuration);
      }
      
      // Test read performance
      for (const player of players) {
        const readStartTime = Date.now();
        await this.serverTaskQueueService.getQueueStatus(player.id);
        const readDuration = Date.now() - readStartTime;
        
        dbOperationTimes.reads.push(readDuration);
      }
      
      // Test update performance (task completion)
      for (let i = 0; i < Math.min(10, players.length); i++) {
        const player = players[i];
        const status = await this.serverTaskQueueService.getQueueStatus(player.id);
        
        if (status.queuedTasks.length > 0) {
          const updateStartTime = Date.now();
          await this.serverTaskQueueService.removeTask(player.id, status.queuedTasks[0].id);
          const updateDuration = Date.now() - updateStartTime;
          
          dbOperationTimes.updates.push(updateDuration);
        }
      }
      
      // Test delete performance
      for (let i = 0; i < Math.min(5, players.length); i++) {
        const player = players[i];
        const status = await this.serverTaskQueueService.getQueueStatus(player.id);
        
        if (status.queuedTasks.length > 0) {
          const deleteStartTime = Date.now();
          await this.serverTaskQueueService.removeTask(player.id, status.queuedTasks[0].id);
          const deleteDuration = Date.now() - deleteStartTime;
          
          dbOperationTimes.deletes.push(deleteDuration);
        }
      }
      
      // Calculate averages
      const avgWriteTime = dbOperationTimes.writes.reduce((sum, time) => sum + time, 0) / dbOperationTimes.writes.length;
      const avgReadTime = dbOperationTimes.reads.reduce((sum, time) => sum + time, 0) / dbOperationTimes.reads.length;
      const avgUpdateTime = dbOperationTimes.updates.length > 0 
        ? dbOperationTimes.updates.reduce((sum, time) => sum + time, 0) / dbOperationTimes.updates.length 
        : 0;
      const avgDeleteTime = dbOperationTimes.deletes.length > 0 
        ? dbOperationTimes.deletes.reduce((sum, time) => sum + time, 0) / dbOperationTimes.deletes.length 
        : 0;
      
      const performanceMetrics = {
        playersCount: players.length,
        averageWriteTime: avgWriteTime,
        averageReadTime: avgReadTime,
        averageUpdateTime: avgUpdateTime,
        averageDeleteTime: avgDeleteTime,
        writePerformanceGood: avgWriteTime <= 100, // 100ms threshold
        readPerformanceGood: avgReadTime <= 50, // 50ms threshold
        updatePerformanceGood: avgUpdateTime <= 100 || avgUpdateTime === 0,
        deletePerformanceGood: avgDeleteTime <= 100 || avgDeleteTime === 0
      };
      
      const allPerformanceGood = performanceMetrics.writePerformanceGood && 
                                performanceMetrics.readPerformanceGood && 
                                performanceMetrics.updatePerformanceGood && 
                                performanceMetrics.deletePerformanceGood;
      
      return {
        name: testName,
        status: allPerformanceGood ? 'PASSED' : 'FAILED',
        duration: Date.now() - startTime,
        details: `DB performance: ${avgWriteTime.toFixed(1)}ms write, ${avgReadTime.toFixed(1)}ms read, ${avgUpdateTime.toFixed(1)}ms update`,
        performanceMetrics
      };
      
    } catch (error) {
      return {
        name: testName,
        status: 'FAILED',
        duration: Date.now() - startTime,
        details: `Failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Test system scalability limits
   */
  private async testScalabilityLimits(): Promise<PerformanceScenarioResult> {
    const startTime = Date.now();
    const testName = 'Scalability Limits';
    
    try {
      // Test increasing load until performance degrades
      const scalabilityResults = [];
      const loadLevels = [10, 25, 50, 100];
      
      for (const loadLevel of loadLevels) {
        const players = this.testDataGenerator.generateTestPlayers(loadLevel);
        
        const loadTestStartTime = Date.now();
        const responseTimes = [];
        
        // Perform concurrent operations
        const promises = players.map(async (player) => {
          const operationStartTime = Date.now();
          
          // Add a task
          const task = this.testDataGenerator.generateTask(TaskType.HARVESTING);
          await this.addTaskToService(player.id, task);
          
          // Get status
          await this.serverTaskQueueService.getQueueStatus(player.id);
          
          const operationDuration = Date.now() - operationStartTime;
          return operationDuration;
        });
        
        try {
          const results = await Promise.all(promises);
          responseTimes.push(...results);
          
          const avgResponseTime = results.reduce((sum, time) => sum + time, 0) / results.length;
          const maxResponseTime = Math.max(...results);
          const loadTestDuration = Date.now() - loadTestStartTime;
          
          scalabilityResults.push({
            loadLevel,
            avgResponseTime,
            maxResponseTime,
            loadTestDuration,
            successfulOperations: results.length,
            throughput: results.length / (loadTestDuration / 1000)
          });
          
        } catch (error) {
          scalabilityResults.push({
            loadLevel,
            avgResponseTime: Infinity,
            maxResponseTime: Infinity,
            loadTestDuration: Date.now() - loadTestStartTime,
            successfulOperations: 0,
            throughput: 0,
            error: (error as Error).message
          });
        }
      }
      
      // Analyze scalability
      const successfulTests = scalabilityResults.filter(r => r.successfulOperations > 0);
      const maxSuccessfulLoad = successfulTests.length > 0 
        ? Math.max(...successfulTests.map(r => r.loadLevel)) 
        : 0;
      
      const performanceMetrics = {
        loadLevelsTested: loadLevels,
        maxSuccessfulLoad,
        scalabilityResults,
        linearScaling: this.checkLinearScaling(successfulTests),
        performanceDegradation: this.checkPerformanceDegradation(successfulTests),
        scalabilityGood: maxSuccessfulLoad >= 50 // Should handle at least 50 concurrent users
      };
      
      return {
        name: testName,
        status: performanceMetrics.scalabilityGood ? 'PASSED' : 'FAILED',
        duration: Date.now() - startTime,
        details: `Scalability: handled up to ${maxSuccessfulLoad} concurrent users successfully`,
        performanceMetrics
      };
      
    } catch (error) {
      return {
        name: testName,
        status: 'FAILED',
        duration: Date.now() - startTime,
        details: `Failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Check if performance scales linearly with load
   */
  private checkLinearScaling(results: any[]): boolean {
    if (results.length < 2) return false;
    
    // Simple check: response time shouldn't increase exponentially
    for (let i = 1; i < results.length; i++) {
      const prevResult = results[i - 1];
      const currentResult = results[i];
      
      const loadIncrease = currentResult.loadLevel / prevResult.loadLevel;
      const responseIncrease = currentResult.avgResponseTime / prevResult.avgResponseTime;
      
      // If response time increases more than 3x the load increase, scaling is poor
      if (responseIncrease > loadIncrease * 3) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Check for performance degradation patterns
   */
  private checkPerformanceDegradation(results: any[]): string {
    if (results.length < 2) return 'INSUFFICIENT_DATA';
    
    const lastResult = results[results.length - 1];
    const firstResult = results[0];
    
    const responseTimeIncrease = lastResult.avgResponseTime / firstResult.avgResponseTime;
    
    if (responseTimeIncrease < 2) return 'MINIMAL';
    if (responseTimeIncrease < 5) return 'MODERATE';
    return 'SIGNIFICANT';
  }

  /**
   * Helper method to add a task using the appropriate service method
   */
  private async addTaskToService(playerId: string, task: any): Promise<void> {
    const mockStats = this.createMockStats();
    
    switch (task.type) {
      case 'HARVESTING':
        const harvestingActivity = {
          id: 'test-activity',
          name: 'Test Activity',
          description: 'Test harvesting activity',
          category: HarvestingCategory.MECHANICAL,
          icon: '⛏️',
          baseTime: 30,
          energyCost: 10,
          requiredLevel: 1,
          statBonuses: { experience: 25 },
          dropTable: {
            guaranteed: [],
            common: [],
            uncommon: [],
            rare: [],
            legendary: []
          }
        };
        await this.serverTaskQueueService.addHarvestingTask(playerId, harvestingActivity, mockStats);
        break;
      case 'CRAFTING':
        const craftingRecipe = {
          recipeId: 'test-recipe',
          name: 'Test Recipe',
          description: 'Test crafting recipe',
          category: 'materials' as const,
          requiredSkill: 'clockmaking' as const,
          requiredLevel: 1,
          craftingTime: 60,
          materials: [],
          outputs: [],
          experienceGain: 50,
          steampunkTheme: {
            flavorText: 'A test recipe',
            visualDescription: 'Test crafting'
          }
        };
        await this.serverTaskQueueService.addCraftingTask(playerId, craftingRecipe, mockStats, 10, {});
        break;
      case 'COMBAT':
        const enemy = {
          enemyId: 'test-enemy',
          name: 'Test Enemy',
          description: 'Test combat enemy',
          type: 'automaton' as const,
          level: 1,
          stats: {
            health: 100,
            attack: 10,
            defense: 5,
            speed: 8,
            resistances: {},
            abilities: []
          },
          lootTable: [],
          experienceReward: 100,
          steampunkTheme: {
            appearance: 'Test automaton',
            backstory: 'Test enemy',
            combatStyle: 'Basic'
          }
        };
        const combatStats = { 
          health: 100, 
          maxHealth: 100, 
          attack: 10, 
          defense: 5, 
          speed: 8, 
          abilities: [] 
        };
        await this.serverTaskQueueService.addCombatTask(playerId, enemy, mockStats, 10, combatStats);
        break;
    }
  }

  private createMockStats() {
    return {
      strength: 10,
      dexterity: 10,
      intelligence: 10,
      vitality: 10,
      craftingSkills: {
        clockmaking: 5,
        engineering: 5,
        alchemy: 5,
        steamcraft: 5,
        level: 5,
        experience: 1000
      },
      harvestingSkills: {
        mining: 5,
        foraging: 5,
        salvaging: 5,
        crystal_extraction: 5,
        level: 5,
        experience: 1000
      },
      combatSkills: {
        melee: 5,
        ranged: 5,
        defense: 5,
        tactics: 5,
        level: 5,
        experience: 1000
      }
    };
  }
}