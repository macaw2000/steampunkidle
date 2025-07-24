import { TaskQueue, Task } from '../types/taskQueue';
import { TaskQueueDebugger } from './taskQueueDebugger';

export interface SupportTicket {
  ticketId: string;
  playerId: string;
  playerName: string;
  issueType: SupportIssueType;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: number;
  updatedAt: number;
  assignedTo?: string;
  resolution?: string;
  attachments: SupportAttachment[];
}

export enum SupportIssueType {
  QUEUE_STUCK = 'queue_stuck',
  TASK_NOT_COMPLETING = 'task_not_completing',
  PROGRESS_LOST = 'progress_lost',
  SYNC_ISSUES = 'sync_issues',
  PERFORMANCE_SLOW = 'performance_slow',
  REWARDS_MISSING = 'rewards_missing',
  QUEUE_CORRUPTION = 'queue_corruption',
  OTHER = 'other'
}

export interface SupportAttachment {
  type: 'debug_log' | 'screenshot' | 'queue_state' | 'error_trace';
  filename: string;
  data: string;
  timestamp: number;
}

export interface QueueDiagnostic {
  playerId: string;
  timestamp: number;
  issues: DiagnosticIssue[];
  recommendations: DiagnosticRecommendation[];
  queueHealth: 'healthy' | 'warning' | 'critical';
  autoFixApplied: boolean;
}

export interface DiagnosticIssue {
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  description: string;
  affectedTasks: string[];
  possibleCauses: string[];
  autoFixable: boolean;
}

export interface DiagnosticRecommendation {
  action: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  automated: boolean;
}

export class TaskQueueSupportTools {
  private baseUrl: string;
  private adminToken: string;
  private debuggerService: TaskQueueDebugger;

  constructor(baseUrl: string, adminToken: string, debuggerService: TaskQueueDebugger) {
    this.baseUrl = baseUrl;
    this.adminToken = adminToken;
    this.debuggerService = debuggerService;
  }

