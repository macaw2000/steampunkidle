import { Task, TaskQueue } from '../types/taskQueue';

export interface TaskExecutionTrace {
  taskId: string;
  playerId: string;
  timestamp: number;
  event: TaskExecutionEvent;
  data: any;
  duration?: number;
  error?: string;
  stackTrace?: string;
}

export enum TaskExecutionEvent {
  TASK_QUEUED = 'task_queued',
  TASK_STARTED = 'task_started',
  TASK_PROGRESS = 'task_progress',
  TASK_PAUSED = 'task_paused',
  TASK_RESUMED = 'task_resumed',
  TASK_COMPLETED = 'task_completed',
  TASK_FAILED = 'task_failed',
  TASK_CANCELLED = 'task_cancelled',
  VALIDATION_FAILED = 'validation_failed',
  REWARD_CALCULATED = 'reward_calculated',
  STATE_PERSISTED = 'state_persisted',
  SYNC_STARTED = 'sync_started',
  SYNC_COMPLETED = 'sync_completed',
  ERROR_OCCURRED = 'error_occurred'
}

export interface DebugSession {
  sessionId: string;
  playerId: string;
  startTime: number;
  endTime?: number;
  traces: TaskExecutionTrace[];
  filters: TraceFilter[];
}

export interface TraceFilter {
  type: 'event' | 'taskId' | 'timeRange' | 'error';
  value: any;
}

export interface PerformanceMetrics {
  taskId: string;
  executionTime: number;
  memoryUsage: number;
  cpuUsage: number;
  databaseQueries: number;
  networkRequests: number;
}

export class TaskQueueDebugger {
  private traces: Map<string, TaskExecutionTrace[]> = new Map();
  private activeSessions: Map<string, DebugSession> = new Map();
  private performanceMetrics: Map<string, PerformanceMetrics[]> = new Map();
  private maxTraces: number = 10000;
  private baseUrl: string;
  private adminToken: string;

  constructor(baseUrl: string, adminToken: string) {
    this.baseUrl = baseUrl;
    this.adminToken = adminToken;
  }

