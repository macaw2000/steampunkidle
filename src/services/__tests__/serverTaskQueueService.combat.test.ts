/**
 * Tests for Server Task Queue Service - Combat functionality
 */

import { serverTaskQueueService } from '../serverTaskQueueService.enhanced';
import { TaskUtils } from '../../utils/taskUtils';
import { NetworkUtils } from '../../utils/networkUtils';
import { CombatRewardCalculator } from '../combatRewardCalculator';
import { ENEMIES } from '../../data/combatData';

// Mock dependencies
jest.mock('../../utils/taskUtils', () => ({
  TaskUtils: {
    createCombatTask: jest.fn().mockReturnValue({
      id: 'test-combat-task',
      type: 'combat',
      name: 'Fight Test Enemy',
      playerId: 'player1',
      duration: 30000,
      estimatedCompletion: Date.now() + 30000
    })
  }
}));

jest.mock('../../utils/networkUtils', () => ({
  NetworkUtils: {
    postJson: jest.fn().mockResolvedValue({ success: true })
  }
}));

jest.mock('../combatRewardCalculator', () => ({
  CombatRewardCalculator: {
    createCombatTaskData: jest.fn().mockReturnValue({
      enemy: ENEMIES[0],
      playerLevel: 5,
      playerStats: { health: 100, attack: 20 },
      equipment: [],
      combatStrategy: { strategyId: 'balanced' },
      estimatedOutcome: { winProbability: 0.7 }
    }),
    calculateCombatDuration: jest.fn().mockReturnValue(30000)
  }
}));

// Mock base service
const mockBaseService = {
  stopAllTasks: jest.fn().mockResolvedValue(undefined),
  syncWithServer: jest.fn().mockResolvedValue(undefined),
  apiUrl: 'http://test-api.com'
};

// Replace the base service in the enhanced service
(serverTaskQueueService as any).stopAllTasks = mockBaseService.stopAllTasks;
(serverTaskQueueService as any).syncWithServer = mockBaseService.syncWithServer;
(serverTaskQueueService as any).apiUrl = mockBaseService.apiUrl;

