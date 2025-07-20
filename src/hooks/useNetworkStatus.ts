/**
 * Network status hook
 * Provides network state and utilities for components
 */

import { useState, useEffect, useCallback } from 'react';
import { offlineService, OfflineState } from '../services/offlineService';
import { NetworkUtils } from '../utils/networkUtils';

export interface NetworkStatus extends OfflineState {
  isOnline: boolean;
  testConnectivity: () => Promise<boolean>;
  waitForOnline: (timeout?: number) => Promise<void>;
}

export const useNetworkStatus = (): NetworkStatus => {
  const [offlineState, setOfflineState] = useState<OfflineState>(offlineService.getState());

  useEffect(() => {
    const unsubscribe = offlineService.subscribe(setOfflineState);
    return unsubscribe;
  }, []);

  const testConnectivity = useCallback(async (): Promise<boolean> => {
    return offlineService.testConnectivity();
  }, []);

  const waitForOnline = useCallback(async (timeout: number = 30000): Promise<void> => {
    return offlineService.waitForOnline(timeout);
  }, []);

  return {
    ...offlineState,
    isOnline: !offlineState.isOffline,
    testConnectivity,
    waitForOnline,
  };
};

export default useNetworkStatus;