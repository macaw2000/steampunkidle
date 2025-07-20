/**
 * Offline indicator component
 * Shows network status and provides appropriate UI feedback
 */

import React, { useState, useEffect } from 'react';
import { offlineService, OfflineState } from '../../services/offlineService';

interface OfflineIndicatorProps {
  className?: string;
  showDuration?: boolean;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  className = '',
  showDuration = true,
}) => {
  const [offlineState, setOfflineState] = useState<OfflineState>(offlineService.getState());

  useEffect(() => {
    const unsubscribe = offlineService.subscribe(setOfflineState);
    return unsubscribe;
  }, []);

  const formatDuration = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  if (!offlineState.isOffline) {
    return null; // Don't show anything when online
  }

  return (
    <div className={`offline-indicator ${className}`}>
      <div className="offline-indicator__content">
        <div className="offline-indicator__icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM7 4a1 1 0 1 1 2 0v3a1 1 0 1 1-2 0V4zm1 7a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
          </svg>
        </div>
        <div className="offline-indicator__text">
          <span className="offline-indicator__status">Offline</span>
          {showDuration && offlineState.offlineDuration > 0 && (
            <span className="offline-indicator__duration">
              {formatDuration(offlineState.offlineDuration)}
            </span>
          )}
        </div>
      </div>
      <div className="offline-indicator__message">
        Some features may be limited while offline
      </div>
    </div>
  );
};

export default OfflineIndicator;