describe('ServerTaskQueueService - Combat', () => {
  const mockEnemy = ENEMIES[0];
  
  const mockPlayerStats = {
    strength: 10,
    dexterity: 10,
    intelligence: 10,
    vitality: 10,
    harvestingSkills: { level: 1 },
    craftingSkills: { level: 1 },
    combatSkills: { level: 1 }
  };
  
  const mockPlayerCombatStats = {
    health: 100,
    maxHealth: 100,
    attack: 20,
    defense: 10,
    speed: 8,
    abilities: []
  };
  
  const mockEquipment = [
    {
      equipmentId: 'test-weapon',
      name: 'Test Weapon',
      type: 'weapon',
      stats: {
        attack: 5
      },
      requirements: [],
      durability: 100,
      maxDurability: 100
    }
  ];
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('startCombatTask', () => {
    it('should stop current tasks and start a new combat task', async () => {
      const task = await serverTaskQueueService.startCombatTask(
        'player1',
        mockEnemy,
        mockPlayerStats,
        5,
        mockPlayerCombatStats,
        {
          equipment: mockEquipment
        }
      );
      
      // Should stop current tasks
      expect(mockBaseService.stopAllTasks).toHaveBeenCalledWith('player1');
      
      // Should create task with high priority
      expect(TaskUtils.createCombatTask).toHaveBeenCalledWith(
        'player1',
        mockEnemy,
        mockPlayerStats,
        5,
        mockPlayerCombatStats,
        {
          equipment: mockEquipment,
          priority: 10
        }
      );
      
      // Should send task to server
      expect(NetworkUtils.postJson).toHaveBeenCalled();
      
      // Should sync with server
      expect(mockBaseService.syncWithServer).toHaveBeenCalledWith('player1');
      
      // Should return the task
      expect(task).toHaveProperty('id', 'test-combat-task');
      expect(task).toHaveProperty('type', 'combat');
    });
    
    it('should handle server errors gracefully', async () => {
      // Mock network error
      (NetworkUtils.postJson as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      // Mock local fallback
      (serverTaskQueueService as any).useLocalFallback = false;
      (serverTaskQueueService as any).handleServerError = jest.fn();
      (serverTaskQueueService as any).queuePendingOperation = jest.fn();
      (serverTaskQueueService as any).taskQueueService = {
        startCombatTask: jest.fn().mockReturnValue({
          id: 'local-combat-task',
          type: 'combat'
        })
      };
      
      const task = await serverTaskQueueService.startCombatTask(
        'player1',
        mockEnemy,
        mockPlayerStats,
        5,
        mockPlayerCombatStats
      );
      
      // Should handle error
      expect((serverTaskQueueService as any).handleServerError).toHaveBeenCalled();
      
      // Should queue pending operation
      expect((serverTaskQueueService as any).queuePendingOperation).toHaveBeenCalled();
      
      // Should use local fallback
      expect((serverTaskQueueService as any).taskQueueService.startCombatTask).toHaveBeenCalled();
      
      // Should return local task
      expect(task).toHaveProperty('id', 'local-combat-task');
      
      // Reset for other tests
      (serverTaskQueueService as any).useLocalFallback = false;
    });
  });
  
  describe('queueCombatTask', () => {
    it('should add a combat task to the queue', async () => {
      const task = await serverTaskQueueService.queueCombatTask(
        'player1',
        mockEnemy,
        mockPlayerStats,
        5,
        mockPlayerCombatStats,
        {
          equipment: mockEquipment,
          priority: 5
        }
      );
      
      // Should create combat task data
      expect(CombatRewardCalculator.createCombatTaskData).toHaveBeenCalledWith(
        mockEnemy,
        mockPlayerStats,
        mockPlayerCombatStats,
        5,
        {
          equipment: mockEquipment,
          strategy: undefined
        }
      );
      
      // Should calculate duration
      expect(CombatRewardCalculator.calculateCombatDuration).toHaveBeenCalledWith(
        mockEnemy,
        mockPlayerCombatStats,
        mockEquipment,
        undefined
      );
      
      // Should create task
      expect(TaskUtils.createCombatTask).toHaveBeenCalledWith(
        'player1',
        mockEnemy,
        mockPlayerStats,
        5,
        mockPlayerCombatStats,
        {
          equipment: mockEquipment,
          priority: 5,
          strategy: undefined
        }
      );
      
      // Should send task to server
      expect(NetworkUtils.postJson).toHaveBeenCalled();
      
      // Should sync with server
      expect(mockBaseService.syncWithServer).toHaveBeenCalledWith('player1');
      
      // Should return the task
      expect(task).toHaveProperty('id', 'test-combat-task');
      expect(task).toHaveProperty('type', 'combat');
    });
    
    it('should use local fallback when already in fallback mode', async () => {
      // Set fallback mode
      (serverTaskQueueService as any).useLocalFallback = true;
      (serverTaskQueueService as any).queuePendingOperation = jest.fn();
      (serverTaskQueueService as any).taskQueueService = {
        addCombatTask: jest.fn().mockReturnValue({
          id: 'local-combat-task',
          type: 'combat'
        })
      };
      
      const task = await serverTaskQueueService.queueCombatTask(
        'player1',
        mockEnemy,
        mockPlayerStats,
        5,
        mockPlayerCombatStats
      );
      
      // Should not try to send to server
      expect(NetworkUtils.postJson).not.toHaveBeenCalled();
      
      // Should queue pending operation
      expect((serverTaskQueueService as any).queuePendingOperation).toHaveBeenCalled();
      
      // Should use local fallback
      expect((serverTaskQueueService as any).taskQueueService.addCombatTask).toHaveBeenCalled();
      
      // Should return local task
      expect(task).toHaveProperty('id', 'local-combat-task');
      
      // Reset for other tests
      (serverTaskQueueService as any).useLocalFallback = false;
    });
  });
});