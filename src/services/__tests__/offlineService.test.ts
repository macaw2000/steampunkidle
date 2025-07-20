/**
 * Tests for OfflineService
 */

import { OfflineService } from '../offlineService';

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

// Mock NetworkUtils
jest.mock('../../utils/networkUtils', () => ({
  NetworkUtils: {
    isOnline: jest.fn(() => navigator.onLine),
    onNetworkStatusChange: jest.fn((callback) => {
      // Store callback for manual triggering in tests
      (global as any).mockNetworkCallback = callback;
      return jest.fn(); // Return cleanup function
    }),
    waitForOnline: jest.fn(() => Promise.resolve()),
    fetchWithRetry: jest.fn(() => Promise.resolve({ ok: true })),
  },
}));

describe('OfflineService', () => {
  let offlineService: OfflineService;

  beforeEach(() => {
    // Reset navigator.onLine to true
    (navigator as any).onLine = true;
    
    // Reset singleton instance
    (OfflineService as any).instance = undefined;
    offlineService = OfflineService.getInstance();
    jest.clearAllMocks();
  });

  afterEach(() => {
    offlineService.destroy();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = OfflineService.getInstance();
      const instance2 = OfflineService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('initial state', () => {
    it('should start with online state when navigator.onLine is true', () => {
      const state = offlineService.getState();
      expect(state.isOffline).toBe(false);
      expect(state.offlineDuration).toBe(0);
    });
  });

  describe('state management', () => {
    it('should update state when going offline', () => {
      const mockCallback = jest.fn();
      offlineService.subscribe(mockCallback);

      // Simulate going offline
      if ((global as any).mockNetworkCallback) {
        (global as any).mockNetworkCallback(false);
      }

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          isOffline: true,
          offlineDuration: 0,
        })
      );
    });

    it('should update state when coming back online', () => {
      const mockCallback = jest.fn();
      offlineService.subscribe(mockCallback);

      // Simulate going offline then online
      if ((global as any).mockNetworkCallback) {
        (global as any).mockNetworkCallback(false);
        (global as any).mockNetworkCallback(true);
      }

      expect(mockCallback).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isOffline: false,
          offlineDuration: 0,
        })
      );
    });
  });

  describe('subscription management', () => {
    it('should call listener immediately on subscription', () => {
      const mockCallback = jest.fn();
      offlineService.subscribe(mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          isOffline: false,
        })
      );
    });

    it('should remove listener when unsubscribe is called', () => {
      const mockCallback = jest.fn();
      const unsubscribe = offlineService.subscribe(mockCallback);

      // Clear initial call
      mockCallback.mockClear();

      unsubscribe();

      // Simulate network change
      if ((global as any).mockNetworkCallback) {
        (global as any).mockNetworkCallback(false);
      }

      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('utility methods', () => {
    it('should return correct online/offline status', () => {
      expect(offlineService.isOnline()).toBe(true);
      expect(offlineService.isOffline()).toBe(false);

      // Simulate going offline
      if ((global as any).mockNetworkCallback) {
        (global as any).mockNetworkCallback(false);
      }

      expect(offlineService.isOnline()).toBe(false);
      expect(offlineService.isOffline()).toBe(true);
    });

    it('should return zero duration when online', () => {
      expect(offlineService.getOfflineDuration()).toBe(0);
    });
  });

  describe('connectivity testing', () => {
    it('should test connectivity successfully', async () => {
      const result = await offlineService.testConnectivity();
      expect(result).toBe(true);
    });

    it('should handle connectivity test failure', async () => {
      const { NetworkUtils } = require('../../utils/networkUtils');
      NetworkUtils.fetchWithRetry.mockRejectedValueOnce(new Error('Network error'));

      const result = await offlineService.testConnectivity();
      expect(result).toBe(false);
    });
  });
});