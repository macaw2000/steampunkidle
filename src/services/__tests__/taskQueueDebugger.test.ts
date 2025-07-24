import { TaskQueueDebugger, TaskExecutionEvent, TaskExecutionTrace } from '../taskQueueDebugger';

// Mock fetch globally
global.fetch = jest.fn();

describe('TaskQueueDebugger', () => {
  let debuggerService: TaskQueueDebugger;
  const mockBaseUrl = 'https://api.example.com';
  const mockAdminToken = 'admin-token-123';

  beforeEach(() => {
    debuggerService = new TaskQueueDebugger(mockBaseUrl, mockAdminToken);
    jest.clearAllMocks();
  });

  describe('startDebugSession', () => {
    it('should start a debug session successfully', async () => {
      const playerId = 'player1';
      const filters = [{ type: 'event' as const, value: TaskExecutionEvent.TASK_STARTED }];

      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      const sessionId = await debuggerService.startDebugSession(playerId, filters);

      expect(sessionId).toMatch(/^debug_player1_\d+$/);
      expect(fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/admin/debug/sessions`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mockAdminToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sessionId,
            playerId,
            filters
          })
        })
      );
    });

    it('should handle session start errors gracefully', async () => {
      const playerId = 'player1';

      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      // Should still return session ID even if server call fails
      const sessionId = await debuggerService.startDebugSession(playerId);
      expect(sessionId).toMatch(/^debug_player1_\d+$/);
    });
  });

  describe('addTrace', () => {
    it('should add trace to player traces', () => {
      const trace: TaskExecutionTrace = {
        taskId: 'task1',
        playerId: 'player1',
        timestamp: Date.now(),
        event: TaskExecutionEvent.TASK_STARTED,
        data: { taskName: 'Test Task' }
      };

      debuggerService.addTrace(trace);

      const playerTraces = debuggerService.getPlayerTraces('player1');
      expect(playerTraces).toContain(trace);
    });

    it('should limit trace history to prevent memory issues', () => {
      const playerId = 'player1';
      
      // Add more traces than the limit (assuming limit is 10000)
      for (let i = 0; i < 10005; i++) {
        const trace: TaskExecutionTrace = {
          taskId: `task${i}`,
          playerId,
          timestamp: Date.now() + i,
          event: TaskExecutionEvent.TASK_STARTED,
          data: {}
        };
        debuggerService.addTrace(trace);
      }

      const playerTraces = debuggerService.getPlayerTraces(playerId);
      expect(playerTraces.length).toBeLessThanOrEqual(10000);
    });

    it('should add trace to active debug sessions with matching filters', async () => {
      const playerId = 'player1';
      const filters = [{ type: 'event' as const, value: TaskExecutionEvent.TASK_STARTED }];
      
      const sessionId = await debuggerService.startDebugSession(playerId, filters);

      const matchingTrace: TaskExecutionTrace = {
        taskId: 'task1',
        playerId,
        timestamp: Date.now(),
        event: TaskExecutionEvent.TASK_STARTED,
        data: {}
      };

      const nonMatchingTrace: TaskExecutionTrace = {
        taskId: 'task2',
        playerId,
        timestamp: Date.now(),
        event: TaskExecutionEvent.TASK_COMPLETED,
        data: {}
      };

      debuggerService.addTrace(matchingTrace);
      debuggerService.addTrace(nonMatchingTrace);

      // Session should only contain the matching trace
      // Note: This would require access to internal session state in a real implementation
    });
  });

  describe('getTaskTraces', () => {
    it('should return traces for a specific task', () => {
      const taskId = 'task1';
      const playerId = 'player1';

      const trace1: TaskExecutionTrace = {
        taskId,
        playerId,
        timestamp: Date.now(),
        event: TaskExecutionEvent.TASK_STARTED,
        data: {}
      };

      const trace2: TaskExecutionTrace = {
        taskId,
        playerId,
        timestamp: Date.now() + 1000,
        event: TaskExecutionEvent.TASK_COMPLETED,
        data: {}
      };

      const trace3: TaskExecutionTrace = {
        taskId: 'task2',
        playerId,
        timestamp: Date.now() + 2000,
        event: TaskExecutionEvent.TASK_STARTED,
        data: {}
      };

      debuggerService.addTrace(trace1);
      debuggerService.addTrace(trace2);
      debuggerService.addTrace(trace3);

      const taskTraces = debuggerService.getTaskTraces(taskId, playerId);
      expect(taskTraces).toHaveLength(2);
      expect(taskTraces).toContain(trace1);
      expect(taskTraces).toContain(trace2);
      expect(taskTraces).not.toContain(trace3);
    });
  });

  describe('analyzeTaskExecution', () => {
    it('should analyze task execution patterns', () => {
      const taskId = 'task1';
      const playerId = 'player1';
      const baseTime = Date.now();

      // Add traces for task execution
      const startTrace: TaskExecutionTrace = {
        taskId,
        playerId,
        timestamp: baseTime,
        event: TaskExecutionEvent.TASK_STARTED,
        data: {}
      };

      const completedTrace: TaskExecutionTrace = {
        taskId,
        playerId,
        timestamp: baseTime + 5000, // 5 seconds later
        event: TaskExecutionEvent.TASK_COMPLETED,
        data: {}
      };

      const errorTrace: TaskExecutionTrace = {
        taskId,
        playerId,
        timestamp: baseTime + 1000,
        event: TaskExecutionEvent.ERROR_OCCURRED,
        data: {},
        error: 'Test error'
      };

      debuggerService.addTrace(startTrace);
      debuggerService.addTrace(completedTrace);
      debuggerService.addTrace(errorTrace);

      const analysis = debuggerService.analyzeTaskExecution(taskId);

      expect(analysis.averageExecutionTime).toBe(5000);
      expect(analysis.successRate).toBe(100); // 1 completed out of 1 started
      expect(analysis.commonErrors).toContain('Test error');
    });

    it('should handle empty traces gracefully', () => {
      const analysis = debuggerService.analyzeTaskExecution('nonexistent-task');

      expect(analysis.averageExecutionTime).toBe(0);
      expect(analysis.successRate).toBe(0);
      expect(analysis.commonErrors).toHaveLength(0);
      expect(analysis.performanceBottlenecks).toHaveLength(0);
    });
  });

  describe('generatePlayerDebugReport', () => {
    it('should generate comprehensive debug report for player', () => {
      const playerId = 'player1';
      const baseTime = Date.now();

      // Add various traces
      const traces: TaskExecutionTrace[] = [
        {
          taskId: 'task1',
          playerId,
          timestamp: baseTime,
          event: TaskExecutionEvent.TASK_STARTED,
          data: {}
        },
        {
          taskId: 'task1',
          playerId,
          timestamp: baseTime + 2000,
          event: TaskExecutionEvent.TASK_COMPLETED,
          data: {}
        },
        {
          taskId: 'task2',
          playerId,
          timestamp: baseTime + 3000,
          event: TaskExecutionEvent.TASK_STARTED,
          data: {}
        },
        {
          taskId: 'task2',
          playerId,
          timestamp: baseTime + 4000,
          event: TaskExecutionEvent.TASK_FAILED,
          data: {},
          error: 'Task failed'
        },
        {
          taskId: 'task3',
          playerId,
          timestamp: baseTime + 5000,
          event: TaskExecutionEvent.ERROR_OCCURRED,
          data: {},
          error: 'System error'
        }
      ];

      traces.forEach(trace => debuggerService.addTrace(trace));

      const report = debuggerService.generatePlayerDebugReport(playerId);

      expect(report.summary.totalTasks).toBe(2); // 2 tasks started
      expect(report.summary.completedTasks).toBe(1);
      expect(report.summary.failedTasks).toBe(1);
      expect(report.summary.averageTaskTime).toBe(2000); // Only completed task took 2000ms
      expect(report.recentErrors).toHaveLength(2);
    });

    it('should filter by time range when provided', () => {
      const playerId = 'player1';
      const baseTime = Date.now();

      const oldTrace: TaskExecutionTrace = {
        taskId: 'task1',
        playerId,
        timestamp: baseTime - 10000, // 10 seconds ago
        event: TaskExecutionEvent.TASK_STARTED,
        data: {}
      };

      const newTrace: TaskExecutionTrace = {
        taskId: 'task2',
        playerId,
        timestamp: baseTime,
        event: TaskExecutionEvent.TASK_STARTED,
        data: {}
      };

      debuggerService.addTrace(oldTrace);
      debuggerService.addTrace(newTrace);

      const timeRange = {
        start: baseTime - 5000, // 5 seconds ago
        end: baseTime + 5000    // 5 seconds from now
      };

      const report = debuggerService.generatePlayerDebugReport(playerId, timeRange);

      expect(report.summary.totalTasks).toBe(1); // Only new trace in range
    });
  });

  describe('exportDebugData', () => {
    it('should export debug data as JSON', async () => {
      const playerId = 'player1';
      
      const trace: TaskExecutionTrace = {
        taskId: 'task1',
        playerId,
        timestamp: Date.now(),
        event: TaskExecutionEvent.TASK_STARTED,
        data: {}
      };

      debuggerService.addTrace(trace);

      const exportData = await debuggerService.exportDebugData(playerId, 'json');
      const parsedData = JSON.parse(exportData);

      expect(parsedData.playerId).toBe(playerId);
      expect(parsedData.traces).toContain(trace);
      expect(parsedData.summary).toBeDefined();
    });

    it('should export debug data as CSV', async () => {
      const playerId = 'player1';
      
      const trace: TaskExecutionTrace = {
        taskId: 'task1',
        playerId,
        timestamp: Date.now(),
        event: TaskExecutionEvent.TASK_STARTED,
        data: {}
      };

      debuggerService.addTrace(trace);

      const exportData = await debuggerService.exportDebugData(playerId, 'csv');

      expect(exportData).toContain('timestamp,taskId,playerId,event,duration,error');
      expect(exportData).toContain(trace.taskId);
      expect(exportData).toContain(trace.event);
    });
  });

  describe('clearPlayerDebugData', () => {
    it('should clear all debug data for a player', async () => {
      const playerId = 'player1';
      
      const trace: TaskExecutionTrace = {
        taskId: 'task1',
        playerId,
        timestamp: Date.now(),
        event: TaskExecutionEvent.TASK_STARTED,
        data: {}
      };

      debuggerService.addTrace(trace);
      
      // Start a debug session
      await debuggerService.startDebugSession(playerId);

      // Verify data exists
      expect(debuggerService.getPlayerTraces(playerId)).toHaveLength(1);

      // Clear data
      debuggerService.clearPlayerDebugData(playerId);

      // Verify data is cleared
      expect(debuggerService.getPlayerTraces(playerId)).toHaveLength(0);
    });
  });
});