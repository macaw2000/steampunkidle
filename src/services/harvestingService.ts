/**
 * Harvesting service for managing resource gathering operations
 */

import { 
  HarvestingNode, 
  HarvestingSession, 
  HarvestingArea,
  StartHarvestingRequest,
  StartHarvestingResponse,
  CompleteHarvestingRequest,
  CompleteHarvestingResponse,
  HarvestingSkillType,
  HarvestingResource
} from '../types/harvesting';
import { Character } from '../types/character';
import { HARVESTING_NODES, HARVESTING_AREAS } from '../data/harvestingData';

export class HarvestingService {
  /**
   * Calculate harvesting skill level based on experience
   */
  static calculateSkillLevel(experience: number): number {
    return Math.floor(Math.sqrt(experience / 60)) + 1;
  }

  /**
   * Calculate experience required for a specific skill level
   */
  static calculateExperienceForSkillLevel(level: number): number {
    return Math.pow(level - 1, 2) * 60;
  }

  /**
   * Calculate harvesting time with skill bonuses
   */
  static calculateHarvestingTime(baseTime: number, skillLevel: number, nodeRequiredLevel: number): number {
    const skillAdvantage = Math.max(0, skillLevel - nodeRequiredLevel);
    const speedBonus = Math.min(0.5, skillAdvantage * 0.03); // Max 50% speed bonus
    
    return Math.max(10, Math.floor(baseTime * (1 - speedBonus))); // Minimum 10 seconds
  }

  /**
   * Calculate resource yield based on skill level and luck
   */
  static calculateResourceYield(
    baseResources: HarvestingResource[], 
    skillLevel: number, 
    nodeRequiredLevel: number
  ): HarvestingResource[] {
    const skillAdvantage = Math.max(0, skillLevel - nodeRequiredLevel);
    const yieldBonus = 1 + (skillAdvantage * 0.05); // 5% yield bonus per skill level above requirement
    
    return baseResources.map(resource => {
      // Check if resource drops based on drop chance
      if (Math.random() > resource.dropChance) {
        return { ...resource, quantity: 0 };
      }
      
      // Calculate final quantity with bonuses
      const baseQuantity = resource.quantity;
      const bonusQuantity = Math.random() < 0.1 ? 1 : 0; // 10% chance for bonus resource
      const finalQuantity = Math.floor((baseQuantity + bonusQuantity) * yieldBonus);
      
      return {
        ...resource,
        quantity: Math.max(1, finalQuantity)
      };
    }).filter(resource => resource.quantity > 0);
  }

  /**
   * Get available harvesting nodes for a character
   */
  static getAvailableNodes(character: Character): HarvestingNode[] {
    return HARVESTING_NODES.filter(node => {
      const skillLevel = character.stats.harvestingSkills.level || 1;
      return skillLevel >= node.requiredLevel;
    });
  }

  /**
   * Get available harvesting areas for a character
   */
  static getAvailableAreas(character: Character): HarvestingArea[] {
    return HARVESTING_AREAS.filter(area => {
      return character.level >= area.requiredLevel;
    });
  }

  /**
   * Start a harvesting session
   */
  static async startHarvesting(request: StartHarvestingRequest): Promise<StartHarvestingResponse> {
    try {
      const response = await fetch('/api/harvesting/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start harvesting');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error starting harvesting:', error);
      throw error;
    }
  }

  /**
   * Complete a harvesting session
   */
  static async completeHarvesting(request: CompleteHarvestingRequest): Promise<CompleteHarvestingResponse> {
    try {
      const response = await fetch('/api/harvesting/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to complete harvesting');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error completing harvesting:', error);
      throw error;
    }
  }

  /**
   * Get node by ID
   */
  static getNodeById(nodeId: string): HarvestingNode | null {
    return HARVESTING_NODES.find(node => node.nodeId === nodeId) || null;
  }

  /**
   * Get area by ID
   */
  static getAreaById(areaId: string): HarvestingArea | null {
    return HARVESTING_AREAS.find(area => area.areaId === areaId) || null;
  }

  /**
   * Format harvesting time for display
   */
  static formatHarvestingTime(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const remainingMinutes = Math.floor((seconds % 3600) / 60);
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
  }

  /**
   * Get skill display information
   */
  static getSkillDisplay(skillType: HarvestingSkillType) {
    const skillInfo = {
      mining: {
        name: 'Mining',
        description: 'Extract valuable ores and minerals from the earth',
        icon: '⛏️',
        color: '#8b4513'
      },
      foraging: {
        name: 'Foraging',
        description: 'Gather herbs and natural materials from the wilderness',
        icon: '🌿',
        color: '#228b22'
      },
      salvaging: {
        name: 'Salvaging',
        description: 'Recover useful parts from abandoned machinery and workshops',
        icon: '🔧',
        color: '#696969'
      },
      crystal_extraction: {
        name: 'Crystal Extraction',
        description: 'Harvest crystallized steam energy from rare formations',
        icon: '💎',
        color: '#4169e1'
      }
    };
    
    return skillInfo[skillType];
  }

  /**
   * Calculate harvesting efficiency based on character stats
   */
  static calculateHarvestingEfficiency(character: Character, skillType: HarvestingSkillType): number {
    if (!character) return 1;

    const skillLevel = character.stats.harvestingSkills.level || 1;
    const statBonus = character.stats.dexterity * 0.01; // Dexterity affects harvesting
    
    return 1 + (skillLevel * 0.05) + statBonus;
  }

  /**
   * Get recommended harvesting activity based on character level
   */
  static getRecommendedActivity(character: Character): HarvestingNode | null {
    const availableNodes = this.getAvailableNodes(character);
    
    if (availableNodes.length === 0) return null;
    
    // Recommend highest level node the character can access
    return availableNodes.reduce((best, current) => 
      current.requiredLevel > best.requiredLevel ? current : best
    );
  }

  /**
   * Calculate experience gain from harvesting
   */
  static calculateExperienceGain(
    node: HarvestingNode, 
    resourcesGathered: HarvestingResource[], 
    skillLevel: number
  ): number {
    const baseExperience = 15 + (node.requiredLevel * 5);
    const resourceBonus = resourcesGathered.reduce((total, resource) => {
      const rarityMultiplier = {
        'common': 1,
        'uncommon': 1.5,
        'rare': 2,
        'legendary': 3
      }[resource.rarity];
      
      return total + (resource.quantity * rarityMultiplier);
    }, 0);
    
    const skillBonus = Math.max(0, (skillLevel - node.requiredLevel) * 0.1);
    
    return Math.floor(baseExperience + resourceBonus + (baseExperience * skillBonus));
  }

  /**
   * Check if node is available (not on cooldown)
   */
  static isNodeAvailable(nodeId: string, lastHarvestTime?: Date): boolean {
    if (!lastHarvestTime) return true;
    
    const node = this.getNodeById(nodeId);
    if (!node) return false;
    
    const timeSinceHarvest = Date.now() - lastHarvestTime.getTime();
    return timeSinceHarvest >= (node.respawnTime * 1000);
  }

  /**
   * Get time until node respawns
   */
  static getTimeUntilRespawn(nodeId: string, lastHarvestTime: Date): number {
    const node = this.getNodeById(nodeId);
    if (!node) return 0;
    
    const timeSinceHarvest = Date.now() - lastHarvestTime.getTime();
    const respawnTime = node.respawnTime * 1000;
    
    return Math.max(0, respawnTime - timeSinceHarvest);
  }
}

export default HarvestingService;