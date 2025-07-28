/**
 * Service Health Indicator Component
 * Shows service status and allows switching between live and mock services
 */

import React, { useState, useEffect } from 'react';
import { DevServiceManager, ServiceHealth } from '../../services/devServiceManager';
import { MockCharacterService } from '../../services/mockCharacterService';
import './ServiceHealthIndicator.css';

interface ServiceHealthIndicatorProps {
  showInProduction?: boolean;
  compact?: boolean;
}

export const ServiceHealthIndicator: React.FC<ServiceHealthIndicatorProps> = ({
  showInProduction = false,
  compact = false,
}) => {
  const [statusSummary, setStatusSummary] = useState(DevServiceManager.getStatusSummary());
  const [isExpanded, setIsExpanded] = useState(false);
  const [mockConfig, setMockConfig] = useState(MockCharacterService.getConfig());

  // Don't show in production unless explicitly enabled
  if (process.env.NODE_ENV === 'production' && !showInProduction) {
    return null;
  }

  useEffect(() => {
    // Initialize service manager
    DevServiceManager.initialize();

    // Update status every 5 seconds
    const interval = setInterval(() => {
      setStatusSummary(DevServiceManager.getStatusSummary());
      setMockConfig(MockCharacterService.getConfig());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'healthy': return '#4CAF50';
      case 'degraded': return '#FF9800';
      case 'unhealthy': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'healthy': return '✓';
      case 'degraded': return '⚠';
      case 'unhealthy': return '✗';
      default: return '?';
    }
  };

  const handleToggleMockMode = () => {
    if (statusSummary.mockModeActive) {
      DevServiceManager.disableMockMode();
    } else {
      DevServiceManager.enableMockMode();
    }
    setStatusSummary(DevServiceManager.getStatusSummary());
  };

  const handleRefreshHealth = () => {
    DevServiceManager.resetHealthStatus();
    setStatusSummary(DevServiceManager.getStatusSummary());
  };

  const handleMockConfigChange = (key: string, value: any) => {
    const newConfig = { ...mockConfig, [key]: value };
    MockCharacterService.configure(newConfig);
    setMockConfig(newConfig);
  };

  if (compact) {
    return (
      <div className="service-health-compact">
        <div 
          className="status-indicator"
          style={{ backgroundColor: getStatusColor(statusSummary.overall) }}
          onClick={() => setIsExpanded(!isExpanded)}
          title={`Services: ${statusSummary.overall} | Mock: ${statusSummary.mockModeActive ? 'ON' : 'OFF'}`}
        >
          {getStatusIcon(statusSummary.overall)}
        </div>
        
        {isExpanded && (
          <div className="status-dropdown">
            <div className="status-header">
              <h4>Service Status</h4>
              <button onClick={handleRefreshHealth} className="refresh-btn">↻</button>
            </div>
            
            <div className="service-list">
              {statusSummary.services.map((service) => (
                <div key={service.name} className="service-item">
                  <span 
                    className="service-status"
                    style={{ color: getStatusColor(service.status) }}
                  >
                    {getStatusIcon(service.status)}
                  </span>
                  <span className="service-name">{service.name}</span>
                  <span className="service-time">
                    {service.responseTime ? `${service.responseTime}ms` : '-'}
                  </span>
                </div>
              ))}
            </div>
            
            <div className="mock-controls">
              <label>
                <input
                  type="checkbox"
                  checked={statusSummary.mockModeActive}
                  onChange={handleToggleMockMode}
                />
                Mock Mode
              </label>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="service-health-indicator">
      <div className="health-header">
        <h3>Development Service Status</h3>
        <div className="header-controls">
          <button onClick={handleRefreshHealth} className="refresh-button">
            Refresh Status
          </button>
          <button 
            onClick={handleToggleMockMode}
            className={`mock-toggle ${statusSummary.mockModeActive ? 'active' : ''}`}
          >
            {statusSummary.mockModeActive ? 'Disable Mock Mode' : 'Enable Mock Mode'}
          </button>
        </div>
      </div>

      <div className="overall-status">
        <div 
          className="status-badge"
          style={{ backgroundColor: getStatusColor(statusSummary.overall) }}
        >
          {getStatusIcon(statusSummary.overall)} Overall: {statusSummary.overall.toUpperCase()}
        </div>
        {statusSummary.mockModeActive && (
          <div className="mock-badge">
            🔧 Mock Mode Active
          </div>
        )}
      </div>

      <div className="services-grid">
        {statusSummary.services.map((service) => (
          <div key={service.name} className="service-card">
            <div className="service-header">
              <span 
                className="service-status-icon"
                style={{ color: getStatusColor(service.status) }}
              >
                {getStatusIcon(service.status)}
              </span>
              <h4>{service.name}</h4>
            </div>
            
            <div className="service-details">
              <div className="detail-row">
                <span className="label">Status:</span>
                <span 
                  className="value"
                  style={{ color: getStatusColor(service.status) }}
                >
                  {service.status}
                </span>
              </div>
              
              <div className="detail-row">
                <span className="label">Message:</span>
                <span className="value">{service.message}</span>
              </div>
              
              {service.responseTime && (
                <div className="detail-row">
                  <span className="label">Response:</span>
                  <span className="value">{service.responseTime}ms</span>
                </div>
              )}
              
              <div className="detail-row">
                <span className="label">Last Check:</span>
                <span className="value">
                  {service.lastChecked.toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {statusSummary.mockModeActive && (
        <div className="mock-configuration">
          <h4>Mock Service Configuration</h4>
          
          <div className="config-grid">
            <div className="config-item">
              <label>
                <input
                  type="checkbox"
                  checked={mockConfig.simulateNetworkDelay}
                  onChange={(e) => handleMockConfigChange('simulateNetworkDelay', e.target.checked)}
                />
                Simulate Network Delay
              </label>
            </div>
            
            <div className="config-item">
              <label>
                Min Delay (ms):
                <input
                  type="number"
                  value={mockConfig.minDelay}
                  onChange={(e) => handleMockConfigChange('minDelay', parseInt(e.target.value))}
                  min="0"
                  max="5000"
                />
              </label>
            </div>
            
            <div className="config-item">
              <label>
                Max Delay (ms):
                <input
                  type="number"
                  value={mockConfig.maxDelay}
                  onChange={(e) => handleMockConfigChange('maxDelay', parseInt(e.target.value))}
                  min="0"
                  max="10000"
                />
              </label>
            </div>
            
            <div className="config-item">
              <label>
                Error Rate:
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={mockConfig.errorRate}
                  onChange={(e) => handleMockConfigChange('errorRate', parseFloat(e.target.value))}
                />
                <span>{Math.round(mockConfig.errorRate * 100)}%</span>
              </label>
            </div>
            
            <div className="config-item">
              <label>
                <input
                  type="checkbox"
                  checked={mockConfig.offlineMode}
                  onChange={(e) => handleMockConfigChange('offlineMode', e.target.checked)}
                />
                Offline Mode
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceHealthIndicator;