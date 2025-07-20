/**
 * Example component demonstrating network resilience features
 * Shows how to use offline detection, network error handling, and retry logic
 */

import React, { useState } from 'react';
import { NetworkErrorBoundary } from '../common/NetworkErrorBoundary';
import { OfflineIndicator } from '../common/OfflineIndicator';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { NetworkUtils } from '../../utils/networkUtils';

const NetworkResilienceExample: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const networkStatus = useNetworkStatus();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Example API call with network resilience
      const result = await NetworkUtils.fetchJson('/api/example-data', {}, {
        timeout: 10000,
        retries: 3,
        exponentialBackoff: true,
      });
      
      setData(result);
    } catch (error: any) {
      if (error.isNetworkError) {
        if (error.isOffline) {
          setError('You are offline. Please check your connection and try again.');
        } else if (error.isTimeout) {
          setError('Request timed out. Please try again.');
        } else {
          setError(`Network error: ${error.message}`);
        }
      } else {
        setError(`Error: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const testConnectivity = async () => {
    setLoading(true);
    try {
      const isConnected = await networkStatus.testConnectivity();
      alert(isConnected ? 'Connection test successful!' : 'Connection test failed.');
    } catch (error) {
      alert('Connection test failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <NetworkErrorBoundary>
      <div className="network-resilience-example">
        <h2>Network Resilience Example</h2>
        
        {/* Offline indicator */}
        <OfflineIndicator className="offline-indicator--fixed-top" />
        
        {/* Network status display */}
        <div className="network-status">
          <h3>Network Status</h3>
          <p>Status: {networkStatus.isOnline ? '🟢 Online' : '🔴 Offline'}</p>
          {networkStatus.isOffline && networkStatus.offlineDuration > 0 && (
            <p>Offline for: {Math.floor(networkStatus.offlineDuration / 1000)} seconds</p>
          )}
          {networkStatus.lastOnlineTime && (
            <p>Last online: {networkStatus.lastOnlineTime.toLocaleTimeString()}</p>
          )}
        </div>

        {/* API testing section */}
        <div className="api-testing">
          <h3>API Testing</h3>
          <div className="button-group">
            <button 
              onClick={fetchData} 
              disabled={loading}
              className="test-button"
            >
              {loading ? 'Loading...' : 'Fetch Data (with retry)'}
            </button>
            
            <button 
              onClick={testConnectivity} 
              disabled={loading}
              className="test-button"
            >
              {loading ? 'Testing...' : 'Test Connectivity'}
            </button>
          </div>

          {error && (
            <div className="error-display">
              <h4>Error:</h4>
              <p>{error}</p>
            </div>
          )}

          {data && (
            <div className="data-display">
              <h4>Data:</h4>
              <pre>{JSON.stringify(data, null, 2)}</pre>
            </div>
          )}
        </div>

        {/* Offline behavior explanation */}
        <div className="offline-behavior">
          <h3>Offline Behavior</h3>
          <ul>
            <li>API calls will automatically retry with exponential backoff</li>
            <li>Offline state is detected and displayed to users</li>
            <li>Network errors are handled gracefully with user-friendly messages</li>
            <li>Timeouts are configured to prevent hanging requests</li>
            <li>Services fall back to local processing when server is unavailable</li>
          </ul>
        </div>

        {/* Network resilience features */}
        <div className="resilience-features">
          <h3>Network Resilience Features</h3>
          <div className="feature-grid">
            <div className="feature-card">
              <h4>🔄 Automatic Retries</h4>
              <p>Failed requests are automatically retried with exponential backoff</p>
            </div>
            
            <div className="feature-card">
              <h4>⏱️ Timeout Handling</h4>
              <p>Requests timeout after a reasonable period to prevent hanging</p>
            </div>
            
            <div className="feature-card">
              <h4>📶 Offline Detection</h4>
              <p>Automatically detects when the device goes offline</p>
            </div>
            
            <div className="feature-card">
              <h4>🛡️ Error Boundaries</h4>
              <p>Network errors are caught and handled gracefully</p>
            </div>
            
            <div className="feature-card">
              <h4>🔄 Fallback Modes</h4>
              <p>Services fall back to local processing when server is unavailable</p>
            </div>
            
            <div className="feature-card">
              <h4>📱 User Feedback</h4>
              <p>Clear error messages and status indicators for users</p>
            </div>
          </div>
        </div>
      </div>
    </NetworkErrorBoundary>
  );
};

export default NetworkResilienceExample;