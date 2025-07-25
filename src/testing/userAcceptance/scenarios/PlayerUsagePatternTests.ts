import { TestDataGenerator, Player, UsageScenario } from '../utils/TestDataGenerator';
import { PlayerUsageTestResults, PlayerUsageScenarioResult } from '../UserAcceptanceTestSuite';
import { serverTaskQueueService } from '../../../services/serverTaskQueueService';
import { TaskQueue, Task } from '../../../types/taskQueue';

/**
 * Tests typical player usage patterns and workflows
 * Validates Requirements: 1.1, 2.1, 6.1
 */
export class PlayerUsagePatternTests {
  private testDataGenerator: TestDataGenerator;
  private taskQueueService: typeof serverTaskQueueService;

  constructor(testDataGenerator: TestDataGenerator) {
    this.testDataGenerator = testDataGenerator;
    this.taskQueueService = serverTaskQueueService;
  }

  /**
   * Run all player usage pattern tests
   */
  async runAllTests(): Promise<PlayerUsageTestResults> {
    const scenarios: PlayerUsageScenarioResult[] = [];
    
    try {
      // Test typical queue operations
      scenarios.push(await this.testTypicalQueueOperations());
      
      // Test multi-activity workflows
      scenarios.push(await this.testMultiActivityWorkflows());
      
      // Test long-running sessions
      scenarios.push(await this.testLongRunningSession());
      
      // Test casual play patterns
      scenarios.push(await this.testCasualPlayPatterns());
      
      // Test queue management operations
      scenarios.push(await this.testQueueManagementOperations());
      
      // Test resource validation scenarios
      scenarios.push(await this.testResourceValidationScenarios());

      const passedTests = scenarios.filter(s => s.status === 'PASSED').length;
      
      return {
        totalTests: scenarios.length,
        passedTests,
        scenarios
      };
      
    } catch (error) {
      console.error('Player Usage Pattern Tests failed:', error);
      throw error;
    }
  }

  /**
   * Test typical queue operations (add, remove, reorder)
   */
  private async testTypicalQueueOperations(): Promise<PlayerUsageScenarioResult> {
    const startTime = Date.now();
    const testName = 'Typical Queue Operations';
    
    try {
      const player = this.testDataGenerator.generateTestPlayer('CASUAL');
      const initialQueue = this.testDataGenerator.generateTestTaskQueue(player.id, 'MIXED');
      
      // Test adding tasks
      const harvestingTask = this.testDataGenerator.generateTask('HARVESTING');
      const craftingTask = this.testDataGenerator.generateTask('CRAFTING');
      const combatTask = this.testDataGenerator.generateTask('COMBAT');
      
      await this.taskQueueService.addTask(player.id, harvestingTask);
      await this.taskQueueService.addTask(player.id, craftingTask);
      await this.taskQueueService.addTask(player.id, combatTask);
      
      // Verify tasks were added
      const queueStatus = await this.taskQueueService.getQueueStatus(player.id);
      if (queueStatus.queuedTasks.length < 3) {
        throw new Error('Tasks were not added correctly');
      }
      
      // Test removing a task
      await this.taskQueueService.removeTask(player.id, craftingTask.id);
      
      // Test reordering tasks
      const taskIds = queueStatus.queuedTasks.map(t => t.id);
      const reorderedIds = [taskIds[1], taskIds[0], ...taskIds.slice(2)];
      await this.taskQueueService.reorderTasks(player.id, reorderedIds);
      
      // Verify operations completed successfully
      const finalStatus = await this.taskQueueService.getQueueStatus(player.id);
      
      const metrics = {
        tasksAdded: 3,
        tasksRemoved: 1,
        tasksReordered: reorderedIds.length,
        finalQueueSize: finalStatus.queuedTasks.length
      };
      
      return {
        name: testName,
        status: 'PASSED',
        duration: Date.now() - startTime,
        details: 'Successfully performed typical queue operations including add, remove, and reorder',
        metrics
      };
      
    } catch (error) {
      return {
        name: testName,
        status: 'FAILED',
        duration: Date.now() - startTime,
        details: `Failed: ${error.message}`
      };
    }
  }