  /**
   * Run comprehensive diagnostics on a player's queue
   */
  async runQueueDiagnostics(playerId: string, autoFix: boolean = false): Promise<QueueDiagnostic> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/support/diagnostics/${playerId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ autoFix })
      });

      if (!response.ok) {
        throw new Error(`Failed to run diagnostics: ${response.statusText}`);
      }

      const diagnostic = await response.json();
      
      // Enhance with local debugging data
      const debugReport = this.debuggerService.generatePlayerDebugReport(playerId);
      diagnostic.debugData = debugReport;

      return diagnostic;
    } catch (error) {
      console.error('Error running queue diagnostics:', error);
      throw error;
    }
  }

  /**
   * Create a support ticket
   */
  async createSupportTicket(ticket: Omit<SupportTicket, 'ticketId' | 'createdAt' | 'updatedAt' | 'status'>): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/support/tickets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...ticket,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: 'open'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create support ticket: ${response.statusText}`);
      }

      const result = await response.json();
      return result.ticketId;
    } catch (error) {
      console.error('Error creating support ticket:', error);
      throw error;
    }
  }

  /**
   * Get all support tickets
   */
  async getSupportTickets(filters?: {
    status?: string;
    priority?: string;
    issueType?: SupportIssueType;
    assignedTo?: string;
  }): Promise<SupportTicket[]> {
    try {
      const queryParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) queryParams.append(key, value);
        });
      }

      const response = await fetch(`${this.baseUrl}/admin/support/tickets?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch support tickets: ${response.statusText}`);
      }

      const data = await response.json();
      return data.tickets || [];
    } catch (error) {
      console.error('Error fetching support tickets:', error);
      throw error;
    }
  }

  /**
   * Update support ticket status
   */
  async updateSupportTicket(ticketId: string, updates: Partial<SupportTicket>): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...updates,
          updatedAt: Date.now()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update support ticket: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error updating support ticket:', error);
      throw error;
    }
  }

  /**
   * Auto-resolve common queue issues
   */
  async autoResolveQueueIssues(playerId: string): Promise<{
    resolved: string[];
    failed: string[];
    recommendations: string[];
  }> {
    const resolved: string[] = [];
    const failed: string[] = [];
    const recommendations: string[] = [];

    try {
      // Run diagnostics first
      const diagnostic = await this.runQueueDiagnostics(playerId, false);

      for (const issue of diagnostic.issues) {
        if (issue.autoFixable) {
          try {
            await this.applyAutoFix(playerId, issue);
            resolved.push(issue.description);
          } catch (error) {
            failed.push(`${issue.description}: ${error}`);
          }
        } else {
          recommendations.push(`Manual intervention needed: ${issue.description}`);
        }
      }

      return { resolved, failed, recommendations };
    } catch (error) {
      console.error('Error auto-resolving queue issues:', error);
      throw error;
    }
  }

  /**
   * Reset player queue to a clean state
   */
  async resetPlayerQueue(playerId: string, preserveCurrentTask: boolean = true): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/support/reset-queue/${playerId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ preserveCurrentTask })
      });

      if (!response.ok) {
        throw new Error(`Failed to reset player queue: ${response.statusText}`);
      }

      // Log the intervention
      await this.logSupportAction(playerId, 'queue_reset', `Queue reset (preserve current: ${preserveCurrentTask})`);
    } catch (error) {
      console.error('Error resetting player queue:', error);
      throw error;
    }
  }

  /**
   * Restore queue from backup
   */
  async restoreQueueFromBackup(playerId: string, backupTimestamp: number): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/support/restore-queue/${playerId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ backupTimestamp })
      });

      if (!response.ok) {
        throw new Error(`Failed to restore queue from backup: ${response.statusText}`);
      }

      await this.logSupportAction(playerId, 'queue_restore', `Queue restored from backup: ${new Date(backupTimestamp).toISOString()}`);
    } catch (error) {
      console.error('Error restoring queue from backup:', error);
      throw error;
    }
  }

  /**
   * Get available queue backups for a player
   */
  async getQueueBackups(playerId: string): Promise<{
    timestamp: number;
    taskCount: number;
    currentTask: string | null;
    size: number;
  }[]> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/support/backups/${playerId}`, {
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch queue backups: ${response.statusText}`);
      }

      const data = await response.json();
      return data.backups || [];
    } catch (error) {
      console.error('Error fetching queue backups:', error);
      throw error;
    }
  }

  /**
   * Manually complete a stuck task
   */
  async manuallyCompleteTask(playerId: string, taskId: string, rewards?: any[]): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/support/complete-task/${playerId}/${taskId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rewards })
      });

      if (!response.ok) {
        throw new Error(`Failed to manually complete task: ${response.statusText}`);
      }

      await this.logSupportAction(playerId, 'manual_task_completion', `Manually completed task ${taskId}`);
    } catch (error) {
      console.error('Error manually completing task:', error);
      throw error;
    }
  }

  /**
   * Fix sync issues for a player
   */
  async fixSyncIssues(playerId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/support/fix-sync/${playerId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fix sync issues: ${response.statusText}`);
      }

      await this.logSupportAction(playerId, 'sync_fix', 'Fixed synchronization issues');
    } catch (error) {
      console.error('Error fixing sync issues:', error);
      throw error;
    }
  }

  /**
   * Generate comprehensive support report
   */
  async generateSupportReport(playerId: string): Promise<{
    playerInfo: any;
    queueState: TaskQueue;
    diagnostics: QueueDiagnostic;
    recentActivity: any[];
    systemHealth: any;
    recommendations: string[];
  }> {
    try {
      const [playerInfo, queueState, diagnostics, recentActivity, systemHealth] = await Promise.all([
        this.getPlayerInfo(playerId),
        this.getPlayerQueueState(playerId),
        this.runQueueDiagnostics(playerId),
        this.getRecentPlayerActivity(playerId),
        this.getSystemHealthForPlayer(playerId)
      ]);

      const recommendations = this.generateSupportRecommendations(diagnostics, queueState);

      return {
        playerInfo,
        queueState,
        diagnostics,
        recentActivity,
        systemHealth,
        recommendations
      };
    } catch (error) {
      console.error('Error generating support report:', error);
      throw error;
    }
  }

  /**
   * Bulk operations for multiple players
   */
  async bulkFixIssues(playerIds: string[], issueType: SupportIssueType): Promise<{
    successful: string[];
    failed: { playerId: string; error: string }[];
  }> {
    const successful: string[] = [];
    const failed: { playerId: string; error: string }[] = [];

    for (const playerId of playerIds) {
      try {
        switch (issueType) {
          case SupportIssueType.SYNC_ISSUES:
            await this.fixSyncIssues(playerId);
            break;
          case SupportIssueType.QUEUE_STUCK:
            await this.autoResolveQueueIssues(playerId);
            break;
          case SupportIssueType.QUEUE_CORRUPTION:
            await this.resetPlayerQueue(playerId, false);
            break;
          default:
            throw new Error(`Unsupported bulk operation for issue type: ${issueType}`);
        }
        successful.push(playerId);
      } catch (error) {
        failed.push({ playerId, error: String(error) });
      }
    }

    return { successful, failed };
  }

  // Private helper methods

  private async applyAutoFix(playerId: string, issue: DiagnosticIssue): Promise<void> {
    switch (issue.type) {
      case 'stuck_task':
        await this.manuallyCompleteTask(playerId, issue.affectedTasks[0]);
        break;
      case 'sync_conflict':
        await this.fixSyncIssues(playerId);
        break;
      case 'invalid_task_state':
        await this.resetPlayerQueue(playerId, true);
        break;
      default:
        throw new Error(`No auto-fix available for issue type: ${issue.type}`);
    }
  }

  private async logSupportAction(playerId: string, action: string, details: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/admin/support/actions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          playerId,
          action,
          details,
          timestamp: Date.now()
        })
      });
    } catch (error) {
      console.error('Error logging support action:', error);
    }
  }

  private async getPlayerInfo(playerId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/admin/players/${playerId}`, {
      headers: {
        'Authorization': `Bearer ${this.adminToken}`,
        'Content-Type': 'application/json'
      }
    });
    return response.json();
  }

  private async getPlayerQueueState(playerId: string): Promise<TaskQueue> {
    const response = await fetch(`${this.baseUrl}/admin/queues/${playerId}`, {
      headers: {
        'Authorization': `Bearer ${this.adminToken}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    return data.queue;
  }

  private async getRecentPlayerActivity(playerId: string): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/admin/activity/${playerId}?limit=50`, {
      headers: {
        'Authorization': `Bearer ${this.adminToken}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    return data.activities || [];
  }

  private async getSystemHealthForPlayer(playerId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/admin/health/player/${playerId}`, {
      headers: {
        'Authorization': `Bearer ${this.adminToken}`,
        'Content-Type': 'application/json'
      }
    });
    return response.json();
  }

  private generateSupportRecommendations(diagnostics: QueueDiagnostic, queueState: TaskQueue): string[] {
    const recommendations: string[] = [];

    if (diagnostics.queueHealth === 'critical') {
      recommendations.push('Consider resetting the player queue to resolve critical issues');
    }

    if (queueState.queuedTasks.length > 30) {
      recommendations.push('Queue is very long, consider helping player optimize their task planning');
    }

    if (diagnostics.issues.some(i => i.type === 'sync_conflict')) {
      recommendations.push('Sync conflicts detected, run sync fix operation');
    }

    return recommendations;
  }
}