/**
 * Harvesting Task Integration Service
 * Connects the harvesting system to the unified task queue
 */

import { serverTaskQueueService } from './serverTaskQueueService';
import { HarvestingActivity, HarvestingCategory } from '../types/harvesting';
import { CharacterStats } from '../types/character';
import { HarvestingLocation, EquippedTool } from '../types/taskQueue';
import { HARVESTING_ACTIVITIES } from '../data/harvestingActivities';
import { HARVESTING_LOCATIONS, getBestAvailableLocation } from '../data/harvestingLocations';
import { HARVESTING_TOOLS, getBestAvailableTools } from '../data/harvestingTools';

export class HarvestingTaskIntegration {
  /**
   * Start a harvesting activity immediately
   */
  static async startHarvestingActivity(
    playerId: string,
    activityId: string,
    playerStats: CharacterStats,
    playerLevel: number,
    playerInventory: { [itemId: string]: number },
    playerEquipment: { [slot: string]: any }
  ): Promise<void> {
    // Find the activity
    const activity = HARVESTING_ACTIVITIES.find(a => a.id === activityId);
    if (!activity) {
      throw new Error(`Harvesting activity not found: ${activityId}`);
    }
    
    // Check if player meets level requirement
    if (playerLevel < activity.requiredLevel) {
      throw new Error(`Player level ${playerLevel} is below required level ${activity.requiredLevel}`);
    }
    
    // Get best available location for this activity
    const location = getBestAvailableLocation(
      activity.category,
      playerLevel,
      playerInventory,
      playerEquipment
    );
    
    // Get best available tools for this activity
    const toolInventory: { [toolId: string]: { durability: number } } = {};
    for (const [itemId, quantity] of Object.entries(playerInventory)) {
      if (itemId.includes('tool_') && quantity > 0) {
        toolInventory[itemId] = { durability: 100 }; // Assuming full durability
      }
    }
    
    const tools = getBestAvailableTools(activity.category, playerLevel, toolInventory);
    
    // Start the harvesting task
    await serverTaskQueueService.startHarvestingTask(
      playerId,
      activity,
      playerStats,
      {
        playerLevel,
        playerInventory,
        playerEquipment,
        location: location || undefined,
        tools
      }
    );
  }
  
  /**
   * Queue a harvesting activity
   */
  static async queueHarvestingActivity(
    playerId: string,
    activityId: string,
    playerStats: CharacterStats,
    playerLevel: number,
    playerInventory: { [itemId: string]: number },
    playerEquipment: { [slot: string]: any },
    priority?: number
  ): Promise<void> {
    // Find the activity
    const activity = HARVESTING_ACTIVITIES.find(a => a.id === activityId);
    if (!activity) {
      throw new Error(`Harvesting activity not found: ${activityId}`);
    }
    
    // Check if player meets level requirement
    if (playerLevel < activity.requiredLevel) {
      throw new Error(`Player level ${playerLevel} is below required level ${activity.requiredLevel}`);
    }
    
    // Get best available location for this activity
    const location = getBestAvailableLocation(
      activity.category,
      playerLevel,
      playerInventory,
      playerEquipment
    );
    
    // Get best available tools for this activity
    const toolInventory: { [toolId: string]: { durability: number } } = {};
    for (const [itemId, quantity] of Object.entries(playerInventory)) {
      if (itemId.includes('tool_') && quantity > 0) {
        toolInventory[itemId] = { durability: 100 }; // Assuming full durability
      }
    }
    
    const tools = getBestAvailableTools(activity.category, playerLevel, toolInventory);
    
    // Queue the harvesting task
    await serverTaskQueueService.queueHarvestingTask(
      playerId,
      activity,
      playerStats,
      {
        playerLevel,
        playerInventory,
        playerEquipment,
        location: location || undefined,
        tools,
        priority
      }
    );
  }
  
  /**
   * Get available harvesting activities for player
   */
  static getAvailableActivities(
    playerLevel: number,
    playerStats: CharacterStats
  ): HarvestingActivity[] {
    return HARVESTING_ACTIVITIES.filter(activity => {
      // Check level requirement
      if (playerLevel < activity.requiredLevel) {
        return false;
      }
      
      // Check stat requirements
      if (activity.requiredStats) {
        for (const [stat, required] of Object.entries(activity.requiredStats)) {
          const playerStat = this.getPlayerStat(playerStats, stat);
          if (playerStat < required) {
            return false;
          }
        }
      }
      
      return true;
    });
  }
  
  /**
   * Get available locations for player
   */
  static getAvailableLocations(
    playerLevel: number,
    playerInventory: { [itemId: string]: number },
    playerEquipment: { [slot: string]: any }
  ): HarvestingLocation[] {
    return HARVESTING_LOCATIONS.filter(location => {
      // Check all requirements
      for (const req of location.requirements) {
        if (req.type === 'level' && playerLevel < (req.requirement as number)) {
          return false;
        }
        
        if (req.type === 'item' && !playerInventory[req.requirement as string]) {
          return false;
        }
        
        if (req.type === 'equipment' && !playerEquipment[req.requirement as string]) {
          return false;
        }
      }
      
      return true;
    });
  }
  
  /**
   * Get available tools for player
   */
  static getAvailableTools(
    playerLevel: number,
    playerInventory: { [itemId: string]: number }
  ): EquippedTool[] {
    const toolInventory: { [toolId: string]: { durability: number } } = {};
    for (const [itemId, quantity] of Object.entries(playerInventory)) {
      if (itemId.includes('tool_') && quantity > 0) {
        toolInventory[itemId] = { durability: 100 }; // Assuming full durability
      }
    }
    
    const availableTools: EquippedTool[] = [];
    
    for (const category of Object.values(HarvestingCategory)) {
      const tools = getBestAvailableTools(category, playerLevel, toolInventory);
      availableTools.push(...tools);
    }
    
    // Remove duplicates
    const uniqueTools = availableTools.filter((tool, index, self) =>
      index === self.findIndex(t => t.toolId === tool.toolId)
    );
    
    return uniqueTools;
  }
  
  /**
   * Get player stat value
   */
  private static getPlayerStat(playerStats: CharacterStats, statName: string): number {
    switch (statName.toLowerCase()) {
      case 'strength':
        return playerStats.strength;
      case 'dexterity':
        return playerStats.dexterity;
      case 'intelligence':
        return playerStats.intelligence;
      case 'vitality':
        return playerStats.vitality;
      case 'perception':
        return playerStats.intelligence || 0; // Using intelligence as perception substitute
      default:
        return 0;
    }
  }
}

// Export singleton instance
export const harvestingTaskIntegration = new HarvestingTaskIntegration();
