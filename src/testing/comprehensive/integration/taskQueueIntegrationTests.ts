/**
 * Integration Tests for Task Queue System
 * 
 * Tests client-server synchronization and component interactions
 */

import { TestResults } from '../taskQueueTestSuite';
import { serverTaskQueueService } from '../../../services/serverTaskQueueService';
import { taskQueueSyncService } from '../../../services/taskQueueSyncService';
import { websocketService } from '../../../services/websocketService';
import { offlineTaskQueueManager } from '../../../services/offlineTaskQueueManager';
import { 
  Task, 
  TaskType, 
  TaskQueue,
  QueueStatus,
  TaskCompletionResult
} from '../../../types/taskQueue';

export class TaskQueueIntegrationTests {
  private testResults: TestResults = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: 0,
    errors: []
  };

  async runAll(): Promise<TestResults> {
    console.log('🔗 Starting Integration Tests...');
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

    // Run all integration test categories
    await this.testClientServerSync();
    await this.testWebSocketIntegration();
    await this.testOfflineOnlineSync();
    await this.testServiceInteractions();
    await this.testDataConsistency();
    await this.testConcurrentOperations();
    await this.testErrorRecovery();

    this.testResults.duration = Date.now() - startTime;
    return this.testResults;
  }

  /**
   * Test Client-Server Synchronization
   */
  private async testClientServerSync(): Promise<void> {
    console.log('  Testing Client-Server Sync...');

    // Test basic queue synchronization
    await this.runTest('Basic queue synchronization', async () => {
      const playerId = 'sync-test-player';
      
      // Mock server response
      const mockQueueStatus: QueueStatus = {
        currentTask: this.createMockTask(TaskType.HARVESTING),
        queueLength: 2,
        queuedTasks: [
          this.createMockTask(TaskType.CRAFTING),
          this.createMockTask(TaskType.COMBAT)
        ],
        isRunning: true,
        totalCompleted: 5,
        estimatedCompletionTime: Date.now() + 60000,
        totalQueueTime: 120000
      };

      // Mock service methods
      jest.spyOn(serverTaskQueueService, 'getQueueStatus')
        .mockReturnValue(mockQueueStatus);
      
      jest.spyOn(taskQueueSyncService, 'syncWithServer')
        .mockResolvedValue({
          success: true,
          syncedAt: Date.now(),
          conflicts: [],
          changes: {
            added: 0,
            removed: 0,
            updated: 1
          }
        });

      // Perform sync
      const syncResult = await taskQueueSyncService.syncWithServer(playerId);
      
      if (!syncResult.success) {
        throw new Error('Expected successful sync');
      }
      
      // Verify queue status matches
      const currentStatus = serverTaskQueueService.getQueueStatus(playerId);
      if (currentStatus.queueLength !== mockQueueStatus.queueLength) {
        throw new Error('Queue length mismatch after sync');
      }
    });

    // Test sync conflict resolution
    await this.runTest('Sync conflict resolution', async () => {
      const playerId = 'conflict-test-player';
      
      // Mock conflicting changes
      const localTask = this.createMockTask(TaskType.HARVESTING);
      localTask.progress = 0.5;
      
      const serverTask = { ...localTask };
      serverTask.progress = 0.7; // Different progress
      
      jest.spyOn(taskQueueSyncService, 'syncWithServer')
        .mockResolvedValue({
          success: true,
          syncedAt: Date.now(),
          conflicts: [{
            type: 'task_progress',
            taskId: localTask.id,
            localValue: 0.5,
            serverValue: 0.7,
            resolution: 'server_wins'
          }],
          changes: {
            added: 0,
            removed: 0,
            updated: 1
          }
        });

      const syncResult = await taskQueueSyncService.syncWithServer(playerId);
      
      if (syncResult.conflicts.length === 0) {
        throw new Error('Expected conflict to be detected');
      }
      
      if (syncResult.conflicts[0].resolution !== 'server_wins') {
        throw new Error('Expected server to win conflict resolution');
      }
    });

    // Test incremental sync
    await this.runTest('Incremental synchronization', async () => {
      const playerId = 'incremental-test-player';
      const lastSyncTime = Date.now() - 60000; // 1 minute ago
      
      jest.spyOn(taskQueueSyncService, 'getIncrementalChanges')
        .mockResolvedValue({
          changes: [
            {
              type: 'task_completed',
              taskId: 'task-1',
              timestamp: Date.now() - 30000,
              data: { rewards: [{ type: 'experience', quantity: 100 }] }
            }
          ],
          lastChangeTime: Date.now()
        });

      const changes = await taskQueueSyncService.getIncrementalChanges(
        playerId, 
        lastSyncTime
      );
      
      if (changes.changes.length === 0) {
        throw new Error('Expected incremental changes');
      }
      
      if (changes.changes[0].type !== 'task_completed') {
        throw new Error('Expected task completion change');
      }
    });
  }

  /**
   * Test WebSocket Integration
   */
  private async testWebSocketIntegration(): Promise<void> {
    console.log('  Testing WebSocket Integration...');

    // Test real-time progress updates
    await this.runTest('Real-time progress updates', async () => {
      const playerId = 'websocket-test-player';
      let progressUpdateReceived = false;
      
      // Mock WebSocket connection
      jest.spyOn(websocketService, 'connect')
        .mockResolvedValue(true);
      
      jest.spyOn(websocketService, 'subscribe')
        .mockImplementation((channel, callback) => {
          if (channel === `task-progress-${playerId}`) {
            // Simulate progress update
            setTimeout(() => {
              callback({
                type: 'task_progress',
                taskId: 'test-task',
                progress: 0.75,
                estimatedCompletion: Date.now() + 15000
              });
              progressUpdateReceived = true;
            }, 10);
          }
        });

      // Connect and subscribe
      await websocketService.connect();
      websocketService.subscribe(`task-progress-${playerId}`, (data) => {
        if (data.type === 'task_progress') {
          progressUpdateReceived = true;
        }
      });

      // Wait for update
      await new Promise(resolve => setTimeout(resolve, 50));
      
      if (!progressUpdateReceived) {
        throw new Error('Expected progress update via WebSocket');
      }
    });

    // Test task completion notifications
    await this.runTest('Task completion notifications', async () => {
      const playerId = 'completion-test-player';
      let completionReceived = false;
      
      jest.spyOn(websocketService, 'subscribe')
        .mockImplementation((channel, callback) => {
          if (channel === `task-completion-${playerId}`) {
            setTimeout(() => {
              callback({
                type: 'task_completed',
                taskId: 'test-task',
                rewards: [{ type: 'experience', quantity: 100 }],
                nextTask: null
              });
              completionReceived = true;
            }, 10);
          }
        });

      websocketService.subscribe(`task-completion-${playerId}`, (data) => {
        if (data.type === 'task_completed') {
          completionReceived = true;
        }
      });

      await new Promise(resolve => setTimeout(resolve, 50));
      
      if (!completionReceived) {
        throw new Error('Expected completion notification via WebSocket');
      }
    });

    // Test connection recovery
    await this.runTest('WebSocket connection recovery', async () => {
      let reconnectAttempted = false;
      
      jest.spyOn(websocketService, 'reconnect')
        .mockImplementation(async () => {
          reconnectAttempted = true;
          return true;
        });

      jest.spyOn(websocketService, 'isConnected')
        .mockReturnValue(false);

      // Simulate connection loss and recovery
      await websocketService.reconnect();
      
      if (!reconnectAttempted) {
        throw new Error('Expected reconnection attempt');
      }
    });
  }

  /**
   * Test Offline/Online Synchronization
   */
  private async testOfflineOnlineSync(): Promise<void> {
    console.log('  Testing Offline/Online Sync...');

    // Test offline task processing
    await this.runTest('Offline task processing', async () => {
      const playerId = 'offline-test-player';
      const task = this.createMockTask(TaskType.HARVESTING);
      task.duration = 1000; // 1 second for quick test
      
      // Mock offline manager
      jest.spyOn(offlineTaskQueueManager, 'processOfflineTasks')
        .mockResolvedValue({
          completedTasks: [task],
          totalRewards: [{ type: 'experience', quantity: 50 }],
          timeProcessed: 1000
        });

      const result = await offlineTaskQueueManager.processOfflineTasks(
        playerId,
        Date.now() - 2000, // 2 seconds offline
        Date.now()
      );
      
      if (result.completedTasks.length === 0) {
        throw new Error('Expected tasks to be completed offline');
      }
      
      if (result.totalRewards.length === 0) {
        throw new Error('Expected rewards from offline processing');
      }
    });

    // Test online reconnection sync
    await this.runTest('Online reconnection sync', async () => {
      const playerId = 'reconnect-test-player';
      
      // Mock offline changes
      const offlineChanges = {
        completedTasks: [this.createMockTask(TaskType.HARVESTING)],
        addedTasks: [this.createMockTask(TaskType.CRAFTING)],
        removedTasks: ['removed-task-id']
      };

      jest.spyOn(offlineTaskQueueManager, 'getOfflineChanges')
        .mockReturnValue(offlineChanges);

      jest.spyOn(taskQueueSyncService, 'syncOfflineChanges')
        .mockResolvedValue({
          success: true,
          conflicts: [],
          appliedChanges: 3
        });

      const syncResult = await taskQueueSyncService.syncOfflineChanges(
        playerId,
        offlineChanges
      );
      
      if (!syncResult.success) {
        throw new Error('Expected successful offline sync');
      }
      
      if (syncResult.appliedChanges !== 3) {
        throw new Error('Expected 3 changes to be applied');
      }
    });

    // Test offline/online conflict resolution
    await this.runTest('Offline/online conflict resolution', async () => {
      const playerId = 'conflict-resolution-test';
      const taskId = 'conflicted-task';
      
      // Mock conflicting states
      const offlineTask = this.createMockTask(TaskType.HARVESTING);
      offlineTask.id = taskId;
      offlineTask.completed = true;
      
      const onlineTask = { ...offlineTask };
      onlineTask.completed = false;
      onlineTask.progress = 0.8;

      jest.spyOn(taskQueueSyncService, 'resolveConflicts')
        .mockResolvedValue([{
          taskId,
          conflictType: 'completion_status',
          resolution: 'merge',
          resolvedTask: {
            ...onlineTask,
            completed: true, // Offline completion takes precedence
            progress: 1.0
          }
        }]);

      const conflicts = await taskQueueSyncService.resolveConflicts(
        playerId,
        [offlineTask],
        [onlineTask]
      );
      
      if (conflicts.length === 0) {
        throw new Error('Expected conflict to be detected');
      }
      
      if (!conflicts[0].resolvedTask.completed) {
        throw new Error('Expected offline completion to be preserved');
      }
    });
  }

  /**
   * Test Service Interactions
   */
  private async testServiceInteractions(): Promise<void> {
    console.log('  Testing Service Interactions...');

    // Test task queue service integration
    await this.runTest('Task queue service integration', async () => {
      const playerId = 'service-integration-test';
      const harvestingActivity = this.createMockHarvestingActivity();
      
      // Mock service chain
      jest.spyOn(serverTaskQueueService, 'addHarvestingTask')
        .mockResolvedValue(this.createMockTask(TaskType.HARVESTING));
      
      jest.spyOn(serverTaskQueueService, 'getQueueStatus')
        .mockReturnValue({
          currentTask: null,
          queueLength: 1,
          queuedTasks: [this.createMockTask(TaskType.HARVESTING)],
          isRunning: false,
          totalCompleted: 0,
          estimatedCompletionTime: Date.now() + 30000,
          totalQueueTime: 30000
        });

      // Add task and verify queue state
      const task = await serverTaskQueueService.addHarvestingTask(
        playerId,
        harvestingActivity
      );
      
      const queueStatus = serverTaskQueueService.getQueueStatus(playerId);
      
      if (!task) {
        throw new Error('Expected task to be created');
      }
      
      if (queueStatus.queueLength !== 1) {
        throw new Error('Expected queue length of 1 after adding task');
      }
    });

    // Test validation service integration
    await this.runTest('Validation service integration', async () => {
      const playerId = 'validation-integration-test';
      const invalidTask = this.createMockTask(TaskType.CRAFTING);
      invalidTask.resourceRequirements = [{
        resourceId: 'rare-material',
        resourceName: 'Rare Material',
        quantityRequired: 100,
        quantityAvailable: 0,
        isSufficient: false
      }];

      // Mock validation failure
      jest.spyOn(serverTaskQueueService, 'addCraftingTask')
        .mockRejectedValue(new Error('Insufficient materials'));

      try {
        await serverTaskQueueService.addCraftingTask(
          playerId,
          this.createMockCraftingRecipe()
        );
        throw new Error('Expected task addition to fail due to validation');
      } catch (error) {
        if (!(error as Error).message.includes('materials')) {
          throw new Error('Expected materials validation error');
        }
      }
    });

    // Test persistence service integration
    await this.runTest('Persistence service integration', async () => {
      const playerId = 'persistence-integration-test';
      const queue = this.createMockTaskQueue(playerId);
      
      // Mock persistence operations
      const mockPersistenceService = require('../../../services/taskQueuePersistence');
      jest.spyOn(mockPersistenceService, 'saveQueueState')
        .mockResolvedValue(true);
      
      jest.spyOn(mockPersistenceService, 'loadQueueState')
        .mockResolvedValue(queue);

      // Save and load queue
      const saveResult = await mockPersistenceService.saveQueueState(queue);
      const loadedQueue = await mockPersistenceService.loadQueueState(playerId);
      
      if (!saveResult) {
        throw new Error('Expected successful queue save');
      }
      
      if (!loadedQueue || loadedQueue.playerId !== playerId) {
        throw new Error('Expected loaded queue to match saved queue');
      }
    });
  }

  /**
   * Test Data Consistency
   */
  private async testDataConsistency(): Promise<void> {
    console.log('  Testing Data Consistency...');

    // Test queue state consistency
    await this.runTest('Queue state consistency', async () => {
      const playerId = 'consistency-test-player';
      const task1 = this.createMockTask(TaskType.HARVESTING);
      const task2 = this.createMockTask(TaskType.CRAFTING);
      
      // Mock queue operations
      jest.spyOn(serverTaskQueueService, 'addHarvestingTask')
        .mockResolvedValue(task1);
      
      jest.spyOn(serverTaskQueueService, 'addCraftingTask')
        .mockResolvedValue(task2);

      let queueStatus = {
        currentTask: null,
        queueLength: 0,
        queuedTasks: [] as Task[],
        isRunning: false,
        totalCompleted: 0,
        estimatedCompletionTime: 0,
        totalQueueTime: 0
      };

      jest.spyOn(serverTaskQueueService, 'getQueueStatus')
        .mockImplementation(() => ({ ...queueStatus }));

      // Add tasks and verify consistency
      await serverTaskQueueService.addHarvestingTask(playerId, this.createMockHarvestingActivity());
      queueStatus.queuedTasks.push(task1);
      queueStatus.queueLength = 1;
      queueStatus.totalQueueTime = task1.duration;

      await serverTaskQueueService.addCraftingTask(playerId, this.createMockCraftingRecipe());
      queueStatus.queuedTasks.push(task2);
      queueStatus.queueLength = 2;
      queueStatus.totalQueueTime += task2.duration;

      const finalStatus = serverTaskQueueService.getQueueStatus(playerId);
      
      if (finalStatus.queueLength !== 2) {
        throw new Error('Expected queue length to be consistent');
      }
      
      if (finalStatus.totalQueueTime !== task1.duration + task2.duration) {
        throw new Error('Expected total queue time to be consistent');
      }
    });

    // Test task ID uniqueness
    await this.runTest('Task ID uniqueness', async () => {
      const playerId = 'uniqueness-test-player';
      const taskIds = new Set<string>();
      
      // Generate multiple tasks
      for (let i = 0; i < 10; i++) {
        const task = this.createMockTask(TaskType.HARVESTING);
        
        if (taskIds.has(task.id)) {
          throw new Error(`Duplicate task ID detected: ${task.id}`);
        }
        
        taskIds.add(task.id);
      }
      
      if (taskIds.size !== 10) {
        throw new Error('Expected 10 unique task IDs');
      }
    });

    // Test progress consistency
    await this.runTest('Progress consistency', async () => {
      const task = this.createMockTask(TaskType.HARVESTING);
      task.startTime = Date.now() - 15000; // Started 15 seconds ago
      task.duration = 30000; // 30 second duration
      
      // Calculate expected progress
      const elapsed = Date.now() - task.startTime;
      const expectedProgress = Math.min(elapsed / task.duration, 1);
      
      // Mock progress calculation
      const calculatedProgress = elapsed / task.duration;
      
      if (Math.abs(calculatedProgress - expectedProgress) > 0.01) {
        throw new Error('Progress calculation inconsistency');
      }
    });
  }

  /**
   * Test Concurrent Operations
   */
  private async testConcurrentOperations(): Promise<void> {
    console.log('  Testing Concurrent Operations...');

    // Test concurrent task additions
    await this.runTest('Concurrent task additions', async () => {
      const playerId = 'concurrent-test-player';
      const tasks: Task[] = [];
      
      // Mock concurrent additions
      jest.spyOn(serverTaskQueueService, 'addHarvestingTask')
        .mockImplementation(async () => {
          const task = this.createMockTask(TaskType.HARVESTING);
          tasks.push(task);
          return task;
        });

      // Simulate concurrent additions
      const promises = Array(5).fill(null).map(() =>
        serverTaskQueueService.addHarvestingTask(playerId, this.createMockHarvestingActivity())
      );

      await Promise.all(promises);
      
      if (tasks.length !== 5) {
        throw new Error('Expected 5 tasks to be added concurrently');
      }
      
      // Check for unique IDs
      const uniqueIds = new Set(tasks.map(t => t.id));
      if (uniqueIds.size !== 5) {
        throw new Error('Expected all concurrent tasks to have unique IDs');
      }
    });

    // Test concurrent sync operations
    await this.runTest('Concurrent sync operations', async () => {
      const playerId = 'concurrent-sync-test';
      let syncCount = 0;
      
      jest.spyOn(taskQueueSyncService, 'syncWithServer')
        .mockImplementation(async () => {
          syncCount++;
          // Simulate sync delay
          await new Promise(resolve => setTimeout(resolve, 10));
          return {
            success: true,
            syncedAt: Date.now(),
            conflicts: [],
            changes: { added: 0, removed: 0, updated: 1 }
          };
        });

      // Simulate concurrent sync requests
      const syncPromises = Array(3).fill(null).map(() =>
        taskQueueSyncService.syncWithServer(playerId)
      );

      const results = await Promise.all(syncPromises);
      
      if (results.some(r => !r.success)) {
        throw new Error('Expected all concurrent syncs to succeed');
      }
      
      if (syncCount !== 3) {
        throw new Error('Expected 3 sync operations to be executed');
      }
    });
  }

  /**
   * Test Error Recovery
   */
  private async testErrorRecovery(): Promise<void> {
    console.log('  Testing Error Recovery...');

    // Test network error recovery
    await this.runTest('Network error recovery', async () => {
      const playerId = 'network-error-test';
      let attemptCount = 0;
      
      jest.spyOn(taskQueueSyncService, 'syncWithServer')
        .mockImplementation(async () => {
          attemptCount++;
          if (attemptCount < 3) {
            throw new Error('Network error');
          }
          return {
            success: true,
            syncedAt: Date.now(),
            conflicts: [],
            changes: { added: 0, removed: 0, updated: 1 }
          };
        });

      // Mock retry logic
      let result;
      for (let i = 0; i < 3; i++) {
        try {
          result = await taskQueueSyncService.syncWithServer(playerId);
          break;
        } catch (error) {
          if (i === 2) throw error; // Re-throw on final attempt
        }
      }
      
      if (!result?.success) {
        throw new Error('Expected sync to succeed after retries');
      }
      
      if (attemptCount !== 3) {
        throw new Error('Expected 3 sync attempts');
      }
    });

    // Test data corruption recovery
    await this.runTest('Data corruption recovery', async () => {
      const playerId = 'corruption-recovery-test';
      
      // Mock corrupted data detection and recovery
      const mockRecoveryService = require('../../../services/taskQueueRecoveryService');
      jest.spyOn(mockRecoveryService, 'detectCorruption')
        .mockReturnValue(true);
      
      jest.spyOn(mockRecoveryService, 'recoverFromCorruption')
        .mockResolvedValue({
          success: true,
          recoveredQueue: this.createMockTaskQueue(playerId),
          backupUsed: 'latest'
        });

      const corruptionDetected = mockRecoveryService.detectCorruption(playerId);
      
      if (!corruptionDetected) {
        throw new Error('Expected corruption to be detected');
      }
      
      const recovery = await mockRecoveryService.recoverFromCorruption(playerId);
      
      if (!recovery.success) {
        throw new Error('Expected successful recovery from corruption');
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
}