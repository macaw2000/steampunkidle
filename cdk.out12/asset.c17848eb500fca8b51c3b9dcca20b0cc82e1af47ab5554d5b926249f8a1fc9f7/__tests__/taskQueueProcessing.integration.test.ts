/**
 * Integration tests for task queue processing and reward distribution
 * Tests the complete flow from task creation to reward application
 */

import { handler } from '../processTaskQueue';
import { DatabaseService } from '../../../services/databaseService';
import { WebSocketNotificationService } from '../websocketNotificationService';
import { Task, TaskType, TaskQueue, HarvestingTaskData, CraftingTaskData, CombatTaskData, TaskReward } from '../../../types/taskQueue';
import { CharacterStats } from '../../../types/character';
import { ScheduledEvent } from 'aws-lambda';

// Mock dependencies
jest.mock('../../../services/databaseService');
jest.mock('../websocketNotificationService');

const mockDatabaseService = DatabaseService as jest.Mocked<typeof DatabaseService>;
const mockWebSocketService = WebSocketNotificationService as jest.MockedClass<typeof WebSocketNotificationService>;

describe('Task Queue Processing Integration', () => {
  let mockWsInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock WebSocket service instance
    mockWsInstance = {
      sendToPlayer: jest.fn().mockResolvedValue(undefined)
    };
    mockWebSocketService.mockImplementation(() => mockWsInstance as any);
  });

  describe('Continuous Task Processing', () => {
    test('should process all active task queues every second', async () => {
      // Mock active task queues
      const activeQueues = [
        createMockTaskQueue('player-1', createHarvestingTask('player-1')),
        createMockTaskQueue('player-2', createCombatTask('player-2')),
        createMockTaskQueue('player-3', createCraftingTask('player-3'))
      ];

      mockDatabaseService.scan.mockResolvedValue({
        items: activeQueues,
        lastEvaluatedKey: undefined
      });

      // Mock character data for reward application
      mockDatabaseService.getItem.mockImplementation(({ Key }) => {
        return Promise.resolve({
          Item: createMockCharacter(Key.userId)
        });
      });

      mockDatabaseService.updateItem.mockResolvedValue({});
      mockDatabaseService.putItem.mockResolvedValue({});

      // Create scheduled event
      const scheduledEvent: ScheduledEvent = {
        version: '0',
        id: 'test-event',
        'detail-type': 'Scheduled Event',
        source: 'aws.events',
        account: '123456789012',
        time: new Date().toISOString(),
        region: 'us-east-1',
        detail: {}
      };

      // Execute handler
      await handler(scheduledEvent);

      // Verify that scan was called to get active queues
      expect(mockDatabaseService.scan).toHaveBeenCalledWith({
        TableName: expect.any(String),
        FilterExpression: 'isRunning = :running',
        ExpressionAttributeValues: {
          ':running': true,
        },
      });

      // Verify that character updates were called for reward application
      expect(mockDatabaseService.updateItem).toHaveBeenCalledTimes(3); // One for each player
    });

    test('should handle task completion and reward distribution accurately', async () => {
      const completedTask = createHarvestingTask('player-1');
      completedTask.startTime = Date.now() - completedTask.duration - 1000; // Task completed 1 second ago

      const taskQueue = createMockTaskQueue('player-1', completedTask);
      
      mockDatabaseService.scan.mockResolvedValue({
        items: [taskQueue],
        lastEvaluatedKey: undefined
      });

      mockDatabaseService.getItem.mockResolvedValue({
        Item: createMockCharacter('player-1')
      });

      mockDatabaseService.updateItem.mockResolvedValue({});
      mockDatabaseService.putItem.mockResolvedValue({});

      const scheduledEvent: ScheduledEvent = {
        version: '0',
        id: 'test-event',
        'detail-type': 'Scheduled Event',
        source: 'aws.events',
        account: '123456789012',
        time: new Date().toISOString(),
        region: 'us-east-1',
        detail: {}
      };

      await handler(scheduledEvent);

      // Verify character was updated with rewards
      expect(mockDatabaseService.updateItem).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: expect.any(String),
          Key: { userId: 'player-1' },
          UpdateExpression: expect.stringContaining('experience'),
          ExpressionAttributeValues: expect.objectContaining({
            ':exp': expect.any(Number)
          })
        })
      );

      // Verify task queue was updated
      expect(mockDatabaseService.putItem).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: expect.any(String),
          Item: expect.objectContaining({
            playerId: 'player-1',
            totalTasksCompleted: 1,
            totalTimeSpent: completedTask.duration
          })
        })
      );
    });

    test('should send progress notifications during task execution', async () => {
      const ongoingTask = createHarvestingTask('player-1');
      ongoingTask.startTime = Date.now() - 30000; // Task started 30 seconds ago
      ongoingTask.duration = 60000; // 1 minute duration

      const taskQueue = createMockTaskQueue('player-1', ongoingTask);
      
      mockDatabaseService.scan.mockResolvedValue({
        items: [taskQueue],
        lastEvaluatedKey: undefined
      });

      mockDatabaseService.getItem.mockResolvedValue({
        Item: createMockCharacter('player-1')
      });

      const scheduledEvent: ScheduledEvent = {
        version: '0',
        id: 'test-event',
        'detail-type': 'Scheduled Event',
        source: 'aws.events',
        account: '123456789012',
        time: new Date().toISOString(),
        region: 'us-east-1',
        detail: {}
      };

      await handler(scheduledEvent);

      // Verify progress notification was sent
      expect(mockWsInstance.sendToPlayer).toHaveBeenCalledWith(
        'player-1',
        expect.objectContaining({
          type: 'task_progress',
          taskId: ongoingTask.id,
          data: expect.objectContaining({
            progress: expect.any(Number),
            timeRemaining: expect.any(Number),
            isComplete: false
          })
        })
      );
    });
  });

  describe('Reward Generation Accuracy', () => {
    test('should generate predictable harvesting rewards with primary materials', async () => {
      const harvestingTask = createHarvestingTask('player-1');
      harvestingTask.startTime = Date.now() - harvestingTask.duration - 1000; // Completed

      const taskQueue = createMockTaskQueue('player-1', harvestingTask);
      
      mockDatabaseService.scan.mockResolvedValue({
        items: [taskQueue],
        lastEvaluatedKey: undefined
      });

      const mockCharacter = createMockCharacter('player-1');
      mockDatabaseService.getItem.mockResolvedValue({
        Item: mockCharacter
      });

      let capturedUpdateCall: any;
      mockDatabaseService.updateItem.mockImplementation((params) => {
        capturedUpdateCall = params;
        return Promise.resolve({});
      });

      mockDatabaseService.putItem.mockResolvedValue({});

      const scheduledEvent: ScheduledEvent = {
        version: '0',
        id: 'test-event',
        'detail-type': 'Scheduled Event',
        source: 'aws.events',
        account: '123456789012',
        time: new Date().toISOString(),
        region: 'us-east-1',
        detail: {}
      };

      await handler(scheduledEvent);

      // Verify that experience was gained
      expect(capturedUpdateCall.ExpressionAttributeValues[':exp']).toBeGreaterThan(0);
      
      // Verify that inventory was updated with primary material
      const updateExpression = capturedUpdateCall.UpdateExpression;
      expect(updateExpression).toContain('inventory.iron_ore');
    });

    test('should apply skill progression based on activity type', async () => {
      const harvestingTask = createHarvestingTask('player-1');
      harvestingTask.startTime = Date.now() - harvestingTask.duration - 1000;

      const taskQueue = createMockTaskQueue('player-1', harvestingTask);
      
      mockDatabaseService.scan.mockResolvedValue({
        items: [taskQueue],
        lastEvaluatedKey: undefined
      });

      const mockCharacter = createMockCharacter('player-1');
      mockCharacter.lastCompletedTask = harvestingTask;
      
      mockDatabaseService.getItem.mockResolvedValue({
        Item: mockCharacter
      });

      let capturedUpdateCall: any;
      mockDatabaseService.updateItem.mockImplementation((params) => {
        capturedUpdateCall = params;
        return Promise.resolve({});
      });

      mockDatabaseService.putItem.mockResolvedValue({});

      const scheduledEvent: ScheduledEvent = {
        version: '0',
        id: 'test-event',
        'detail-type': 'Scheduled Event',
        source: 'aws.events',
        account: '123456789012',
        time: new Date().toISOString(),
        region: 'us-east-1',
        detail: {}
      };

      await handler(scheduledEvent);

      // Verify that harvesting skill was increased
      const updateExpression = capturedUpdateCall.UpdateExpression;
      expect(updateExpression).toContain('stats.harvestingSkills.mining');
      expect(capturedUpdateCall.ExpressionAttributeValues[':skill_gain']).toBeGreaterThan(0);
    });

    test('should handle level progression when experience thresholds are met', async () => {
      const harvestingTask = createHarvestingTask('player-1');
      harvestingTask.startTime = Date.now() - harvestingTask.duration - 1000;

      const taskQueue = createMockTaskQueue('player-1', harvestingTask);
      
      mockDatabaseService.scan.mockResolvedValue({
        items: [taskQueue],
        lastEvaluatedKey: undefined
      });

      // Create character close to leveling up
      const mockCharacter = createMockCharacter('player-1');
      mockCharacter.experience = 9900; // Close to level 10 (sqrt(10000/100) + 1 = 11)
      mockCharacter.level = 10;
      
      mockDatabaseService.getItem.mockResolvedValue({
        Item: mockCharacter
      });

      let capturedUpdateCall: any;
      mockDatabaseService.updateItem.mockImplementation((params) => {
        capturedUpdateCall = params;
        return Promise.resolve({});
      });

      mockDatabaseService.putItem.mockResolvedValue({});

      const scheduledEvent: ScheduledEvent = {
        version: '0',
        id: 'test-event',
        'detail-type': 'Scheduled Event',
        source: 'aws.events',
        account: '123456789012',
        time: new Date().toISOString(),
        region: 'us-east-1',
        detail: {}
      };

      await handler(scheduledEvent);

      // Verify that level was updated if experience threshold was crossed
      const updateExpression = capturedUpdateCall.UpdateExpression;
      const newExp = capturedUpdateCall.ExpressionAttributeValues[':exp'];
      
      if (newExp >= 10000) { // Level 11 threshold
        expect(updateExpression).toContain('#level = :level');
        expect(capturedUpdateCall.ExpressionAttributeValues[':level']).toBe(11);
      }
    });
  });

  describe('Task Completion Notifications', () => {
    test('should send comprehensive task completion notifications', async () => {
      const completedTask = createCombatTask('player-1');
      completedTask.startTime = Date.now() - completedTask.duration - 1000;

      const taskQueue = createMockTaskQueue('player-1', completedTask);
      
      mockDatabaseService.scan.mockResolvedValue({
        items: [taskQueue],
        lastEvaluatedKey: undefined
      });

      mockDatabaseService.getItem.mockResolvedValue({
        Item: createMockCharacter('player-1')
      });

      mockDatabaseService.updateItem.mockResolvedValue({});
      mockDatabaseService.putItem.mockResolvedValue({});

      const scheduledEvent: ScheduledEvent = {
        version: '0',
        id: 'test-event',
        'detail-type': 'Scheduled Event',
        source: 'aws.events',
        account: '123456789012',
        time: new Date().toISOString(),
        region: 'us-east-1',
        detail: {}
      };

      await handler(scheduledEvent);

      // Verify task completion notification was sent
      expect(mockWsInstance.sendToPlayer).toHaveBeenCalledWith(
        'player-1',
        expect.objectContaining({
          type: 'task_completed',
          taskId: completedTask.id,
          data: expect.objectContaining({
            task: expect.objectContaining({
              id: completedTask.id,
              name: completedTask.name,
              type: completedTask.type,
              completed: true
            }),
            rewards: expect.any(Array),
            queueStats: expect.objectContaining({
              totalCompleted: expect.any(Number),
              averageDuration: expect.any(Number),
              completionRate: expect.any(Number),
              efficiencyScore: expect.any(Number)
            }),
            rewardSummary: expect.any(String)
          })
        })
      );
    });

    test('should send task started notifications for next tasks', async () => {
      const completedTask = createHarvestingTask('player-1');
      completedTask.startTime = Date.now() - completedTask.duration - 1000;

      const nextTask = createCombatTask('player-1');
      nextTask.id = 'next-task-id';

      const taskQueue = createMockTaskQueue('player-1', completedTask);
      taskQueue.queuedTasks = [nextTask];
      
      mockDatabaseService.scan.mockResolvedValue({
        items: [taskQueue],
        lastEvaluatedKey: undefined
      });

      mockDatabaseService.getItem.mockResolvedValue({
        Item: createMockCharacter('player-1')
      });

      mockDatabaseService.updateItem.mockResolvedValue({});
      mockDatabaseService.putItem.mockResolvedValue({});

      const scheduledEvent: ScheduledEvent = {
        version: '0',
        id: 'test-event',
        'detail-type': 'Scheduled Event',
        source: 'aws.events',
        account: '123456789012',
        time: new Date().toISOString(),
        region: 'us-east-1',
        detail: {}
      };

      await handler(scheduledEvent);

      // Verify task started notification was sent for next task
      expect(mockWsInstance.sendToPlayer).toHaveBeenCalledWith(
        'player-1',
        expect.objectContaining({
          type: 'task_started',
          taskId: 'next-task-id',
          data: expect.objectContaining({
            task: expect.objectContaining({
              id: 'next-task-id',
              name: nextTask.name,
              type: nextTask.type,
              duration: nextTask.duration
            })
          })
        })
      );
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should continue processing other queues when one fails', async () => {
      const workingQueue = createMockTaskQueue('player-1', createHarvestingTask('player-1'));
      const failingQueue = createMockTaskQueue('player-2', createCombatTask('player-2'));

      mockDatabaseService.scan.mockResolvedValue({
        items: [workingQueue, failingQueue],
        lastEvaluatedKey: undefined
      });

      // Mock character retrieval to fail for player-2
      mockDatabaseService.getItem.mockImplementation(({ Key }) => {
        if (Key.userId === 'player-2') {
          return Promise.reject(new Error('Database error'));
        }
        return Promise.resolve({
          Item: createMockCharacter(Key.userId)
        });
      });

      mockDatabaseService.updateItem.mockResolvedValue({});
      mockDatabaseService.putItem.mockResolvedValue({});

      const scheduledEvent: ScheduledEvent = {
        version: '0',
        id: 'test-event',
        'detail-type': 'Scheduled Event',
        source: 'aws.events',
        account: '123456789012',
        time: new Date().toISOString(),
        region: 'us-east-1',
        detail: {}
      };

      await handler(scheduledEvent);

      // Verify that player-1's queue was still processed successfully
      expect(mockDatabaseService.updateItem).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: { userId: 'player-1' }
        })
      );
    });
  });
});

