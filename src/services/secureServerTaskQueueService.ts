import { TaskQueueSecurityMiddleware } from './taskQueueSecurityMiddleware';
import { TaskQueueTokenManager } from './taskQueueSecurity';
import { Task, TaskType, TaskProgress, TaskCompletionResult } from '../types/taskQueue';
import type { CraftingStation } from '../types/taskQueue';
import { HarvestingActivity } from '../types/harvesting';
import { CraftingRecipe } from '../types/crafting';
import { Enemy, PlayerCombatStats } from '../types/combat';
import { CharacterStats } from '../types/character';
import { NetworkUtils } from '../utils/networkUtils';

/**
 * Secure Server Task Queue Service with integrated security middleware
 */
export class SecureServerTaskQueueService {
  private apiUrl: string;
  private progressCallbacks: Map<string, (progress: TaskProgress) => void> = new Map();
  private completionCallbacks: Map<string, (result: TaskCompletionResult) => void> = new Map();

  constructor() {
    this.apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
  }

  /**
   * Authenticate player and get session token
   */
  async authenticatePlayer(playerId: string, credentials: any): Promise<string> {
    try {
      const response = await NetworkUtils.postJson(`${this.apiUrl}/auth/login`, {
        playerId,
        credentials
      });

      if (response.success) {
        return response.token;
      } else {
        throw new Error('Authentication failed');
      }
    } catch (error) {
      console.error('SecureServerTaskQueueService: Authentication failed:', error);
      throw new Error('Failed to authenticate player');
    }
  }