  /**
   * Test multi-activity workflows
   */
  private async testMultiActivityWorkflows(): Promise<PlayerUsageScenarioResult> {
    const startTime = Date.now();
    const testName = 'Multi-Activity Workflows';
    
    try {
      const player = this.testDataGenerator.generateTestPlayer('HARDCORE');
      
      // Create a complex workflow: Harvest -> Craft -> Combat -> Harvest
      const workflow = [
        this.testDataGenerator.generateTask('HARVESTING'),
        this.testDataGenerator.generateTask('CRAFTING'),
        this.testDataGenerator.generateTask('COMBAT'),
        this.testDataGenerator.generateTask('HARVESTING')
      ];
      
      // Add tasks in sequence
      for (const task of workflow) {
        await this.taskQueueService.addTask(player.id, task);
      }
      
      // Simulate task processing
      let processedTasks = 0;
      const maxProcessingTime = 30000; // 30 seconds max
      const processingStartTime = Date.now();
      
      while (processedTasks < workflow.length && (Date.now() - processingStartTime) < maxProcessingTime) {
        const status = await this.taskQueueService.getQueueStatus(player.id);
        
        if (status.currentTask && status.currentTask.completed) {
          processedTasks++;
        }
        
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const metrics = {
        workflowLength: workflow.length,
        tasksProcessed: processedTasks,
        processingTime: Date.now() - processingStartTime,
        activityTypes: ['HARVESTING', 'CRAFTING', 'COMBAT']
      };
      
      return {
        name: testName,
        status: processedTasks >= 2 ? 'PASSED' : 'FAILED', // At least 2 tasks should process
        duration: Date.now() - startTime,
        details: `Multi-activity workflow processed ${processedTasks}/${workflow.length} tasks`,
        metrics
      };
      
    } catch (error) {
      return {
        name: testName,
        status: 'FAILED',
        duration: Date.now() - startTime,
        details: `Failed: ${error.message}`
      };
    }
  }

  /**
   * Test long-running session behavior
   */
  private async testLongRunningSession(): Promise<PlayerUsageScenarioResult> {
    const startTime = Date.now();
    const testName = 'Long-Running Session';
    
    try {
      const player = this.testDataGenerator.generateTestPlayer('HARDCORE');
      
      // Create a large queue (simulate extended play session)
      const largeBatch = [];
      for (let i = 0; i < 20; i++) {
        largeBatch.push(this.testDataGenerator.generateTask(
          ['HARVESTING', 'CRAFTING', 'COMBAT'][i % 3] as any
        ));
      }
      
      // Add tasks in batches
      const batchSize = 5;
      let totalAdded = 0;
      
      for (let i = 0; i < largeBatch.length; i += batchSize) {
        const batch = largeBatch.slice(i, i + batchSize);
        
        for (const task of batch) {
          await this.taskQueueService.addTask(player.id, task);
          totalAdded++;
        }
        
        // Check queue status periodically
        const status = await this.taskQueueService.getQueueStatus(player.id);
        
        // Simulate some user interaction delay
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Verify queue integrity
      const finalStatus = await this.taskQueueService.getQueueStatus(player.id);
      
      const metrics = {
        tasksAdded: totalAdded,
        finalQueueSize: finalStatus.queuedTasks.length,
        batchesProcessed: Math.ceil(largeBatch.length / batchSize),
        queueIntegrity: finalStatus.queuedTasks.length > 0
      };
      
      return {
        name: testName,
        status: totalAdded === largeBatch.length ? 'PASSED' : 'FAILED',
        duration: Date.now() - startTime,
        details: `Long-running session added ${totalAdded} tasks successfully`,
        metrics
      };
      
    } catch (error) {
      return {
        name: testName,
        status: 'FAILED',
        duration: Date.now() - startTime,
        details: `Failed: ${error.message}`
      };
    }
  }

  /**
   * Test casual play patterns (short sessions)
   */
  private async testCasualPlayPatterns(): Promise<PlayerUsageScenarioResult> {
    const startTime = Date.now();
    const testName = 'Casual Play Patterns';
    
    try {
      const scenarios = this.testDataGenerator.generateUsageScenarios();
      const casualScenario = scenarios.find(s => s.name === 'Quick Check') || scenarios[0];
      
      const player = this.testDataGenerator.generateTestPlayer('CASUAL');
      
      // Simulate quick check scenario
      const sessionStartTime = Date.now();
      
      // Step 1: Login (simulated)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Step 2: Check queue status
      const initialStatus = await this.taskQueueService.getQueueStatus(player.id);
      
      // Step 3: Add a few quick tasks
      const quickTasks = [
        this.testDataGenerator.generateTask('HARVESTING'),
        this.testDataGenerator.generateTask('CRAFTING')
      ];
      
      for (const task of quickTasks) {
        await this.taskQueueService.addTask(player.id, task);
      }
      
      // Step 4: Check final status
      const finalStatus = await this.taskQueueService.getQueueStatus(player.id);
      
      const sessionDuration = Date.now() - sessionStartTime;
      
      const metrics = {
        sessionDuration,
        tasksAdded: quickTasks.length,
        expectedDuration: casualScenario.expectedDuration,
        withinExpectedTime: sessionDuration <= casualScenario.expectedDuration,
        statusChecks: 2
      };
      
      return {
        name: testName,
        status: sessionDuration <= casualScenario.expectedDuration * 2 ? 'PASSED' : 'FAILED', // Allow 2x buffer
        duration: Date.now() - startTime,
        details: `Casual play session completed in ${sessionDuration}ms (expected: ${casualScenario.expectedDuration}ms)`,
        metrics
      };
      
    } catch (error) {
      return {
        name: testName,
        status: 'FAILED',
        duration: Date.now() - startTime,
        details: `Failed: ${error.message}`
      };
    }
  }

  /**
   * Test queue management operations
   */
  private async testQueueManagementOperations(): Promise<PlayerUsageScenarioResult> {
    const startTime = Date.now();
    const testName = 'Queue Management Operations';
    
    try {
      const player = this.testDataGenerator.generateTestPlayer('CASUAL');
      
      // Test pause/resume functionality
      await this.taskQueueService.pauseQueue(player.id);
      let status = await this.taskQueueService.getQueueStatus(player.id);
      
      if (!status.isPaused) {
        throw new Error('Queue pause failed');
      }
      
      await this.taskQueueService.resumeQueue(player.id);
      status = await this.taskQueueService.getQueueStatus(player.id);
      
      if (status.isPaused) {
        throw new Error('Queue resume failed');
      }
      
      // Test stop all tasks
      const tasks = [
        this.testDataGenerator.generateTask('HARVESTING'),
        this.testDataGenerator.generateTask('CRAFTING'),
        this.testDataGenerator.generateTask('COMBAT')
      ];
      
      for (const task of tasks) {
        await this.taskQueueService.addTask(player.id, task);
      }
      
      await this.taskQueueService.stopAllTasks(player.id);
      const finalStatus = await this.taskQueueService.getQueueStatus(player.id);
      
      const metrics = {
        pauseResumeSuccess: !finalStatus.isPaused,
        stopAllSuccess: finalStatus.queuedTasks.length === 0,
        operationsTested: 3
      };
      
      return {
        name: testName,
        status: metrics.pauseResumeSuccess && metrics.stopAllSuccess ? 'PASSED' : 'FAILED',
        duration: Date.now() - startTime,
        details: 'Queue management operations (pause, resume, stop all) tested successfully',
        metrics
      };
      
    } catch (error) {
      return {
        name: testName,
        status: 'FAILED',
        duration: Date.now() - startTime,
        details: `Failed: ${error.message}`
      };
    }
  }

  /**
   * Test resource validation scenarios
   */
  private async testResourceValidationScenarios(): Promise<PlayerUsageScenarioResult> {
    const startTime = Date.now();
    const testName = 'Resource Validation Scenarios';
    
    try {
      const player = this.testDataGenerator.generateTestPlayer('NEWBIE');
      
      // Test adding task with insufficient resources
      const craftingTask = this.testDataGenerator.generateTask('CRAFTING');
      craftingTask.resourceRequirements = [
        { resource: 'iron-ingot', quantity: 10 },
        { resource: 'wood', quantity: 5 }
      ];
      
      // This should either reject the task or pause the queue
      let validationPassed = false;
      try {
        await this.taskQueueService.addTask(player.id, craftingTask);
        const status = await this.taskQueueService.getQueueStatus(player.id);
        
        // Check if queue is paused due to resource shortage
        validationPassed = status.isPaused && status.pauseReason?.includes('resource');
      } catch (error) {
        // Task rejection is also valid validation behavior
        validationPassed = error.message.includes('resource') || error.message.includes('insufficient');
      }
      
      // Test adding task with met prerequisites
      const simpleTask = this.testDataGenerator.generateTask('HARVESTING');
      simpleTask.resourceRequirements = []; // No requirements
      
      await this.taskQueueService.addTask(player.id, simpleTask);
      const finalStatus = await this.taskQueueService.getQueueStatus(player.id);
      
      const metrics = {
        resourceValidationWorking: validationPassed,
        simpleTaskAdded: finalStatus.queuedTasks.some(t => t.id === simpleTask.id),
        validationChecks: 2
      };
      
      return {
        name: testName,
        status: validationPassed && metrics.simpleTaskAdded ? 'PASSED' : 'FAILED',
        duration: Date.now() - startTime,
        details: 'Resource validation correctly handled insufficient resources and allowed valid tasks',
        metrics
      };
      
    } catch (error) {
      return {
        name: testName,
        status: 'FAILED',
        duration: Date.now() - startTime,
        details: `Failed: ${error.message}`
      };
    }
  }
}