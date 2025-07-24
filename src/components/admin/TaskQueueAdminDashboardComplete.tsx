import React, { useState, useEffect } from 'react';
import { TaskQueueAdminInterface } from './TaskQueueAdminInterface';
import { TaskQueueDebuggerComponent } from './TaskQueueDebugger';
import { TaskQueueSupportToolsComponent } from './TaskQueueSupportTools';
import { TaskQueueDataExporterComponent } from './TaskQueueDataExporter';
import { TaskQueueAdminService } from '../../services/taskQueueAdminService';
import { TaskQueueDebugger } from '../../services/taskQueueDebugger';
import { TaskQueueSupportTools } from '../../services/taskQueueSupportTools';
import { TaskQueueDataExporter } from '../../services/taskQueueDataExporter';
import './TaskQueueAdminDashboardComplete.css';

interface TaskQueueAdminDashboardCompleteProps {
  baseUrl: string;
  adminToken: string;
}

export const TaskQueueAdminDashboardComplete: React.FC<TaskQueueAdminDashboardCompleteProps> = ({
  baseUrl,
  adminToken
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'admin' | 'debug' | 'support' | 'export'>('overview');
  const [systemStats, setSystemStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize services
  const adminService = new TaskQueueAdminService(baseUrl, adminToken);
  const debuggerService = new TaskQueueDebugger(baseUrl, adminToken);
  const supportTools = new TaskQueueSupportTools(baseUrl, adminToken, debuggerService);
  const dataExporter = new TaskQueueDataExporter(baseUrl, adminToken);

  useEffect(() => {
    loadSystemStats();
    const interval = setInterval(loadSystemStats, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const loadSystemStats = async () => {
    try {
      setLoading(true);
      const stats = await adminService.getSystemStats();
      setSystemStats(stats);
      setError(null);
    } catch (err) {
      setError(`Failed to load system stats: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const getTabIcon = (tab: string) => {
    switch (tab) {
      case 'overview': return '📊';
      case 'admin': return '⚙️';
      case 'debug': return '🔍';
      case 'support': return '🛠️';
      case 'export': return '📤';
      default: return '';
    }
  };

  const getSystemHealthColor = (load: number) => {
    if (load < 0.5) return '#28a745';
    if (load < 0.8) return '#ffc107';
    return '#dc3545';
  };

  return (
    <div className="task-queue-admin-dashboard-complete">
      <div className="dashboard-header">
        <div className="header-content">
          <h1>Task Queue Administration</h1>
          <div className="system-status">
            {systemStats && (
              <>
                <div className="status-item">
                  <span className="label">Active Players:</span>
                  <span className="value">{systemStats.totalActivePlayers}</span>
                </div>
                <div className="status-item">
                  <span className="label">Queued Tasks:</span>
                  <span className="value">{systemStats.totalQueuedTasks}</span>
                </div>
                <div className="status-item">
                  <span className="label">System Load:</span>
                  <span 
                    className="value system-load"
                    style={{ color: getSystemHealthColor(systemStats.systemLoad) }}
                  >
                    {Math.round(systemStats.systemLoad * 100)}%
                  </span>
                </div>
              </>
            )}
            <button onClick={loadSystemStats} disabled={loading} className="refresh-btn">
              {loading ? '⟳' : '🔄'}
            </button>
          </div>
        </div>
        
        <nav className="tab-navigation">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'admin', label: 'Queue Admin' },
            { key: 'debug', label: 'Debugger' },
            { key: 'support', label: 'Support Tools' },
            { key: 'export', label: 'Data Export' }
          ].map(tab => (
            <button
              key={tab.key}
              className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key as any)}
            >
              <span className="tab-icon">{getTabIcon(tab.key)}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="dashboard-content">
        {activeTab === 'overview' && (
          <div className="overview-section">
            <div className="overview-header">
              <h2>System Overview</h2>
              <div className="overview-actions">
                <button onClick={loadSystemStats} disabled={loading}>
                  Refresh Stats
                </button>
              </div>
            </div>

            {systemStats ? (
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-header">
                    <h3>Player Statistics</h3>
                    <span className="stat-icon">👥</span>
                  </div>
                  <div className="stat-content">
                    <div className="stat-row">
                      <span>Total Active Players:</span>
                      <span className="stat-value">{systemStats.totalActivePlayers}</span>
                    </div>
                    <div className="stat-row">
                      <span>Average Queue Length:</span>
                      <span className="stat-value">{systemStats.averageQueueLength.toFixed(1)}</span>
                    </div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <h3>Task Statistics</h3>
                    <span className="stat-icon">📋</span>
                  </div>
                  <div className="stat-content">
                    <div className="stat-row">
                      <span>Total Queued Tasks:</span>
                      <span className="stat-value">{systemStats.totalQueuedTasks}</span>
                    </div>
                    <div className="stat-row">
                      <span>Tasks Completed Today:</span>
                      <span className="stat-value">{systemStats.totalTasksCompletedToday}</span>
                    </div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <h3>System Health</h3>
                    <span className="stat-icon">💚</span>
                  </div>
                  <div className="stat-content">
                    <div className="stat-row">
                      <span>System Load:</span>
                      <span 
                        className="stat-value"
                        style={{ color: getSystemHealthColor(systemStats.systemLoad) }}
                      >
                        {Math.round(systemStats.systemLoad * 100)}%
                      </span>
                    </div>
                    <div className="stat-row">
                      <span>Status:</span>
                      <span className={`stat-value status ${systemStats.systemLoad < 0.8 ? 'healthy' : 'warning'}`}>
                        {systemStats.systemLoad < 0.8 ? 'Healthy' : 'High Load'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="stat-card full-width">
                  <div className="stat-header">
                    <h3>Quick Actions</h3>
                    <span className="stat-icon">⚡</span>
                  </div>
                  <div className="quick-actions">
                    <button 
                      onClick={() => setActiveTab('admin')}
                      className="quick-action-btn admin"
                    >
                      <span>⚙️</span>
                      Manage Queues
                    </button>
                    <button 
                      onClick={() => setActiveTab('debug')}
                      className="quick-action-btn debug"
                    >
                      <span>🔍</span>
                      Debug Issues
                    </button>
                    <button 
                      onClick={() => setActiveTab('support')}
                      className="quick-action-btn support"
                    >
                      <span>🛠️</span>
                      Support Tools
                    </button>
                    <button 
                      onClick={() => setActiveTab('export')}
                      className="quick-action-btn export"
                    >
                      <span>📤</span>
                      Export Data
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>Loading system statistics...</p>
              </div>
            )}

            <div className="recent-activity">
              <h3>Recent System Activity</h3>
              <div className="activity-placeholder">
                <p>Activity monitoring will be displayed here</p>
                <p>This would show recent queue operations, errors, and system events</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <TaskQueueAdminInterface adminService={adminService} />
        )}

        {activeTab === 'debug' && (
          <TaskQueueDebuggerComponent debugger={debuggerService} />
        )}

        {activeTab === 'support' && (
          <TaskQueueSupportToolsComponent supportTools={supportTools} />
        )}

        {activeTab === 'export' && (
          <TaskQueueDataExporterComponent dataExporter={dataExporter} />
        )}
      </div>
    </div>
  );
};