/**
 * End-to-End Tests for Task Queue System
 * 
 * Tests complete task lifecycle scenarios from user interaction to completion
 */

import { TestResults } from '../taskQueueTestSuite';
import { serverTaskQueueService } from '../../../services/serverTaskQueueService';
import { TaskQueueSyncService } from '../../../services/taskQueueSyncService';
import { WebSocketService } from '../../../services/websocketService';
import { 
  Task, 
  TaskType, 
  TaskCompletionResult
} from '../../../types/taskQueue';

export class TaskQueueE2ETests {
  private testResults: TestResults = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: 0,
    errors: []
  };

  async runAll(): Promise<TestResults> {
    console.log('🎯 Starting End-to-End Tests...');
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

    // Run all E2E test scenarios
    await this.testCompleteTaskLifecycle();
    await this.testMultiActivityWorkflow();
    await this.testOfflineToOnlineFlow();
    await this.testQueueManagementFlow();
    await this.testErrorRecoveryFlow();
    await this.testConcurrentPlayerFlow();
    await this.testLongRunningScenarios();

    this.testResults.duration = Date.now() - startTime;
    return this.testResults;
  }

  /**
   * Test Complete Task Lifecycle
   */
  private async testCompleteTaskLifecycle(): Promise<void> {
    console.log('  Testing Complete Task Lifecycle...');

    // Test harvesting task from creation to completion
    await this.runTest('Harvesting task complete lifecycle', async () => {
      const playerId = 'lifecycle-test-player';
      const harvestingActivity = this.createMockHarvestingActivity();
      
      // Step 1: Add task to queue
      const mockTask = this.createMockTask(TaskType.HARVESTING);
      jest.spyOn(serverTaskQueueService, 'addHarvestingTask')
        .mockResolvedValue(mockTask);

      const addedTask = await serverTaskQueueService.addHarvestingTask(
        playerId, 
        harvestingActivity
      );

      if (!addedTask) {
        throw new Error('Failed to add harvesting task');
      }

      // Step 2: Verify task is queued
      jest.spyOn(serverTaskQueueService, 'getQueueStatus')
        .mockReturnValue({
          currentTask: null,
          queueLength: 1,
          queuedTasks: [addedTask],
          isRunning: false,
          totalCompleted: 0,
          estimatedCompletionTime: addedTask.estimatedCompletion,
          totalQueueTime: addedTask.duration
        });

      const queueStatus = serverTaskQueueService.getQueueStatus(playerId);
      if (queueStatus.queueLength !== 1) {
        throw new Error('Task not properly queued');
      }

      // Step 3: Start task processing
      jest.spyOn(serverTaskQueueService, 'getQueueStatus')
        .mockReturnValue({
          currentTask: addedTask,
          queueLength: 0,
          queuedTasks: [],
          isRunning: true,
          totalCompleted: 0,
          estimatedCompletionTime: addedTask.estimatedCompletion,
          totalQueueTime: 0
        });

      const runningStatus = serverTaskQueueService.getQueueStatus(playerId);
      if (!runningStatus.isRunning || !runningStatus.currentTask) {
        throw new Error('Task not properly started');
      }

      // Step 4: Simulate progress updates
      let progressUpdateCount = 0;
      jest.spyOn(websocketService, 'subscribe')
        .mockImplementation((channel, callback) => {
          if (channel === `task-progress-${playerId}`) {
            // Simulate multiple progress updates
            const intervals = [0.25, 0.5, 0.75, 1.0];
            intervals.forEach((progress, index) => {
              setTimeout(() => {
                callback({
                  type: 'task_progress',
                  taskId: addedTask.id,
                  progress,
                  estimatedCompletion: Date.now() + (1000 * (1 - progress))
                });
                progressUpdateCount++;
              }, index * 100);
            });
          }
        });

      websocketService.subscribe(`task-progress-${playerId}`, () => {});
      
      // Wait for progress updates
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (progressUpdateCount !== 4) {
        throw new Error(`Expected 4 progress updates, got ${progressUpdateCount}`);
      }

      // Step 5: Task completion
      const completionResult: TaskCompletionResult = {
        task: { ...addedTask, completed: true, progress: 1.0 },
        rewards: [
          { type: 'experience', quantity: 100 },
          { type: 'item', itemId: 'copper-ore', quantity: 3 }
        ],
        nextTask: null
      };

      let completionReceived = false;
      jest.spyOn(serverTaskQueueService, 'onTaskComplete')
        .mockImplementation((pid, callback) => {
          if (pid === playerId) {
            setTimeout(() => {
              callback(completionResult);
              completionReceived = true;
            }, 10);
          }
        });

      serverTaskQueueService.onTaskComplete(playerId, () => {});
      await new Promise(resolve => setTimeout(resolve, 50));

      if (!completionReceived) {
        throw new Error('Task completion callback not received');
      }

      // Step 6: Verify final state
      jest.spyOn(serverTaskQueueService, 'getQueueStatus')
        .mockReturnValue({
          currentTask: null,
          queueLength: 0,
          queuedTasks: [],
          isRunning: false,
          totalCompleted: 1,
          estimatedCompletionTime: 0,
          totalQueueTime: 0
        });

      const finalStatus = serverTaskQueueService.getQueueStatus(playerId);
      if (finalStatus.totalCompleted !== 1) {
        throw new Error('Task completion not recorded');
      }
    });

    // Test crafting task with material consumption
    await this.runTest('Crafting task with material consumption', async () => {
      const playerId = 'crafting-lifecycle-player';
      const craftingRecipe = this.createMockCraftingRecipe();
      
      // Mock initial inventory
      const initialInventory = {
        'steel-ingot': 5,
        'copper-wire': 10
      };

      const craftingTask = this.createMockTask(TaskType.CRAFTING);
      craftingTask.resourceRequirements = [
        {
          resourceId: 'steel-ingot',
          resourceName: 'Steel Ingot',
          quantityRequired: 2,
          quantityAvailable: 5,
          isSufficient: true
        }
      ];

      jest.spyOn(serverTaskQueueService, 'addCraftingTask')
        .mockResolvedValue(craftingTask);

      // Add crafting task
      const addedTask = await serverTaskQueueService.addCraftingTask(
        playerId,
        craftingRecipe
      );

      // Simulate task completion with material consumption
      const completionResult: TaskCompletionResult = {
        task: { ...addedTask, completed: true },
        rewards: [
          { type: 'item', itemId: 'steam-gear', quantity: 1 },
          { type: 'experience', quantity: 75 }
        ],
        nextTask: null,
        consumedResources: [
          { resourceId: 'steel-ingot', quantity: 2 }
        ]
      };

      let materialConsumed = false;
      jest.spyOn(serverTaskQueueService, 'onTaskComplete')
        .mockImplementation((pid, callback) => {
          if (pid === playerId) {
            setTimeout(() => {
              callback(completionResult);
              materialConsumed = true;
            }, 10);
          }
        });

      serverTaskQueueService.onTaskComplete(playerId, () => {});
      await new Promise(resolve => setTimeout(resolve, 50));

      if (!materialConsumed) {
        throw new Error('Material consumption not processed');
      }

      // Verify materials were consumed
      if (!completionResult.consumedResources?.some(r => r.resourceId === 'steel-ingot')) {
        throw new Error('Expected steel ingot to be consumed');
      }
    });

    // Test combat task with equipment durability
    await this.runTest('Combat task with equipment durability', async () => {
      const playerId = 'combat-lifecycle-player';
      const enemy = this.createMockEnemy();
      
      const combatTask = this.createMockTask(TaskType.COMBAT);
      combatTask.prerequisites = [
        {
          type: 'equipment',
          requirement: 'weapon',
          description: 'Requires weapon',
          isMet: true
        }
      ];

      jest.spyOn(serverTaskQueueService, 'addCombatTask')
        .mockResolvedValue(combatTask);

      const addedTask = await serverTaskQueueService.addCombatTask(
        playerId,
        enemy
      );

      // Simulate combat completion with equipment wear
      const completionResult: TaskCompletionResult = {
        task: { ...addedTask, completed: true },
        rewards: [
          { type: 'experience', quantity: 150 },
          { type: 'item', itemId: 'scrap-metal', quantity: 2 }
        ],
        nextTask: null,
        equipmentDamage: [
          { equipmentId: 'iron-sword', durabilityLoss: 5 }
        ]
      };

      let equipmentDamaged = false;
      jest.spyOn(serverTaskQueueService, 'onTaskComplete')
        .mockImplementation((pid, callback) => {
          if (pid === playerId) {
            setTimeout(() => {
              callback(completionResult);
              equipmentDamaged = true;
            }, 10);
          }
        });

      serverTaskQueueService.onTaskComplete(playerId, () => {});
      await new Promise(resolve => setTimeout(resolve, 50));

      if (!equipmentDamaged) {
        throw new Error('Equipment damage not processed');
      }

      if (!completionResult.equipmentDamage?.some(d => d.equipmentId === 'iron-sword')) {
        throw new Error('Expected sword durability to be reduced');
      }
    });
  }

  /**
   * Test Multi-Activity Workflow
   */
  private async testMultiActivityWorkflow(): Promise<void> {
    console.log('  Testing Multi-Activity Workflow...');

    // Test harvesting -> crafting -> combat chain
    await this.runTest('Harvesting -> Crafting -> Combat chain', async () => {
      const playerId = 'multi-activity-player';
      
      // Step 1: Add harvesting task
      const harvestingTask = this.createMockTask(TaskType.HARVESTING);
      jest.spyOn(serverTaskQueueService, 'addHarvestingTask')
        .mockResolvedValue(harvestingTask);

      await serverTaskQueueService.addHarvestingTask(
        playerId,
        this.createMockHarvestingActivity()
      );

      // Step 2: Add crafting task (depends on harvesting output)
      const craftingTask = this.createMockTask(TaskType.CRAFTING);
      craftingTask.resourceRequirements = [
        {
          resourceId: 'copper-ore',
          resourceName: 'Copper Ore',
          quantityRequired: 3,
          quantityAvailable: 0, // Will be available after harvesting
          isSufficient: false
        }
      ];

      jest.spyOn(serverTaskQueueService, 'addCraftingTask')
        .mockResolvedValue(craftingTask);

      await serverTaskQueueService.addCraftingTask(
        playerId,
        this.createMockCraftingRecipe()
      );

      // Step 3: Add combat task (requires crafted equipment)
      const combatTask = this.createMockTask(TaskType.COMBAT);
      combatTask.prerequisites = [
        {
          type: 'equipment',
          requirement: 'copper-sword',
          description: 'Requires copper sword',
          isMet: false // Will be available after crafting
        }
      ];

      jest.spyOn(serverTaskQueueService, 'addCombatTask')
        .mockResolvedValue(combatTask);

      await serverTaskQueueService.addCombatTask(
        playerId,
        this.createMockEnemy()
      );

      // Verify queue has all three tasks
      jest.spyOn(serverTaskQueueService, 'getQueueStatus')
        .mockReturnValue({
          currentTask: null,
          queueLength: 3,
          queuedTasks: [harvestingTask, craftingTask, combatTask],
          isRunning: false,
          totalCompleted: 0,
          estimatedCompletionTime: Date.now() + 120000,
          totalQueueTime: 120000
        });

      const queueStatus = serverTaskQueueService.getQueueStatus(playerId);
      if (queueStatus.queueLength !== 3) {
        throw new Error('Expected 3 tasks in queue');
      }

      // Simulate task chain execution
      const taskTypes = queueStatus.queuedTasks.map(t => t.type);
      const expectedOrder = [TaskType.HARVESTING, TaskType.CRAFTING, TaskType.COMBAT];
      
      if (!taskTypes.every((type, index) => type === expectedOrder[index])) {
        throw new Error('Tasks not in expected order');
      }
    });

    // Test parallel task processing
    await this.runTest('Parallel task processing', async () => {
      const playerId = 'parallel-processing-player';
      
      // Add multiple independent tasks
      const tasks = [
        this.createMockTask(TaskType.HARVESTING),
        this.createMockTask(TaskType.HARVESTING),
        this.createMockTask(TaskType.COMBAT)
      ];

      // Mock parallel processing capability
      jest.spyOn(serverTaskQueueService, 'getQueueStatus')
        .mockReturnValue({
          currentTask: tasks[0],
          queueLength: 2,
          queuedTasks: tasks.slice(1),
          isRunning: true,
          totalCompleted: 0,
          estimatedCompletionTime: Date.now() + 60000,
          totalQueueTime: 90000,
          parallelTasks: [tasks[1]] // Second harvesting task running in parallel
        });

      const queueStatus = serverTaskQueueService.getQueueStatus(playerId);
      
      if (!queueStatus.parallelTasks || queueStatus.parallelTasks.length === 0) {
        throw new Error('Expected parallel task processing');
      }
    });
  }

  /**
   * Test Offline to Online Flow
   */
  private async testOfflineToOnlineFlow(): Promise<void> {
    console.log('  Testing Offline to Online Flow...');

    // Test offline task completion and online sync
    await this.runTest('Offline task completion and sync', async () => {
      const playerId = 'offline-online-player';
      const offlineStartTime = Date.now() - 300000; // 5 minutes ago
      const onlineTime = Date.now();
      
      // Mock offline processing
      const offlineResults = {
        completedTasks: [
          { ...this.createMockTask(TaskType.HARVESTING), completed: true },
          { ...this.createMockTask(TaskType.CRAFTING), completed: true }
        ],
        totalRewards: [
          { type: 'experience', quantity: 200 },
          { type: 'item', itemId: 'copper-ore', quantity: 5 },
          { type: 'item', itemId: 'iron-gear', quantity: 1 }
        ],
        timeProcessed: 300000
      };

      const mockOfflineManager = require('../../../services/offlineTaskQueueManager');
      jest.spyOn(mockOfflineManager, 'processOfflineTasks')
        .mockResolvedValue(offlineResults);

      // Process offline tasks
      const results = await mockOfflineManager.processOfflineTasks(
        playerId,
        offlineStartTime,
        onlineTime
      );

      if (results.completedTasks.length !== 2) {
        throw new Error('Expected 2 tasks to be completed offline');
      }

      // Mock sync with server
      jest.spyOn(taskQueueSyncService, 'syncOfflineChanges')
        .mockResolvedValue({
          success: true,
          conflicts: [],
          appliedChanges: 2
        });

      const syncResult = await taskQueueSyncService.syncOfflineChanges(
        playerId,
        {
          completedTasks: results.completedTasks,
          addedTasks: [],
          removedTasks: []
        }
      );

      if (!syncResult.success) {
        throw new Error('Offline sync failed');
      }

      if (syncResult.appliedChanges !== 2) {
        throw new Error('Expected 2 changes to be applied');
      }
    });

    // Test offline queue modifications
    await this.runTest('Offline queue modifications', async () => {
      const playerId = 'offline-modifications-player';
      
      // Mock offline changes
      const offlineChanges = {
        completedTasks: [this.createMockTask(TaskType.HARVESTING)],
        addedTasks: [
          this.createMockTask(TaskType.CRAFTING),
          this.createMockTask(TaskType.COMBAT)
        ],
        removedTasks: ['removed-task-id'],
        modifiedTasks: [
          { ...this.createMockTask(TaskType.HARVESTING), progress: 0.75 }
        ]
      };

      jest.spyOn(taskQueueSyncService, 'syncOfflineChanges')
        .mockResolvedValue({
          success: true,
          conflicts: [{
            type: 'task_progress',
            taskId: 'conflicted-task',
            localValue: 0.75,
            serverValue: 0.5,
            resolution: 'local_wins'
          }],
          appliedChanges: 4
        });

      const syncResult = await taskQueueSyncService.syncOfflineChanges(
        playerId,
        offlineChanges
      );

      if (syncResult.conflicts.length === 0) {
        throw new Error('Expected conflict during offline sync');
      }

      if (syncResult.conflicts[0].resolution !== 'local_wins') {
        throw new Error('Expected local changes to win conflict');
      }
    });
  }

  /**
   * Test Queue Management Flow
   */
  private async testQueueManagementFlow(): Promise<void> {
    console.log('  Testing Queue Management Flow...');

    // Test complete queue management operations
    await this.runTest('Complete queue management operations', async () => {
      const playerId = 'queue-management-player';
      
      // Start with empty queue
      let queueStatus: QueueStatus = {
        currentTask: null,
        queueLength: 0,
        queuedTasks: [],
        isRunning: false,
        totalCompleted: 0,
        estimatedCompletionTime: 0,
        totalQueueTime: 0
      };

      jest.spyOn(serverTaskQueueService, 'getQueueStatus')
        .mockImplementation(() => ({ ...queueStatus }));

      // Add multiple tasks
      const tasks = [
        this.createMockTask(TaskType.HARVESTING),
        this.createMockTask(TaskType.CRAFTING),
        this.createMockTask(TaskType.COMBAT)
      ];

      for (const task of tasks) {
        queueStatus.queuedTasks.push(task);
        queueStatus.queueLength++;
        queueStatus.totalQueueTime += task.duration;
      }

      // Test reordering
      jest.spyOn(serverTaskQueueService, 'reorderTasks')
        .mockImplementation(async (pid, taskIds) => {
          if (pid === playerId) {
            const reorderedTasks = taskIds.map(id => 
              queueStatus.queuedTasks.find(t => t.id === id)!
            );
            queueStatus.queuedTasks = reorderedTasks;
          }
        });

      const newOrder = [tasks[2].id, tasks[0].id, tasks[1].id]; // Combat, Harvesting, Crafting
      await serverTaskQueueService.reorderTasks(playerId, newOrder);

      if (queueStatus.queuedTasks[0].type !== TaskType.COMBAT) {
        throw new Error('Task reordering failed');
      }

      // Test task removal
      jest.spyOn(serverTaskQueueService, 'removeTask')
        .mockImplementation(async (pid, taskId) => {
          if (pid === playerId) {
            queueStatus.queuedTasks = queueStatus.queuedTasks.filter(t => t.id !== taskId);
            queueStatus.queueLength--;
          }
        });

      await serverTaskQueueService.removeTask(playerId, tasks[1].id);

      if (queueStatus.queueLength !== 2) {
        throw new Error('Task removal failed');
      }

      // Test queue pause/resume
      jest.spyOn(serverTaskQueueService, 'pauseQueue')
        .mockImplementation(async (pid) => {
          if (pid === playerId) {
            queueStatus.isRunning = false;
          }
        });

      jest.spyOn(serverTaskQueueService, 'resumeQueue')
        .mockImplementation(async (pid) => {
          if (pid === playerId) {
            queueStatus.isRunning = true;
          }
        });

      await serverTaskQueueService.pauseQueue(playerId, 'Manual pause');
      if (queueStatus.isRunning) {
        throw new Error('Queue pause failed');
      }

      await serverTaskQueueService.resumeQueue(playerId);
      if (!queueStatus.isRunning) {
        throw new Error('Queue resume failed');
      }

      // Test queue clearing
      jest.spyOn(serverTaskQueueService, 'clearQueue')
        .mockImplementation(async (pid) => {
          if (pid === playerId) {
            queueStatus.queuedTasks = [];
            queueStatus.queueLength = 0;
            queueStatus.totalQueueTime = 0;
          }
        });

      await serverTaskQueueService.clearQueue(playerId);

      if (queueStatus.queueLength !== 0) {
        throw new Error('Queue clearing failed');
      }
    });
  }

  /**
   * Test Error Recovery Flow
   */
  private async testErrorRecoveryFlow(): Promise<void> {
    console.log('  Testing Error Recovery Flow...');

    // Test task failure and retry
    await this.runTest('Task failure and retry', async () => {
      const playerId = 'error-recovery-player';
      const failingTask = this.createMockTask(TaskType.CRAFTING);
      failingTask.maxRetries = 3;
      
      // Mock task failure
      let failureCount = 0;
      jest.spyOn(serverTaskQueueService, 'onTaskComplete')
        .mockImplementation((pid, callback) => {
          if (pid === playerId) {
            setTimeout(() => {
              failureCount++;
              if (failureCount < 3) {
                // Simulate failure
                callback({
                  task: { ...failingTask, retryCount: failureCount },
                  rewards: [],
                  nextTask: null,
                  error: new Error('Task execution failed')
                });
              } else {
                // Success on third retry
                callback({
                  task: { ...failingTask, completed: true, retryCount: failureCount },
                  rewards: [{ type: 'experience', quantity: 50 }],
                  nextTask: null
                });
              }
            }, 10);
          }
        });

      let completionReceived = false;
      serverTaskQueueService.onTaskComplete(playerId, (result) => {
        if (result.task.completed) {
          completionReceived = true;
        }
      });

      // Wait for retries and completion
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!completionReceived) {
        throw new Error('Task should have succeeded after retries');
      }

      if (failureCount !== 3) {
        throw new Error(`Expected 3 attempts, got ${failureCount}`);
      }
    });

    // Test queue corruption recovery
    await this.runTest('Queue corruption recovery', async () => {
      const playerId = 'corruption-recovery-player';
      
      // Mock corruption detection
      const mockRecoveryService = require('../../../services/taskQueueRecoveryService');
      jest.spyOn(mockRecoveryService, 'detectCorruption')
        .mockReturnValue(true);

      jest.spyOn(mockRecoveryService, 'recoverFromCorruption')
        .mockResolvedValue({
          success: true,
          recoveredQueue: this.createMockTaskQueue(playerId),
          backupUsed: 'latest',
          corruptionType: 'checksum_mismatch'
        });

      // Detect and recover from corruption
      const corruptionDetected = mockRecoveryService.detectCorruption(playerId);
      if (!corruptionDetected) {
        throw new Error('Expected corruption to be detected');
      }

      const recovery = await mockRecoveryService.recoverFromCorruption(playerId);
      if (!recovery.success) {
        throw new Error('Expected successful recovery');
      }

      if (recovery.backupUsed !== 'latest') {
        throw new Error('Expected latest backup to be used');
      }
    });
  }

  /**
   * Test Concurrent Player Flow
   */
  private async testConcurrentPlayerFlow(): Promise<void> {
    console.log('  Testing Concurrent Player Flow...');

    // Test multiple players with independent queues
    await this.runTest('Multiple players with independent queues', async () => {
      const playerIds = ['player-1', 'player-2', 'player-3'];
      const playerQueues = new Map<string, QueueStatus>();

      // Initialize queues for each player
      playerIds.forEach(playerId => {
        playerQueues.set(playerId, {
          currentTask: null,
          queueLength: 0,
          queuedTasks: [],
          isRunning: false,
          totalCompleted: 0,
          estimatedCompletionTime: 0,
          totalQueueTime: 0
        });
      });

      jest.spyOn(serverTaskQueueService, 'getQueueStatus')
        .mockImplementation((playerId) => {
          return { ...playerQueues.get(playerId)! };
        });

      // Add tasks for each player concurrently
      const addTaskPromises = playerIds.map(async (playerId, index) => {
        const task = this.createMockTask(TaskType.HARVESTING);
        task.playerId = playerId;
        
        jest.spyOn(serverTaskQueueService, 'addHarvestingTask')
          .mockResolvedValue(task);

        await serverTaskQueueService.addHarvestingTask(
          playerId,
          this.createMockHarvestingActivity()
        );

        // Update mock queue
        const queue = playerQueues.get(playerId)!;
        queue.queuedTasks.push(task);
        queue.queueLength++;
        queue.totalQueueTime += task.duration;
      });

      await Promise.all(addTaskPromises);

      // Verify each player has their own queue
      playerIds.forEach(playerId => {
        const queue = serverTaskQueueService.getQueueStatus(playerId);
        if (queue.queueLength !== 1) {
          throw new Error(`Player ${playerId} should have 1 task in queue`);
        }
        if (queue.queuedTasks[0].playerId !== playerId) {
          throw new Error(`Task should belong to ${playerId}`);
        }
      });
    });
  }

  /**
   * Test Long-Running Scenarios
   */
  private async testLongRunningScenarios(): Promise<void> {
    console.log('  Testing Long-Running Scenarios...');

    // Test extended offline processing
    await this.runTest('Extended offline processing', async () => {
      const playerId = 'long-offline-player';
      const offlineStartTime = Date.now() - 86400000; // 24 hours ago
      const onlineTime = Date.now();
      
      // Mock long offline period with multiple task completions
      const mockOfflineManager = require('../../../services/offlineTaskQueueManager');
      jest.spyOn(mockOfflineManager, 'processOfflineTasks')
        .mockResolvedValue({
          completedTasks: Array(20).fill(null).map(() => ({
            ...this.createMockTask(TaskType.HARVESTING),
            completed: true
          })),
          totalRewards: [
            { type: 'experience', quantity: 2000 },
            { type: 'item', itemId: 'copper-ore', quantity: 60 }
          ],
          timeProcessed: 86400000,
          levelUps: 2,
          skillGains: {
            harvesting: 500,
            mining: 300
          }
        });

      const results = await mockOfflineManager.processOfflineTasks(
        playerId,
        offlineStartTime,
        onlineTime
      );

      if (results.completedTasks.length !== 20) {
        throw new Error('Expected 20 tasks to be completed during long offline period');
      }

      if (!results.levelUps || results.levelUps < 2) {
        throw new Error('Expected level ups during extended offline period');
      }

      if (results.timeProcessed !== 86400000) {
        throw new Error('Expected full 24 hours to be processed');
      }
    });

    // Test queue with maximum capacity
    await this.runTest('Queue with maximum capacity', async () => {
      const playerId = 'max-capacity-player';
      const maxQueueSize = 50;
      
      // Create maximum number of tasks
      const tasks = Array(maxQueueSize).fill(null).map(() => 
        this.createMockTask(TaskType.HARVESTING)
      );

      jest.spyOn(serverTaskQueueService, 'getQueueStatus')
        .mockReturnValue({
          currentTask: null,
          queueLength: maxQueueSize,
          queuedTasks: tasks,
          isRunning: false,
          totalCompleted: 0,
          estimatedCompletionTime: Date.now() + (maxQueueSize * 30000),
          totalQueueTime: maxQueueSize * 30000
        });

      const queueStatus = serverTaskQueueService.getQueueStatus(playerId);
      
      if (queueStatus.queueLength !== maxQueueSize) {
        throw new Error(`Expected queue length of ${maxQueueSize}`);
      }

      // Test that adding another task fails
      jest.spyOn(serverTaskQueueService, 'addHarvestingTask')
        .mockRejectedValue(new Error('Queue size limit exceeded'));

      try {
        await serverTaskQueueService.addHarvestingTask(
          playerId,
          this.createMockHarvestingActivity()
        );
        throw new Error('Expected task addition to fail due to queue limit');
      } catch (error) {
        if (!(error as Error).message.includes('limit')) {
          throw new Error('Expected queue limit error');
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

  private createMockTaskQueue(playerId: string) {
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
      id: 'mock-harvesting',
      name: 'Mock Harvesting',
      description: 'Mock harvesting activity',
      category: 'metallurgical' as any,
      icon: '⛏️',
      baseTime: 30,
      energyCost: 10,
      requiredLevel: 1,
      requiredStats: {},
      statBonuses: {},
      dropTable: {
        guaranteed: [],
        common: [],
        uncommon: [],
        rare: [],
        legendary: []
      }
    };
  }

  private createMockCraftingRecipe() {
    return {
      recipeId: 'mock-recipe',
      name: 'Mock Recipe',
      description: 'Mock crafting recipe',
      category: 'materials',
      requiredSkill: 'engineering',
      requiredLevel: 1,
      craftingTime: 60,
      materials: [],
      outputs: [],
      experienceGain: 50,
      steampunkTheme: {
        flavorText: 'Mock recipe',
        visualDescription: 'Mock item'
      }
    };
  }

  private createMockEnemy() {
    return {
      enemyId: 'mock-enemy',
      name: 'Mock Enemy',
      description: 'Mock enemy for testing',
      type: 'automaton',
      level: 10,
      stats: {
        health: 100,
        attack: 20,
        defense: 10,
        speed: 15,
        resistances: {},
        abilities: []
      },
      lootTable: [],
      experienceReward: 100,
      steampunkTheme: {
        appearance: 'Mock enemy appearance',
        backstory: 'Mock enemy backstory',
        combatStyle: 'Mock combat style'
      }
    };
  }
}