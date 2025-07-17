/**
 * Activity service for managing character activities
 */

import { ActivityType, Character, ActivityReward } from '../types/character';

export interface ActivityProgress {
  activityType: ActivityType;
  startedAt: Date;
  minutesActive: number;
  progressPercentage: number;
  potentialRewards: ActivityReward[];
}

export interface SwitchActivityResponse {
  character: Character;
  previousActivityRewards?: ActivityReward[];
  message: string;
}

export class ActivityService {
  /**
   * Switch character to a new activity
   */
  static async switchActivity(userId: string, activityType: ActivityType): Promise<SwitchActivityResponse> {
    try {
      const response = await fetch(`/api/activity/${userId}/switch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ activityType }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to switch activity');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error switching activity:', error);
      throw error;
    }
  }

  /**
   * Get current activity progress
   */
  static async getActivityProgress(userId: string): Promise<ActivityProgress | null> {
    try {
      const response = await fetch(`/api/activity/${userId}/progress`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get activity progress');
      }

      const result = await response.json();
      return result.progress;
    } catch (error) {
      console.error('Error getting activity progress:', error);
      throw error;
    }
  }

  /**
   * Calculate activity efficiency based on character stats
   */
  static calculateActivityEfficiency(character: Character, activityType: ActivityType): number {
    if (!character) return 1;

    switch (activityType) {
      case 'crafting':
        return 1 + (character.stats.craftingSkills.level * 0.1) + (character.stats.intelligence * 0.02);
      case 'harvesting':
        return 1 + (character.stats.harvestingSkills.level * 0.1) + (character.stats.dexterity * 0.02);
      case 'combat':
        return 1 + (character.stats.combatSkills.level * 0.1) + (character.stats.strength * 0.02);
      default:
        return 1;
    }
  }

  /**
   * Get activity display information
   */
  static getActivityDisplayInfo(activityType: ActivityType) {
    const activityInfo = {
      crafting: {
        name: 'Clockwork Crafting',
        description: 'Create intricate clockwork devices and steam-powered trinkets',
        icon: '⚙️',
        primaryStat: 'Intelligence',
        rewards: ['Experience', 'Currency', 'Crafted Items'],
        steampunkFlavor: 'Tinker with gears and steam to create mechanical marvels',
      },
      harvesting: {
        name: 'Resource Gathering',
        description: 'Collect steam crystals, copper ore, and rare materials',
        icon: '⛏️',
        primaryStat: 'Dexterity',
        rewards: ['Experience', 'Raw Materials', 'Resources'],
        steampunkFlavor: 'Mine precious metals and harvest steam-infused crystals',
      },
      combat: {
        name: 'Automaton Combat',
        description: 'Battle rogue steam-powered machines and mechanical beasts',
        icon: '⚔️',
        primaryStat: 'Strength',
        rewards: ['Experience', 'Currency', 'Combat Loot'],
        steampunkFlavor: 'Fight against malfunctioning clockwork creatures',
      },
    };

    return activityInfo[activityType];
  }

  /**
   * Get recommended activity based on character specialization
   */
  static getRecommendedActivity(character: Character): ActivityType {
    if (!character || !character.specialization.primaryRole) {
      return 'crafting'; // Default recommendation
    }

    switch (character.specialization.primaryRole) {
      case 'tank':
        return 'combat'; // Tanks benefit from combat experience
      case 'healer':
        return 'crafting'; // Healers benefit from crafting (intelligence-based)
      case 'dps':
        return 'combat'; // DPS benefits from combat experience
      default:
        return 'crafting';
    }
  }

  /**
   * Calculate time until next reward milestone
   */
  static calculateNextRewardMilestone(progress: ActivityProgress): {
    nextMilestoneMinutes: number;
    timeRemaining: number;
    rewardPreview: ActivityReward[];
  } {
    const milestones = [15, 30, 60, 120]; // Reward milestones in minutes
    const currentMinutes = progress.minutesActive;
    
    const nextMilestone = milestones.find(milestone => milestone > currentMinutes) || milestones[milestones.length - 1];
    const timeRemaining = Math.max(0, nextMilestone - currentMinutes);
    
    // Calculate preview of rewards at next milestone
    const rewardPreview = progress.potentialRewards.map(reward => ({
      ...reward,
      amount: Math.floor(reward.amount * (nextMilestone / Math.max(currentMinutes, 1))),
    }));

    return {
      nextMilestoneMinutes: nextMilestone,
      timeRemaining,
      rewardPreview,
    };
  }

  /**
   * Format activity duration for display
   */
  static formatActivityDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}m`;
    } else if (minutes < 1440) { // Less than 24 hours
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    } else {
      const days = Math.floor(minutes / 1440);
      const remainingHours = Math.floor((minutes % 1440) / 60);
      return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
    }
  }

  /**
   * Get activity status message
   */
  static getActivityStatusMessage(progress: ActivityProgress | null): string {
    if (!progress) {
      return 'No active activity. Select an activity to begin earning rewards!';
    }

    const activityInfo = this.getActivityDisplayInfo(progress.activityType);
    const duration = this.formatActivityDuration(progress.minutesActive);
    
    return `${activityInfo.name} for ${duration} - ${Math.floor(progress.progressPercentage)}% progress`;
  }
}

export default ActivityService;