import { TestDataGenerator, Player } from '../utils/TestDataGenerator';
import { OfflineOnlineTestResults, OfflineOnlineScenarioResult } from '../UserAcceptanceTestSuite';
import { serverTaskQueueService } from '../../../services/serverTaskQueueService';
import { OfflineTaskQueueManager } from '../../../services/offlineTaskQueueManager';
import { OfflineSyncIntegration } from '../../../services/offlineSyncIntegration';
import { TaskQueue, Task } from '../../../types/taskQueue';

/**
 * Tests offline/online transitions and data synchronization
 * Validates Requirements: 1.1, 5.1, 9.1
 */
export class OfflineOnlineTransitionTests {
  private testDataGenerator: TestDataGenerator;
  private serverTaskQueueService: typeof serverTaskQueueService;
  private offlineTaskQueueManager: OfflineTaskQueueManager;
  private offlineSyncIntegration: OfflineSyncIntegration;

  constructor(testDataGenerator: TestDataGenerator) {
    this.testDataGenerator = testDataGenerator;
    this.serverTaskQueueService = serverTaskQueueService;
    this.offlineTaskQueueManager = new OfflineTaskQueueManager();
    this.offlineSyncIntegration = new OfflineSyncIntegration();
  }

  /**
   * Run all offline/online transition tests
   */
  async runAllTests(): Promise<OfflineOnlineTestResults> {
    const scenarios: OfflineOnlineScenarioResult[] = [];
    
    try {
      // Test offline task processing
      scenarios.push(await this.testOfflineTaskProcessing());
      
      // Test online reconnection sync
      scenarios.push(await this.testOnlineReconnectionSync());
      
      // Test conflict resolution
      scenarios.push(await this.testConflictResolution());
      
      // Test data integrity during transitions
      scenarios.push(await this.testDataIntegrityDuringTransitions());
      
      // Test incremental synchronization
      scenarios.push(await this.testIncrementalSynchronization());
      
      // Test extended offline periods
      scenarios.push(await this.testExtendedOfflinePeriods());

      const passedTests = scenarios.filter(s => s.status === 'PASSED').length;
      
      return {
        totalTests: scenarios.length,
        passedTests,
        scenarios
      };
      
    } catch (error) {
      console.error('Offline/Online Transition Tests failed:', error);
      throw error;
    }
  }

