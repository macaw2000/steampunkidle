import React, { useState, useEffect } from 'react';
import { TaskQueueDebugger, TaskExecutionTrace, TaskExecutionEvent, TraceFilter, DebugSession } from '../../services/taskQueueDebugger';
import './TaskQueueDebugger.css';

interface TaskQueueDebuggerProps {
  debugger: TaskQueueDebugger;
}

export const TaskQueueDebuggerComponent: React.FC<TaskQueueDebuggerProps> = ({
  debugger: debuggerService
}) => {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [traces, setTraces] = useState<TaskExecutionTrace[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [filters, setFilters] = useState<TraceFilter[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<TaskExecutionTrace | null>(null);
  const [debugReport, setDebugReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    if (autoRefresh && selectedPlayerId) {
      const interval = setInterval(() => {
        loadTraces();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, selectedPlayerId]);

  const loadTraces = () => {
    if (!selectedPlayerId) return;
    
    const playerTraces = debuggerService.getPlayerTraces(selectedPlayerId, filters);
    setTraces(playerTraces.slice(-100)); // Show last 100 traces
  };

  const startDebugSession = async () => {
    if (!selectedPlayerId) return;
    
    try {
      setLoading(true);
      const sessionId = await debuggerService.startDebugSession(selectedPlayerId, filters);
      setActiveSession(sessionId);
      setAutoRefresh(true);
    } catch (error) {
      console.error('Error starting debug session:', error);
    } finally {
      setLoading(false);
    }
  };

  const stopDebugSession = async () => {
    if (!activeSession) return;
    
    try {
      setLoading(true);
      await debuggerService.stopDebugSession(activeSession);
      setActiveSession(null);
      setAutoRefresh(false);
    } catch (error) {
      console.error('Error stopping debug session:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = () => {
    if (!selectedPlayerId) return;
    
    const report = debuggerService.generatePlayerDebugReport(selectedPlayerId);
    setDebugReport(report);
  };

  const exportData = async (format: 'json' | 'csv') => {
    if (!selectedPlayerId) return;
    
    try {
      const data = await debuggerService.exportDebugData(selectedPlayerId, format);
      const blob = new Blob([data], { 
        type: format === 'json' ? 'application/json' : 'text/csv' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `debug_${selectedPlayerId}_${Date.now()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  };

  const addFilter = (type: string, value: any) => {
    const newFilter: TraceFilter = { type: type as any, value };
    setFilters(prev => [...prev, newFilter]);
  };

  const removeFilter = (index: number) => {
    setFilters(prev => prev.filter((_, i) => i !== index));
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getEventColor = (event: TaskExecutionEvent) => {
    switch (event) {
      case TaskExecutionEvent.TASK_STARTED:
        return '#28a745';
      case TaskExecutionEvent.TASK_COMPLETED:
        return '#007bff';
      case TaskExecutionEvent.TASK_FAILED:
      case TaskExecutionEvent.ERROR_OCCURRED:
        return '#dc3545';
      case TaskExecutionEvent.TASK_PAUSED:
        return '#ffc107';
      default:
        return '#6c757d';
    }
  };

  return (
    <div className="task-queue-debugger">
      <div className="debugger-header">
        <h2>Task Queue Debugger</h2>
        <div className="debugger-controls">
          <input
            type="text"
            placeholder="Player ID"
            value={selectedPlayerId}
            onChange={(e) => setSelectedPlayerId(e.target.value)}
            className="player-input"
          />
          {!activeSession ? (
            <button 
              onClick={startDebugSession} 
              disabled={!selectedPlayerId || loading}
              className="start-debug-btn"
            >
              Start Debug Session
            </button>
          ) : (
            <button 
              onClick={stopDebugSession} 
              disabled={loading}
              className="stop-debug-btn"
            >
              Stop Debug Session
            </button>
          )}
          <button onClick={loadTraces} disabled={!selectedPlayerId}>
            Load Traces
          </button>
          <button onClick={generateReport} disabled={!selectedPlayerId}>
            Generate Report
          </button>
          <label className="auto-refresh">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto Refresh
          </label>
        </div>
      </div>

      <div className="debugger-content">
        <div className="filters-section">
          <h3>Filters</h3>
          <div className="filter-controls">
            <select onChange={(e) => {
              if (e.target.value) {
                addFilter('event', e.target.value);
                e.target.value = '';
              }
            }}>
              <option value="">Add Event Filter</option>
              {Object.values(TaskExecutionEvent).map(event => (
                <option key={event} value={event}>{event}</option>
              ))}
            </select>
            <button onClick={() => addFilter('error', true)}>
              Show Only Errors
            </button>
          </div>
          <div className="active-filters">
            {filters.map((filter, index) => (
              <div key={index} className="filter-tag">
                {filter.type}: {JSON.stringify(filter.value)}
                <button onClick={() => removeFilter(index)}>×</button>
              </div>
            ))}
          </div>
        </div>

        <div className="traces-section">
          <div className="traces-header">
            <h3>Execution Traces ({traces.length})</h3>
            <div className="export-controls">
              <button onClick={() => exportData('json')}>Export JSON</button>
              <button onClick={() => exportData('csv')}>Export CSV</button>
            </div>
          </div>
          
          <div className="traces-list">
            {traces.map((trace, index) => (
              <div
                key={index}
                className={`trace-item ${selectedTrace === trace ? 'selected' : ''}`}
                onClick={() => setSelectedTrace(trace)}
              >
                <div className="trace-header">
                  <span 
                    className="event-indicator"
                    style={{ backgroundColor: getEventColor(trace.event) }}
                  />
                  <span className="event-name">{trace.event}</span>
                  <span className="trace-timestamp">
                    {formatTimestamp(trace.timestamp)}
                  </span>
                </div>
                <div className="trace-details">
                  <span className="task-id">Task: {trace.taskId}</span>
                  {trace.duration && (
                    <span className="duration">{trace.duration}ms</span>
                  )}
                  {trace.error && (
                    <span className="error-indicator">ERROR</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="trace-details-section">
          {selectedTrace ? (
            <div className="selected-trace-details">
              <h3>Trace Details</h3>
              <div className="trace-info">
                <div className="info-row">
                  <label>Event:</label>
                  <span>{selectedTrace.event}</span>
                </div>
                <div className="info-row">
                  <label>Task ID:</label>
                  <span>{selectedTrace.taskId}</span>
                </div>
                <div className="info-row">
                  <label>Player ID:</label>
                  <span>{selectedTrace.playerId}</span>
                </div>
                <div className="info-row">
                  <label>Timestamp:</label>
                  <span>{formatTimestamp(selectedTrace.timestamp)}</span>
                </div>
                {selectedTrace.duration && (
                  <div className="info-row">
                    <label>Duration:</label>
                    <span>{selectedTrace.duration}ms</span>
                  </div>
                )}
                {selectedTrace.error && (
                  <div className="info-row error">
                    <label>Error:</label>
                    <span>{selectedTrace.error}</span>
                  </div>
                )}
              </div>
              
              {selectedTrace.data && (
                <div className="trace-data">
                  <h4>Data</h4>
                  <pre>{JSON.stringify(selectedTrace.data, null, 2)}</pre>
                </div>
              )}
              
              {selectedTrace.stackTrace && (
                <div className="stack-trace">
                  <h4>Stack Trace</h4>
                  <pre>{selectedTrace.stackTrace}</pre>
                </div>
              )}
            </div>
          ) : (
            <div className="no-trace-selected">
              <p>Select a trace to view details</p>
            </div>
          )}
        </div>
      </div>

      {debugReport && (
        <div className="debug-report">
          <h3>Debug Report</h3>
          <div className="report-summary">
            <h4>Summary</h4>
            <div className="summary-stats">
              <div className="stat">
                <label>Total Tasks:</label>
                <span>{debugReport.summary.totalTasks}</span>
              </div>
              <div className="stat">
                <label>Completed:</label>
                <span>{debugReport.summary.completedTasks}</span>
              </div>
              <div className="stat">
                <label>Failed:</label>
                <span>{debugReport.summary.failedTasks}</span>
              </div>
              <div className="stat">
                <label>Avg Time:</label>
                <span>{Math.round(debugReport.summary.averageTaskTime)}ms</span>
              </div>
            </div>
          </div>

          {debugReport.recentErrors.length > 0 && (
            <div className="recent-errors">
              <h4>Recent Errors</h4>
              <div className="error-list">
                {debugReport.recentErrors.map((error: TaskExecutionTrace, index: number) => (
                  <div key={index} className="error-item">
                    <span className="error-time">
                      {formatTimestamp(error.timestamp)}
                    </span>
                    <span className="error-message">{error.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {debugReport.performanceIssues.length > 0 && (
            <div className="performance-issues">
              <h4>Performance Issues</h4>
              <ul>
                {debugReport.performanceIssues.map((issue: string, index: number) => (
                  <li key={index}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {debugReport.recommendations.length > 0 && (
            <div className="recommendations">
              <h4>Recommendations</h4>
              <ul>
                {debugReport.recommendations.map((rec: string, index: number) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};