import { TaskQueueDataExporter } from '../taskQueueDataExporter';

// Mock fetch globally
global.fetch = jest.fn();

describe('TaskQueueDataExporter', () => {
  let dataExporter: TaskQueueDataExporter;
  const mockBaseUrl = 'https://api.example.com';
  const mockAdminToken = 'admin-token-123';

  beforeEach(() => {
    dataExporter = new TaskQueueDataExporter(mockBaseUrl, mockAdminToken);
    jest.clearAllMocks();
  });

  describe('exportPlayerData', () => {
    it('should export player data successfully', async () => {
      const playerId = 'player1';
      const options = {
        format: 'json' as const,
        includeDebugData: true,
        dateRange: {
          start: Date.now() - 86400000, // 1 day ago
          end: Date.now()
        }
      };

      const mockPlayerData = {
        playerId,
        playerName: 'TestPlayer',
        queueData: { tasks: [] },
        debugData: { traces: [] }
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPlayerData
      });

      const result = await dataExporter.exportPlayerData(playerId, options);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/admin/export/player/${playerId}`),
        expect.objectContaining({
          headers: {
            'Authorization': `Bearer ${mockAdminToken}`,
            'Content-Type': 'application/json'
          }
        })
      );

      expect(result.filename).toMatch(/^player_player1_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/);
      expect(result.mimeType).toBe('application/json');
      expect(result.data).toContain(playerId);
      expect(result.size).toBeGreaterThan(0);
    });

    it('should handle export errors', async () => {
      const playerId = 'player1';
      const options = { format: 'json' as const };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found'
      });

      await expect(dataExporter.exportPlayerData(playerId, options)).rejects.toThrow(
        'Failed to fetch player data: Not Found'
      );
    });
  });

  describe('exportAnalyticsData', () => {
    it('should export analytics data successfully', async () => {
      const options = {
        format: 'json' as const,
        dateRange: {
          start: Date.now() - 86400000,
          end: Date.now()
        }
      };

      const mockAnalyticsData = {
        playerQueues: [],
        systemMetrics: { totalPlayers: 100 },
        taskPerformance: [],
        errorAnalysis: { totalErrors: 5 },
        usagePatterns: { peakHours: [] }
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnalyticsData
      });

      const result = await dataExporter.exportAnalyticsData(options);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/admin/export/analytics'),
        expect.any(Object)
      );

      expect(result.filename).toMatch(/^system_analytics_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/);
      expect(result.data).toContain('totalPlayers');
    });
  });

  describe('exportDebugTraces', () => {
    it('should export debug traces for specific player', async () => {
      const playerId = 'player1';
      const options = { format: 'json' as const };

      const mockTraces = [
        {
          taskId: 'task1',
          playerId,
          timestamp: Date.now(),
          event: 'task_started',
          data: {}
        }
      ];

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ traces: mockTraces })
      });

      const result = await dataExporter.exportDebugTraces(playerId, options);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/admin/export/traces?playerId=${playerId}`),
        expect.any(Object)
      );

      expect(result.filename).toMatch(/^debug_traces_player1_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/);
      expect(result.data).toContain('task_started');
    });

    it('should export all debug traces when no player specified', async () => {
      const options = { format: 'json' as const };

      const mockTraces = [
        {
          taskId: 'task1',
          playerId: 'player1',
          timestamp: Date.now(),
          event: 'task_started',
          data: {}
        }
      ];

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ traces: mockTraces })
      });

      const result = await dataExporter.exportDebugTraces(undefined, options);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/admin/export/traces?'),
        expect.any(Object)
      );

      expect(result.filename).toMatch(/^debug_traces_all_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/);
    });
  });

  describe('exportTimeRangeData', () => {
    it('should export data for specific time range and data types', async () => {
      const startTime = Date.now() - 86400000;
      const endTime = Date.now();
      const dataTypes = ['queues', 'errors'] as const;
      const options = { format: 'json' as const };

      const mockQueueData = { queues: [] };
      const mockErrorData = { errors: [] };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockQueueData
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockErrorData
        });

      const result = await dataExporter.exportTimeRangeData(startTime, endTime, dataTypes, options);

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(result.data).toContain('queueData');
      expect(result.data).toContain('errorData');
      expect(result.filename).toMatch(/^timerange_\d{4}-\d{2}-\d{2}_to_\d{4}-\d{2}-\d{2}_/);
    });
  });

  describe('exportBulkPlayerData', () => {
    it('should export data for multiple players', async () => {
      const playerIds = ['player1', 'player2', 'player3'];
      const options = { format: 'json' as const };

      const mockPlayerData1 = { playerId: 'player1', data: 'test1' };
      const mockPlayerData2 = { playerId: 'player2', data: 'test2' };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPlayerData1
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPlayerData2
        })
        .mockRejectedValueOnce(new Error('Player not found'));

      const result = await dataExporter.exportBulkPlayerData(playerIds, options);

      expect(fetch).toHaveBeenCalledTimes(3);
      
      const exportedData = JSON.parse(result.data as string);
      expect(exportedData.playerCount).toBe(3);
      expect(exportedData.players).toHaveLength(3);
      expect(exportedData.players[0]).toEqual(mockPlayerData1);
      expect(exportedData.players[1]).toEqual(mockPlayerData2);
      expect(exportedData.players[2]).toEqual({
        playerId: 'player3',
        error: 'Player not found'
      });
    });
  });

  describe('format conversion', () => {
    it('should format data as CSV', async () => {
      const mockData = [
        { id: 1, name: 'Test 1', value: 100 },
        { id: 2, name: 'Test 2', value: 200 }
      ];

      const options = { format: 'csv' as const };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      const result = await dataExporter.exportAnalyticsData(options);

      expect(result.filename).toMatch(/\.csv$/);
      expect(result.mimeType).toBe('text/csv');
      expect(result.data).toContain('id,name,value');
      expect(result.data).toContain('"1","Test 1","100"');
      expect(result.data).toContain('"2","Test 2","200"');
    });

    it('should format data as XML', async () => {
      const mockData = { test: 'value', number: 123 };
      const options = { format: 'xml' as const };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      const result = await dataExporter.exportAnalyticsData(options);

      expect(result.filename).toMatch(/\.xml$/);
      expect(result.mimeType).toBe('application/xml');
      expect(result.data).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result.data).toContain('<root>');
      expect(result.data).toContain('<test>value</test>');
      expect(result.data).toContain('<number>123</number>');
      expect(result.data).toContain('</root>');
    });

    it('should handle XLSX format (fallback to CSV)', async () => {
      const mockData = [{ test: 'value' }];
      const options = { format: 'xlsx' as const };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      const result = await dataExporter.exportAnalyticsData(options);

      expect(result.filename).toMatch(/\.xlsx$/);
      expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      // Should contain CSV data as fallback
      expect(result.data).toContain('test');
      expect(result.data).toContain('value');
    });

    it('should throw error for unsupported format', async () => {
      const mockData = { test: 'value' };
      const options = { format: 'unsupported' as any };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      await expect(dataExporter.exportAnalyticsData(options)).rejects.toThrow(
        'Unsupported export format: unsupported'
      );
    });
  });

  describe('CSV conversion edge cases', () => {
    it('should handle empty arrays', async () => {
      const mockData: any[] = [];
      const options = { format: 'csv' as const };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      const result = await dataExporter.exportAnalyticsData(options);

      expect(result.data).toBe('');
    });

    it('should handle objects (non-array data)', async () => {
      const mockData = { key1: 'value1', key2: 'value2' };
      const options = { format: 'csv' as const };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      const result = await dataExporter.exportAnalyticsData(options);

      expect(result.data).toContain('Key,Value');
      expect(result.data).toContain('"key1","value1"');
      expect(result.data).toContain('"key2","value2"');
    });

    it('should escape quotes in CSV data', async () => {
      const mockData = [{ name: 'Test "quoted" value', description: 'Has "quotes"' }];
      const options = { format: 'csv' as const };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      const result = await dataExporter.exportAnalyticsData(options);

      expect(result.data).toContain('"Test ""quoted"" value"');
      expect(result.data).toContain('"Has ""quotes"""');
    });
  });
});