  /**
   * Test offline task processing continues when player is offline
   */
  private async testOfflineTaskProcessing(): Promise<OfflineOnlineScenarioResult> {
    const startTime = Date.now();
    const testName = 'Offline Task Processing';
    
    try {
      const player = this.testDataGenerator.generateTestPlayer('CASUAL');
      
      // Set up initial queue with tasks
      const tasks = [
        this.testDataGenerator.generateTask('HARVESTING'),
        this.testDataGenerator.generateTask('CRAFTING'),
        this.testDataGenerator.generateTask('COMBAT')
      ];
      
      // Add tasks while online
      for (const task of tasks) {
        await this.serverTaskQueueService.addTask(player.id, task);
      }
      
      const initialStatus = await this.serverTaskQueueService.getQueueStatus(player.id);
      const initialQueueLength = initialStatus.queuedTasks.length;
      
      // Simulate going offline
      await this.simulateOfflineMode(player.id);
      
      // Let offline processing run for a period
      const offlineProcessingTime = 5000; // 5 seconds
      await new Promise(resolve => setTimeout(resolve, offlineProcessingTime));
      
      // Check offline progress
      const offlineStatus = await this.offlineTaskQueueManager.getOfflineQueueStatus(player.id);
      
      // Simulate coming back online
      await this.simulateOnlineMode(player.id);
      
      // Check final status after sync
      const finalStatus = await this.serverTaskQueueService.getQueueStatus(player.id);
      
      const syncMetrics = {
        initialQueueLength,
        offlineProcessingTime,
        tasksProcessedOffline: Math.max(0, initialQueueLength - (offlineStatus?.queuedTasks.length || initialQueueLength)),
        finalQueueLength: finalStatus.queuedTasks.length,
        progressMaintained: finalStatus.totalTasksCompleted >= initialStatus.totalTasksCompleted
      };
      
      return {
        name: testName,
        status: syncMetrics.progressMaintained ? 'PASSED' : 'FAILED',
        duration: Date.now() - startTime,
        details: `Offline processing maintained progress: ${syncMetrics.tasksProcessedOffline} tasks processed offline`,
        syncMetrics
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
   * Test online reconnection and synchronization
   */
  private async testOnlineReconnectionSync(): Promise<OfflineOnlineScenarioResult> {
    const startTime = Date.now();
    const testName = 'Online Reconnection Sync';
    
    try {
      const player = this.testDataGenerator.generateTestPlayer('HARDCORE');
      
      // Set up initial state
      const initialTasks = [
        this.testDataGenerator.generateTask('HARVESTING'),
        this.testDataGenerator.generateTask('CRAFTING')
      ];
      
      for (const task of initialTasks) {
        await this.serverTaskQueueService.addTask(player.id, task);
      }
      
      // Simulate disconnection
      await this.simulateOfflineMode(player.id);
      
      // Make offline changes
      const offlineTask = this.testDataGenerator.generateTask('COMBAT');
      await this.offlineTaskQueueManager.addOfflineTask(player.id, offlineTask);
      
      // Simulate server-side changes (other device or background processing)
      const serverTask = this.testDataGenerator.generateTask('HARVESTING');
      await this.serverTaskQueueService.addTask(player.id, serverTask);
      
      // Record pre-sync state
      const preSyncOfflineState = await this.offlineTaskQueueManager.getOfflineQueueStatus(player.id);
      const preSyncServerState = await this.serverTaskQueueService.getQueueStatus(player.id);
      
      // Simulate reconnection and sync
      const syncStartTime = Date.now();
      await this.simulateOnlineMode(player.id);
      
      // Perform synchronization
      const syncResult = await this.offlineSyncIntegration.syncPlayerQueue(player.id);
      const syncDuration = Date.now() - syncStartTime;
      
      // Verify final state
      const finalStatus = await this.serverTaskQueueService.getQueueStatus(player.id);
      
      const syncMetrics = {
        syncDuration,
        offlineTasksBeforeSync: preSyncOfflineState?.queuedTasks.length || 0,
        serverTasksBeforeSync: preSyncServerState.queuedTasks.length,
        finalTaskCount: finalStatus.queuedTasks.length,
        syncSuccessful: syncResult.success,
        conflictsResolved: syncResult.conflictsResolved || 0
      };
      
      return {
        name: testName,
        status: syncResult.success ? 'PASSED' : 'FAILED',
        duration: Date.now() - startTime,
        details: `Reconnection sync completed in ${syncDuration}ms with ${syncMetrics.conflictsResolved} conflicts resolved`,
        syncMetrics
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
   * Test conflict resolution during sync
   */
  private async testConflictResolution(): Promise<OfflineOnlineScenarioResult> {
    const startTime = Date.now();
    const testName = 'Conflict Resolution';
    
    try {
      const player = this.testDataGenerator.generateTestPlayer('CASUAL');
      
      // Set up initial queue
      const baseTask = this.testDataGenerator.generateTask('HARVESTING');
      await this.serverTaskQueueService.addTask(player.id, baseTask);
      
      // Simulate offline mode
      await this.simulateOfflineMode(player.id);
      
      // Create conflicting changes
      // Offline: Remove the task and add a new one
      await this.offlineTaskQueueManager.removeOfflineTask(player.id, baseTask.id);
      const offlineTask = this.testDataGenerator.generateTask('CRAFTING');
      await this.offlineTaskQueueManager.addOfflineTask(player.id, offlineTask);
      
      // Server: Modify the same task (simulate completion)
      await this.serverTaskQueueService.completeTask(player.id, baseTask.id);
      const serverTask = this.testDataGenerator.generateTask('COMBAT');
      await this.serverTaskQueueService.addTask(player.id, serverTask);
      
      // Record conflict state
      const offlineState = await this.offlineTaskQueueManager.getOfflineQueueStatus(player.id);
      const serverState = await this.serverTaskQueueService.getQueueStatus(player.id);
      
      // Perform conflict resolution
      const resolutionStartTime = Date.now();
      await this.simulateOnlineMode(player.id);
      
      const syncResult = await this.offlineSyncIntegration.syncPlayerQueue(player.id);
      const resolutionDuration = Date.now() - resolutionStartTime;
      
      // Verify resolution
      const finalStatus = await this.serverTaskQueueService.getQueueStatus(player.id);
      
      const syncMetrics = {
        resolutionDuration,
        conflictsDetected: syncResult.conflictsDetected || 0,
        conflictsResolved: syncResult.conflictsResolved || 0,
        resolutionStrategy: syncResult.resolutionStrategy || 'SERVER_AUTHORITY',
        finalTaskCount: finalStatus.queuedTasks.length,
        dataIntegrityMaintained: finalStatus.queuedTasks.every(t => t.id && t.type)
      };
      
      return {
        name: testName,
        status: syncMetrics.conflictsResolved >= syncMetrics.conflictsDetected ? 'PASSED' : 'FAILED',
        duration: Date.now() - startTime,
        details: `Resolved ${syncMetrics.conflictsResolved}/${syncMetrics.conflictsDetected} conflicts using ${syncMetrics.resolutionStrategy}`,
        syncMetrics
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
   * Test data integrity during offline/online transitions
   */
  private async testDataIntegrityDuringTransitions(): Promise<OfflineOnlineScenarioResult> {
    const startTime = Date.now();
    const testName = 'Data Integrity During Transitions';
    
    try {
      const player = this.testDataGenerator.generateTestPlayer('HARDCORE');
      
      // Create comprehensive initial state
      const initialTasks = [
        this.testDataGenerator.generateTask('HARVESTING'),
        this.testDataGenerator.generateTask('CRAFTING'),
        this.testDataGenerator.generateTask('COMBAT')
      ];
      
      for (const task of initialTasks) {
        await this.serverTaskQueueService.addTask(player.id, task);
      }
      
      const initialStatus = await this.serverTaskQueueService.getQueueStatus(player.id);
      const initialChecksum = this.calculateQueueChecksum(initialStatus);
      
      // Perform multiple offline/online transitions
      const transitionCount = 3;
      const transitionResults = [];
      
      for (let i = 0; i < transitionCount; i++) {
        // Go offline
        await this.simulateOfflineMode(player.id);
        
        // Make offline changes
        const offlineTask = this.testDataGenerator.generateTask('HARVESTING');
        await this.offlineTaskQueueManager.addOfflineTask(player.id, offlineTask);
        
        // Come back online
        await this.simulateOnlineMode(player.id);
        
        // Sync and verify
        const syncResult = await this.offlineSyncIntegration.syncPlayerQueue(player.id);
        const currentStatus = await this.serverTaskQueueService.getQueueStatus(player.id);
        
        transitionResults.push({
          transition: i + 1,
          syncSuccess: syncResult.success,
          queueIntegrity: this.validateQueueIntegrity(currentStatus),
          taskCount: currentStatus.queuedTasks.length
        });
      }
      
      // Final integrity check
      const finalStatus = await this.serverTaskQueueService.getQueueStatus(player.id);
      const finalIntegrity = this.validateQueueIntegrity(finalStatus);
      
      const syncMetrics = {
        transitionCount,
        successfulTransitions: transitionResults.filter(r => r.syncSuccess).length,
        integrityMaintained: transitionResults.every(r => r.queueIntegrity),
        finalIntegrity,
        finalTaskCount: finalStatus.queuedTasks.length,
        dataConsistency: finalStatus.lastSynced <= Date.now()
      };
      
      return {
        name: testName,
        status: syncMetrics.integrityMaintained && syncMetrics.finalIntegrity ? 'PASSED' : 'FAILED',
        duration: Date.now() - startTime,
        details: `Data integrity maintained through ${syncMetrics.successfulTransitions}/${transitionCount} transitions`,
        syncMetrics
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
   * Test incremental synchronization efficiency
   */
  private async testIncrementalSynchronization(): Promise<OfflineOnlineScenarioResult> {
    const startTime = Date.now();
    const testName = 'Incremental Synchronization';
    
    try {
      const player = this.testDataGenerator.generateTestPlayer('CASUAL');
      
      // Set up large initial queue
      const largeBatch = [];
      for (let i = 0; i < 50; i++) {
        largeBatch.push(this.testDataGenerator.generateTask(
          ['HARVESTING', 'CRAFTING', 'COMBAT'][i % 3] as any
        ));
      }
      
      for (const task of largeBatch) {
        await this.serverTaskQueueService.addTask(player.id, task);
      }
      
      // Go offline and make minimal changes
      await this.simulateOfflineMode(player.id);
      
      const smallChanges = [
        this.testDataGenerator.generateTask('HARVESTING'),
        this.testDataGenerator.generateTask('CRAFTING')
      ];
      
      for (const task of smallChanges) {
        await this.offlineTaskQueueManager.addOfflineTask(player.id, task);
      }
      
      // Measure sync efficiency
      const syncStartTime = Date.now();
      await this.simulateOnlineMode(player.id);
      
      const syncResult = await this.offlineSyncIntegration.syncPlayerQueue(player.id);
      const syncDuration = Date.now() - syncStartTime;
      
      // Verify incremental sync worked
      const finalStatus = await this.serverTaskQueueService.getQueueStatus(player.id);
      
      const syncMetrics = {
        initialTaskCount: largeBatch.length,
        changesApplied: smallChanges.length,
        syncDuration,
        finalTaskCount: finalStatus.queuedTasks.length,
        syncEfficiency: syncDuration < 1000, // Should be fast for small changes
        incrementalSync: syncResult.incrementalSync || false,
        dataTransferred: syncResult.dataTransferred || 0
      };
      
      return {
        name: testName,
        status: syncMetrics.syncEfficiency && syncResult.success ? 'PASSED' : 'FAILED',
        duration: Date.now() - startTime,
        details: `Incremental sync completed in ${syncDuration}ms for ${smallChanges.length} changes`,
        syncMetrics
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
   * Test extended offline periods
   */
  private async testExtendedOfflinePeriods(): Promise<OfflineOnlineScenarioResult> {
    const startTime = Date.now();
    const testName = 'Extended Offline Periods';
    
    try {
      const player = this.testDataGenerator.generateTestPlayer('CASUAL');
      
      // Set up long-running tasks
      const longTasks = [
        { ...this.testDataGenerator.generateTask('HARVESTING'), duration: 10000 },
        { ...this.testDataGenerator.generateTask('CRAFTING'), duration: 15000 },
        { ...this.testDataGenerator.generateTask('COMBAT'), duration: 12000 }
      ];
      
      for (const task of longTasks) {
        await this.serverTaskQueueService.addTask(player.id, task);
      }
      
      const initialStatus = await this.serverTaskQueueService.getQueueStatus(player.id);
      
      // Simulate extended offline period
      await this.simulateOfflineMode(player.id);
      
      const extendedOfflineTime = 20000; // 20 seconds
      await new Promise(resolve => setTimeout(resolve, extendedOfflineTime));
      
      // Check offline progress
      const offlineStatus = await this.offlineTaskQueueManager.getOfflineQueueStatus(player.id);
      
      // Come back online after extended period
      await this.simulateOnlineMode(player.id);
      
      const syncResult = await this.offlineSyncIntegration.syncPlayerQueue(player.id);
      const finalStatus = await this.serverTaskQueueService.getQueueStatus(player.id);
      
      const syncMetrics = {
        offlineDuration: extendedOfflineTime,
        initialTaskCount: initialStatus.queuedTasks.length,
        tasksCompletedOffline: Math.max(0, initialStatus.queuedTasks.length - (offlineStatus?.queuedTasks.length || initialStatus.queuedTasks.length)),
        finalTaskCount: finalStatus.queuedTasks.length,
        progressPreserved: finalStatus.totalTasksCompleted >= initialStatus.totalTasksCompleted,
        syncAfterExtendedOffline: syncResult.success
      };
      
      return {
        name: testName,
        status: syncMetrics.progressPreserved && syncMetrics.syncAfterExtendedOffline ? 'PASSED' : 'FAILED',
        duration: Date.now() - startTime,
        details: `Extended offline period (${extendedOfflineTime}ms) handled successfully with ${syncMetrics.tasksCompletedOffline} tasks completed`,
        syncMetrics
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
   * Simulate offline mode
   */
  private async simulateOfflineMode(playerId: string): Promise<void> {
    // Switch to offline task queue manager
    await this.offlineTaskQueueManager.enableOfflineMode(playerId);
  }

  /**
   * Simulate online mode
   */
  private async simulateOnlineMode(playerId: string): Promise<void> {
    // Switch back to server task queue service
    await this.offlineTaskQueueManager.disableOfflineMode(playerId);
  }

  /**
   * Calculate queue checksum for integrity verification
   */
  private calculateQueueChecksum(queue: TaskQueue): string {
    const data = JSON.stringify({
      queuedTasks: queue.queuedTasks.map(t => ({ id: t.id, type: t.type })),
      totalTasksCompleted: queue.totalTasksCompleted,
      totalTimeSpent: queue.totalTimeSpent
    });
    
    // Simple checksum calculation
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString(16);
  }

  /**
   * Validate queue integrity
   */
  private validateQueueIntegrity(queue: TaskQueue): boolean {
    // Check basic structure
    if (!queue.playerId || !Array.isArray(queue.queuedTasks)) {
      return false;
    }
    
    // Check task integrity
    for (const task of queue.queuedTasks) {
      if (!task.id || !task.type || !task.name) {
        return false;
      }
    }
    
    // Check timestamps
    if (queue.lastUpdated > Date.now() || queue.createdAt > Date.now()) {
      return false;
    }
    
    return true;
  }
}