/**
 * Simple Harvesting Service for Minimal Backend
 * Works with the basic activity endpoints we have deployed
 */

import { NetworkUtils } from '../utils/networkUtils';

interface SimpleActivity {
  id: string;
  name: string;
  type: string;
  duration: number;
  description: string;
  icon: string;
}

interface ActivityProgress {
  progress: number;
  timeRemaining: number;
  isComplete: boolean;
  rewards: any[];
}

class SimpleHarvestingService {
  private apiUrl: string;

  constructor() {
    this.apiUrl = process.env.REACT_APP_API_URL || '';
  }

  /**
   * Get available harvesting activities
   */
  getAvailableActivities(): SimpleActivity[] {
    return [
      {
        id: 'copper_mining',
        name: 'Copper Mining',
        type: 'harvesting',
        duration: 30000, // 30 seconds
        description: 'Extract copper ore from steampunk mines',
        icon: '⛏️'
      },
      {
        id: 'gear_crafting',
        name: 'Gear Crafting',
        type: 'crafting',
        duration: 45000, // 45 seconds
        description: 'Craft mechanical gears and components',
        icon: '⚙️'
      },
      {
        id: 'steam_research',
        name: 'Steam Research',
        type: 'harvesting',
        duration: 60000, // 60 seconds
        description: 'Research steam-powered technologies',
        icon: '🔬'
      }
    ];
  }

  /**
   * Start a harvesting activity
   */
  async startActivity(userId: string, activity: SimpleActivity): Promise<void> {
    try {
      console.log('=== SIMPLE HARVESTING SERVICE DEBUG ===');
      console.log('API URL:', this.apiUrl);
      console.log('Full endpoint:', `${this.apiUrl}/activity/switch`);
      console.log('Request payload:', {
        userId,
        activityType: activity.type,
        activityData: {
          activityId: activity.id,
          name: activity.name,
          duration: activity.duration,
          description: activity.description,
          icon: activity.icon
        }
      });

      const response = await NetworkUtils.postJson(`${this.apiUrl}/activity/switch`, {
        userId,
        activityType: activity.type,
        activityData: {
          activityId: activity.id,
          name: activity.name,
          duration: activity.duration,
          description: activity.description,
          icon: activity.icon
        }
      });

      console.log('✅ Activity started successfully:', response);
    } catch (error) {
      console.error('❌ Failed to start activity:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined
      });
      throw error;
    }
  }

  /**
   * Get current activity progress
   */
  async getActivityProgress(userId: string): Promise<ActivityProgress> {
    try {
      const response = await NetworkUtils.fetchJson(`${this.apiUrl}/activity/progress?userId=${userId}`);
      return {
        progress: response.progress || 0,
        timeRemaining: response.timeRemaining || 0,
        isComplete: response.isComplete || false,
        rewards: response.rewards || []
      };
    } catch (error) {
      console.error('Failed to get activity progress:', error);
      return {
        progress: 0,
        timeRemaining: 0,
        isComplete: false,
        rewards: []
      };
    }
  }

  /**
   * Get character data
   */
  async getCharacter(userId: string): Promise<any> {
    try {
      const response = await NetworkUtils.fetchJson(`${this.apiUrl}/character?userId=${userId}`);
      return response.character;
    } catch (error) {
      console.error('Failed to get character:', error);
      throw error;
    }
  }
}

export const simpleHarvestingService = new SimpleHarvestingService();