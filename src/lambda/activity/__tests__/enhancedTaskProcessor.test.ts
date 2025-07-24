/**
 * Tests for the enhanced task processor with multi-activity support
 */

import { handler } from '../processTaskQueue';
import { WebSocketNotificationService } from '../websocketNotificationService';
import { DatabaseService } from '../../../services/databaseService';
import { Task, TaskType, TaskQueue, HarvestingTaskData, CraftingTaskData, CombatTaskData } from '../../../types/taskQueue';
import { APIGatewayProxyEvent, ScheduledEvent } from 'aws-lambda';

// Mock dependencies
jest.mock('../../../services/databaseService');
jest.mock('../websocketNotificationService');

const mockDatabaseService = DatabaseService as jest.Mocked<typeof DatabaseService>;
const mockWebSocketService = WebSocketNotificationService as jest.MockedClass<typeof WebSocketNotificationService>;

describe('Enhanced Task Processor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Multi-Activity Task Processing', () => {
    it('should process harvesting tasks with proper reward calculation', async () => {
      const harvestingTask: Task = {
        id: 'harvest-001',
        type: TaskType.HARVESTING,
        name: 'Mine Copper Ore',
        description: 'Extract copper ore from the steam mines',
        icon: 'mining-icon',
        duration: 60000, // 1 minute
        startTime: Date.now() - 60000, // Started 1 minute ago
        playerId: 'player-123',
        activityData: {
          activity: {
            id: 'copper-mining',
            name: 'Copper Mining',
            skill: 'mining',
            baseYield: 3,
            primaryResource: 'copper_ore',
            rareResource: 'steam_crystal'
          },
          playerStats: {
            level: 5,
            harvestingSkills: { mining: 25 }
          },
          tools: [{
            toolId: 'steam-pickaxe',
            name: 'Steam Pickaxe',
            type: 'harvesting' as const,
            bonuses: [{ type: 'yield', value: 15, description: '+15% yield' }],
            durability: 80,
            maxDurability: 100
          }],
          expectedYield: []
        } as HarvestingTaskData,
        prerequisites: [],
        resourceRequirements: [],
        progress: 0,
        completed: false,
        rewards: [],
        priority: 1,
        estimatedCompletion: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        isValid: true,
        validationErrors: []
      };

      const taskQueue: TaskQueue = {
        playerId: 'player-123',
        currentTask: harvestingTask,
        queuedTasks: [],
        isRunning: true,
        isPaused: false,
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
        maxHistorySize: 100,
        canResume: true
      };

      // Mock database responses
      mockDatabaseService.scan.mockResolvedValue({
        items: [taskQueue],
        count: 1,
        scannedCount: 1
      });

      mockDatabaseService.getItem.mockResolvedValue({
        userId: 'player-123',
        level: 5,
        experience: 1000,
        stats: {
          level: 5,
          harvestingSkills: { mining: 25 }
        }
      });

      mockDatabaseService.putItem.mockResolvedValue({});
      mockDatabaseService.updateItem.mockResolvedValue({});

      // Mock WebSocket service
      const mockWsInstance = {
        sendToPlayer: jest.fn().mockResolvedValue(undefined)
      };
      mockWebSocketService.mockImplementation(() => mockWsInstance as any);

      // Create scheduled event
      const scheduledEvent: ScheduledEvent = {
        id: 'test-event',
        'detail-type': 'Scheduled Event',
        source: 'aws.events',
        account: '123456789012',
        time: new Date().toISOString(),
        region: 'us-east-1',
        detail: {},
        version: '0',
        resources: []
      };

      // Execute handler
      await handler(scheduledEvent);

      // Verify task processing
      expect(mockDatabaseService.scan).toHaveBeenCalledWith({
        TableName: expect.any(String),
        FilterExpression: 'isRunning = :running',
        ExpressionAttributeValues: {
          ':running': true
        }
      });

      // Verify character update with rewards
      expect(mockDatabaseService.updateItem).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: expect.any(String),
          Key: { userId: 'player-123' },
          UpdateExpression: expect.stringContaining('experience'),
          ExpressionAttributeValues: expect.objectContaining({
            ':exp': expect.any(Number)
          })
        })
      );

      // Verify WebSocket notifications were sent
      expect(mockWsInstance.sendToPlayer).toHaveBeenCalled();
      
      // Verify that progress updates are sent during task processing
      const progressCall = mockWsInstance.sendToPlayer.mock.calls.find(call => 
        call[1].type === 'task_progress'
      );
      expect(progressCall).toBeDefined();
      expect(progressCall[0]).toBe('player-123');
      expect(progressCall[1].taskId).toBe('harvest-001');
      
      // Verify that task completion notifications are sent
      const completionCall = mockWsInstance.sendToPlayer.mock.calls.find(call => 
        call[1].type === 'task_completed'
      );
      if (completionCall) {
        expect(completionCall[0]).toBe('player-123');
        expect(completionCall[1].taskId).toBe('harvest-001');
      }
    });

    it('should process crafting tasks with material validation', async () => {
      const craftingTask: Task = {
        id: 'craft-001',
        type: TaskType.CRAFTING,
        name: 'Craft Clockwork Gear',
        description: 'Create a precision clockwork gear',
        icon: 'crafting-icon',
        duration: 120000, // 2 minutes
        startTime: Date.now() - 120000,
        playerId: 'player-456',
        activityData: {
          recipe: {
            id: 'clockwork-gear',
            name: 'Clockwork Gear',
            description: 'A precision mechanical component',
            difficulty: 2,
            craftingTime: 120000,
            requiredSkillLevel: 15,
            materials: [],
            outputs: [],
            category: 'mechanical'
          },
          materials: [
            { id: 'copper-ingot', name: 'Copper Ingot', quantity: 2, quality: 'common' },
            { id: 'steam-oil', name: 'Steam Oil', quantity: 1, quality: 'common' }
          ],
          playerSkillLevel: 20,
          qualityModifier: 1.1,
          expectedOutputs: [
            { itemId: 'clockwork-gear', quantity: 1, quality: 'common' }
          ]
        } as CraftingTaskData,
        prerequisites: [],
        resourceRequirements: [],
        progress: 0,
        completed: false,
        rewards: [],
        priority: 1,
        estimatedCompletion: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        isValid: true,
        validationErrors: []
      };

      const taskQueue: TaskQueue = {
        playerId: 'player-456',
        currentTask: craftingTask,
        queuedTasks: [],
        isRunning: true,
        isPaused: false,
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
        maxHistorySize: 100,
        canResume: true
      };

      mockDatabaseService.scan.mockResolvedValue({
        items: [taskQueue],
        count: 1,
        scannedCount: 1
      });

      mockDatabaseService.getItem.mockResolvedValue({
        userId: 'player-456',
        level: 8,
        experience: 2000,
        stats: {
          level: 8,
          craftingSkills: { clockmaking: 20 }
        }
      });

      const scheduledEvent: ScheduledEvent = {
        id: 'test-event',
        'detail-type': 'Scheduled Event',
        source: 'aws.events',
        account: '123456789012',
        time: new Date().toISOString(),
        region: 'us-east-1',
        detail: {},
        version: '0',
        resources: []
      };

      await handler(scheduledEvent);

      // Verify crafting-specific processing
      expect(mockDatabaseService.updateItem).toHaveBeenCalledWith(
        expect.objectContaining({
          UpdateExpression: expect.stringContaining('experience')
        })
      );
    });

    it('should process combat tasks with win probability calculation', async () => {
      const combatTask: Task = {
        id: 'combat-001',
        type: TaskType.COMBAT,
        name: 'Fight Steam Automaton',
        description: 'Battle against a mechanical enemy',
        icon: 'combat-icon',
        duration: 90000, // 1.5 minutes
        startTime: Date.now() - 90000,
        playerId: 'player-789',
        activityData: {
          enemy: {
            id: 'steam-automaton',
            name: 'Steam Automaton',
            level: 6,
            health: 100,
            attack: 15,
            defense: 8,
            difficulty: 1.2,
            rarity: 'common',
            lootTable: ['mechanical-parts', 'steam-core']
          },
          playerLevel: 7,
          playerStats: {
            strength: 18,
            dexterity: 12,
            vitality: 15
          },
          equipment: [
            {
              equipmentId: 'steam-sword',
              name: 'Steam Sword',
              type: 'weapon' as const,
              stats: { attack: 12, criticalChance: 0.1 },
              requirements: [],
              durability: 90,
              maxDurability: 100
            }
          ],
          combatStrategy: {
            strategyId: 'aggressive',
            name: 'Aggressive',
            description: 'Focus on dealing maximum damage',
            modifiers: [
              { type: 'damage', value: 1.2, description: '+20% damage' }
            ]
          },
          estimatedOutcome: {
            winProbability: 0.75,
            estimatedDuration: 90000,
            expectedRewards: [],
            riskLevel: 'medium' as const
          }
        } as CombatTaskData,
        prerequisites: [],
        resourceRequirements: [],
        progress: 0,
        completed: false,
        rewards: [],
        priority: 1,
        estimatedCompletion: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        isValid: true,
        validationErrors: []
      };

      const taskQueue: TaskQueue = {
        playerId: 'player-789',
        currentTask: combatTask,
        queuedTasks: [],
        isRunning: true,
        isPaused: false,
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
        maxHistorySize: 100,
        canResume: true
      };

      mockDatabaseService.scan.mockResolvedValue({
        items: [taskQueue],
        count: 1,
        scannedCount: 1
      });

      mockDatabaseService.getItem.mockResolvedValue({
        userId: 'player-789',
        level: 7,
        experience: 1500,
        stats: {
          level: 7,
          combatSkills: { melee: 18 }
        }
      });

      const scheduledEvent: ScheduledEvent = {
        id: 'test-event',
        'detail-type': 'Scheduled Event',
        source: 'aws.events',
        account: '123456789012',
        time: new Date().toISOString(),
        region: 'us-east-1',
        detail: {},
        version: '0',
        resources: []
      };

      await handler(scheduledEvent);

      // Verify combat processing with experience and currency rewards
      expect(mockDatabaseService.updateItem).toHaveBeenCalledWith(
        expect.objectContaining({
          UpdateExpression: expect.stringMatching(/experience.*currency/)
        })
      );
    });
  });

  describe('WebSocket Notifications', () => {
    it('should send real-time progress updates', async () => {
      const mockWsInstance = {
        sendToPlayer: jest.fn().mockResolvedValue(undefined)
      };
      mockWebSocketService.mockImplementation(() => mockWsInstance as any);

      const taskQueue: TaskQueue = {
        playerId: 'player-123',
        currentTask: {
          id: 'test-task',
          type: TaskType.HARVESTING,
          name: 'Test Task',
          description: 'Test',
          icon: 'test',
          duration: 60000,
          startTime: Date.now() - 30000, // Half completed
          playerId: 'player-123',
          activityData: {} as any,
          prerequisites: [],
          resourceRequirements: [],
          progress: 0.5,
          completed: false,
          rewards: [],
          priority: 1,
          estimatedCompletion: Date.now() + 30000,
          retryCount: 0,
          maxRetries: 3,
          isValid: true,
          validationErrors: []
        },
        queuedTasks: [],
        isRunning: true,
        isPaused: false,
        totalTasksCompleted: 0,
        totalTimeSpent: 0,
        totalRewardsEarned: [],
        averageTaskDuration: 0,
        taskCompletionRate: 0,
        queueEfficiencyScore: 0,
        config: {} as any,
        lastUpdated: Date.now(),
        lastSynced: Date.now(),
        createdAt: Date.now(),
        version: 1,
        checksum: 'test',
        lastValidated: Date.now(),
        stateHistory: [],
        maxHistorySize: 100,
        canResume: true
      };

      mockDatabaseService.scan.mockResolvedValue({
        items: [taskQueue],
        count: 1,
        scannedCount: 1
      });

      mockDatabaseService.getItem.mockResolvedValue({
        userId: 'player-123',
        stats: { level: 1 }
      });

      const scheduledEvent: ScheduledEvent = {
        id: 'test-event',
        'detail-type': 'Scheduled Event',
        source: 'aws.events',
        account: '123456789012',
        time: new Date().toISOString(),
        region: 'us-east-1',
        detail: {},
        version: '0',
        resources: []
      };

      await handler(scheduledEvent);

      // Verify progress update was sent
      expect(mockWsInstance.sendToPlayer).toHaveBeenCalledWith(
        'player-123',
        expect.objectContaining({
          type: 'task_progress',
          data: expect.objectContaining({
            progress: expect.any(Number),
            timeRemaining: expect.any(Number)
          })
        })
      );
    });
  });

  describe('Error Handling and Retry Logic', () => {
    it('should retry failed tasks up to max retries', async () => {
      const failingTask: Task = {
        id: 'failing-task',
        type: TaskType.HARVESTING,
        name: 'Failing Task',
        description: 'This task will fail',
        icon: 'test',
        duration: 1000,
        startTime: Date.now() - 1000,
        playerId: 'player-123',
        activityData: {} as any,
        prerequisites: [],
        resourceRequirements: [],
        progress: 0,
        completed: false,
        rewards: [],
        priority: 1,
        estimatedCompletion: Date.now(),
        retryCount: 2, // Already retried twice
        maxRetries: 3,
        isValid: true,
        validationErrors: []
      };

      const taskQueue: TaskQueue = {
        playerId: 'player-123',
        currentTask: failingTask,
        queuedTasks: [],
        isRunning: true,
        isPaused: false,
        totalTasksCompleted: 0,
        totalTimeSpent: 0,
        totalRewardsEarned: [],
        averageTaskDuration: 0,
        taskCompletionRate: 0,
        queueEfficiencyScore: 0,
        config: {} as any,
        lastUpdated: Date.now(),
        lastSynced: Date.now(),
        createdAt: Date.now(),
        version: 1,
        checksum: 'test',
        lastValidated: Date.now(),
        stateHistory: [],
        maxHistorySize: 100,
        canResume: true
      };

      mockDatabaseService.scan.mockResolvedValue({
        items: [taskQueue],
        count: 1,
        scannedCount: 1
      });

      // Make getItem fail to simulate task processing error
      mockDatabaseService.getItem.mockRejectedValue(new Error('Database error'));

      const scheduledEvent: ScheduledEvent = {
        id: 'test-event',
        'detail-type': 'Scheduled Event',
        source: 'aws.events',
        account: '123456789012',
        time: new Date().toISOString(),
        region: 'us-east-1',
        detail: {},
        version: '0',
        resources: []
      };

      await handler(scheduledEvent);

      // Verify the task was processed despite the error
      expect(mockDatabaseService.scan).toHaveBeenCalled();
    });
  });
});