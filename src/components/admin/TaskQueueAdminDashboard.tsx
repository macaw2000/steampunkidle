/**
 * Admin dashboard for task queue monitoring and management
 * Provides comprehensive view of system health, metrics, and alerts
 */

import React, { useState, useEffect, useCallback } from 'react';
import { taskQueueMetrics, QueueMetrics } from '../../services/taskQueueMetrics';
import { taskQueueAlerting, Alert, AlertSeverity } from '../../services/taskQueueAlerting';
import './TaskQueueAdminDashboard.css';

interface DashboardProps {
  refreshInterval?: number;
  autoRefresh?: boolean;
}

interface MetricCard {
  title: string;
  value: string | number;
  unit?: string;
  status: 'good' | 'warning' | 'critical';
  trend?: 'up' | 'down' | 'stable';
}

const TaskQueueAdminDashboard: React.FC<DashboardProps> = ({
  refreshInterval = 30000,
  autoRefresh = true
}) => {
  const [metrics, setMetrics] = useState<QueueMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'metrics' | 'alerts' | 'players'>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Fetch metrics
      const currentMetrics = taskQueueMetrics.exportMetrics();
      setMetrics(currentMetrics);
      
      // Fetch alerts
      const activeAlerts = taskQueueAlerting.getActiveAlerts();
      setAlerts(activeAlerts);
      
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to refresh dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
    
    if (autoRefresh) {
      const interval = setInterval(refreshData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshData, autoRefresh, refreshInterval]);

  const getMetricCards = (): MetricCard[] => {
    if (!metrics) return [];

    return [
      {
        title: 'Average Processing Time',
        value: Math.round(metrics.averageTaskProcessingTime),
        unit: 'ms',
        status: metrics.averageTaskProcessingTime > 30000 ? 'critical' : 
                metrics.averageTaskProcessingTime > 10000 ? 'warning' : 'good'
      },
      {
        title: 'Error Rate',
        value: metrics.errorRate.toFixed(2),
        unit: '%',
        status: metrics.errorRate > 5 ? 'critical' : 
                metrics.errorRate > 2 ? 'warning' : 'good'
      },
      {
        title: 'Average Queue Length',
        value: Math.round(metrics.averageQueueLength),
        unit: 'tasks',
        status: metrics.averageQueueLength > 100 ? 'critical' : 
                metrics.averageQueueLength > 50 ? 'warning' : 'good'
      },
      {
        title: 'Active Players',
        value: metrics.activePlayerCount,
        unit: 'players',
        status: 'good'
      },
      {
        title: 'Tasks/Second',
        value: metrics.tasksProcessedPerSecond.toFixed(1),
        unit: 'tps',
        status: 'good'
      },
      {
        title: 'Memory Usage',
        value: Math.round(metrics.memoryUsage / 1024 / 1024),
        unit: 'MB',
        status: metrics.memoryUsage > 1024 * 1024 * 1024 ? 'critical' : 
                metrics.memoryUsage > 512 * 1024 * 1024 ? 'warning' : 'good'
      },
      {
        title: 'CPU Usage',
        value: metrics.cpuUsage.toFixed(1),
        unit: '%',
        status: metrics.cpuUsage > 80 ? 'critical' : 
                metrics.cpuUsage > 60 ? 'warning' : 'good'
      },
      {
        title: 'Cache Hit Rate',
        value: metrics.cacheHitRate.toFixed(1),
        unit: '%',
        status: metrics.cacheHitRate < 70 ? 'warning' : 'good'
      }
    ];
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await taskQueueAlerting.acknowledgeAlert(alertId, 'admin');
      refreshData();
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      await taskQueueAlerting.resolveAlert(alertId, 'admin');
      refreshData();
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  const getSeverityColor = (severity: AlertSeverity): string => {
    switch (severity) {
      case AlertSeverity.CRITICAL: return '#dc3545';
      case AlertSeverity.HIGH: return '#fd7e14';
      case AlertSeverity.MEDIUM: return '#ffc107';
      case AlertSeverity.LOW: return '#17a2b8';
      default: return '#6c757d';
    }
  };

  const renderOverviewTab = () => (
    <div className="overview-tab">
      <div className="metrics-grid">
        {getMetricCards().map((card, index) => (
          <div key={index} className={`metric-card ${card.status}`}>
            <div className="metric-header">
              <h3>{card.title}</h3>
              {card.trend && (
                <span className={`trend-indicator ${card.trend}`}>
                  {card.trend === 'up' ? '↗' : card.trend === 'down' ? '↘' : '→'}
                </span>
              )}
            </div>
            <div className="metric-value">
              <span className="value">{card.value}</span>
              {card.unit && <span className="unit">{card.unit}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="alerts-summary">
        <h3>Active Alerts ({alerts.length})</h3>
        {alerts.length === 0 ? (
          <p className="no-alerts">No active alerts</p>
        ) : (
          <div className="alerts-list">
            {alerts.slice(0, 5).map(alert => (
              <div key={alert.id} className={`alert-item ${alert.severity}`}>
                <div className="alert-content">
                  <div className="alert-title">{alert.title}</div>
                  <div className="alert-message">{alert.message}</div>
                  <div className="alert-time">
                    {new Date(alert.timestamp).toLocaleString()}
                  </div>
                </div>
                <div className="alert-actions">
                  {!alert.acknowledged && (
                    <button 
                      onClick={() => handleAcknowledgeAlert(alert.id)}
                      className="btn-acknowledge"
                    >
                      Acknowledge
                    </button>
                  )}
                  <button 
                    onClick={() => handleResolveAlert(alert.id)}
                    className="btn-resolve"
                  >
                    Resolve
                  </button>
                </div>
              </div>
            ))}
            {alerts.length > 5 && (
              <div className="more-alerts">
                +{alerts.length - 5} more alerts
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderMetricsTab = () => (
    <div className="metrics-tab">
      <div className="metrics-section">
        <h3>Performance Metrics</h3>
        <div className="metrics-table">
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Current Value</th>
                <th>P95</th>
                <th>P99</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Task Processing Time</td>
                <td>{Math.round(metrics?.averageTaskProcessingTime || 0)}ms</td>
                <td>{Math.round(metrics?.taskProcessingTimeP95 || 0)}ms</td>
                <td>{Math.round(metrics?.taskProcessingTimeP99 || 0)}ms</td>
                <td>
                  <span className={`status ${(metrics?.averageTaskProcessingTime || 0) > 30000 ? 'critical' : 'good'}`}>
                    {(metrics?.averageTaskProcessingTime || 0) > 30000 ? 'Critical' : 'Good'}
                  </span>
                </td>
              </tr>
              <tr>
                <td>Queue Length</td>
                <td>{Math.round(metrics?.averageQueueLength || 0)}</td>
                <td>-</td>
                <td>-</td>
                <td>
                  <span className={`status ${(metrics?.averageQueueLength || 0) > 100 ? 'warning' : 'good'}`}>
                    {(metrics?.averageQueueLength || 0) > 100 ? 'Warning' : 'Good'}
                  </span>
                </td>
              </tr>
              <tr>
                <td>Error Rate</td>
                <td>{(metrics?.errorRate || 0).toFixed(2)}%</td>
                <td>-</td>
                <td>-</td>
                <td>
                  <span className={`status ${(metrics?.errorRate || 0) > 5 ? 'critical' : 'good'}`}>
                    {(metrics?.errorRate || 0) > 5 ? 'Critical' : 'Good'}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="metrics-section">
        <h3>System Resources</h3>
        <div className="resource-bars">
          <div className="resource-bar">
            <label>Memory Usage</label>
            <div className="bar-container">
              <div 
                className="bar-fill" 
                style={{ 
                  width: `${Math.min(100, (metrics?.memoryUsage || 0) / (1024 * 1024 * 1024) * 100)}%`,
                  backgroundColor: (metrics?.memoryUsage || 0) > 1024 * 1024 * 1024 ? '#dc3545' : '#28a745'
                }}
              />
            </div>
            <span>{Math.round((metrics?.memoryUsage || 0) / 1024 / 1024)}MB</span>
          </div>
          
          <div className="resource-bar">
            <label>CPU Usage</label>
            <div className="bar-container">
              <div 
                className="bar-fill" 
                style={{ 
                  width: `${metrics?.cpuUsage || 0}%`,
                  backgroundColor: (metrics?.cpuUsage || 0) > 80 ? '#dc3545' : '#28a745'
                }}
              />
            </div>
            <span>{(metrics?.cpuUsage || 0).toFixed(1)}%</span>
          </div>
          
          <div className="resource-bar">
            <label>Cache Hit Rate</label>
            <div className="bar-container">
              <div 
                className="bar-fill" 
                style={{ 
                  width: `${metrics?.cacheHitRate || 0}%`,
                  backgroundColor: (metrics?.cacheHitRate || 0) < 70 ? '#ffc107' : '#28a745'
                }}
              />
            </div>
            <span>{(metrics?.cacheHitRate || 0).toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAlertsTab = () => (
    <div className="alerts-tab">
      <div className="alerts-header">
        <h3>Alert Management</h3>
        <div className="alert-stats">
          <span className="stat critical">Critical: {alerts.filter(a => a.severity === AlertSeverity.CRITICAL).length}</span>
          <span className="stat high">High: {alerts.filter(a => a.severity === AlertSeverity.HIGH).length}</span>
          <span className="stat medium">Medium: {alerts.filter(a => a.severity === AlertSeverity.MEDIUM).length}</span>
          <span className="stat low">Low: {alerts.filter(a => a.severity === AlertSeverity.LOW).length}</span>
        </div>
      </div>
      
      <div className="alerts-table">
        {alerts.length === 0 ? (
          <p className="no-alerts">No active alerts</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Severity</th>
                <th>Title</th>
                <th>Message</th>
                <th>Time</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map(alert => (
                <tr key={alert.id}>
                  <td>
                    <span 
                      className="severity-badge" 
                      style={{ backgroundColor: getSeverityColor(alert.severity) }}
                    >
                      {alert.severity.toUpperCase()}
                    </span>
                  </td>
                  <td>{alert.title}</td>
                  <td className="alert-message-cell">{alert.message}</td>
                  <td>{new Date(alert.timestamp).toLocaleString()}</td>
                  <td>
                    <span className={`status-badge ${alert.acknowledged ? 'acknowledged' : 'new'}`}>
                      {alert.acknowledged ? 'Acknowledged' : 'New'}
                    </span>
                  </td>
                  <td>
                    <div className="alert-actions">
                      {!alert.acknowledged && (
                        <button 
                          onClick={() => handleAcknowledgeAlert(alert.id)}
                          className="btn-small btn-acknowledge"
                        >
                          Ack
                        </button>
                      )}
                      <button 
                        onClick={() => handleResolveAlert(alert.id)}
                        className="btn-small btn-resolve"
                      >
                        Resolve
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  const renderPlayersTab = () => (
    <div className="players-tab">
      <div className="player-stats">
        <div className="stat-card">
          <h4>Active Players</h4>
          <div className="stat-value">{metrics?.activePlayerCount || 0}</div>
        </div>
        <div className="stat-card">
          <h4>Concurrent Queues</h4>
          <div className="stat-value">{metrics?.concurrentQueueCount || 0}</div>
        </div>
        <div className="stat-card">
          <h4>Engagement Rate</h4>
          <div className="stat-value">{(metrics?.playerEngagementRate || 0).toFixed(1)}%</div>
        </div>
      </div>
      
      <div className="queue-distribution">
        <h4>Queue Length Distribution</h4>
        <div className="distribution-chart">
          {metrics?.queueLengthDistribution && Object.entries(metrics.queueLengthDistribution).map(([range, count]) => (
            <div key={range} className="distribution-bar">
              <label>{range} tasks</label>
              <div className="bar-container">
                <div 
                  className="bar-fill" 
                  style={{ width: `${(count / Math.max(...Object.values(metrics.queueLengthDistribution))) * 100}%` }}
                />
              </div>
              <span>{count} players</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (isLoading && !metrics) {
    return (
      <div className="admin-dashboard loading">
        <div className="loading-spinner">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>Task Queue Admin Dashboard</h1>
        <div className="dashboard-controls">
          <button onClick={refreshData} className="btn-refresh" disabled={isLoading}>
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
          {lastUpdated && (
            <span className="last-updated">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      <div className="dashboard-tabs">
        <button 
          className={`tab ${selectedTab === 'overview' ? 'active' : ''}`}
          onClick={() => setSelectedTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`tab ${selectedTab === 'metrics' ? 'active' : ''}`}
          onClick={() => setSelectedTab('metrics')}
        >
          Metrics
        </button>
        <button 
          className={`tab ${selectedTab === 'alerts' ? 'active' : ''}`}
          onClick={() => setSelectedTab('alerts')}
        >
          Alerts ({alerts.length})
        </button>
        <button 
          className={`tab ${selectedTab === 'players' ? 'active' : ''}`}
          onClick={() => setSelectedTab('players')}
        >
          Players
        </button>
      </div>

      <div className="dashboard-content">
        {selectedTab === 'overview' && renderOverviewTab()}
        {selectedTab === 'metrics' && renderMetricsTab()}
        {selectedTab === 'alerts' && renderAlertsTab()}
        {selectedTab === 'players' && renderPlayersTab()}
      </div>
    </div>
  );
};

export default TaskQueueAdminDashboard;