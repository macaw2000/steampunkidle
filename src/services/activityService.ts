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
    // Always use AWS services for activity switching

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
      // Fallback to mock in case of network error
      return this.mockSwitchActivity(userId, activityType);
    }
  }

  /**
   * Get current activity progress
   */
  static async getActivityProgress(userId: string): Promise<ActivityProgress | null> {
    // Always use AWS services for activity progress

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
      // Fallback to mock in case of network error
      return this.mockGetActivityProgress(userId);
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

  /**
   * Mock activity progress for development mode
   */
  private static async mockGetActivityProgress(userId: string): Promise<ActivityProgress | null> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200));

    // Get current character from localStorage (mock data)
    const characterKey = `testCharacter-${userId}`;
    let character: Character | null = null;

    if (typeof window !== 'undefined' && window.localStorage) {
      const storedCharacter = localStorage.getItem(characterKey);
      if (storedCharacter) {
        character = JSON.parse(storedCharacter);
      }
    }

    if (!character || !character.currentActivity) {
      return null;
    }

    const minutesActive = Math.floor(
      (Date.now() - new Date(character.currentActivity.startedAt).getTime()) / (1000 * 60)
    );

    const progressPercentage = Math.min(100, (minutesActive / 60) * 100); // 100% after 1 hour

    // Generate potential rewards based on activity type and time
    const potentialRewards: ActivityReward[] = [
      {
        type: 'experience',
        amount: Math.floor(minutesActive * 2),
        description: 'Experience gained from activity',
      },
    ];

    if (minutesActive >= 5) {
      potentialRewards.push({
        type: 'currency',
        amount: Math.floor(minutesActive * 0.5),
        description: 'Coins earned',
      });
    }

    return {
      activityType: character.currentActivity.type,
      startedAt: new Date(character.currentActivity.startedAt),
      minutesActive,
      progressPercentage,
      potentialRewards,
    };
  }

  /**
   * Mock activity switching for development mode
   */
  private static async mockSwitchActivity(userId: string, activityType: ActivityType): Promise<SwitchActivityResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Get current character from localStorage (mock data)
    const characterKey = `testCharacter-${userId}`;
    let character: Character | null = null;

    if (typeof window !== 'undefined' && window.localStorage) {
      const storedCharacter = localStorage.getItem(characterKey);
      if (storedCharacter) {
        character = JSON.parse(storedCharacter);
      }
    }

    if (!character) {
      throw new Error('Character not found');
    }

    // Calculate rewards from previous activity if there was one
    const previousActivityRewards: ActivityReward[] = [];
    if (character.currentActivity && character.currentActivity.type !== activityType) {
      const minutesActive = Math.floor(
        (Date.now() - new Date(character.currentActivity.startedAt).getTime()) / (1000 * 60)
      );
      
      if (minutesActive > 0) {
        // Generate mock rewards based on time spent
        const baseReward = Math.floor(minutesActive * 2);
        previousActivityRewards.push({
          type: 'experience',
          amount: baseReward,
          description: `${baseReward} experience from ${character.currentActivity.type}`,
        });
        
        if (minutesActive >= 5) {
          previousActivityRewards.push({
            type: 'currency',
            amount: Math.floor(minutesActive * 0.5),
            description: `${Math.floor(minutesActive * 0.5)} coins earned`,
          });
        }
      }
    }

    // Update character's current activity
    const updatedCharacter: Character = {
      ...character,
      currentActivity: {
        type: activityType,
        startedAt: new Date(),
        progress: 0,
        rewards: [],
      },
      // Apply previous activity rewards
      experience: character.experience + (previousActivityRewards.find(r => r.type === 'experience')?.amount || 0),
      currency: character.currency + (previousActivityRewards.find(r => r.type === 'currency')?.amount || 0),
    };

    // Recalculate level if experience increased
    if (updatedCharacter.experience > character.experience) {
      updatedCharacter.level = Math.floor(Math.sqrt(updatedCharacter.experience / 100)) + 1;
    }

    // Save updated character back to localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(characterKey, JSON.stringify(updatedCharacter));
    }

    const activityInfo = this.getActivityDisplayInfo(activityType);
    
    return {
      character: updatedCharacter,
      previousActivityRewards: previousActivityRewards.length > 0 ? previousActivityRewards : undefined,
      message: `Successfully switched to ${activityInfo.name}!`,
    };
  }
}

export default ActivityService;