import { TaskQueueAdminService } from '../taskQueueAdminService';

// Mock fetch globally
global.fetch = jest.fn();

describe('TaskQueueAdminService', () => {
  let adminService: TaskQueueAdminService;
  const mockBaseUrl = 'https://api.example.com';
  const mockAdminToken = 'admin-token-123';

  beforeEach(() => {
    adminService = new TaskQueueAdminService(mockBaseUrl, mockAdminToken);
    jest.clearAllMocks();
  });

  describe('getAllPlayerQueues', () => {
    it('should fetch all player queues successfully', async () => {
      const mockResponse = {
        playerQueues: [
          {
            playerId: 'player1',
            playerName: 'TestPlayer1',
            queue: { isRunning: true, queuedTasks: [] },
            stats: { totalTasksCompleted: 10 },
            lastActivity: Date.now()
          }
        ]
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await adminService.getAllPlayerQueues();

      expect(fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/admin/queues`,
        expect.objectContaining({
          headers: {
            'Authorization': `Bearer ${mockAdminToken}`,
            'Content-Type': 'application/json'
          }
        })
      );
      expect(result).toEqual(mockResponse.playerQueues);
    });

    it('should handle fetch errors', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized'
      });

      await expect(adminService.getAllPlayerQueues()).rejects.toThrow(
        'Failed to fetch player queues: Unauthorized'
      );
    });
  });

  describe('pausePlayerQueue', () => {
    it('should pause a player queue successfully', async () => {
      const playerId = 'player1';
      const reason = 'Admin intervention';

      (fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true }) // pause request
        .mockResolvedValueOnce({ ok: true }); // log intervention request

      await adminService.pausePlayerQueue(playerId, reason);

      expect(fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/admin/queues/${playerId}/pause`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mockAdminToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ reason })
        })
      );
    });

    it('should handle pause errors', async () => {
      const playerId = 'player1';
      const reason = 'Admin intervention';

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found'
      });

      await expect(adminService.pausePlayerQueue(playerId, reason)).rejects.toThrow(
        'Failed to pause queue: Not Found'
      );
    });
  });

  describe('resumePlayerQueue', () => {
    it('should resume a player queue successfully', async () => {
      const playerId = 'player1';

      (fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true }) // resume request
        .mockResolvedValueOnce({ ok: true }); // log intervention request

      await adminService.resumePlayerQueue(playerId);

      expect(fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/admin/queues/${playerId}/resume`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mockAdminToken}`,
            'Content-Type': 'application/json'
          }
        })
      );
    });
  });

  describe('forceCompleteTask', () => {
    it('should force complete a task successfully', async () => {
      const playerId = 'player1';
      const taskId = 'task1';

      (fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true }) // force complete request
        .mockResolvedValueOnce({ ok: true }); // log intervention request

      await adminService.forceCompleteTask(playerId, taskId);

      expect(fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/admin/queues/${playerId}/tasks/${taskId}/complete`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mockAdminToken}`,
            'Content-Type': 'application/json'
          }
        })
      );
    });
  });

  describe('getSystemStats', () => {
    it('should fetch system statistics successfully', async () => {
      const mockStats = {
        totalActivePlayers: 100,
        totalQueuedTasks: 500,
        averageQueueLength: 5.2,
        totalTasksCompletedToday: 1000,
        systemLoad: 0.65
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats
      });

      const result = await adminService.getSystemStats();

      expect(fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/admin/stats`,
        expect.objectContaining({
          headers: {
            'Authorization': `Bearer ${mockAdminToken}`,
            'Content-Type': 'application/json'
          }
        })
      );
      expect(result).toEqual(mockStats);
    });
  });

  describe('bulkPauseQueues', () => {
    it('should pause multiple queues successfully', async () => {
      const playerIds = ['player1', 'player2', 'player3'];
      const reason = 'System maintenance';

      (fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true }) // bulk pause request
        .mockResolvedValueOnce({ ok: true }); // log intervention request

      await adminService.bulkPauseQueues(playerIds, reason);

      expect(fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/admin/queues/bulk/pause`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mockAdminToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ playerIds, reason })
        })
      );
    });
  });

  describe('validateAdminAccess', () => {
    it('should return true for valid admin token', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      const result = await adminService.validateAdminAccess();

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/admin/validate`,
        expect.objectContaining({
          headers: {
            'Authorization': `Bearer ${mockAdminToken}`,
            'Content-Type': 'application/json'
          }
        })
      );
    });

    it('should return false for invalid admin token', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: false });

      const result = await adminService.validateAdminAccess();

      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await adminService.validateAdminAccess();

      expect(result).toBe(false);
    });
  });
});