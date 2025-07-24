import { TaskQueue, Task, TaskQueueStats } from '../types/taskQueue';

export interface PlayerQueueInfo {
  playerId: string;
  playerName: string;
  queue: TaskQueue;
  stats: TaskQueueStats;
  lastActivity: number;
}

export interface AdminInterventionLog {
  timestamp: number;
  adminId: string;
  action: string;
  playerId: string;
  details: string;
}

export class TaskQueueAdminService {
  private baseUrl: string;
  private adminToken: string;

  constructor(baseUrl: string, adminToken: string) {
    this.baseUrl = baseUrl;
    this.adminToken = adminToken;
  }

  /**
   * Get all player queues with stats and activity information
   */
  async getAllPlayerQueues(): Promise<PlayerQueueInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/queues`, {
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch player queues: ${response.statusText}`);
      }

      const data = await response.json();
      return data.playerQueues || [];
    } catch (error) {
      console.error('Error fetching player queues:', error);
      throw error;
    }
  }

  /**
   * Get detailed information about a specific player's queue
   */
  async getPlayerQueueDetails(playerId: string): Promise<PlayerQueueInfo> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/queues/${playerId}`, {
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch player queue: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching player queue details:', error);
      throw error;
    }
  }

  /**
   * Pause a player's task queue
   */
  async pausePlayerQueue(playerId: string, reason: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/queues/${playerId}/pause`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });

      if (!response.ok) {
        throw new Error(`Failed to pause queue: ${response.statusText}`);
      }

      await this.logIntervention('pause_queue', playerId, reason);
    } catch (error) {
      console.error('Error pausing player queue:', error);
      throw error;
    }
  }

  /**
   * Resume a player's task queue
   */
  async resumePlayerQueue(playerId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/queues/${playerId}/resume`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to resume queue: ${response.statusText}`);
      }

      await this.logIntervention('resume_queue', playerId, 'Admin resumed queue');
    } catch (error) {
      console.error('Error resuming player queue:', error);
      throw error;
    }
  }

  /**
   * Clear all tasks from a player's queue
   */
  async clearPlayerQueue(playerId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/queues/${playerId}/clear`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to clear queue: ${response.statusText}`);
      }

      await this.logIntervention('clear_queue', playerId, 'Admin cleared entire queue');
    } catch (error) {
      console.error('Error clearing player queue:', error);
      throw error;
    }
  }

  /**
   * Force complete a specific task
   */
  async forceCompleteTask(playerId: string, taskId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/queues/${playerId}/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to force complete task: ${response.statusText}`);
      }

      await this.logIntervention('force_complete_task', playerId, `Force completed task ${taskId}`);
    } catch (error) {
      console.error('Error force completing task:', error);
      throw error;
    }
  }

  /**
   * Remove a specific task from a player's queue
   */
  async removeTaskFromQueue(playerId: string, taskId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/queues/${playerId}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to remove task: ${response.statusText}`);
      }

      await this.logIntervention('remove_task', playerId, `Removed task ${taskId} from queue`);
    } catch (error) {
      console.error('Error removing task from queue:', error);
      throw error;
    }
  }

  /**
   * Get system-wide queue statistics
   */
  async getSystemStats(): Promise<{
    totalActivePlayers: number;
    totalQueuedTasks: number;
    averageQueueLength: number;
    totalTasksCompletedToday: number;
    systemLoad: number;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/stats`, {
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch system stats: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching system stats:', error);
      throw error;
    }
  }

  /**
   * Get intervention log entries
   */
  async getInterventionLog(limit: number = 100): Promise<AdminInterventionLog[]> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/interventions?limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch intervention log: ${response.statusText}`);
      }

      const data = await response.json();
      return data.interventions || [];
    } catch (error) {
      console.error('Error fetching intervention log:', error);
      throw error;
    }
  }

  /**
   * Search for players by ID or name
   */
  async searchPlayers(query: string): Promise<PlayerQueueInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/players/search?q=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to search players: ${response.statusText}`);
      }

      const data = await response.json();
      return data.players || [];
    } catch (error) {
      console.error('Error searching players:', error);
      throw error;
    }
  }

  /**
   * Bulk operations on multiple players
   */
  async bulkPauseQueues(playerIds: string[], reason: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/queues/bulk/pause`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ playerIds, reason })
      });

      if (!response.ok) {
        throw new Error(`Failed to bulk pause queues: ${response.statusText}`);
      }

      await this.logIntervention('bulk_pause_queues', 'multiple', `Paused ${playerIds.length} queues: ${reason}`);
    } catch (error) {
      console.error('Error bulk pausing queues:', error);
      throw error;
    }
  }

  async bulkResumeQueues(playerIds: string[]): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/queues/bulk/resume`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ playerIds })
      });

      if (!response.ok) {
        throw new Error(`Failed to bulk resume queues: ${response.statusText}`);
      }

      await this.logIntervention('bulk_resume_queues', 'multiple', `Resumed ${playerIds.length} queues`);
    } catch (error) {
      console.error('Error bulk resuming queues:', error);
      throw error;
    }
  }

  /**
   * Log an admin intervention
   */
  private async logIntervention(action: string, playerId: string, details: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/admin/interventions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action,
          playerId,
          details,
          timestamp: Date.now()
        })
      });
    } catch (error) {
      console.error('Error logging intervention:', error);
      // Don't throw here as this is a secondary operation
    }
  }

  /**
   * Validate admin token and permissions
   */
  async validateAdminAccess(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/validate`, {
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response.ok;
    } catch (error) {
      console.error('Error validating admin access:', error);
      return false;
    }
  }
}