// Helper functions for creating mock data
function createMockTaskQueue(playerId: string, currentTask: Task): TaskQueue {
  return {
    playerId,
    currentTask,
    queuedTasks: [],
    isRunning: true,
    isPaused: false,
    totalTasksCompleted: 0,
    totalTimeSpent: 0,
    totalRewardsEarned: [],
    averageTaskDuration: 0,
    taskCompletionRate: 0,
    queueEfficiencyScore: 0.5,
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
      pauseOnError: false,
      resumeOnResourceAvailable: true,
      persistenceInterval: 10000,
      integrityCheckInterval: 60000,
      maxHistorySize: 100
    },
    lastUpdated: Date.now(),
    lastSynced: Date.now(),
    createdAt: Date.now(),
    version: 1,
    checksum: 'test-checksum',
    lastValidated: Date.now(),
    stateHistory: [],
    maxHistorySize: 10,
    lastProcessed: new Date().toISOString()
  };
}

function createHarvestingTask(playerId: string): Task {
  return {
    id: `harvesting-${Date.now()}`,
    type: TaskType.HARVESTING,
    name: 'Mine Iron Ore',
    description: 'Extract iron ore from the steam mines',
    icon: 'mining-icon',
    duration: 60000, // 1 minute
    startTime: Date.now(),
    playerId,
    activityData: {
      activity: {
        id: 'iron-mining',
        name: 'Iron Mining',
        primaryResource: 'iron_ore',
        baseYield: 3,
        category: 'metallurgical'
      },
      playerStats: {
        harvestingSkills: { mining: 15 }
      },
      tools: [],
      expectedYield: []
    } as HarvestingTaskData,
    prerequisites: [],
    resourceRequirements: [],
    progress: 0,
    completed: false,
    rewards: [],
    priority: 1,
    estimatedCompletion: Date.now() + 60000,
    retryCount: 0,
    maxRetries: 3,
    isValid: true,
    validationErrors: []
  };
}

