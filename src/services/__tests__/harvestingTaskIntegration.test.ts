/**
 * Harvesting Task Integration Tests
 */

import { HarvestingTaskIntegration } from '../harvestingTaskIntegration';
import { serverTaskQueueService } from '../serverTaskQueueService';
import { HARVESTING_ACTIVITIES } from '../../data/harvestingActivities';
import { CharacterStats } from '../../types/character';

// Mock the serverTaskQueueService
jest.mock('../serverTaskQueueService', () => ({
  serverTaskQueueService: {
    startHarvestingTask: jest.fn().mockResolvedValue({}),
    queueHarvestingTask: jest.fn().mockResolvedValue({})
  }
}));

describe('HarvestingTaskIntegration', () => {
  // Sample player data for testing
  const playerId = 'test-player-123';
  const playerStats: CharacterStats = {
    strength: 20,
    dexterity: 15,
    intelligence: 25,
    vitality: 18,
    craftingSkills: {
      clockmaking: 5,
      engineering: 3,
      alchemy: 2,
      steamcraft: 4,
      level: 5,
      experience: 500
    },
    harvestingSkills: {
      mining: 8,
      foraging: 6,
      salvaging: 4,
      crystal_extraction: 2,
      level: 6,
      experience: 600
    },
    combatSkills: {
      melee: 5,
      ranged: 3,
      defense: 4,
      tactics: 2,
      level: 4,
      experience: 400
    }
  };
  const playerLevel = 10;
  const playerInventory = {
    'energy': 100,
    'tool_brass_multitool': 1,
    'tool_precision_screwdriver_set': 1,
    'archive_key': 1
  };
  const playerEquipment = {
    'safety_gear': true
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should start a harvesting activity', async () => {
    // Get first activity from the list
    const activity = HARVESTING_ACTIVITIES[0];
    
    await HarvestingTaskIntegration.startHarvestingActivity(
      playerId,
      activity.id,
      playerStats,
      playerLevel,
      playerInventory,
      playerEquipment
    );
    
    // Check if serverTaskQueueService.startHarvestingTask was called
    expect(serverTaskQueueService.startHarvestingTask).toHaveBeenCalledTimes(1);
    expect(serverTaskQueueService.startHarvestingTask).toHaveBeenCalledWith(
      playerId,
      activity,
      playerStats,
      expect.objectContaining({
        playerLevel,
        playerInventory,
        playerEquipment,
        location: expect.any(Object),
        tools: expect.any(Array)
      })
    );
  });

  test('should queue a harvesting activity', async () => {
    // Get first activity from the list
    const activity = HARVESTING_ACTIVITIES[0];
    
    await HarvestingTaskIntegration.queueHarvestingActivity(
      playerId,
      activity.id,
      playerStats,
      playerLevel,
      playerInventory,
      playerEquipment
    );
    
    // Check if serverTaskQueueService.queueHarvestingTask was called
    expect(serverTaskQueueService.queueHarvestingTask).toHaveBeenCalledTimes(1);
    expect(serverTaskQueueService.queueHarvestingTask).toHaveBeenCalledWith(
      playerId,
      activity,
      playerStats,
      expect.objectContaining({
        playerLevel,
        playerInventory,
        playerEquipment,
        location: expect.any(Object),
        tools: expect.any(Array)
      })
    );
  });

  test('should filter available activities by player level and stats', () => {
    const availableActivities = HarvestingTaskIntegration.getAvailableActivities(
      playerLevel,
      playerStats
    );
    
    // Check that all returned activities meet the level requirement
    availableActivities.forEach(activity => {
      expect(activity.requiredLevel).toBeLessThanOrEqual(playerLevel);
      
      // Check stat requirements if they exist
      if (activity.requiredStats) {
        for (const [stat, required] of Object.entries(activity.requiredStats)) {
          const playerStat = playerStats[stat as keyof typeof playerStats] || 0;
          expect(playerStat).toBeGreaterThanOrEqual(required);
        }
      }
    });
  });

  test('should get available locations for player', () => {
    const availableLocations = HarvestingTaskIntegration.getAvailableLocations(
      playerLevel,
      playerInventory,
      playerEquipment
    );
    
    // Check that all returned locations meet the requirements
    availableLocations.forEach(location => {
      location.requirements.forEach(req => {
        if (req.type === 'level') {
          expect(playerLevel).toBeGreaterThanOrEqual(req.requirement as number);
        }
        
        if (req.type === 'item') {
          expect(playerInventory[req.requirement as string]).toBeTruthy();
        }
        
        if (req.type === 'equipment') {
          expect(playerEquipment[req.requirement as string]).toBeTruthy();
        }
      });
    });
  });

  test('should get available tools for player', () => {
    const availableTools = HarvestingTaskIntegration.getAvailableTools(
      playerLevel,
      playerInventory
    );
    
    // Check that tools were found
    expect(availableTools.length).toBeGreaterThan(0);
    
    // Check that all tools in the result are from the player's inventory
    availableTools.forEach(tool => {
      expect(playerInventory[`tool_${tool.toolId}`] || playerInventory[tool.toolId]).toBeTruthy();
    });
  });
});