  /**
   * Start a debugging session for a specific player
   */
  async startDebugSession(playerId: string, filters: TraceFilter[] = []): Promise<string> {
    const sessionId = `debug_${playerId}_${Date.now()}`;
    const session: DebugSession = {
      sessionId,
      playerId,
      startTime: Date.now(),
      traces: [],
      filters
    };

    this.activeSessions.set(sessionId, session);

    try {
      await fetch(`${this.baseUrl}/admin/debug/sessions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId,
          playerId,
          filters
        })
      });
    } catch (error) {
      console.error('Error starting debug session:', error);
    }

    return sessionId;
  }

  /**
   * Stop a debugging session
   */
  async stopDebugSession(sessionId: string): Promise<DebugSession | null> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return null;
    }

    session.endTime = Date.now();
    this.activeSessions.delete(sessionId);

    try {
      await fetch(`${this.baseUrl}/admin/debug/sessions/${sessionId}/stop`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Error stopping debug session:', error);
    }

    return session;
  }

  /**
   * Add a trace entry
   */
  addTrace(trace: TaskExecutionTrace): void {
    const playerId = trace.playerId;
    
    if (!this.traces.has(playerId)) {
      this.traces.set(playerId, []);
    }

    const playerTraces = this.traces.get(playerId)!;
    playerTraces.push(trace);

    // Limit trace history to prevent memory issues
    if (playerTraces.length > this.maxTraces) {
      playerTraces.splice(0, playerTraces.length - this.maxTraces);
    }

    // Add to active debug sessions
    for (const session of this.activeSessions.values()) {
      if (session.playerId === playerId && this.matchesFilters(trace, session.filters)) {
        session.traces.push(trace);
      }
    }

    // Send to server for persistence
    this.sendTraceToServer(trace).catch(error => {
      console.error('Error sending trace to server:', error);
    });
  }

  /**
   * Get traces for a specific player
   */
  getPlayerTraces(playerId: string, filters: TraceFilter[] = []): TaskExecutionTrace[] {
    const traces = this.traces.get(playerId) || [];
    return this.applyFilters(traces, filters);
  }

  /**
   * Get traces for a specific task
   */
  getTaskTraces(taskId: string, playerId?: string): TaskExecutionTrace[] {
    let allTraces: TaskExecutionTrace[] = [];

    if (playerId) {
      allTraces = this.traces.get(playerId) || [];
    } else {
      for (const playerTraces of this.traces.values()) {
        allTraces.push(...playerTraces);
      }
    }

    return allTraces.filter(trace => trace.taskId === taskId);
  }

  /**
   * Get recent traces across all players
   */
  getRecentTraces(limit: number = 100, filters: TraceFilter[] = []): TaskExecutionTrace[] {
    let allTraces: TaskExecutionTrace[] = [];

    for (const playerTraces of this.traces.values()) {
      allTraces.push(...playerTraces);
    }

    allTraces.sort((a, b) => b.timestamp - a.timestamp);
    const filtered = this.applyFilters(allTraces, filters);
    
    return filtered.slice(0, limit);
  }

  /**
   * Get performance metrics for a task
   */
  async getTaskPerformanceMetrics(taskId: string): Promise<PerformanceMetrics[]> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/debug/performance/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch performance metrics: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
      return [];
    }
  }

  /**
   * Analyze task execution patterns
   */
  analyzeTaskExecution(taskId: string): {
    averageExecutionTime: number;
    successRate: number;
    commonErrors: string[];
    performanceBottlenecks: string[];
  } {
    const traces = this.getTaskTraces(taskId);
    
    const startEvents = traces.filter(t => t.event === TaskExecutionEvent.TASK_STARTED);
    const completedEvents = traces.filter(t => t.event === TaskExecutionEvent.TASK_COMPLETED);
    const failedEvents = traces.filter(t => t.event === TaskExecutionEvent.TASK_FAILED);
    const errorEvents = traces.filter(t => t.event === TaskExecutionEvent.ERROR_OCCURRED);

    const executionTimes = completedEvents
      .map(completed => {
        const started = startEvents.find(s => s.taskId === completed.taskId);
        return started ? completed.timestamp - started.timestamp : 0;
      })
      .filter(time => time > 0);

    const averageExecutionTime = executionTimes.length > 0 
      ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length 
      : 0;

    const totalAttempts = startEvents.length;
    const successfulAttempts = completedEvents.length;
    const successRate = totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 0;

    const commonErrors = this.extractCommonErrors(errorEvents.concat(failedEvents));
    const performanceBottlenecks = this.identifyBottlenecks(traces);

    return {
      averageExecutionTime,
      successRate,
      commonErrors,
      performanceBottlenecks
    };
  }

  /**
   * Generate debug report for a player
   */
  generatePlayerDebugReport(playerId: string, timeRange?: { start: number; end: number }): {
    summary: {
      totalTasks: number;
      completedTasks: number;
      failedTasks: number;
      averageTaskTime: number;
    };
    recentErrors: TaskExecutionTrace[];
    performanceIssues: string[];
    recommendations: string[];
  } {
    let traces = this.getPlayerTraces(playerId);

    if (timeRange) {
      traces = traces.filter(t => t.timestamp >= timeRange.start && t.timestamp <= timeRange.end);
    }

    const taskStarted = traces.filter(t => t.event === TaskExecutionEvent.TASK_STARTED);
    const taskCompleted = traces.filter(t => t.event === TaskExecutionEvent.TASK_COMPLETED);
    const taskFailed = traces.filter(t => t.event === TaskExecutionEvent.TASK_FAILED);
    const errors = traces.filter(t => t.event === TaskExecutionEvent.ERROR_OCCURRED);

    const executionTimes = taskCompleted
      .map(completed => {
        const started = taskStarted.find(s => s.taskId === completed.taskId);
        return started ? completed.timestamp - started.timestamp : 0;
      })
      .filter(time => time > 0);

    const averageTaskTime = executionTimes.length > 0 
      ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length 
      : 0;

    const recentErrors = errors
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);

    const performanceIssues = this.identifyPlayerPerformanceIssues(traces);
    const recommendations = this.generateRecommendations(traces, performanceIssues);

    return {
      summary: {
        totalTasks: taskStarted.length,
        completedTasks: taskCompleted.length,
        failedTasks: taskFailed.length,
        averageTaskTime
      },
      recentErrors,
      performanceIssues,
      recommendations
    };
  }

  /**
   * Export debug data for external analysis
   */
  async exportDebugData(playerId: string, format: 'json' | 'csv' = 'json'): Promise<string> {
    const traces = this.getPlayerTraces(playerId);
    
    if (format === 'csv') {
      return this.convertTracesToCSV(traces);
    }
    
    return JSON.stringify({
      playerId,
      exportTime: Date.now(),
      traces,
      summary: this.generatePlayerDebugReport(playerId)
    }, null, 2);
  }

  /**
   * Clear debug data for a player
   */
  clearPlayerDebugData(playerId: string): void {
    this.traces.delete(playerId);
    this.performanceMetrics.delete(playerId);
    
    // Remove from active sessions
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.playerId === playerId) {
        this.activeSessions.delete(sessionId);
      }
    }
  }

  // Private helper methods

  private matchesFilters(trace: TaskExecutionTrace, filters: TraceFilter[]): boolean {
    return filters.every(filter => {
      switch (filter.type) {
        case 'event':
          return trace.event === filter.value;
        case 'taskId':
          return trace.taskId === filter.value;
        case 'timeRange':
          return trace.timestamp >= filter.value.start && trace.timestamp <= filter.value.end;
        case 'error':
          return !!trace.error;
        default:
          return true;
      }
    });
  }

  private applyFilters(traces: TaskExecutionTrace[], filters: TraceFilter[]): TaskExecutionTrace[] {
    return traces.filter(trace => this.matchesFilters(trace, filters));
  }

  private async sendTraceToServer(trace: TaskExecutionTrace): Promise<void> {
    await fetch(`${this.baseUrl}/admin/debug/traces`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(trace)
    });
  }

  private extractCommonErrors(errorTraces: TaskExecutionTrace[]): string[] {
    const errorCounts = new Map<string, number>();
    
    errorTraces.forEach(trace => {
      if (trace.error) {
        const count = errorCounts.get(trace.error) || 0;
        errorCounts.set(trace.error, count + 1);
      }
    });

    return Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([error]) => error);
  }

  private identifyBottlenecks(traces: TaskExecutionTrace[]): string[] {
    const bottlenecks: string[] = [];
    
    // Check for slow database operations
    const dbTraces = traces.filter(t => t.event === TaskExecutionEvent.STATE_PERSISTED);
    const slowDbOps = dbTraces.filter(t => t.duration && t.duration > 1000);
    if (slowDbOps.length > 0) {
      bottlenecks.push('Slow database operations detected');
    }

    // Check for sync issues
    const syncTraces = traces.filter(t => t.event === TaskExecutionEvent.SYNC_STARTED);
    const slowSyncs = syncTraces.filter(t => t.duration && t.duration > 5000);
    if (slowSyncs.length > 0) {
      bottlenecks.push('Slow synchronization operations detected');
    }

    return bottlenecks;
  }

  private identifyPlayerPerformanceIssues(traces: TaskExecutionTrace[]): string[] {
    const issues: string[] = [];
    
    const errorRate = traces.filter(t => t.event === TaskExecutionEvent.ERROR_OCCURRED).length / traces.length;
    if (errorRate > 0.1) {
      issues.push('High error rate detected');
    }

    const failedTasks = traces.filter(t => t.event === TaskExecutionEvent.TASK_FAILED);
    if (failedTasks.length > 5) {
      issues.push('Multiple task failures detected');
    }

    return issues;
  }

  private generateRecommendations(traces: TaskExecutionTrace[], issues: string[]): string[] {
    const recommendations: string[] = [];
    
    if (issues.includes('High error rate detected')) {
      recommendations.push('Review task validation logic and error handling');
    }
    
    if (issues.includes('Multiple task failures detected')) {
      recommendations.push('Check resource availability and task prerequisites');
    }

    if (issues.includes('Slow database operations detected')) {
      recommendations.push('Consider optimizing database queries or adding caching');
    }

    return recommendations;
  }

  private convertTracesToCSV(traces: TaskExecutionTrace[]): string {
    const headers = ['timestamp', 'taskId', 'playerId', 'event', 'duration', 'error'];
    const rows = traces.map(trace => [
      new Date(trace.timestamp).toISOString(),
      trace.taskId,
      trace.playerId,
      trace.event,
      trace.duration || '',
      trace.error || ''
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }
}