  /**
   * Add harvesting task with security validation
   */
  async addHarvestingTask(
    playerId: string,
    activity: HarvestingActivity,
    playerStats: CharacterStats,
    token: string,
    context: {
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
    } = {},
    options: {
      playerLevel?: number;
      playerInventory?: { [itemId: string]: number };
      priority?: number;
    } = {}
  ): Promise<Task> {
    // Security validation
    const validation = await TaskQueueSecurityMiddleware.validateOperation(
      'add',
      playerId,
      {
        type: 'harvesting',
        activityData: { activity, playerStats },
        duration: this.calculateHarvestingDuration(activity, playerStats),
        priority: options.priority || 5
      },
      { token, ...context }
    );

    if (!validation.success) {
      throw new Error(validation.error || 'Security validation failed');
    }

    try {
      const response = await NetworkUtils.postJson(
        `${this.apiUrl}/task-queue/add-harvesting`,
        {
          playerId: validation.playerId,
          activity,
          playerStats,
          options
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Player-ID': validation.playerId!,
            'X-Session-ID': context.sessionId || '',
            'X-Client-IP': context.ipAddress || '',
            'User-Agent': context.userAgent || ''
          },
          timeout: 8000,
          retries: 2
        }
      );

      if (response.success) {
        return response.task;
      } else {
        throw new Error(response.error || 'Failed to add harvesting task');
      }
    } catch (error) {
      console.error('SecureServerTaskQueueService: Failed to add harvesting task:', error);
      throw error;
    }
  }

  /**
   * Add crafting task with security validation
   */
  async addCraftingTask(
    playerId: string,
    recipe: CraftingRecipe,
    playerStats: CharacterStats,
    token: string,
    context: {
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
    } = {},
    options: {
      playerLevel?: number;
      playerInventory?: { [itemId: string]: number };
      priority?: number;
      quantity?: number;
    } = {}
  ): Promise<Task> {
    // Security validation
    const validation = await TaskQueueSecurityMiddleware.validateOperation(
      'add',
      playerId,
      {
        type: 'crafting',
        activityData: { recipe, playerStats },
        duration: this.calculateCraftingDuration(recipe, playerStats),
        priority: options.priority || 5
      },
      { token, ...context }
    );

    if (!validation.success) {
      throw new Error(validation.error || 'Security validation failed');
    }

    try {
      const response = await NetworkUtils.postJson(
        `${this.apiUrl}/task-queue/add-crafting`,
        {
          playerId: validation.playerId,
          recipe,
          playerStats,
          options
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Player-ID': validation.playerId!,
            'X-Session-ID': context.sessionId || '',
            'X-Client-IP': context.ipAddress || '',
            'User-Agent': context.userAgent || ''
          },
          timeout: 8000,
          retries: 2
        }
      );

      if (response.success) {
        return response.task;
      } else {
        throw new Error(response.error || 'Failed to add crafting task');
      }
    } catch (error) {
      console.error('SecureServerTaskQueueService: Failed to add crafting task:', error);
      throw error;
    }
  }

  /**
   * Add combat task with security validation
   */
  async addCombatTask(
    playerId: string,
    enemy: Enemy,
    playerStats: CharacterStats,
    playerCombatStats: PlayerCombatStats,
    token: string,
    context: {
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
    } = {},
    options: {
      playerLevel?: number;
      priority?: number;
      equipment?: any[];
    } = {}
  ): Promise<Task> {
    // Security validation
    const validation = await TaskQueueSecurityMiddleware.validateOperation(
      'add',
      playerId,
      {
        type: 'combat',
        activityData: { enemy, playerStats, playerCombatStats },
        duration: this.calculateCombatDuration(enemy, playerCombatStats),
        priority: options.priority || 5
      },
      { token, ...context }
    );

    if (!validation.success) {
      throw new Error(validation.error || 'Security validation failed');
    }

    try {
      const response = await NetworkUtils.postJson(
        `${this.apiUrl}/task-queue/add-combat`,
        {
          playerId: validation.playerId,
          enemy,
          playerStats,
          playerCombatStats,
          options
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Player-ID': validation.playerId!,
            'X-Session-ID': context.sessionId || '',
            'X-Client-IP': context.ipAddress || '',
            'User-Agent': context.userAgent || ''
          },
          timeout: 8000,
          retries: 2
        }
      );

      if (response.success) {
        return response.task;
      } else {
        throw new Error(response.error || 'Failed to add combat task');
      }
    } catch (error) {
      console.error('SecureServerTaskQueueService: Failed to add combat task:', error);
      throw error;
    }
  }

  /**
   * Remove task with security validation
   */
  async removeTask(
    playerId: string,
    taskId: string,
    token: string,
    context: {
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
    } = {}
  ): Promise<void> {
    // Security validation
    const validation = await TaskQueueSecurityMiddleware.validateOperation(
      'remove',
      playerId,
      { taskId, playerId },
      { token, ...context }
    );

    if (!validation.success) {
      throw new Error(validation.error || 'Security validation failed');
    }

    try {
      const response = await NetworkUtils.postJson(
        `${this.apiUrl}/task-queue/remove`,
        {
          playerId: validation.playerId,
          taskId
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Player-ID': validation.playerId!,
            'X-Session-ID': context.sessionId || '',
            'X-Client-IP': context.ipAddress || '',
            'User-Agent': context.userAgent || ''
          },
          timeout: 6000,
          retries: 1
        }
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to remove task');
      }
    } catch (error) {
      console.error('SecureServerTaskQueueService: Failed to remove task:', error);
      throw error;
    }
  }

  /**
   * Reorder tasks with security validation
   */
  async reorderTasks(
    playerId: string,
    taskIds: string[],
    token: string,
    context: {
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
    } = {}
  ): Promise<void> {
    // Security validation
    const validation = await TaskQueueSecurityMiddleware.validateOperation(
      'reorder',
      playerId,
      { taskIds, playerId },
      { token, ...context }
    );

    if (!validation.success) {
      throw new Error(validation.error || 'Security validation failed');
    }

    try {
      const response = await NetworkUtils.postJson(
        `${this.apiUrl}/task-queue/reorder`,
        {
          playerId: validation.playerId,
          taskIds
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Player-ID': validation.playerId!,
            'X-Session-ID': context.sessionId || '',
            'X-Client-IP': context.ipAddress || '',
            'User-Agent': context.userAgent || ''
          },
          timeout: 6000,
          retries: 1
        }
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to reorder tasks');
      }
    } catch (error) {
      console.error('SecureServerTaskQueueService: Failed to reorder tasks:', error);
      throw error;
    }
  }

  /**
   * Stop all tasks with security validation
   */
  async stopAllTasks(
    playerId: string,
    token: string,
    context: {
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
    } = {}
  ): Promise<void> {
    // Security validation
    const validation = await TaskQueueSecurityMiddleware.validateOperation(
      'stop',
      playerId,
      { playerId },
      { token, ...context }
    );

    if (!validation.success) {
      throw new Error(validation.error || 'Security validation failed');
    }

    try {
      const response = await NetworkUtils.postJson(
        `${this.apiUrl}/task-queue/stop`,
        {
          playerId: validation.playerId
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Player-ID': validation.playerId!,
            'X-Session-ID': context.sessionId || '',
            'X-Client-IP': context.ipAddress || '',
            'User-Agent': context.userAgent || ''
          },
          timeout: 6000,
          retries: 1
        }
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to stop tasks');
      }
    } catch (error) {
      console.error('SecureServerTaskQueueService: Failed to stop tasks:', error);
      throw error;
    }
  }

  /**
   * Get queue status with security validation
   */
  async getQueueStatus(
    playerId: string,
    token: string,
    context: {
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
    } = {}
  ): Promise<any> {
    // Security validation
    const validation = await TaskQueueSecurityMiddleware.validateOperation(
      'view',
      playerId,
      { playerId },
      { token, ...context }
    );

    if (!validation.success) {
      throw new Error(validation.error || 'Security validation failed');
    }

    try {
      const response = await NetworkUtils.fetchJson(
        `${this.apiUrl}/task-queue/${validation.playerId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Player-ID': validation.playerId!,
            'X-Session-ID': context.sessionId || '',
            'X-Client-IP': context.ipAddress || '',
            'User-Agent': context.userAgent || ''
          }
        },
        {
          timeout: 5000,
          retries: 1
        }
      );

      return response.queue;
    } catch (error) {
      console.error('SecureServerTaskQueueService: Failed to get queue status:', error);
      throw error;
    }
  }

  /**
   * Get security status (admin only)
   */
  async getSecurityStatus(
    adminId: string,
    token: string,
    context: {
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
      adminLevel: string;
    }
  ): Promise<any> {
    // Admin security validation
    const validation = await TaskQueueSecurityMiddleware.validateAdminOperation(
      'view_security_status',
      adminId,
      '',
      {},
      { token, ...context }
    );

    if (!validation.success) {
      throw new Error(validation.error || 'Admin security validation failed');
    }

    return TaskQueueSecurityMiddleware.getSecurityStatus();
  }

  /**
   * Revoke player tokens (admin only)
   */
  async revokePlayerTokens(
    adminId: string,
    targetPlayerId: string,
    token: string,
    context: {
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
      adminLevel: string;
    }
  ): Promise<number> {
    // Admin security validation
    const validation = await TaskQueueSecurityMiddleware.validateAdminOperation(
      'revoke_tokens',
      adminId,
      targetPlayerId,
      { targetPlayerId },
      { token, ...context }
    );

    if (!validation.success) {
      throw new Error(validation.error || 'Admin security validation failed');
    }

    return TaskQueueTokenManager.revokePlayerTokens(targetPlayerId);
  }

  /**
   * Refresh session token
   */
  async refreshToken(token: string): Promise<boolean> {
    return TaskQueueTokenManager.refreshToken(token);
  }

  /**
   * Logout and revoke token
   */
  async logout(token: string): Promise<boolean> {
    return TaskQueueTokenManager.revokeToken(token);
  }

  // Private helper methods for duration calculations
  private calculateHarvestingDuration(activity: HarvestingActivity, playerStats: CharacterStats): number {
    // Base duration with player stat modifiers
    const baseDuration = 30000; // 30 seconds
    const efficiencyMultiplier = 1 - (playerStats.intelligence || 0) * 0.001; // Use intelligence for efficiency
    return Math.max(5000, baseDuration * efficiencyMultiplier);
  }

  private calculateCraftingDuration(recipe: CraftingRecipe, playerStats: CharacterStats): number {
    // Base duration with crafting time and player skill modifiers
    const baseDuration = recipe.craftingTime * 1000; // Convert seconds to milliseconds
    const skillMultiplier = 1 - (playerStats.intelligence || 0) * 0.001; // Use intelligence for crafting efficiency
    return Math.max(10000, baseDuration * skillMultiplier);
  }

  private calculateCombatDuration(enemy: Enemy, playerCombatStats: PlayerCombatStats): number {
    // Duration based on enemy difficulty and player combat stats
    const baseDuration = (enemy.level || 1) * 20000; // 20 seconds per enemy level
    const combatMultiplier = 1 - (playerCombatStats.attack || 0) * 0.002;
    return Math.max(15000, baseDuration * combatMultiplier);
  }
}