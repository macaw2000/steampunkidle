import React, { useState, useEffect } from 'react';
import { TaskQueueSupportTools, SupportTicket, SupportIssueType, QueueDiagnostic } from '../../services/taskQueueSupportTools';
import './TaskQueueSupportTools.css';

interface TaskQueueSupportToolsProps {
  supportTools: TaskQueueSupportTools;
}

export const TaskQueueSupportToolsComponent: React.FC<TaskQueueSupportToolsProps> = ({
  supportTools
}) => {
  const [activeTab, setActiveTab] = useState<'tickets' | 'diagnostics' | 'tools'>('tickets');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [diagnosticPlayerId, setDiagnosticPlayerId] = useState('');
  const [diagnosticResult, setDiagnosticResult] = useState<QueueDiagnostic | null>(null);
  const [supportReport, setSupportReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const ticketList = await supportTools.getSupportTickets();
      setTickets(ticketList);
      setError(null);
    } catch (err) {
      setError(`Failed to load tickets: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const runDiagnostics = async (autoFix: boolean = false) => {
    if (!diagnosticPlayerId) return;

    try {
      setLoading(true);
      const result = await supportTools.runQueueDiagnostics(diagnosticPlayerId, autoFix);
      setDiagnosticResult(result);
      setError(null);
    } catch (err) {
      setError(`Failed to run diagnostics: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const generateSupportReport = async () => {
    if (!diagnosticPlayerId) return;

    try {
      setLoading(true);
      const report = await supportTools.generateSupportReport(diagnosticPlayerId);
      setSupportReport(report);
      setError(null);
    } catch (err) {
      setError(`Failed to generate support report: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const autoResolveIssues = async () => {
    if (!diagnosticPlayerId) return;

    try {
      setLoading(true);
      const result = await supportTools.autoResolveQueueIssues(diagnosticPlayerId);
      
      // Show results
      const message = `
        Resolved: ${result.resolved.length} issues
        Failed: ${result.failed.length} issues
        Recommendations: ${result.recommendations.length}
      `;
      alert(message);
      
      // Refresh diagnostics
      await runDiagnostics();
    } catch (err) {
      setError(`Failed to auto-resolve issues: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const resetPlayerQueue = async (preserveCurrentTask: boolean) => {
    if (!diagnosticPlayerId) return;
    
    if (!window.confirm(`Reset queue for player ${diagnosticPlayerId}? This action cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      await supportTools.resetPlayerQueue(diagnosticPlayerId, preserveCurrentTask);
      alert('Player queue has been reset successfully');
      await runDiagnostics();
    } catch (err) {
      setError(`Failed to reset player queue: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const updateTicketStatus = async (ticketId: string, status: string) => {
    try {
      await supportTools.updateSupportTicket(ticketId, { status: status as any });
      await loadTickets();
    } catch (err) {
      setError(`Failed to update ticket: ${err}`);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return '#dc3545';
      case 'high': return '#fd7e14';
      case 'medium': return '#ffc107';
      case 'low': return '#28a745';
      default: return '#6c757d';
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return '#28a745';
      case 'warning': return '#ffc107';
      case 'critical': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#dc3545';
      case 'error': return '#fd7e14';
      case 'warning': return '#ffc107';
      case 'info': return '#17a2b8';
      default: return '#6c757d';
    }
  };

  return (
    <div className="task-queue-support-tools">
      <div className="support-header">
        <h2>Task Queue Support Tools</h2>
        <div className="tab-navigation">
          <button
            className={activeTab === 'tickets' ? 'active' : ''}
            onClick={() => setActiveTab('tickets')}
          >
            Support Tickets
          </button>
          <button
            className={activeTab === 'diagnostics' ? 'active' : ''}
            onClick={() => setActiveTab('diagnostics')}
          >
            Diagnostics
          </button>
          <button
            className={activeTab === 'tools' ? 'active' : ''}
            onClick={() => setActiveTab('tools')}
          >
            Support Tools
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {activeTab === 'tickets' && (
        <div className="tickets-section">
          <div className="tickets-header">
            <h3>Support Tickets</h3>
            <button onClick={loadTickets} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          <div className="tickets-content">
            <div className="tickets-list">
              {tickets.map(ticket => (
                <div
                  key={ticket.ticketId}
                  className={`ticket-item ${selectedTicket?.ticketId === ticket.ticketId ? 'selected' : ''}`}
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <div className="ticket-header">
                    <span className="ticket-id">#{ticket.ticketId.slice(-8)}</span>
                    <span 
                      className="priority-badge"
                      style={{ backgroundColor: getPriorityColor(ticket.priority) }}
                    >
                      {ticket.priority}
                    </span>
                    <span className={`status-badge ${ticket.status}`}>
                      {ticket.status}
                    </span>
                  </div>
                  <div className="ticket-info">
                    <strong>{ticket.playerName}</strong>
                    <span className="issue-type">{ticket.issueType}</span>
                  </div>
                  <div className="ticket-description">
                    {ticket.description.substring(0, 100)}...
                  </div>
                  <div className="ticket-meta">
                    <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                    {ticket.assignedTo && <span>Assigned to: {ticket.assignedTo}</span>}
                  </div>
                </div>
              ))}
            </div>

            <div className="ticket-details">
              {selectedTicket ? (
                <div className="selected-ticket">
                  <div className="ticket-detail-header">
                    <h4>Ticket #{selectedTicket.ticketId.slice(-8)}</h4>
                    <div className="ticket-actions">
                      <select
                        value={selectedTicket.status}
                        onChange={(e) => updateTicketStatus(selectedTicket.ticketId, e.target.value)}
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                  </div>

                  <div className="ticket-detail-content">
                    <div className="detail-row">
                      <label>Player:</label>
                      <span>{selectedTicket.playerName} ({selectedTicket.playerId})</span>
                    </div>
                    <div className="detail-row">
                      <label>Issue Type:</label>
                      <span>{selectedTicket.issueType}</span>
                    </div>
                    <div className="detail-row">
                      <label>Priority:</label>
                      <span 
                        className="priority-badge"
                        style={{ backgroundColor: getPriorityColor(selectedTicket.priority) }}
                      >
                        {selectedTicket.priority}
                      </span>
                    </div>
                    <div className="detail-row">
                      <label>Created:</label>
                      <span>{new Date(selectedTicket.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="detail-row">
                      <label>Updated:</label>
                      <span>{new Date(selectedTicket.updatedAt).toLocaleString()}</span>
                    </div>
                    
                    <div className="description-section">
                      <label>Description:</label>
                      <div className="description-content">
                        {selectedTicket.description}
                      </div>
                    </div>

                    {selectedTicket.resolution && (
                      <div className="resolution-section">
                        <label>Resolution:</label>
                        <div className="resolution-content">
                          {selectedTicket.resolution}
                        </div>
                      </div>
                    )}

                    <div className="quick-actions">
                      <button
                        onClick={() => {
                          setDiagnosticPlayerId(selectedTicket.playerId);
                          setActiveTab('diagnostics');
                        }}
                        className="action-btn"
                      >
                        Run Diagnostics
                      </button>
                      <button
                        onClick={() => {
                          setDiagnosticPlayerId(selectedTicket.playerId);
                          setActiveTab('tools');
                        }}
                        className="action-btn"
                      >
                        Open Support Tools
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="no-ticket-selected">
                  <p>Select a ticket to view details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'diagnostics' && (
        <div className="diagnostics-section">
          <div className="diagnostics-controls">
            <input
              type="text"
              placeholder="Player ID"
              value={diagnosticPlayerId}
              onChange={(e) => setDiagnosticPlayerId(e.target.value)}
              className="player-input"
            />
            <button onClick={() => runDiagnostics(false)} disabled={!diagnosticPlayerId || loading}>
              Run Diagnostics
            </button>
            <button onClick={() => runDiagnostics(true)} disabled={!diagnosticPlayerId || loading}>
              Run with Auto-Fix
            </button>
            <button onClick={generateSupportReport} disabled={!diagnosticPlayerId || loading}>
              Generate Report
            </button>
          </div>

          {diagnosticResult && (
            <div className="diagnostic-results">
              <div className="diagnostic-header">
                <h3>Diagnostic Results</h3>
                <div className="health-indicator">
                  <span>Queue Health: </span>
                  <span 
                    className="health-badge"
                    style={{ backgroundColor: getHealthColor(diagnosticResult.queueHealth) }}
                  >
                    {diagnosticResult.queueHealth}
                  </span>
                </div>
              </div>

              {diagnosticResult.issues.length > 0 && (
                <div className="issues-section">
                  <h4>Issues Found ({diagnosticResult.issues.length})</h4>
                  <div className="issues-list">
                    {diagnosticResult.issues.map((issue, index) => (
                      <div key={index} className="issue-item">
                        <div className="issue-header">
                          <span 
                            className="severity-badge"
                            style={{ backgroundColor: getSeverityColor(issue.severity) }}
                          >
                            {issue.severity}
                          </span>
                          <span className="issue-type">{issue.type}</span>
                          {issue.autoFixable && (
                            <span className="auto-fixable">Auto-fixable</span>
                          )}
                        </div>
                        <div className="issue-description">
                          {issue.description}
                        </div>
                        {issue.affectedTasks.length > 0 && (
                          <div className="affected-tasks">
                            <strong>Affected Tasks:</strong> {issue.affectedTasks.join(', ')}
                          </div>
                        )}
                        {issue.possibleCauses.length > 0 && (
                          <div className="possible-causes">
                            <strong>Possible Causes:</strong>
                            <ul>
                              {issue.possibleCauses.map((cause, i) => (
                                <li key={i}>{cause}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {diagnosticResult.recommendations.length > 0 && (
                <div className="recommendations-section">
                  <h4>Recommendations</h4>
                  <div className="recommendations-list">
                    {diagnosticResult.recommendations.map((rec, index) => (
                      <div key={index} className="recommendation-item">
                        <div className="recommendation-header">
                          <span className="action">{rec.action}</span>
                          <span className={`impact ${rec.impact}`}>{rec.impact} impact</span>
                          {rec.automated && <span className="automated">Automated</span>}
                        </div>
                        <div className="recommendation-description">
                          {rec.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {supportReport && (
            <div className="support-report">
              <h3>Support Report</h3>
              <div className="report-sections">
                <div className="report-section">
                  <h4>Player Information</h4>
                  <pre>{JSON.stringify(supportReport.playerInfo, null, 2)}</pre>
                </div>
                <div className="report-section">
                  <h4>Queue State</h4>
                  <div className="queue-summary">
                    <div>Current Task: {supportReport.queueState.currentTask?.name || 'None'}</div>
                    <div>Queued Tasks: {supportReport.queueState.queuedTasks.length}</div>
                    <div>Running: {supportReport.queueState.isRunning ? 'Yes' : 'No'}</div>
                  </div>
                </div>
                <div className="report-section">
                  <h4>System Health</h4>
                  <pre>{JSON.stringify(supportReport.systemHealth, null, 2)}</pre>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'tools' && (
        <div className="tools-section">
          <div className="tools-header">
            <input
              type="text"
              placeholder="Player ID"
              value={diagnosticPlayerId}
              onChange={(e) => setDiagnosticPlayerId(e.target.value)}
              className="player-input"
            />
          </div>

          <div className="tool-groups">
            <div className="tool-group">
              <h4>Queue Management</h4>
              <div className="tool-buttons">
                <button
                  onClick={autoResolveIssues}
                  disabled={!diagnosticPlayerId || loading}
                  className="tool-btn resolve"
                >
                  Auto-Resolve Issues
                </button>
                <button
                  onClick={() => resetPlayerQueue(true)}
                  disabled={!diagnosticPlayerId || loading}
                  className="tool-btn reset"
                >
                  Reset Queue (Keep Current)
                </button>
                <button
                  onClick={() => resetPlayerQueue(false)}
                  disabled={!diagnosticPlayerId || loading}
                  className="tool-btn reset-all"
                >
                  Reset Queue (Clear All)
                </button>
              </div>
            </div>

            <div className="tool-group">
              <h4>Synchronization</h4>
              <div className="tool-buttons">
                <button
                  onClick={async () => {
                    try {
                      setLoading(true);
                      await supportTools.fixSyncIssues(diagnosticPlayerId);
                      alert('Sync issues fixed successfully');
                    } catch (err) {
                      setError(`Failed to fix sync issues: ${err}`);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={!diagnosticPlayerId || loading}
                  className="tool-btn sync"
                >
                  Fix Sync Issues
                </button>
              </div>
            </div>

            <div className="tool-group">
              <h4>Data Management</h4>
              <div className="tool-buttons">
                <button
                  onClick={async () => {
                    try {
                      const backups = await supportTools.getQueueBackups(diagnosticPlayerId);
                      console.log('Available backups:', backups);
                      alert(`Found ${backups.length} backups. Check console for details.`);
                    } catch (err) {
                      setError(`Failed to get backups: ${err}`);
                    }
                  }}
                  disabled={!diagnosticPlayerId || loading}
                  className="tool-btn backup"
                >
                  View Backups
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};