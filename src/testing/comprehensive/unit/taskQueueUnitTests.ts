/**
 * Comprehensive Unit Tests for Task Queue System
 * 
 * Tests all individual components and edge cases
 */

import { TestResults } from '../taskQueueTestSuite';
import { TaskValidationService } from '../../../services/taskValidation';
import { queueStateManager } from '../../../services/queueStateManager';
import { TaskUtils } from '../../../utils/taskUtils';
import { 
  Task, 
  TaskType, 
  TaskQueue,
  TaskValidationResult
} from '../../../types/taskQueue';
import { CharacterStats } from '../../../types/character';

export class TaskQueueUnitTests {
  private testResults: TestResults = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: 0,
    errors: []
  };

  async runAll(): Promise<TestResults> {
    console.log('🔬 Starting Unit Tests...');
    const startTime = Date.now();

    // Reset results
    this.testResults = {
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      errors: []
    };

    // Run all unit test categories
    await this.testTaskValidation();
    await this.testQueueStateManager();
    await this.testTaskUtils();
    await this.testTaskQueueOperations();
    await this.testEdgeCases();
    await this.testErrorHandling();
    await this.testPerformance();

    this.testResults.duration = Date.now() - startTime;
    return this.testResults;
  }

  /**
   * Test Task Validation Service
   */
  private async testTaskValidation(): Promise<void> {
    console.log('  Testing Task Validation...');

    // Test valid task validation
    await this.runTest('Valid harvesting task validation', async () => {
      const mockStats = this.createMockPlayerStats();
      const task = this.createMockHarvestingTask();
      
      const result = TaskValidationService.validateTask(
        task, 
        mockStats, 
        15, 
        { 'copper-ore': 10 }
      );
      
      if (!result.isValid) {
        throw new Error(`Expected valid task, got errors: ${JSON.stringify(result.errors)}`);
      }
    });

    // Test invalid task validation
    await this.runTest('Invalid task validation - insufficient level', async () => {
      const mockStats = this.createMockPlayerStats();
      const task = this.createMockHarvestingTask();
      task.prerequisites = [{
        type: 'level',
        requirement: 100,
        description: 'Requires level 100',
        isMet: false
      }];
      
      const result = TaskValidationService.validateTask(
        task, 
        mockStats, 
        15, 
        {}
      );
      
      if (result.isValid) {
        throw new Error('Expected invalid task due to level requirement');
      }
      
      if (!result.errors.some(e => e.code === 'INSUFFICIENT_LEVEL')) {
        throw new Error('Expected INSUFFICIENT_LEVEL error');
      }
    });

    // Test resource validation
    await this.runTest('Resource validation - insufficient materials', async () => {
      const mockStats = this.createMockPlayerStats();
      const task = this.createMockCraftingTask();
      
      const result = TaskValidationService.validateTask(
        task, 
        mockStats, 
        15, 
        {} // Empty inventory
      );
      
      if (result.isValid) {
        throw new Error('Expected invalid task due to missing materials');
      }
    });

    // Test queue validation
    await this.runTest('Queue size validation', async () => {
      const tasks = Array(60).fill(null).map(() => this.createMockHarvestingTask());
      
      const result = TaskValidationService.validateTaskQueue(
        tasks, 
        50, // Max size
        7 * 24 * 60 * 60 * 1000 // Max duration
      );
      
      if (result.isValid) {
        throw new Error('Expected invalid queue due to size limit');
      }
      
      if (!result.errors.some(e => e.code === 'QUEUE_SIZE_EXCEEDED')) {
        throw new Error('Expected QUEUE_SIZE_EXCEEDED error');
      }
    });

    // Test admin bypass
    await this.runTest('Admin validation bypass', async () => {
      const mockStats = this.createMockPlayerStats();
      const invalidTask = this.createMockHarvestingTask();
      invalidTask.duration = -100; // Invalid duration
      
      const adminOptions = TaskValidationService.createAdminValidationOptions('Testing');
      const result = TaskValidationService.validateTask(
        invalidTask, 
        mockStats, 
        15, 
        {},
        adminOptions
      );
      
      if (!result.isValid) {
        throw new Error('Expected admin bypass to allow invalid task');
      }
      
      if (!result.warnings.some(w => w.code === 'VALIDATION_BYPASSED')) {
        throw new Error('Expected VALIDATION_BYPASSED warning');
      }
    });
  }

  /**
   * Test Queue State Manager
   */
  private async testQueueStateManager(): Promise<void> {
    console.log('  Testing Queue State Manager...');

    // Test state validation
    await this.runTest('Queue state validation - valid state', async () => {
      const queue = this.createMockTaskQueue('player-123');
      
      const result = await queueStateManager.validateState(queue);
      
      if (!result.isValid) {
        throw new Error(`Expected valid state, got errors: ${JSON.stringify(result.errors)}`);
      }
      
      if (result.integrityScore < 0.8) {
        throw new Error(`Expected high integrity score, got ${result.integrityScore}`);
      }
    });

    // Test corrupted state detection
    await this.runTest('Queue state validation - corrupted checksum', async () => {
      const queue = this.createMockTaskQueue('player-123');
      queue.checksum = 'invalid-checksum';
      
      const result = await queueStateManager.validateState(queue);
      
      if (result.isValid) {
        throw new Error('Expected invalid state due to corrupted checksum');
      }
      
      if (!result.errors.some(e => e.code === 'CHECKSUM_MISMATCH')) {
        throw new Error('Expected CHECKSUM_MISMATCH error');
      }
    });

    // Test state repair
    await this.runTest('Queue state repair - negative statistics', async () => {
      const queue = this.createMockTaskQueue('player-123');
      queue.totalTasksCompleted = -5;
      queue.totalTimeSpent = -1000;
      
      // Mock database service for repair
      const mockDatabaseService = require('../../../services/databaseService');
      mockDatabaseService.DatabaseService.putItem = jest.fn().mockResolvedValue(undefined);
      
      const repairedQueue = await queueStateManager.repairState(queue);
      
      if (repairedQueue.totalTasksCompleted !== 0) {
        throw new Error('Expected negative tasks completed to be repaired to 0');
      }
      
      if (repairedQueue.totalTimeSpent !== 0) {
        throw new Error('Expected negative time spent to be repaired to 0');
      }
    });

    // Test snapshot creation
    await this.runTest('Queue snapshot creation', async () => {
      const queue = this.createMockTaskQueue('player-123');
      const task = this.createMockHarvestingTask();
      queue.currentTask = task;
      queue.queuedTasks = [this.createMockCraftingTask()];
      queue.isRunning = true;
      queue.totalTasksCompleted = 10;
      
      const snapshot = queueStateManager.createSnapshot(queue);
      
      if (snapshot.currentTaskId !== task.id) {
        throw new Error('Expected snapshot to capture current task ID');
      }
      
      if (snapshot.queuedTaskIds.length !== 1) {
        throw new Error('Expected snapshot to capture queued task IDs');
      }
      
      if (!snapshot.isRunning) {
        throw new Error('Expected snapshot to capture running state');
      }
      
      if (snapshot.totalTasksCompleted !== 10) {
        throw new Error('Expected snapshot to capture completed tasks count');
      }
    });
  }

  /**
   * Test Task Utils
   */
  private async testTaskUtils(): Promise<void> {
    console.log('  Testing Task Utils...');

    // Test task creation
    await this.runTest('Task creation - harvesting task', async () => {
      const mockStats = this.createMockPlayerStats();
      const mockActivity = this.createMockHarvestingActivity();
      
      const task = TaskUtils.createHarvestingTask(
        'player-123',
        mockActivity,
        mockStats,
        15
      );
      
      if (task.type !== TaskType.HARVESTING) {
        throw new Error('Expected harvesting task type');
      }
      
      if (task.playerId !== 'player-123') {
        throw new Error('Expected correct player ID');
      }
      
      if (!task.id) {
        throw new Error('Expected task to have an ID');
      }
      
      if (task.duration <= 0) {
        throw new Error('Expected positive task duration');
      }
    });

    // Test task duration calculation
    await this.runTest('Task duration calculation with bonuses', async () => {
      const mockStats = this.createMockPlayerStats();
      mockStats.harvestingSkills.level = 20; // High level for bonus
      const mockActivity = this.createMockHarvestingActivity();
      
      const task = TaskUtils.createHarvestingTask(
        'player-123',
        mockActivity,
        mockStats,
        20
      );
      
      // Duration should be reduced due to high skill level
      if (task.duration >= mockActivity.baseTime * 1000) {
        throw new Error('Expected duration to be reduced by skill bonus');
      }
    });

    // Test task validation during creation
    await this.runTest('Task creation with validation', async () => {
      const mockStats = this.createMockPlayerStats();
      const mockActivity = this.createMockHarvestingActivity();
      mockActivity.requiredLevel = 100; // Impossible level
      
      const task = TaskUtils.createHarvestingTask(
        'player-123',
        mockActivity,
        mockStats,
        15
      );
      
      if (task.isValid) {
        throw new Error('Expected task to be marked as invalid due to level requirement');
      }
      
      if (task.validationErrors.length === 0) {
        throw new Error('Expected validation errors to be recorded');
      }
    });
  }

  /**
   * Test Task Queue Operations
   */
  private async testTaskQueueOperations(): Promise<void> {
    console.log('  Testing Task Queue Operations...');

    // Test queue status calculation
    await this.runTest('Queue status calculation', async () => {
      const queue = this.createMockTaskQueue('player-123');
      const currentTask = this.createMockHarvestingTask();
      currentTask.progress = 0.5;
      currentTask.startTime = Date.now() - 15000; // Started 15 seconds ago
      currentTask.duration = 30000; // 30 second duration
      
      queue.currentTask = currentTask;
      queue.queuedTasks = [
        this.createMockCraftingTask(),
        this.createMockCombatTask()
      ];
      queue.isRunning = true;
      
      // Calculate status (this would normally be done by a service)
      const status = {
        currentTask: currentTask,
        queueLength: queue.queuedTasks.length,
        queuedTasks: queue.queuedTasks,
        isRunning: queue.isRunning,
        totalCompleted: queue.totalTasksCompleted,
        estimatedCompletionTime: currentTask.estimatedCompletion,
        totalQueueTime: queue.queuedTasks.reduce((sum, task) => sum + task.duration, 0)
      };
      
      if (status.queueLength !== 2) {
        throw new Error('Expected queue length of 2');
      }
      
      if (!status.isRunning) {
        throw new Error('Expected queue to be running');
      }
      
      if (status.totalQueueTime <= 0) {
        throw new Error('Expected positive total queue time');
      }
    });

    // Test queue statistics calculation
    await this.runTest('Queue statistics calculation', async () => {
      const queue = this.createMockTaskQueue('player-123');
      queue.totalTasksCompleted = 10;
      queue.totalTimeSpent = 300000; // 5 minutes
      
      const averageDuration = queue.totalTimeSpent / queue.totalTasksCompleted;
      const completionRate = queue.totalTasksCompleted / (queue.totalTasksCompleted + queue.queuedTasks.length);
      
      if (averageDuration !== 30000) {
        throw new Error(`Expected average duration of 30000ms, got ${averageDuration}`);
      }
      
      if (completionRate !== 1) {
        throw new Error(`Expected completion rate of 1, got ${completionRate}`);
      }
    });
  }

  /**
   * Test Edge Cases
   */
  private async testEdgeCases(): Promise<void> {
    console.log('  Testing Edge Cases...');

    // Test empty queue handling
    await this.runTest('Empty queue handling', async () => {
      const queue = this.createMockTaskQueue('player-123');
      queue.currentTask = null;
      queue.queuedTasks = [];
      
      const result = await queueStateManager.validateState(queue);
      
      if (!result.isValid) {
        throw new Error('Expected empty queue to be valid');
      }
    });

    // Test maximum queue size
    await this.runTest('Maximum queue size handling', async () => {
      const tasks = Array(1000).fill(null).map(() => this.createMockHarvestingTask());
      
      const result = TaskValidationService.validateTaskQueue(
        tasks,
        50, // Much smaller max size
        7 * 24 * 60 * 60 * 1000
      );
      
      if (result.isValid) {
        throw new Error('Expected queue to be invalid due to size');
      }
    });

    // Test task with zero duration
    await this.runTest('Zero duration task handling', async () => {
      const task = this.createMockHarvestingTask();
      task.duration = 0;
      
      const mockStats = this.createMockPlayerStats();
      const result = TaskValidationService.validateTask(
        task,
        mockStats,
        15,
        {}
      );
      
      if (result.isValid) {
        throw new Error('Expected zero duration task to be invalid');
      }
    });

    // Test task with negative progress
    await this.runTest('Negative progress handling', async () => {
      const task = this.createMockHarvestingTask();
      task.progress = -0.5;
      
      const mockStats = this.createMockPlayerStats();
      const result = TaskValidationService.validateTask(
        task,
        mockStats,
        15,
        {}
      );
      
      if (result.isValid) {
        throw new Error('Expected negative progress task to be invalid');
      }
    });

    // Test task with progress > 1
    await this.runTest('Over-progress handling', async () => {
      const task = this.createMockHarvestingTask();
      task.progress = 1.5;
      
      const mockStats = this.createMockPlayerStats();
      const result = TaskValidationService.validateTask(
        task,
        mockStats,
        15,
        {}
      );
      
      if (result.isValid) {
        throw new Error('Expected over-progress task to be invalid');
      }
    });
  }

  /**
   * Test Error Handling
   */
  private async testErrorHandling(): Promise<void> {
    console.log('  Testing Error Handling...');

    // Test null task validation
    await this.runTest('Null task validation', async () => {
      const mockStats = this.createMockPlayerStats();
      
      try {
        TaskValidationService.validateTask(
          null as any,
          mockStats,
          15,
          {}
        );
        throw new Error('Expected error for null task');
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes('null') && !error.message.includes('undefined')) {
          throw new Error('Expected null/undefined error');
        }
      }
    });

    // Test invalid player stats
    await this.runTest('Invalid player stats handling', async () => {
      const task = this.createMockHarvestingTask();
      
      try {
        TaskValidationService.validateTask(
          task,
          null as any,
          15,
          {}
        );
        throw new Error('Expected error for null stats');
      } catch (error) {
        if (!(error instanceof Error)) {
          throw new Error('Expected Error object');
        }
      }
    });

    // Test corrupted queue recovery
    await this.runTest('Corrupted queue recovery', async () => {
      const queue = this.createMockTaskQueue('player-123');
      queue.playerId = ''; // Corrupt player ID
      queue.checksum = 'invalid';
      queue.totalTasksCompleted = -10;
      
      // Mock database service
      const mockDatabaseService = require('../../../services/databaseService');
      mockDatabaseService.DatabaseService.putItem = jest.fn().mockResolvedValue(undefined);
      
      const repairedQueue = await queueStateManager.repairState(queue);
      
      if (!repairedQueue.playerId) {
        throw new Error('Expected player ID to be restored during repair');
      }
      
      if (repairedQueue.totalTasksCompleted < 0) {
        throw new Error('Expected negative stats to be repaired');
      }
    });
  }

  /**
   * Test Performance
   */
  private async testPerformance(): Promise<void> {
    console.log('  Testing Performance...');

    // Test large queue validation performance
    await this.runTest('Large queue validation performance', async () => {
      const startTime = Date.now();
      const tasks = Array(100).fill(null).map(() => this.createMockHarvestingTask());
      
      const result = TaskValidationService.validateTaskQueue(
        tasks,
        150,
        7 * 24 * 60 * 60 * 1000
      );
      
      const duration = Date.now() - startTime;
      
      if (duration > 1000) { // Should complete within 1 second
        throw new Error(`Queue validation took too long: ${duration}ms`);
      }
      
      if (!result.isValid && !result.errors.some(e => e.code === 'QUEUE_SIZE_EXCEEDED')) {
        // Should be valid or fail for expected reasons
        console.log('Queue validation result:', result);
      }
    });

    // Test checksum calculation performance
    await this.runTest('Checksum calculation performance', async () => {
      const queue = this.createMockTaskQueue('player-123');
      queue.queuedTasks = Array(50).fill(null).map(() => this.createMockHarvestingTask());
      
      const startTime = Date.now();
      
      // Calculate checksum multiple times
      for (let i = 0; i < 10; i++) {
        queueStateManager.createSnapshot(queue);
      }
      
      const duration = Date.now() - startTime;
      
      if (duration > 100) { // Should complete within 100ms
        throw new Error(`Checksum calculation took too long: ${duration}ms`);
      }
    });
  }

  /**
   * Helper method to run individual tests
   */
  private async runTest(testName: string, testFn: () => Promise<void>): Promise<void> {
    this.testResults.totalTests++;
    
    try {
      await testFn();
      this.testResults.passed++;
      console.log(`    ✅ ${testName}`);
    } catch (error) {
      this.testResults.failed++;
      this.testResults.errors?.push(error as Error);
      console.log(`    ❌ ${testName}: ${(error as Error).message}`);
    }
  }

  // Mock data creation helpers
  private createMockPlayerStats(): CharacterStats {
    return {
      strength: 10,
      dexterity: 15,
      intelligence: 20,
      vitality: 12,
      craftingSkills: {
        clockmaking: 5,
        engineering: 8,
        alchemy: 3,
        steamcraft: 6,
        level: 10,
        experience: 1500
      },
      harvestingSkills: {
        mining: 7,
        foraging: 9,
        salvaging: 4,
        crystal_extraction: 2,
        level: 8,
        experience: 1200
      },
      combatSkills: {
        melee: 6,
        ranged: 4,
        defense: 8,
        tactics: 5,
        level: 7,
        experience: 1000
      }
    };
  }

  private createMockHarvestingTask(): Task {
    return {
      id: `harvesting-${Date.now()}-${Math.random()}`,
      type: TaskType.HARVESTING,
      name: 'Mine Copper',
      description: 'Mining copper ore',
      icon: '⛏️',
      duration: 30000,
      startTime: Date.now(),
      playerId: 'player-123',
      activityData: {} as any,
      prerequisites: [],
      resourceRequirements: [],
      progress: 0,
      completed: false,
      rewards: [],
      priority: 5,
      estimatedCompletion: Date.now() + 30000,
      retryCount: 0,
      maxRetries: 3,
      isValid: true,
      validationErrors: []
    };
  }

  private createMockCraftingTask(): Task {
    return {
      id: `crafting-${Date.now()}-${Math.random()}`,
      type: TaskType.CRAFTING,
      name: 'Craft Sword',
      description: 'Crafting a steel sword',
      icon: '⚔️',
      duration: 60000,
      startTime: 0,
      playerId: 'player-123',
      activityData: {} as any,
      prerequisites: [],
      resourceRequirements: [{
        resourceId: 'steel-ingot',
        resourceName: 'Steel Ingot',
        quantityRequired: 2,
        quantityAvailable: 0,
        isSufficient: false
      }],
      progress: 0,
      completed: false,
      rewards: [],
      priority: 5,
      estimatedCompletion: Date.now() + 60000,
      retryCount: 0,
      maxRetries: 3,
      isValid: true,
      validationErrors: []
    };
  }

  private createMockCombatTask(): Task {
    return {
      id: `combat-${Date.now()}-${Math.random()}`,
      type: TaskType.COMBAT,
      name: 'Fight Goblin',
      description: 'Combat with a goblin',
      icon: '⚔️',
      duration: 45000,
      startTime: 0,
      playerId: 'player-123',
      activityData: {} as any,
      prerequisites: [],
      resourceRequirements: [],
      progress: 0,
      completed: false,
      rewards: [],
      priority: 5,
      estimatedCompletion: Date.now() + 45000,
      retryCount: 0,
      maxRetries: 3,
      isValid: true,
      validationErrors: []
    };
  }

  private createMockTaskQueue(playerId: string): TaskQueue {
    const now = Date.now();
    return {
      playerId,
      currentTask: null,
      queuedTasks: [],
      isRunning: false,
      isPaused: false,
      canResume: true,
      totalTasksCompleted: 0,
      totalTimeSpent: 0,
      totalRewardsEarned: [],
      averageTaskDuration: 0,
      taskCompletionRate: 0,
      queueEfficiencyScore: 0,
      config: {
        maxQueueSize: 50,
        maxTaskDuration: 86400000,
        maxTotalQueueDuration: 604800000,
        autoStart: true,
        priorityHandling: false,
        retryEnabled: true,
        maxRetries: 3,
        validationEnabled: true,
        syncInterval: 5000,
        offlineProcessingEnabled: true,
        pauseOnError: true,
        resumeOnResourceAvailable: true,
        persistenceInterval: 30000,
        integrityCheckInterval: 300000,
        maxHistorySize: 10,
      },
      lastUpdated: now,
      lastSynced: now,
      createdAt: now,
      version: 1,
      checksum: 'mock-checksum',
      lastValidated: now,
      stateHistory: [],
      maxHistorySize: 10,
    };
  }

  private createMockHarvestingActivity() {
    return {
      id: 'copper-mining',
      name: 'Copper Mining',
      description: 'Extract copper ore',
      category: 'metallurgical' as any,
      icon: '⛏️',
      baseTime: 30,
      energyCost: 10,
      requiredLevel: 5,
      requiredStats: {
        strength: 8,
        dexterity: 5
      },
      statBonuses: {
        strength: 1,
        experience: 25
      },
      dropTable: {
        guaranteed: [],
        common: [],
        uncommon: [],
        rare: [],
        legendary: []
      }
    };
  }
}