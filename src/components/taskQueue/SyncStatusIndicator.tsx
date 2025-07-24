/**
 * Sync Status Indicator Component
 * Shows real-time synchronization status with manual sync triggers
 */

import React, { useState, useEffect } from 'react';
import { OfflineTaskQueueManager, SyncIndicator } from '../../services/offlineTaskQueueManager';
import './SyncStatusIndicator.css';

interface SyncStatusIndicatorProps {
  playerId: string;
  className?: string;
  showDetails?: boolean;
  onSyncComplete?: () => void;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  playerId,
  className = '',
  showDetails = false,
  onSyncComplete
}) => {
  const [syncIndicator, setSyncIndicator] = useState<SyncIndicator | null>(null);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    const offlineManager = OfflineTaskQueueManager.getInstance();
    
    // Update sync status periodically
    const updateStatus = () => {
      const indicator = offlineManager.getSyncIndicator(playerId);
      setSyncIndicator(indicator);
    };

    updateStatus();
    const interval = setInterval(updateStatus, 1000);

    return () => clearInterval(interval);
  }, [playerId]);

  const handleManualSync = async () => {
    if (!syncIndicator?.canManualSync || isManualSyncing) {
      return;
    }

    setIsManualSyncing(true);
    
    try {
      const offlineManager = OfflineTaskQueueManager.getInstance();
      await offlineManager.triggerManualSync(playerId);
      onSyncComplete?.();
    } catch (error) {
      console.error('Manual sync failed:', error);
    } finally {
      setIsManualSyncing(false);
    }
  };

  const getStatusIcon = () => {
    if (!syncIndicator) return '⚪';
    
    switch (syncIndicator.status) {
      case 'online':
        return '🟢';
      case 'offline':
        return '🔴';
      case 'syncing':
        return '🟡';
      case 'error':
        return '🔴';
      case 'conflict':
        return '🟠';
      default:
        return '⚪';
    }
  };

  const getStatusClass = () => {
    if (!syncIndicator) return 'sync-status-unknown';
    return `sync-status-${syncIndicator.status}`;
  };

  const formatLastSync = (timestamp?: number) => {
    if (!timestamp) return 'Never';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  if (!syncIndicator) {
    return (
      <div className={`sync-status-indicator sync-status-unknown ${className}`}>
        <span className="sync-icon">⚪</span>
        <span className="sync-message">Loading...</span>
      </div>
    );
  }

  return (
    <div 
      className={`sync-status-indicator ${getStatusClass()} ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="sync-status-main">
        <span className="sync-icon">{getStatusIcon()}</span>
        <span className="sync-message">{syncIndicator.message}</span>
        
        {syncIndicator.progress !== undefined && (
          <div className="sync-progress">
            <div 
              className="sync-progress-bar"
              style={{ width: `${syncIndicator.progress}%` }}
            />
          </div>
        )}
        
        {syncIndicator.canManualSync && (
          <button
            className={`sync-button ${isManualSyncing ? 'syncing' : ''}`}
            onClick={handleManualSync}
            disabled={isManualSyncing}
            title="Sync now"
          >
            {isManualSyncing ? '⟳' : '↻'}
          </button>
        )}
      </div>

      {showDetails && (
        <div className="sync-details">
          <div className="sync-detail-item">
            <span className="sync-detail-label">Last sync:</span>
            <span className="sync-detail-value">{formatLastSync(syncIndicator.lastSync)}</span>
          </div>
          
          {syncIndicator.pendingCount !== undefined && syncIndicator.pendingCount > 0 && (
            <div className="sync-detail-item">
              <span className="sync-detail-label">Pending:</span>
              <span className="sync-detail-value">{syncIndicator.pendingCount} changes</span>
            </div>
          )}
        </div>
      )}

      {showTooltip && (
        <div className="sync-tooltip">
          <div className="sync-tooltip-content">
            <div><strong>Status:</strong> {syncIndicator.status}</div>
            <div><strong>Last sync:</strong> {formatLastSync(syncIndicator.lastSync)}</div>
            {syncIndicator.pendingCount !== undefined && (
              <div><strong>Pending:</strong> {syncIndicator.pendingCount} changes</div>
            )}
            {syncIndicator.canManualSync && (
              <div className="sync-tooltip-action">Click sync button to sync now</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SyncStatusIndicator;