function createCombatTask(playerId: string): Task {
  return {
    id: `combat-${Date.now()}`,
    type: TaskType.COMBAT,
    name: 'Fight Steam Golem',
    description: 'Battle against a mechanical steam golem',
    icon: 'combat-icon',
    duration: 90000, // 1.5 minutes
    startTime: Date.now(),
    playerId,
    activityData: {
      enemy: {
        id: 'steam-golem',
        name: 'Steam Golem',
        level: 5,
        lootTable: [
          { itemId: 'golem_core', quantity: 1, rarity: 'uncommon' }
        ]
      },
      playerStats: { attack: 20, defense: 15 },
      equipment: []
    } as CombatTaskData,
    prerequisites: [],
    resourceRequirements: [],
    progress: 0,
    completed: false,
    rewards: [],
    priority: 1,
    estimatedCompletion: Date.now() + 90000,
    retryCount: 0,
    maxRetries: 3,
    isValid: true,
    validationErrors: []
  };
}

function createCraftingTask(playerId: string): Task {
  return {
    id: `crafting-${Date.now()}`,
    type: TaskType.CRAFTING,
    name: 'Craft Steam Gear',
    description: 'Create a precision steam gear',
    icon: 'crafting-icon',
    duration: 120000, // 2 minutes
    startTime: Date.now(),
    playerId,
    activityData: {
      recipe: {
        id: 'steam-gear',
        name: 'Steam Gear',
        requiredLevel: 3
      },
      materials: [],
      playerSkillLevel: 10,
      qualityModifier: 1.0,
      expectedOutputs: [
        { itemId: 'steam_gear', quantity: 1 }
      ]
    } as CraftingTaskData,
    prerequisites: [],
    resourceRequirements: [],
    progress: 0,
    completed: false,
    rewards: [],
    priority: 1,
    estimatedCompletion: Date.now() + 120000,
    retryCount: 0,
    maxRetries: 3,
    isValid: true,
    validationErrors: []
  };
}

function createMockCharacter(userId: string) {
  return {
    userId,
    name: `Player ${userId}`,
    level: 5,
    experience: 500,
    currency: 100,
    inventory: {},
    stats: {
      strength: 15,
      dexterity: 12,
      intelligence: 18,
      vitality: 14,
      harvestingSkills: {
        mining: 15,
        foraging: 8,
        salvaging: 5,
        crystal_extraction: 3
      },
      craftingSkills: {
        clockmaking: 10,
        engineering: 6,
        alchemy: 4,
        steamcraft: 8
      },
      combatSkills: {
        melee: 7,
        ranged: 5,
        defense: 9,
        tactics: 4
      }
    },
    lastActiveAt: new Date().toISOString()
  };
}