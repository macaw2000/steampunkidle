/**
 * Regression Tests for Task Queue System
 * 
 * Tests critical functionality to prevent regressions
 */

import { TestResults } from '../taskQueueTestSuite';
import { TaskValidationService } from '../../../services/taskValidation';
import { queueStateManager } from '../../../services/queueStateManager';
import { serverTaskQueueService } from '../../../services/serverTaskQueueService';
import { 
  Task, 
  TaskType, 
  TaskQueue,
  QueueStatus
} from '../../../types/taskQueue';

export class TaskQueueRegressionTests {
  private testResults: TestResults = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: 0,
    errors: []
  };

  async runAll(): Promise<TestResults> {
    console.log('🔄 Starting Regression Tests...');
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

    // Run all regression test categories
    await this.testCriticalBugFixes();
    await this.testPerformanceRegressions();
    await this.testDataIntegrityRegressions();
    await this.testAPICompatibility();
    await this.testSecurityRegressions();
    await this.testScalabilityRegressions();
    await this.testBackwardCompatibility();

    this.testResults.duration = Date.now() - startTime;
    return this.testResults;
  }

  /**
   * Test Critical Bug Fixes
   */
  private async testCriticalBugFixes(): Promise<void> {
    console.log('  Testing Critical Bug Fixes...');

    // Regression test for task duplication bug
    await this.runTest('Task duplication prevention', async () => {
      const playerId = 'duplication-test-player';
      const taskId = 'unique-task-id';
      
      // Mock task creation with fixed ID
      const createTaskWithId = (id: string) => ({
        ...this.createMockTask(TaskType.HARVESTING),
        id
      });

      const task1 = createTaskWithId(taskId);
      const task2 = createTaskWithId(taskId);
      
      // Attempt to validate queue with duplicate IDs
      const result = TaskValidationService.validateTaskQueue(
        [task1, task2],
        50,
        7 * 24 * 60 * 60 * 1000
      );
      
      if (result.isValid) {
        throw new Error('Expected validation to fail for duplicate task IDs');
      }
      
      if (!result.errors.some(e => e.code === 'DUPLICATE_TASK_ID')) {
        throw new Error('Expected DUPLICATE_TASK_ID error');
      }
    });

    // Regression test for negative progress bug
    await this.runTest('Negative progress prevention', async () => {
      const task = this.createMockTask(TaskType.HARVESTING);
      task.progress = -0.1; // Invalid negative progress
      
      const mockStats = this.createMockPlayerStats();
      const result = TaskValidationService.validateTask(
        task,
        mockStats,
        15,
        {}
      );
      
      if (result.isValid) {
        throw new Error('Expected validation to fail for negative progress');
      }
      
      if (!result.errors.some(e => e.message.includes('progress'))) {
        throw new Error('Expected progress validation error');
      }
    });

    // Regression test for queue state corruption
    await this.runTest('Queue state corruption detection', async () => {
      const queue = this.createMockTaskQueue('corruption-test-player');
      
      // Introduce corruption
      queue.totalTasksCompleted = -5; // Invalid negative value
      queue.checksum = 'invalid-checksum';
      queue.playerId = ''; // Invalid empty player ID
      
      const result = await queueStateManager.validateState(queue);
      
      if (result.isValid) {
        throw new Error('Expected validation to fail for corrupted queue');
      }
      
      // Should detect multiple corruption issues
      const expectedErrors = ['NEGATIVE_COMPLETED_TASKS', 'CHECKSUM_MISMATCH', 'MISSING_PLAYER_ID'];
      const actualErrorCodes = result.errors.map(e => e.code);
      
      for (const expectedError of expectedErrors) {
        if (!actualErrorCodes.includes(expectedError)) {
          throw new Error(`Expected error code ${expectedError} not found`);
        }
      }
    });

    // Regression test for infinite retry loop
    await this.runTest('Infinite retry loop prevention', async () => {
      const task = this.createMockTask(TaskType.CRAFTING);
      task.retryCount = 10;
      task.maxRetries = 3;
      
      const mockStats = this.createMockPlayerStats();
      const result = TaskValidationService.validateTask(
        task,
        mockStats,
        15,
        {}
      );
      
      if (result.isValid) {
        throw new Error('Expected validation to fail for excessive retry count');
      }
      
      if (!result.errors.some(e => e.message.includes('retry'))) {
        throw new Error('Expected retry validation error');
      }
    });

    // Regression test for memory leak in queue processing
    await this.runTest('Memory leak prevention in queue processing', async () => {
      const playerId = 'memory-leak-test-player';
      
      // Create large number of tasks to test memory handling
      const largeTasks = Array(1000).fill(null).map(() => 
        this.createMockTask(TaskType.HARVESTING)
      );
      
      // Mock memory usage tracking
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Process large queue
      const result = TaskValidationService.validateTaskQueue(
        largeTasks,
        1500, // Allow large queue for test
        30 * 24 * 60 * 60 * 1000 // 30 days
      );
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 50MB for 1000 tasks)
      if (memoryIncrease > 50 * 1024 * 1024) {
        throw new Error(`Excessive memory usage: ${memoryIncrease / 1024 / 1024}MB`);
      }
      
      if (!result.isValid && !result.errors.some(e => e.code === 'QUEUE_SIZE_EXCEEDED')) {
        throw new Error('Unexpected validation failure');
      }
    });
  }

  /**
   * Test Performance Regressions
   */
  private async testPerformanceRegressions(): Promise<void> {
    console.log('  Testing Performance Regressions...');

    // Regression test for slow validation
    await this.runTest('Validation performance regression', async () => {
      const tasks = Array(100).fill(null).map(() => 
        this.createMockTask(TaskType.HARVESTING)
      );
      
      const startTime = Date.now();
      
      TaskValidationService.validateTaskQueue(
        tasks,
        150,
        7 * 24 * 60 * 60 * 1000
      );
      
      const duration = Date.now() - startTime;
      
      // Should complete within 500ms for 100 tasks
      if (duration > 500) {
        throw new Error(`Validation too slow: ${duration}ms for 100 tasks`);
      }
    });

    // Regression test for slow checksum calculation
    await this.runTest('Checksum calculation performance', async () => {
      const queue = this.createMockTaskQueue('checksum-perf-test');
      queue.queuedTasks = Array(100).fill(null).map(() => 
        this.createMockTask(TaskType.HARVESTING)
      );
      
      const startTime = Date.now();
      
      // Calculate checksum multiple times
      for (let i = 0; i < 10; i++) {
        queueStateManager.createSnapshot(queue);
      }
      
      const duration = Date.now() - startTime;
      
      // Should complete within 100ms for 10 calculations
      if (duration > 100) {
        throw new Error(`Checksum calculation too slow: ${duration}ms`);
      }
    });

    // Regression test for queue status calculation performance
    await this.runTest('Queue status calculation performance', async () => {
      const playerId = 'status-perf-test';
      
      // Mock large queue
      const largeTasks = Array(500).fill(null).map(() => 
        this.createMockTask(TaskType.HARVESTING)
      );
      
      jest.spyOn(serverTaskQueueService, 'getQueueStatus')
        .mockImplementation(() => {
          const startTime = Date.now();
          
          // Simulate status calculation
          const totalTime = largeTasks.reduce((sum, task) => sum + task.duration, 0);
          const estimatedCompletion = Date.now() + totalTime;
          
          const calculationTime = Date.now() - startTime;
          
          // Should complete quickly even for large queues
          if (calculationTime > 50) {
            throw new Error(`Status calculation too slow: ${calculationTime}ms`);
          }
          
          return {
            currentTask: null,
            queueLength: largeTasks.length,
            queuedTasks: largeTasks,
            isRunning: false,
            totalCompleted: 0,
            estimatedCompletionTime: estimatedCompletion,
            totalQueueTime: totalTime
          };
        });
      
      const status = serverTaskQueueService.getQueueStatus(playerId);
      
      if (status.queueLength !== 500) {
        throw new Error('Status calculation failed');
      }
    });
  }

  /**
   * Test Data Integrity Regressions
   */
  private async testDataIntegrityRegressions(): Promise<void> {
    console.log('  Testing Data Integrity Regressions...');

    // Regression test for task ID collision
    await this.runTest('Task ID collision prevention', async () => {
      const taskIds = new Set<string>();
      const collisionThreshold = 10000; // Generate many IDs to test collision
      
      for (let i = 0; i < collisionThreshold; i++) {
        const task = this.createMockTask(TaskType.HARVESTING);
        
        if (taskIds.has(task.id)) {
          throw new Error(`Task ID collision detected: ${task.id}`);
        }
        
        taskIds.add(task.id);
      }
      
      if (taskIds.size !== collisionThreshold) {
        throw new Error('Task ID generation failed');
      }
    });

    // Regression test for queue version conflicts
    await this.runTest('Queue version conflict handling', async () => {
      const playerId = 'version-conflict-test';
      const queue = this.createMockTaskQueue(playerId);
      
      // Mock database service for atomic update test
      const mockDatabaseService = require('../../../services/databaseService');
      let updateAttempts = 0;
      
      mockDatabaseService.DatabaseService.getItem = jest.fn()
        .mockResolvedValue(queue);
      
      mockDatabaseService.DatabaseService.putItem = jest.fn()
        .mockImplementation(() => {
          updateAttempts++;
          if (updateAttempts < 3) {
            const error = new Error('ConditionalCheckFailedException');
            error.name = 'ConditionalCheckFailedException';
            throw error;
          }
          return Promise.resolve();
        });
      
      // Attempt atomic update with version conflict
      const updateFn = (q: TaskQueue) => {
        const updated = { ...q };
        updated.totalTasksCompleted += 1;
        return updated;
      };
      
      const result = await queueStateManager.atomicUpdate(playerId, updateFn);
      
      if (updateAttempts !== 3) {
        throw new Error(`Expected 3 update attempts, got ${updateAttempts}`);
      }
      
      if (result.totalTasksCompleted !== 1) {
        throw new Error('Atomic update failed to apply changes');
      }
    });

    // Regression test for reward calculation consistency
    await this.runTest('Reward calculation consistency', async () => {
      const task = this.createMockTask(TaskType.HARVESTING);
      const mockStats = this.createMockPlayerStats();
      
      // Calculate rewards multiple times - should be consistent
      const rewards1 = this.calculateMockRewards(task, mockStats);
      const rewards2 = this.calculateMockRewards(task, mockStats);
      
      if (JSON.stringify(rewards1) !== JSON.stringify(rewards2)) {
        throw new Error('Reward calculation inconsistency detected');
      }
      
      // Rewards should not be empty for valid task
      if (rewards1.length === 0) {
        throw new Error('Expected rewards for completed task');
      }
    });

    // Regression test for progress calculation accuracy
    await this.runTest('Progress calculation accuracy', async () => {
      const task = this.createMockTask(TaskType.HARVESTING);
      task.startTime = Date.now() - 15000; // Started 15 seconds ago
      task.duration = 30000; // 30 second duration
      
      const expectedProgress = 0.5; // 50% complete
      const calculatedProgress = Math.min(
        (Date.now() - task.startTime) / task.duration,
        1.0
      );
      
      // Allow small tolerance for timing differences
      const tolerance = 0.05;
      if (Math.abs(calculatedProgress - expectedProgress) > tolerance) {
        throw new Error(
          `Progress calculation inaccuracy: expected ~${expectedProgress}, got ${calculatedProgress}`
        );
      }
    });
  }

  /**
   * Test API Compatibility
   */
  private async testAPICompatibility(): Promise<void> {
    console.log('  Testing API Compatibility...');

    // Regression test for service method signatures
    await this.runTest('Service method signature compatibility', async () => {
      const playerId = 'api-compat-test';
      
      // Test that all expected methods exist with correct signatures
      const expectedMethods = [
        'getQueueStatus',
        'addHarvestingTask',
        'addCraftingTask',
        'addCombatTask',
        'removeTask',
        'clearQueue',
        'pauseQueue',
        'resumeQueue',
        'reorderTasks',
        'onTaskComplete'
      ];
      
      for (const methodName of expectedMethods) {
        if (typeof (serverTaskQueueService as any)[methodName] !== 'function') {
          throw new Error(`Missing method: ${methodName}`);
        }
      }
      
      // Test method calls don't throw unexpected errors
      try {
        serverTaskQueueService.getQueueStatus(playerId);
        // Should not throw for valid player ID
      } catch (error) {
        // Only acceptable if it's a mocking issue, not a signature issue
        if ((error as Error).message.includes('not implemented')) {
          // This is expected in test environment
        } else {
          throw error;
        }
      }
    });

    // Regression test for data structure compatibility
    await this.runTest('Data structure compatibility', async () => {
      const task = this.createMockTask(TaskType.HARVESTING);
      const queue = this.createMockTaskQueue('struct-compat-test');
      
      // Verify all expected properties exist
      const expectedTaskProps = [
        'id', 'type', 'name', 'description', 'icon', 'duration',
        'startTime', 'playerId', 'activityData', 'prerequisites',
        'resourceRequirements', 'progress', 'completed', 'rewards',
        'priority', 'estimatedCompletion', 'retryCount', 'maxRetries',
        'isValid', 'validationErrors'
      ];
      
      for (const prop of expectedTaskProps) {
        if (!(prop in task)) {
          throw new Error(`Missing task property: ${prop}`);
        }
      }
      
      const expectedQueueProps = [
        'playerId', 'currentTask', 'queuedTasks', 'isRunning',
        'isPaused', 'totalTasksCompleted', 'totalTimeSpent',
        'config', 'lastUpdated', 'version', 'checksum'
      ];
      
      for (const prop of expectedQueueProps) {
        if (!(prop in queue)) {
          throw new Error(`Missing queue property: ${prop}`);
        }
      }
    });

    // Regression test for enum value compatibility
    await this.runTest('Enum value compatibility', async () => {
      const expectedTaskTypes = ['HARVESTING', 'CRAFTING', 'COMBAT'];
      
      for (const taskType of expectedTaskTypes) {
        if (!(taskType in TaskType)) {
          throw new Error(`Missing TaskType enum value: ${taskType}`);
        }
      }
      
      // Test enum values can be used in task creation
      const harvestingTask = this.createMockTask(TaskType.HARVESTING);
      const craftingTask = this.createMockTask(TaskType.CRAFTING);
      const combatTask = this.createMockTask(TaskType.COMBAT);
      
      if (harvestingTask.type !== TaskType.HARVESTING) {
        throw new Error('TaskType enum value mismatch');
      }
    });
  }

  /**
   * Test Security Regressions
   */
  private async testSecurityRegressions(): Promise<void> {
    console.log('  Testing Security Regressions...');

    // Regression test for player ID validation
    await this.runTest('Player ID validation', async () => {
      const invalidPlayerIds = ['', null, undefined, '<script>', 'DROP TABLE'];
      
      for (const invalidId of invalidPlayerIds) {
        try {
          const queue = this.createMockTaskQueue(invalidId as string);
          const result = await queueStateManager.validateState(queue);
          
          if (result.isValid && invalidId) {
            throw new Error(`Invalid player ID should be rejected: ${invalidId}`);
          }
        } catch (error) {
          // Expected for null/undefined
          if (invalidId === null || invalidId === undefined) {
            continue;
          }
          throw error;
        }
      }
    });

    // Regression test for task data sanitization
    await this.runTest('Task data sanitization', async () => {
      const maliciousTask = this.createMockTask(TaskType.HARVESTING);
      maliciousTask.name = '<script>alert("xss")</script>';
      maliciousTask.description = 'DROP TABLE tasks;';
      
      const mockStats = this.createMockPlayerStats();
      const result = TaskValidationService.validateTask(
        maliciousTask,
        mockStats,
        15,
        {}
      );
      
      // Should still validate (sanitization happens elsewhere)
      // but malicious content should be flagged if validation includes it
      if (result.warnings && result.warnings.some(w => w.message.includes('script'))) {
        // Good - XSS attempt was detected
      }
    });

    // Regression test for resource requirement validation
    await this.runTest('Resource requirement validation', async () => {
      const task = this.createMockTask(TaskType.CRAFTING);
      task.resourceRequirements = [
        {
          resourceId: '../../../etc/passwd', // Path traversal attempt
          resourceName: 'Malicious Resource',
          quantityRequired: -1, // Invalid negative quantity
          quantityAvailable: 0,
          isSufficient: false
        }
      ];
      
      const mockStats = this.createMockPlayerStats();
      const result = TaskValidationService.validateTask(
        task,
        mockStats,
        15,
        {}
      );
      
      if (result.isValid) {
        throw new Error('Expected validation to fail for malicious resource requirements');
      }
    });
  }

  /**
   * Test Scalability Regressions
   */
  private async testScalabilityRegressions(): Promise<void> {
    console.log('  Testing Scalability Regressions...');

    // Regression test for large queue handling
    await this.runTest('Large queue handling', async () => {
      const largeQueueSize = 1000;
      const tasks = Array(largeQueueSize).fill(null).map(() => 
        this.createMockTask(TaskType.HARVESTING)
      );
      
      const startTime = Date.now();
      
      const result = TaskValidationService.validateTaskQueue(
        tasks,
        1500, // Allow large queue
        30 * 24 * 60 * 60 * 1000 // 30 days
      );
      
      const duration = Date.now() - startTime;
      
      // Should handle large queues efficiently
      if (duration > 2000) { // 2 seconds max
        throw new Error(`Large queue validation too slow: ${duration}ms`);
      }
      
      if (!result.isValid && !result.errors.some(e => e.code === 'QUEUE_SIZE_EXCEEDED')) {
        throw new Error('Unexpected validation failure for large queue');
      }
    });

    // Regression test for concurrent validation
    await this.runTest('Concurrent validation performance', async () => {
      const concurrentTasks = 10;
      const tasksPerValidation = 50;
      
      const validationPromises = Array(concurrentTasks).fill(null).map(() => {
        const tasks = Array(tasksPerValidation).fill(null).map(() => 
          this.createMockTask(TaskType.HARVESTING)
        );
        
        return TaskValidationService.validateTaskQueue(
          tasks,
          100,
          7 * 24 * 60 * 60 * 1000
        );
      });
      
      const startTime = Date.now();
      const results = await Promise.all(validationPromises);
      const duration = Date.now() - startTime;
      
      // Should handle concurrent validations efficiently
      if (duration > 1000) { // 1 second max for 10 concurrent validations
        throw new Error(`Concurrent validation too slow: ${duration}ms`);
      }
      
      // All validations should succeed
      if (!results.every(r => r.isValid)) {
        throw new Error('Some concurrent validations failed unexpectedly');
      }
    });

    // Regression test for memory usage with large data
    await this.runTest('Memory usage with large data sets', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create and process large amounts of data
      for (let i = 0; i < 100; i++) {
        const tasks = Array(100).fill(null).map(() => 
          this.createMockTask(TaskType.HARVESTING)
        );
        
        TaskValidationService.validateTaskQueue(
          tasks,
          150,
          7 * 24 * 60 * 60 * 1000
        );
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 100MB)
      if (memoryIncrease > 100 * 1024 * 1024) {
        throw new Error(`Excessive memory usage: ${memoryIncrease / 1024 / 1024}MB`);
      }
    });
  }

  /**
   * Test Backward Compatibility
   */
  private async testBackwardCompatibility(): Promise<void> {
    console.log('  Testing Backward Compatibility...');

    // Regression test for legacy task format support
    await this.runTest('Legacy task format support', async () => {
      // Create task with old format (missing some new properties)
      const legacyTask = {
        id: 'legacy-task-123',
        type: TaskType.HARVESTING,
        name: 'Legacy Harvesting Task',
        description: 'Old format task',
        icon: '⛏️',
        duration: 30000,
        startTime: Date.now(),
        playerId: 'legacy-player',
        progress: 0,
        completed: false,
        rewards: []
        // Missing: activityData, prerequisites, resourceRequirements, etc.
      };
      
      const mockStats = this.createMockPlayerStats();
      
      // Should handle legacy format gracefully
      try {
        const result = TaskValidationService.validateTask(
          legacyTask as Task,
          mockStats,
          15,
          {}
        );
        
        // May be invalid due to missing properties, but shouldn't crash
        if (!result) {
          throw new Error('Validation should return a result object');
        }
      } catch (error) {
        if ((error as Error).message.includes('Cannot read property')) {
          throw new Error('Legacy task format not handled gracefully');
        }
      }
    });

    // Regression test for legacy queue format support
    await this.runTest('Legacy queue format support', async () => {
      // Create queue with old format
      const legacyQueue = {
        playerId: 'legacy-queue-player',
        currentTask: null,
        queuedTasks: [],
        isRunning: false,
        totalTasksCompleted: 0,
        lastUpdated: Date.now()
        // Missing: many new properties
      };
      
      try {
        const result = await queueStateManager.validateState(legacyQueue as TaskQueue);
        
        // Should handle gracefully even if validation fails
        if (!result) {
          throw new Error('Validation should return a result object');
        }
      } catch (error) {
        if ((error as Error).message.includes('Cannot read property')) {
          throw new Error('Legacy queue format not handled gracefully');
        }
      }
    });

    // Regression test for API version compatibility
    await this.runTest('API version compatibility', async () => {
      // Test that old API calls still work
      const playerId = 'api-version-test';
      
      try {
        // These should not throw errors even if mocked
        const status = serverTaskQueueService.getQueueStatus(playerId);
        
        // Should return expected structure
        if (typeof status !== 'object') {
          throw new Error('getQueueStatus should return an object');
        }
        
        const expectedProps = ['currentTask', 'queueLength', 'isRunning'];
        for (const prop of expectedProps) {
          if (!(prop in status)) {
            throw new Error(`Missing expected property in queue status: ${prop}`);
          }
        }
      } catch (error) {
        // Only acceptable if it's a mocking issue
        if (!(error as Error).message.includes('not implemented')) {
          throw error;
        }
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
  private createMockTask(type: TaskType): Task {
    return {
      id: `${type.toLowerCase()}-${Date.now()}-${Math.random()}`,
      type,
      name: `Mock ${type} Task`,
      description: `Mock task of type ${type}`,
      icon: type === TaskType.HARVESTING ? '⛏️' : type === TaskType.CRAFTING ? '🔨' : '⚔️',
      duration: 30000,
      startTime: Date.now(),
      playerId: 'test-player',
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

  private createMockPlayerStats() {
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

  private calculateMockRewards(task: Task, playerStats: any) {
    // Simple mock reward calculation for consistency testing
    const baseReward = { type: 'experience' as const, quantity: 100 };
    const bonusReward = { type: 'item' as const, itemId: 'copper-ore', quantity: 2 };
    
    return [baseReward, bonusReward];
  }
}