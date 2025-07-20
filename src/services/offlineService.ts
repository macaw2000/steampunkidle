/**
 * Offline detection and management service
 * Provides offline mode detection and appropriate UI states
 */

import { NetworkUtils } from '../utils/networkUtils';

export interface OfflineState {
  isOffline: boolean;
  lastOnlineTime: Date | null;
  offlineDuration: number; // in milliseconds
}

export class OfflineService {
  private static instance: OfflineService;
  private listeners: Set<(state: OfflineState) => void> = new Set();
  private currentState: OfflineState = {
    isOffline: !NetworkUtils.isOnline(),
    lastOnlineTime: NetworkUtils.isOnline() ? new Date() : null,
    offlineDuration: 0,
  };
  private offlineStartTime: Date | null = null;
  private updateInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.initializeNetworkListeners();
    this.startOfflineDurationTracking();
  }

  static getInstance(): OfflineService {
    if (!OfflineService.instance) {
      OfflineService.instance = new OfflineService();
    }
    return OfflineService.instance;
  }

  /**
   * Get current offline state
   */
  getState(): OfflineState {
    return { ...this.currentState };
  }

  /**
   * Check if currently offline
   */
  isOffline(): boolean {
    return this.currentState.isOffline;
  }

  /**
   * Check if currently online
   */
  isOnline(): boolean {
    return !this.currentState.isOffline;
  }

  /**
   * Get offline duration in milliseconds
   */
  getOfflineDuration(): number {
    if (!this.currentState.isOffline) {
      return 0;
    }
    
    if (this.offlineStartTime) {
      return Date.now() - this.offlineStartTime.getTime();
    }
    
    return this.currentState.offlineDuration;
  }

  /**
   * Subscribe to offline state changes
   */
  subscribe(listener: (state: OfflineState) => void): () => void {
    this.listeners.add(listener);
    
    // Immediately call with current state
    listener(this.getState());
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Wait for network to come back online
   */
  async waitForOnline(timeout: number = 30000): Promise<void> {
    if (this.isOnline()) {
      return;
    }

    return NetworkUtils.waitForOnline(timeout);
  }

  /**
   * Test network connectivity by making a lightweight request
   */
  async testConnectivity(): Promise<boolean> {
    try {
      // Use a lightweight endpoint or a known reliable service
      const response = await NetworkUtils.fetchWithRetry('/api/health', {
        method: 'HEAD',
      }, {
        timeout: 5000,
        retries: 1,
      });
      
      return response.ok;
    } catch (error) {
      console.warn('Connectivity test failed:', error);
      return false;
    }
  }

  /**
   * Initialize network event listeners
   */
  private initializeNetworkListeners(): void {
    NetworkUtils.onNetworkStatusChange((isOnline) => {
      this.updateOfflineState(!isOnline);
    });
  }

  /**
   * Start tracking offline duration
   */
  private startOfflineDurationTracking(): void {
    this.updateInterval = setInterval(() => {
      if (this.currentState.isOffline) {
        this.updateOfflineDuration();
      }
    }, 1000); // Update every second
  }

  /**
   * Update offline state and notify listeners
   */
  private updateOfflineState(isOffline: boolean): void {
    const wasOffline = this.currentState.isOffline;
    
    if (isOffline && !wasOffline) {
      // Going offline
      this.offlineStartTime = new Date();
      this.currentState = {
        isOffline: true,
        lastOnlineTime: this.currentState.lastOnlineTime,
        offlineDuration: 0,
      };
      
      console.warn('Network went offline');
      
    } else if (!isOffline && wasOffline) {
      // Coming back online
      const now = new Date();
      this.currentState = {
        isOffline: false,
        lastOnlineTime: now,
        offlineDuration: 0,
      };
      this.offlineStartTime = null;
      
      console.log('Network came back online');
    }

    // Notify all listeners
    this.notifyListeners();
  }

  /**
   * Update offline duration
   */
  private updateOfflineDuration(): void {
    if (this.currentState.isOffline && this.offlineStartTime) {
      this.currentState.offlineDuration = Date.now() - this.offlineStartTime.getTime();
      this.notifyListeners();
    }
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in offline state listener:', error);
      }
    });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.listeners.clear();
  }
}

export const offlineService = OfflineService.getInstance();