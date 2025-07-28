/**
 * Error Reporting Dashboard - Development tool for viewing error reports
 */

import React, { useState, useEffect } from 'react';
import { ErrorLoggingService, ErrorReport } from '../../services/errorLoggingService';
import './ErrorReportingDashboard.css';

interface Props {
  isVisible: boolean;
  onClose: () => void;
}

export const ErrorReportingDashboard: React.FC<Props> = ({ isVisible, onClose }) => {
  const [errorReports, setErrorReports] = useState<ErrorReport[]>([]);
  const [selectedError, setSelectedError] = useState<ErrorReport | null>(null);
  const [statistics, setStatistics] = useState<any>(null);

  useEffect(() => {
    if (isVisible) {
      refreshData();
      const interval = setInterval(refreshData, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [isVisible]);

  const refreshData = () => {
    setErrorReports(ErrorLoggingService.getErrorReports());
    setStatistics(ErrorLoggingService.getErrorStatistics());
  };

  const handleClearErrors = () => {
    ErrorLoggingService.clearErrorReports();
    refreshData();
    setSelectedError(null);
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getSeverityColor = (severity: ErrorReport['severity']) => {
    const colors = {
      low: '#2196F3',
      medium: '#FF9800',
      high: '#F44336',
      critical: '#9C27B0',
    };
    return colors[severity];
  };

  const getCategoryIcon = (category: ErrorReport['category']) => {
    const icons = {
      javascript: '⚠️',
      network: '🌐',
      ui: '🎨',
      data: '📊',
      auth: '🔐',
      unknown: '❓',
    };
    return icons[category];
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="error-reporting-dashboard">
      <div className="dashboard-header">
        <h2>Error Reporting Dashboard</h2>
        <div className="dashboard-actions">
          <button onClick={refreshData} className="refresh-button">
            🔄 Refresh
          </button>
          <button onClick={handleClearErrors} className="clear-button">
            🗑️ Clear All
          </button>
          <button onClick={onClose} className="close-button">
            ✕
          </button>
        </div>
      </div>

      {statistics && (
        <div className="statistics-section">
          <div className="stat-card">
            <div className="stat-value">{statistics.totalErrors}</div>
            <div className="stat-label">Total Errors</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{statistics.uniqueErrors}</div>
            <div className="stat-label">Unique Errors</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{statistics.criticalErrors}</div>
            <div className="stat-label">Critical Errors</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{statistics.recentErrors}</div>
            <div className="stat-label">Recent (1h)</div>
          </div>
        </div>
      )}

      <div className="dashboard-content">
        <div className="errors-list">
          <h3>Error Reports ({errorReports.length})</h3>
          {errorReports.length === 0 ? (
            <div className="no-errors">
              <div className="no-errors-icon">✅</div>
              <p>No errors reported</p>
            </div>
          ) : (
            <div className="error-items">
              {errorReports.map((error) => (
                <div
                  key={error.id}
                  className={`error-item ${selectedError?.id === error.id ? 'selected' : ''}`}
                  onClick={() => setSelectedError(error)}
                >
                  <div className="error-item-header">
                    <div className="error-category">
                      {getCategoryIcon(error.category)} {error.category}
                    </div>
                    <div
                      className="error-severity"
                      style={{ backgroundColor: getSeverityColor(error.severity) }}
                    >
                      {error.severity}
                    </div>
                  </div>
                  <div className="error-message">{error.message}</div>
                  <div className="error-meta">
                    <span className="error-occurrences">
                      {error.occurrences} occurrence{error.occurrences !== 1 ? 's' : ''}
                    </span>
                    <span className="error-timestamp">
                      {formatTimestamp(error.lastSeen)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedError && (
          <div className="error-details">
            <h3>Error Details</h3>
            <div className="error-detail-content">
              <div className="detail-section">
                <h4>Basic Information</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <strong>ID:</strong> {selectedError.id}
                  </div>
                  <div className="detail-item">
                    <strong>Type:</strong> {selectedError.name}
                  </div>
                  <div className="detail-item">
                    <strong>Category:</strong> {selectedError.category}
                  </div>
                  <div className="detail-item">
                    <strong>Severity:</strong> {selectedError.severity}
                  </div>
                  <div className="detail-item">
                    <strong>Occurrences:</strong> {selectedError.occurrences}
                  </div>
                  <div className="detail-item">
                    <strong>First Seen:</strong> {formatTimestamp(selectedError.firstSeen)}
                  </div>
                  <div className="detail-item">
                    <strong>Last Seen:</strong> {formatTimestamp(selectedError.lastSeen)}
                  </div>
                  <div className="detail-item">
                    <strong>Fingerprint:</strong> {selectedError.fingerprint}
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Message</h4>
                <div className="error-message-detail">{selectedError.message}</div>
              </div>

              {selectedError.stack && (
                <div className="detail-section">
                  <h4>Stack Trace</h4>
                  <pre className="stack-trace">{selectedError.stack}</pre>
                </div>
              )}

              <div className="detail-section">
                <h4>Context</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <strong>URL:</strong> {selectedError.url}
                  </div>
                  <div className="detail-item">
                    <strong>User Agent:</strong> {selectedError.userAgent}
                  </div>
                  <div className="detail-item">
                    <strong>Session ID:</strong> {selectedError.sessionId}
                  </div>
                  {selectedError.userId && (
                    <div className="detail-item">
                      <strong>User ID:</strong> {selectedError.userId}
                    </div>
                  )}
                  {selectedError.context?.component && (
                    <div className="detail-item">
                      <strong>Component:</strong> {selectedError.context.component}
                    </div>
                  )}
                  {selectedError.context?.action && (
                    <div className="detail-item">
                      <strong>Action:</strong> {selectedError.context.action}
                    </div>
                  )}
                </div>
              </div>

              {selectedError.context?.additionalData?.componentStack && (
                <div className="detail-section">
                  <h4>Component Stack</h4>
                  <pre className="component-stack">{selectedError.context.additionalData.componentStack}</pre>
                </div>
              )}

              {selectedError.breadcrumbs && selectedError.breadcrumbs.length > 0 && (
                <div className="detail-section">
                  <h4>Breadcrumbs</h4>
                  <div className="breadcrumbs">
                    {selectedError.breadcrumbs.map((breadcrumb: any, index: number) => (
                      <div key={index} className="breadcrumb-item">
                        <div className="breadcrumb-header">
                          <span className="breadcrumb-category">{breadcrumb.category}</span>
                          <span className="breadcrumb-level">{breadcrumb.level}</span>
                          <span className="breadcrumb-timestamp">
                            {formatTimestamp(breadcrumb.timestamp)}
                          </span>
                        </div>
                        <div className="breadcrumb-message">{breadcrumb.message}</div>
                        {breadcrumb.data && (
                          <pre className="breadcrumb-data">
                            {JSON.stringify(breadcrumb.data, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorReportingDashboard;