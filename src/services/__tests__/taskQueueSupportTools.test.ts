import { TaskQueueSupportTools, SupportIssueType } from '../taskQueueSupportTools';
import { TaskQueueDebugger } from '../taskQueueDebugger';

// Mock fetch globally
global.fetch = jest.fn();

// Mock TaskQueueDebugger
jest.mock('../taskQueueDebugger');

describe('TaskQueueSupportTools', () => {
  let supportTools: TaskQueueSupportTools;
  let mockDebugger: jest.Mocked<TaskQueueDebugger>;
  const mockBaseUrl = 'https://api.example.com';
  const mockAdminToken = 'admin-token-123';

  beforeEach(() => {
    mockDebugger = new TaskQueueDebugger(mockBaseUrl, mockAdminToken) as jest.Mocked<TaskQueueDebugger>;
    supportTools = new TaskQueueSupportTools(mockBaseUrl, mockAdminToken, mockDebugger);
    jest.clearAllMocks();
  });

  describe('runQueueDiagnostics', () => {
    it('should run diagnostics successfully', async () => {
      const playerId = 'player1';
      const mockDiagnostic = {
        playerId,
        timestamp: Date.now(),
        issues: [
          {
            type: 'stuck_task',
            severity: 'error' as const,
            description: 'Task is stuck',
            affectedTasks: ['task1'],
            possibleCauses: ['Network timeout'],
            autoFixable: true
          }
        ],
        recommendations: [
          {
            action: 'restart_task',
            description: 'Restart the stuck task',
            impact: 'low' as const,
            automated: true
          }
        ],
        queueHealth: 'warning' as const,
        autoFixApplied: false
      };

      const mockDebugReport = {
        summary: { totalTasks: 5, completedTasks: 4, failedTasks: 1, averageTaskTime: 2000 },
        recentErrors: [],
        performanceIssues: [],
        recommendations: []
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDiagnostic
      });

      mockDebugger.generatePlayerDebugReport.mockReturnValue(mockDebugReport);

      const result = await supportTools.runQueueDiagnostics(playerId, false);

      expect(fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/admin/support/diagnostics/${playerId}`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mockAdminToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ autoFix: false })
        })
      );

      expect(result).toEqual({
        ...mockDiagnostic,
        debugData: mockDebugReport
      });
    });

    it('should handle diagnostics errors', async () => {
      const playerId = 'player1';

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found'
      });

      await expect(supportTools.runQueueDiagnostics(playerId)).rejects.toThrow(
        'Failed to run diagnostics: Not Found'
      );
    });
  });

  describe('createSupportTicket', () => {
    it('should create a support ticket successfully', async () => {
      const ticketData = {
        playerId: 'player1',
        playerName: 'TestPlayer',
        issueType: SupportIssueType.QUEUE_STUCK,
        description: 'Player queue is stuck',
        priority: 'high' as const,
        attachments: []
      };

      const mockTicketId = 'ticket-123';

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ticketId: mockTicketId })
      });

      const result = await supportTools.createSupportTicket(ticketData);

      expect(fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/admin/support/tickets`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mockAdminToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...ticketData,
            createdAt: expect.any(Number),
            updatedAt: expect.any(Number),
            status: 'open'
          })
        })
      );

      expect(result).toBe(mockTicketId);
    });
  });

  describe('getSupportTickets', () => {
    it('should fetch support tickets with filters', async () => {
      const mockTickets = [
        {
          ticketId: 'ticket-1',
          playerId: 'player1',
          playerName: 'TestPlayer1',
          issueType: SupportIssueType.QUEUE_STUCK,
          status: 'open',
          priority: 'high',
          description: 'Queue stuck',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          attachments: []
        }
      ];

      const filters = {
        status: 'open',
        priority: 'high',
        issueType: SupportIssueType.QUEUE_STUCK
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tickets: mockTickets })
      });

      const result = await supportTools.getSupportTickets(filters);

      expect(fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/admin/support/tickets?status=open&priority=high&issueType=queue_stuck`,
        expect.objectContaining({
          headers: {
            'Authorization': `Bearer ${mockAdminToken}`,
            'Content-Type': 'application/json'
          }
        })
      );

      expect(result).toEqual(mockTickets);
    });

    it('should fetch all tickets when no filters provided', async () => {
      const mockTickets = [];

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tickets: mockTickets })
      });

      const result = await supportTools.getSupportTickets();

      expect(fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/admin/support/tickets?`,
        expect.any(Object)
      );

      expect(result).toEqual(mockTickets);
    });
  });

  describe('autoResolveQueueIssues', () => {
    it('should auto-resolve fixable issues', async () => {
      const playerId = 'player1';
      const mockDiagnostic = {
        playerId,
        timestamp: Date.now(),
        issues: [
          {
            type: 'stuck_task',
            severity: 'error' as const,
            description: 'Task is stuck',
            affectedTasks: ['task1'],
            possibleCauses: ['Network timeout'],
            autoFixable: true
          },
          {
            type: 'manual_issue',
            severity: 'warning' as const,
            description: 'Manual intervention needed',
            affectedTasks: ['task2'],
            possibleCauses: ['Complex issue'],
            autoFixable: false
          }
        ],
        recommendations: [],
        queueHealth: 'warning' as const,
        autoFixApplied: false
      };

      // Mock diagnostics call
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiagnostic
        })
        // Mock auto-fix call (would be implemented in applyAutoFix)
        .mockResolvedValueOnce({ ok: true });

      mockDebugger.generatePlayerDebugReport.mockReturnValue({
        summary: { totalTasks: 1, completedTasks: 0, failedTasks: 0, averageTaskTime: 0 },
        recentErrors: [],
        performanceIssues: [],
        recommendations: []
      });

      const result = await supportTools.autoResolveQueueIssues(playerId);

      expect(result.resolved).toHaveLength(1);
      expect(result.resolved[0]).toBe('Task is stuck');
      expect(result.failed).toHaveLength(0);
      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0]).toBe('Manual intervention needed: Manual intervention needed');
    });
  });

  describe('resetPlayerQueue', () => {
    it('should reset player queue successfully', async () => {
      const playerId = 'player1';
      const preserveCurrentTask = true;

      (fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true }) // reset request
        .mockResolvedValueOnce({ ok: true }); // log action request

      await supportTools.resetPlayerQueue(playerId, preserveCurrentTask);

      expect(fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/admin/support/reset-queue/${playerId}`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mockAdminToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ preserveCurrentTask })
        })
      );
    });
  });

  describe('generateSupportReport', () => {
    it('should generate comprehensive support report', async () => {
      const playerId = 'player1';
      
      const mockPlayerInfo = { playerId, playerName: 'TestPlayer' };
      const mockQueueState = { isRunning: true, queuedTasks: [] };
      const mockDiagnostics = { queueHealth: 'healthy', issues: [], recommendations: [] };
      const mockRecentActivity = [{ action: 'task_completed', timestamp: Date.now() }];
      const mockSystemHealth = { status: 'healthy', load: 0.5 };

      // Mock all the API calls
      (fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => mockPlayerInfo })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ queue: mockQueueState }) })
        .mockResolvedValueOnce({ ok: true, json: async () => mockDiagnostics })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ activities: mockRecentActivity }) })
        .mockResolvedValueOnce({ ok: true, json: async () => mockSystemHealth });

      mockDebugger.generatePlayerDebugReport.mockReturnValue({
        summary: { totalTasks: 1, completedTasks: 1, failedTasks: 0, averageTaskTime: 1000 },
        recentErrors: [],
        performanceIssues: [],
        recommendations: []
      });

      const result = await supportTools.generateSupportReport(playerId);

      expect(result.playerInfo).toEqual(mockPlayerInfo);
      expect(result.queueState).toEqual(mockQueueState);
      expect(result.diagnostics).toEqual({
        ...mockDiagnostics,
        debugData: expect.any(Object)
      });
      expect(result.recentActivity).toEqual(mockRecentActivity);
      expect(result.systemHealth).toEqual(mockSystemHealth);
      expect(result.recommendations).toEqual(expect.any(Array));
    });
  });

  describe('bulkFixIssues', () => {
    it('should fix issues for multiple players', async () => {
      const playerIds = ['player1', 'player2', 'player3'];
      const issueType = SupportIssueType.SYNC_ISSUES;

      // Mock successful fix for first two players, failure for third
      (fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true }) // player1 sync fix
        .mockResolvedValueOnce({ ok: true }) // player1 log
        .mockResolvedValueOnce({ ok: true }) // player2 sync fix
        .mockResolvedValueOnce({ ok: true }) // player2 log
        .mockRejectedValueOnce(new Error('Player not found')); // player3 sync fix fails

      const result = await supportTools.bulkFixIssues(playerIds, issueType);

      expect(result.successful).toEqual(['player1', 'player2']);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].playerId).toBe('player3');
      expect(result.failed[0].error).toBe('Error: Player not found');
    });

    it('should handle unsupported bulk operations', async () => {
      const playerIds = ['player1'];
      const unsupportedIssueType = SupportIssueType.OTHER;

      await expect(supportTools.bulkFixIssues(playerIds, unsupportedIssueType)).rejects.toThrow(
        'Unsupported bulk operation for issue type: other'
      );
    });
  });
});