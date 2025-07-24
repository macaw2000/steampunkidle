/**
 * Enhanced ServerTaskQueueService Tests
 * Tests for the enhanced functionality added in task 7
 */

import { serverTaskQueueService } from '../serverTaskQueueService';
import { TaskType } from '../../types/taskQueue';
import { NetworkUtils } from '../../utils/networkUtils';
import { TaskValidationService } from '../taskValidation';

// Mock dependencies
jest.mock('../../utils/networkUtils');
jest.mock('../taskQueueService');
jest.mock('../taskValidation', () => ({
  TaskValidationService: {
    validateTask: jest.fn().mockReturnValue({
      isValid: true,
      errors: [],
      warnings: []
    })
  }
}));

const mockNetworkUtils = NetworkUtils as jest.Mocked<typeof NetworkUtils>;
const mockTaskValidationService = TaskValidationService as jest.Mocked<typeof TaskValidationService>;

describe('Enhanced ServerTaskQueueService', () => {
  const mockPlayerId = 'test-player-123';
  const mockPlayerStats = {
    strength: 10,
    dexterity: 8,
    intelligence: 12,
    vitality: 9,
    craftingSkills: {
      clockmaking: 5,
      engineering: 3,
      alchemy: 2,
      steamcraft: 4
    },
    harvestingSkills: {
      mining: 6,
      foraging: 4,
      salvaging: 3,
      crystal_extraction: 2
    },
    combatSkills: {
      melee: 7,
      ranged: 5,
      defense: 6,
      tactics: 4
    }
  };

  const mockCraftingRecipe = {
    recipeId: 'copper-gear',
    name: 'Copper Gear',
    description: 'A basic copper gear',
    requiredLevel: 5,
    requiredSkill: 'clockmaking',
    craftingTime: 30,
    materials: [
      {
        materialId: 'copper_ore',
        name: 'Copper Ore',
        quantity: 2,
        type: 'metal'
      }
    ],
    outputs: [
      {
        itemId: 'copper_gear',
        name: 'Copper Gear',
        quantity: 1,
        baseStats: {},
        qualityModifier: 1.0
      }
    ]
  };

  const mockEnemy = {
    enemyId: 'steam-bot',
    name: 'Steam Bot',
    level: 8,
    stats: {
      health: 100,
      attack: 15,
      defense: 8,
      speed: 6
    },
    lootTable: [
      {
        itemId: 'scrap_metal',
        quantity: 3,
        rarity: 'common'
      }
    ]
  };

  const mockPlayerCombatStats = {
    health: 80,
    maxHealth: 100,
    attack: 12,
    defense: 10,
    speed: 8
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful server responses by default
    mockNetworkUtils.postJson.mockResolvedValue({
      queue: {
        currentTask: null,
        queueLength: 0,
        queuedTasks: [],
        isRunning: false,
        totalCompleted: 0,
        lastSynced: Date.now()
      }
    });

    mockNetworkUtils.fetchJson.mockResolvedValue({
      queue: {
        currentTask: null,
        queueLength: 0,
        queuedTasks: [],
        isRunning: false,
        totalCompleted: 0,
        lastSynced: Date.now()
      },
      currentProgress: null
    });
  });

  describe('Enhanced Crafting Task Management', () => {
    it('should add crafting task with client-side validation', async () => {
      const task = await serverTaskQueueService.addCraftingTask(
        mockPlayerId,
        mockCraftingRecipe,
        mockPlayerStats,
        10, // player level
        { copper_ore: 5 }, // inventory
        { priority: 7 }
      );

      expect(task).toBeDefined();
      expect(task.type).toBe(TaskType.CRAFTING);
      expect(task.priority).toBe(7);
      expect(mockNetworkUtils.postJson).toHaveBeenCalledWith(
        expect.stringContaining('/task-queue/add-task'),
        expect.objectContaining({
          action: 'addTask',
          playerId: mockPlayerId,
          task: expect.objectContaining({
            type: TaskType.CRAFTING,
            priority: 7
          })
        }),
        expect.any(Object)
      );
    });

    it('should validate crafting task before submission', async () => {
      // Mock validation failure
      mockTaskValidationService.validateTask.mockReturnValueOnce({
        isValid: false,
        errors: [{ code: 'INSUFFICIENT_MATERIALS', message: 'Not enough materials', field: 'materials', severity: 'error' }],
        warnings: []
      });

      // Test with insufficient materials
      await expect(
        serverTaskQueueService.addCraftingTask(
          mockPlayerId,
          mockCraftingRecipe,
          mockPlayerStats,
          10,
          { copper_ore: 1 }, // Not enough materials
          {}
        )
      ).rejects.toThrow('Task validation failed');
    });
  });

  describe('Enhanced Combat Task Management', () => {
    it('should add combat task with proper validation', async () => {
      const task = await serverTaskQueueService.addCombatTask(
        mockPlayerId,
        mockEnemy,
        mockPlayerStats,
        10, // player level
        mockPlayerCombatStats,
        { priority: 8 }
      );

      expect(task).toBeDefined();
      expect(task.type).toBe(TaskType.COMBAT);
      expect(task.priority).toBe(8);
      expect(mockNetworkUtils.postJson).toHaveBeenCalled();
    });

    it('should validate combat requirements', async () => {
      // Mock validation failure
      mockTaskValidationService.validateTask.mockReturnValueOnce({
        isValid: false,
        errors: [{ code: 'INSUFFICIENT_HEALTH', message: 'Not enough health for combat', field: 'health', severity: 'error' }],
        warnings: []
      });

      const lowHealthCombatStats = {
        ...mockPlayerCombatStats,
        health: 10 // Very low health
      };

      await expect(
        serverTaskQueueService.addCombatTask(
          mockPlayerId,
          mockEnemy,
          mockPlayerStats,
          10,
          lowHealthCombatStats,
          {}
        )
      ).rejects.toThrow('Task validation failed');
    });
  });

  describe('Queue Reordering and Priority Management', () => {
    it('should reorder tasks with validation', async () => {
      const taskIds = ['task-1', 'task-2', 'task-3'];
      
      await serverTaskQueueService.reorderTasks(mockPlayerId, taskIds);

      expect(mockNetworkUtils.postJson).toHaveBeenCalledWith(
        expect.stringContaining('/task-queue/reorder'),
        expect.objectContaining({
          action: 'reorderTasks',
          playerId: mockPlayerId,
          taskIds
        }),
        expect.any(Object)
      );
    });

    it('should validate task IDs for reordering', async () => {
      // Test with empty array
      await expect(
        serverTaskQueueService.reorderTasks(mockPlayerId, [])
      ).rejects.toThrow('Task IDs array cannot be empty');

      // Test with duplicate IDs
      await expect(
        serverTaskQueueService.reorderTasks(mockPlayerId, ['task-1', 'task-1'])
      ).rejects.toThrow('Duplicate task IDs found');
    });

    it('should update task priority with validation', async () => {
      await serverTaskQueueService.updateTaskPriority(mockPlayerId, 'task-1', 8);

      expect(mockNetworkUtils.postJson).toHaveBeenCalledWith(
        expect.stringContaining('/task-queue/update-priority'),
        expect.objectContaining({
          action: 'updateTaskPriority',
          playerId: mockPlayerId,
          taskId: 'task-1',
          priority: 8
        }),
        expect.any(Object)
      );
    });

    it('should validate priority range', async () => {
      await expect(
        serverTaskQueueService.updateTaskPriority(mockPlayerId, 'task-1', 15)
      ).rejects.toThrow('Task priority must be between 0 and 10');

      await expect(
        serverTaskQueueService.updateTaskPriority(mockPlayerId, 'task-1', -1)
      ).rejects.toThrow('Task priority must be between 0 and 10');
    });
  });

  describe('Enhanced Queue Management', () => {
    it('should pause queue with reason', async () => {
      await serverTaskQueueService.pauseQueue(mockPlayerId, 'Testing pause');

      expect(mockNetworkUtils.postJson).toHaveBeenCalledWith(
        expect.stringContaining('/task-queue/pause'),
        expect.objectContaining({
          action: 'pauseQueue',
          playerId: mockPlayerId,
          reason: 'Testing pause'
        }),
        expect.any(Object)
      );
    });

    it('should resume queue', async () => {
      await serverTaskQueueService.resumeQueue(mockPlayerId);

      expect(mockNetworkUtils.postJson).toHaveBeenCalledWith(
        expect.stringContaining('/task-queue/resume'),
        expect.objectContaining({
          action: 'resumeQueue',
          playerId: mockPlayerId
        }),
        expect.any(Object)
      );
    });

    it('should clear queue', async () => {
      await serverTaskQueueService.clearQueue(mockPlayerId);

      expect(mockNetworkUtils.postJson).toHaveBeenCalledWith(
        expect.stringContaining('/task-queue/clear'),
        expect.objectContaining({
          action: 'clearQueue',
          playerId: mockPlayerId
        }),
        expect.any(Object)
      );
    });
  });

  describe('Batch Operations', () => {
    it('should add multiple tasks in batch', async () => {
      const tasks = [
        {
          type: 'crafting' as const,
          data: mockCraftingRecipe,
          options: { priority: 5 }
        }
      ];

      const addedTasks = await serverTaskQueueService.addTasksBatch(
        mockPlayerId,
        tasks,
        mockPlayerStats,
        10,
        { copper_ore: 10 },
        mockPlayerCombatStats
      );

      expect(addedTasks).toHaveLength(1);
      expect(addedTasks[0].type).toBe(TaskType.CRAFTING);
    });

    it('should validate batch size', async () => {
      const largeBatch = Array(15).fill({
        type: 'crafting' as const,
        data: mockCraftingRecipe
      });

      await expect(
        serverTaskQueueService.addTasksBatch(
          mockPlayerId,
          largeBatch,
          mockPlayerStats,
          10,
          { copper_ore: 100 }
        )
      ).rejects.toThrow('Batch size cannot exceed 10 tasks');
    });
  });

  describe('Enhanced Offline State Management', () => {
    it('should handle offline fallback gracefully', async () => {
      // Mock network error
      mockNetworkUtils.postJson.mockRejectedValue({
        isNetworkError: true,
        isOffline: true
      });

      // Should not throw error, should fall back to local processing
      await expect(
        serverTaskQueueService.addHarvestingTask(mockPlayerId, {
          id: 'copper-mining',
          name: 'Copper Mining',
          description: 'Mine copper ore',
          icon: '⛏️',
          baseTime: 30,
          energyCost: 10,
          requiredLevel: 1,
          requiredStats: {},
          dropTable: {
            common: [
              {
                itemId: 'copper_ore',
                minQuantity: 1,
                maxQuantity: 3,
                dropRate: 0.8
              }
            ]
          }
        }, mockPlayerStats)
      ).resolves.toBeDefined();
    });

    it('should queue pending operations during offline mode', async () => {
      // Force offline mode
      mockNetworkUtils.postJson.mockRejectedValue({
        isNetworkError: true,
        isOffline: true
      });

      await serverTaskQueueService.addHarvestingTask(mockPlayerId, {
        id: 'test-activity',
        name: 'Test Activity',
        description: 'Test',
        icon: '🔧',
        baseTime: 10,
        energyCost: 5,
        requiredLevel: 1,
        requiredStats: {},
        dropTable: { common: [] }
      }, mockPlayerStats);

      // Check service health to see pending operations
      const health = serverTaskQueueService.getServiceHealth();
      expect(health.localFallback).toBe(true);
      expect(health.status).toBe('degraded');
    });
  });

  describe('Queue Statistics and Health', () => {
    it('should provide queue statistics', () => {
      const stats = serverTaskQueueService.getQueueStatistics(mockPlayerId);
      
      expect(stats).toHaveProperty('totalTasksCompleted');
      expect(stats).toHaveProperty('averageTaskDuration');
      expect(stats).toHaveProperty('taskCompletionRate');
      expect(stats).toHaveProperty('queueEfficiencyScore');
      expect(stats).toHaveProperty('estimatedCompletionTime');
    });

    it('should provide detailed queue information', () => {
      const info = serverTaskQueueService.getDetailedQueueInfo(mockPlayerId);
      
      expect(info).toHaveProperty('queue');
      expect(info).toHaveProperty('statistics');
      expect(info).toHaveProperty('warnings');
      expect(info).toHaveProperty('recommendations');
      expect(Array.isArray(info.warnings)).toBe(true);
      expect(Array.isArray(info.recommendations)).toBe(true);
    });

    it('should provide service health status', () => {
      const health = serverTaskQueueService.getServiceHealth();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('serverConnection');
      expect(health).toHaveProperty('localFallback');
      expect(health).toHaveProperty('activeConnections');
      expect(health).toHaveProperty('pendingOperations');
      expect(health).toHaveProperty('lastSyncTime');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
    });
  });

  describe('Enhanced Client-Side Validation', () => {
    it('should perform comprehensive task validation', async () => {
      // Mock validation failure for long duration
      mockTaskValidationService.validateTask.mockReturnValueOnce({
        isValid: false,
        errors: [{ code: 'TASK_TOO_LONG', message: 'Task duration exceeds maximum', field: 'duration', severity: 'error' }],
        warnings: []
      });

      // Test with invalid task duration
      const invalidRecipe = {
        ...mockCraftingRecipe,
        craftingTime: 25 * 60 * 60 // 25 hours - exceeds 24 hour limit
      };

      await expect(
        serverTaskQueueService.addCraftingTask(
          mockPlayerId,
          invalidRecipe,
          mockPlayerStats,
          10,
          { copper_ore: 10 }
        )
      ).rejects.toThrow('Task validation failed');
    });

    it('should validate queue state before operations', () => {
      // This tests the internal validation logic
      const service = serverTaskQueueService as any;
      const validation = service.validateQueueState(mockPlayerId);
      
      expect(validation).toHaveProperty('isValid');
      expect(validation).toHaveProperty('errors');
      expect(typeof validation.isValid).toBe('boolean');
      expect(Array.isArray(validation.errors)).toBe(true);
    });
  });
});