/**
 * Network Status Indicator Component
 * Shows network connectivity status and provides retry options
 */

import React, { useState, useEffect } from 'react';
import { NetworkClient } from '../../services/networkClient';
import { DevServiceManager } from '../../services/devServiceManager';
import './NetworkStatusIndicator.css';

interface NetworkStatusIndicatorProps {
  showInProduction?: boolean;
  onRetry?: () => void;
}

interface NetworkStatus {
  isOnline: boolean;
  latency?: number;
  error?: string;
  lastChecked: Date;
  usingMockServices: boolean;
}

export const NetworkStatusIndicator: React.FC<NetworkStatusIndicatorProps> = ({
  showInProduction = false,
  onRetry,
}) => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    lastChecked: new Date(),
    usingMockServices: false,
  });
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    // Initial network check
    checkNetworkStatus();

    // Listen for online/offline events
    const handleOnline = () => {
      setNetworkStatus(prev => ({ ...prev, isOnline: true }));
      checkNetworkStatus();
    };

    const handleOffline = () => {
      setNetworkStatus(prev => ({ 
        ...prev, 
        isOnline: false,
        error: 'Device is offline',
        lastChecked: new Date(),
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic network check
    const interval = setInterval(checkNetworkStatus, 30000); // Check every 30 seconds

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const checkNetworkStatus = async () => {
    if (isChecking) return;
    
    setIsChecking(true);
    
    try {
      const connectivity = await NetworkClient.testConnectivity();
      const statusSummary = DevServiceManager.getStatusSummary();
      
      setNetworkStatus({
        isOnline: connectivity.isOnline,
        latency: connectivity.latency,
        error: connectivity.error,
        lastChecked: new Date(),
        usingMockServices: statusSummary.mockModeActive,
      });
    } catch (error: any) {
      setNetworkStatus(prev => ({
        ...prev,
        isOnline: false,
        error: error.message,
        lastChecked: new Date(),
      }));
    } finally {
      setIsChecking(false);
    }
  };

  const handleRetry = async () => {
    await checkNetworkStatus();
    if (onRetry) {
      onRetry();
    }
  };

  const getStatusColor = (): string => {
    if (networkStatus.usingMockServices) return '#FF9800'; // Orange for mock mode
    if (networkStatus.isOnline) return '#4CAF50'; // Green for online
    return '#F44336'; // Red for offline
  };

  const getStatusText = (): string => {
    if (networkStatus.usingMockServices) return 'Mock Mode';
    if (networkStatus.isOnline) return 'Online';
    return 'Offline';
  };

  const getStatusIcon = (): string => {
    if (networkStatus.usingMockServices) return '🔧';
    if (networkStatus.isOnline) return '🟢';
    return '🔴';
  };

  return (
    <div className="network-status-indicator">
      <div className="network-status-compact">
        <div 
          className="status-dot"
          style={{ backgroundColor: getStatusColor() }}
          title={`Network Status: ${getStatusText()}`}
        >
          <span className="status-icon">{getStatusIcon()}</span>
        </div>
        
        <div className="status-info">
          <span className="status-text">{getStatusText()}</span>
          {networkStatus.latency && (
            <span className="latency-text">{networkStatus.latency}ms</span>
          )}
        </div>
      </div>

      {(!networkStatus.isOnline || networkStatus.error) && (
        <div className="network-error-panel">
          <div className="error-message">
            {networkStatus.error || 'Network connection lost'}
          </div>
          
          <div className="error-actions">
            <button 
              onClick={handleRetry}
              disabled={isChecking}
              className="retry-button"
            >
              {isChecking ? 'Checking...' : 'Retry Connection'}
            </button>
            
            {networkStatus.usingMockServices && (
              <div className="mock-mode-info">
                <span>Using offline mode with mock data</span>
              </div>
            )}
          </div>
          
          <div className="network-tips">
            <h4>Troubleshooting Tips:</h4>
            <ul>
              <li>Check your internet connection</li>
              <li>Ensure the backend server is running</li>
              <li>Try refreshing the page</li>
              <li>Mock mode will be used automatically if the server is unavailable</li>
            </ul>
          </div>
        </div>
      )}

      <div className="last-checked">
        Last checked: {networkStatus.lastChecked.toLocaleTimeString()}
      </div>
    </div>
  );
};

export default NetworkStatusIndicator;