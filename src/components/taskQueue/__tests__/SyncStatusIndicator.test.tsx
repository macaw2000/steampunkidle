/**
 * Sync Status Indicator Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SyncStatusIndicator } from '../SyncStatusIndicator';
import { OfflineTaskQueueManager, SyncIndicator } from '../../../services/offlineTaskQueueManager';

// Mock the offline task queue manager
jest.mock('../../../services/offlineTaskQueueManager');

const mockOfflineManager = OfflineTaskQueueManager.getInstance as jest.MockedFunction<typeof OfflineTaskQueueManager.getInstance>;

describe('SyncStatusIndicator', () => {
  let mockManagerInstance: {
    getSyncIndicator: jest.Mock;
    triggerManualSync: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockManagerInstance = {
      getSyncIndicator: jest.fn(),
      triggerManualSync: jest.fn()
    };

    mockOfflineManager.mockReturnValue(mockManagerInstance as any);
  });

  describe('Online Status', () => {
    it('should display online status correctly', () => {
      const mockIndicator: SyncIndicator = {
        status: 'online',
        message: 'All changes synchronized',
        lastSync: Date.now() - 30000, // 30 seconds ago
        pendingCount: 0,
        canManualSync: true
      };

      mockManagerInstance.getSyncIndicator.mockReturnValue(mockIndicator);

      render(<SyncStatusIndicator playerId="player-1" />);

      expect(screen.getByText('All changes synchronized')).toBeInTheDocument();
      expect(screen.getByText('🟢')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sync now/i })).toBeInTheDocument();
    });

    it('should show manual sync button for online status', () => {
      const mockIndicator: SyncIndicator = {
        status: 'online',
        message: 'All changes synchronized',
        canManualSync: true
      };

      mockManagerInstance.getSyncIndicator.mockReturnValue(mockIndicator);

      render(<SyncStatusIndicator playerId="player-1" />);

      const syncButton = screen.getByRole('button', { name: /sync now/i });
      expect(syncButton).toBeInTheDocument();
      expect(syncButton).not.toBeDisabled();
    });
  });

  describe('Offline Status', () => {
    it('should display offline status correctly', () => {
      const mockIndicator: SyncIndicator = {
        status: 'offline',
        message: 'Offline - 3 changes pending',
        pendingCount: 3,
        canManualSync: false
      };

      mockManagerInstance.getSyncIndicator.mockReturnValue(mockIndicator);

      render(<SyncStatusIndicator playerId="player-1" />);

      expect(screen.getByText('Offline - 3 changes pending')).toBeInTheDocument();
      expect(screen.getByText('🔴')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /sync now/i })).not.toBeInTheDocument();
    });
  });

  describe('Syncing Status', () => {
    it('should display syncing status with progress bar', () => {
      const mockIndicator: SyncIndicator = {
        status: 'syncing',
        message: 'Synchronizing with server...',
        progress: 65,
        pendingCount: 5,
        canManualSync: false
      };

      mockManagerInstance.getSyncIndicator.mockReturnValue(mockIndicator);

      render(<SyncStatusIndicator playerId="player-1" />);

      expect(screen.getByText('Synchronizing with server...')).toBeInTheDocument();
      expect(screen.getByText('🟡')).toBeInTheDocument();
      
      const progressBar = document.querySelector('.sync-progress-bar');
      expect(progressBar).toHaveStyle({ width: '65%' });
    });

    it('should disable sync button during syncing', () => {
      const mockIndicator: SyncIndicator = {
        status: 'syncing',
        message: 'Synchronizing with server...',
        canManualSync: false
      };

      mockManagerInstance.getSyncIndicator.mockReturnValue(mockIndicator);

      render(<SyncStatusIndicator playerId="player-1" />);

      expect(screen.queryByRole('button', { name: /sync now/i })).not.toBeInTheDocument();
    });
  });

  describe('Error Status', () => {
    it('should display error status correctly', () => {
      const mockIndicator: SyncIndicator = {
        status: 'error',
        message: 'Sync error - 2 errors',
        pendingCount: 4,
        canManualSync: true
      };

      mockManagerInstance.getSyncIndicator.mockReturnValue(mockIndicator);

      render(<SyncStatusIndicator playerId="player-1" />);

      expect(screen.getByText('Sync error - 2 errors')).toBeInTheDocument();
      expect(screen.getByText('🔴')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sync now/i })).toBeInTheDocument();
    });
  });

  describe('Conflict Status', () => {
    it('should display conflict status correctly', () => {
      const mockIndicator: SyncIndicator = {
        status: 'conflict',
        message: '2 conflicts detected',
        pendingCount: 3,
        canManualSync: true
      };

      mockManagerInstance.getSyncIndicator.mockReturnValue(mockIndicator);

      render(<SyncStatusIndicator playerId="player-1" />);

      expect(screen.getByText('2 conflicts detected')).toBeInTheDocument();
      expect(screen.getByText('🟠')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sync now/i })).toBeInTheDocument();
    });
  });

  describe('Manual Sync', () => {
    it('should trigger manual sync when button is clicked', async () => {
      const mockIndicator: SyncIndicator = {
        status: 'online',
        message: 'All changes synchronized',
        canManualSync: true
      };

      mockManagerInstance.getSyncIndicator.mockReturnValue(mockIndicator);
      mockManagerInstance.triggerManualSync.mockResolvedValue({
        success: true,
        conflicts: [],
        resolvedQueue: {} as any,
        syncTimestamp: Date.now()
      });

      const onSyncComplete = jest.fn();

      render(
        <SyncStatusIndicator 
          playerId="player-1" 
          onSyncComplete={onSyncComplete}
        />
      );

      const syncButton = screen.getByRole('button', { name: /sync now/i });
      fireEvent.click(syncButton);

      await waitFor(() => {
        expect(mockManagerInstance.triggerManualSync).toHaveBeenCalledWith('player-1');
      });

      expect(onSyncComplete).toHaveBeenCalled();
    });

    it('should handle manual sync errors', async () => {
      const mockIndicator: SyncIndicator = {
        status: 'error',
        message: 'Sync error',
        canManualSync: true
      };

      mockManagerInstance.getSyncIndicator.mockReturnValue(mockIndicator);
      mockManagerInstance.triggerManualSync.mockRejectedValue(new Error('Sync failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(<SyncStatusIndicator playerId="player-1" />);

      const syncButton = screen.getByRole('button', { name: /sync now/i });
      fireEvent.click(syncButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Manual sync failed:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });

    it('should show syncing state during manual sync', async () => {
      const mockIndicator: SyncIndicator = {
        status: 'online',
        message: 'All changes synchronized',
        canManualSync: true
      };

      mockManagerInstance.getSyncIndicator.mockReturnValue(mockIndicator);
      
      // Mock slow sync
      mockManagerInstance.triggerManualSync.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          conflicts: [],
          resolvedQueue: {} as any,
          syncTimestamp: Date.now()
        }), 100))
      );

      render(<SyncStatusIndicator playerId="player-1" />);

      const syncButton = screen.getByRole('button', { name: /sync now/i });
      fireEvent.click(syncButton);

      // Button should be disabled and show syncing state
      expect(syncButton).toBeDisabled();
      expect(syncButton).toHaveClass('syncing');

      await waitFor(() => {
        expect(syncButton).not.toBeDisabled();
        expect(syncButton).not.toHaveClass('syncing');
      });
    });

    it('should not trigger sync when already syncing', async () => {
      const mockIndicator: SyncIndicator = {
        status: 'online',
        message: 'All changes synchronized',
        canManualSync: true
      };

      mockManagerInstance.getSyncIndicator.mockReturnValue(mockIndicator);
      mockManagerInstance.triggerManualSync.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      render(<SyncStatusIndicator playerId="player-1" />);

      const syncButton = screen.getByRole('button', { name: /sync now/i });
      
      // Click twice quickly
      fireEvent.click(syncButton);
      fireEvent.click(syncButton);

      await waitFor(() => {
        expect(mockManagerInstance.triggerManualSync).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Details Display', () => {
    it('should show details when showDetails is true', () => {
      const mockIndicator: SyncIndicator = {
        status: 'online',
        message: 'All changes synchronized',
        lastSync: Date.now() - 120000, // 2 minutes ago
        pendingCount: 3,
        canManualSync: true
      };

      mockManagerInstance.getSyncIndicator.mockReturnValue(mockIndicator);

      render(
        <SyncStatusIndicator 
          playerId="player-1" 
          showDetails={true}
        />
      );

      expect(screen.getByText('Last sync:')).toBeInTheDocument();
      expect(screen.getByText('2m ago')).toBeInTheDocument();
      expect(screen.getByText('Pending:')).toBeInTheDocument();
      expect(screen.getByText('3 changes')).toBeInTheDocument();
    });

    it('should not show pending count when zero', () => {
      const mockIndicator: SyncIndicator = {
        status: 'online',
        message: 'All changes synchronized',
        lastSync: Date.now() - 60000,
        pendingCount: 0,
        canManualSync: true
      };

      mockManagerInstance.getSyncIndicator.mockReturnValue(mockIndicator);

      render(
        <SyncStatusIndicator 
          playerId="player-1" 
          showDetails={true}
        />
      );

      expect(screen.getByText('Last sync:')).toBeInTheDocument();
      expect(screen.queryByText('Pending:')).not.toBeInTheDocument();
    });
  });

  describe('Tooltip', () => {
    it('should show tooltip on hover', async () => {
      const mockIndicator: SyncIndicator = {
        status: 'online',
        message: 'All changes synchronized',
        lastSync: Date.now() - 60000,
        pendingCount: 2,
        canManualSync: true
      };

      mockManagerInstance.getSyncIndicator.mockReturnValue(mockIndicator);

      render(<SyncStatusIndicator playerId="player-1" />);

      const indicator = screen.getByText('All changes synchronized').closest('.sync-status-indicator');
      
      fireEvent.mouseEnter(indicator!);

      await waitFor(() => {
        expect(screen.getByText('Status: online')).toBeInTheDocument();
        expect(screen.getByText('Last sync: 1m ago')).toBeInTheDocument();
        expect(screen.getByText('Pending: 2 changes')).toBeInTheDocument();
      });
    });

    it('should hide tooltip on mouse leave', async () => {
      const mockIndicator: SyncIndicator = {
        status: 'online',
        message: 'All changes synchronized',
        canManualSync: true
      };

      mockManagerInstance.getSyncIndicator.mockReturnValue(mockIndicator);

      render(<SyncStatusIndicator playerId="player-1" />);

      const indicator = screen.getByText('All changes synchronized').closest('.sync-status-indicator');
      
      fireEvent.mouseEnter(indicator!);
      
      await waitFor(() => {
        expect(screen.getByText('Status: online')).toBeInTheDocument();
      });

      fireEvent.mouseLeave(indicator!);

      await waitFor(() => {
        expect(screen.queryByText('Status: online')).not.toBeInTheDocument();
      });
    });
  });

  describe('Time Formatting', () => {
    it('should format recent times correctly', () => {
      const mockIndicator: SyncIndicator = {
        status: 'online',
        message: 'All changes synchronized',
        lastSync: Date.now() - 30000, // 30 seconds ago
        canManualSync: true
      };

      mockManagerInstance.getSyncIndicator.mockReturnValue(mockIndicator);

      render(
        <SyncStatusIndicator 
          playerId="player-1" 
          showDetails={true}
        />
      );

      expect(screen.getByText('Just now')).toBeInTheDocument();
    });

    it('should format minute times correctly', () => {
      const mockIndicator: SyncIndicator = {
        status: 'online',
        message: 'All changes synchronized',
        lastSync: Date.now() - 150000, // 2.5 minutes ago
        canManualSync: true
      };

      mockManagerInstance.getSyncIndicator.mockReturnValue(mockIndicator);

      render(
        <SyncStatusIndicator 
          playerId="player-1" 
          showDetails={true}
        />
      );

      expect(screen.getByText('2m ago')).toBeInTheDocument();
    });

    it('should format hour times correctly', () => {
      const mockIndicator: SyncIndicator = {
        status: 'online',
        message: 'All changes synchronized',
        lastSync: Date.now() - 7200000, // 2 hours ago
        canManualSync: true
      };

      mockManagerInstance.getSyncIndicator.mockReturnValue(mockIndicator);

      render(
        <SyncStatusIndicator 
          playerId="player-1" 
          showDetails={true}
        />
      );

      expect(screen.getByText('2h ago')).toBeInTheDocument();
    });

    it('should format day times correctly', () => {
      const mockIndicator: SyncIndicator = {
        status: 'online',
        message: 'All changes synchronized',
        lastSync: Date.now() - 172800000, // 2 days ago
        canManualSync: true
      };

      mockManagerInstance.getSyncIndicator.mockReturnValue(mockIndicator);

      render(
        <SyncStatusIndicator 
          playerId="player-1" 
          showDetails={true}
        />
      );

      expect(screen.getByText('2d ago')).toBeInTheDocument();
    });

    it('should show "Never" for undefined lastSync', () => {
      const mockIndicator: SyncIndicator = {
        status: 'offline',
        message: 'Never synchronized',
        canManualSync: false
      };

      mockManagerInstance.getSyncIndicator.mockReturnValue(mockIndicator);

      render(
        <SyncStatusIndicator 
          playerId="player-1" 
          showDetails={true}
        />
      );

      expect(screen.getByText('Never')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading state when indicator is null', () => {
      mockManagerInstance.getSyncIndicator.mockReturnValue(null);

      render(<SyncStatusIndicator playerId="player-1" />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.getByText('⚪')).toBeInTheDocument();
    });
  });

  describe('Status Updates', () => {
    it('should update status periodically', async () => {
      const mockIndicator1: SyncIndicator = {
        status: 'offline',
        message: 'Offline',
        canManualSync: false
      };

      const mockIndicator2: SyncIndicator = {
        status: 'online',
        message: 'All changes synchronized',
        canManualSync: true
      };

      mockManagerInstance.getSyncIndicator
        .mockReturnValueOnce(mockIndicator1)
        .mockReturnValue(mockIndicator2);

      render(<SyncStatusIndicator playerId="player-1" />);

      expect(screen.getByText('Offline')).toBeInTheDocument();

      // Wait for status update (mocked setInterval)
      await waitFor(() => {
        expect(mockManagerInstance.getSyncIndicator).toHaveBeenCalledTimes(2);
      }, { timeout: 2000 });
    });
  });
});