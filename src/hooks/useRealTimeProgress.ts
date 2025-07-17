/**
 * Custom hook for managing real-time progress updates
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store/store';
import { setActivityProgress, addExperience, updateCurrency, setOnlineStatus } from '../store/slices/gameSlice';
import WebSocketService, { WebSocketMessage, GameWebSocketMessage, ProgressUpdateMessage, NotificationMessage, AchievementMessage, LevelUpMessage } from '../services/websocketService';

export interface UseRealTimeProgressOptions {
  enableNotifications?: boolean;
  updateInterval?: number; // in milliseconds
  autoReconnect?: boolean;
}

export interface RealTimeProgressState {
  isConnected: boolean;
  lastUpdate: Date | null;
  connectionAttempts: number;
  notifications: any[];
  achievements: any[];
}

export const useRealTimeProgress = (options: UseRealTimeProgressOptions = {}) => {
  const {
    enableNotifications = true,
    updateInterval = 1000,
    autoReconnect = true
  } = options;

  const dispatch = useDispatch();
  const { character, activityProgress } = useSelector((state: RootState) => state.game);
  
  const wsService = WebSocketService.getInstance();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const updateIntervalRef = useRef<NodeJS.Timeout>();
  
  const [state, setState] = React.useState<RealTimeProgressState>({
    isConnected: false,
    lastUpdate: null,
    connectionAttempts: 0,
    notifications: [],
    achievements: []
  });

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    const gameMessage = message as GameWebSocketMessage;
    setState(prev => ({ ...prev, lastUpdate: new Date() }));

    switch (gameMessage.type) {
      case 'progress_update':
        const progressMsg = gameMessage as ProgressUpdateMessage;
        dispatch(setActivityProgress(progressMsg.data.activityProgress));
        if (progressMsg.data.experienceGained) {
          dispatch(addExperience(progressMsg.data.experienceGained));
        }
        if (progressMsg.data.currencyGained) {
          dispatch(updateCurrency(progressMsg.data.currencyGained));
        }
        break;

      case 'notification':
        const notificationMsg = gameMessage as NotificationMessage;
        if (enableNotifications) {
          setState(prev => ({
            ...prev,
            notifications: [...prev.notifications, notificationMsg.data]
          }));
        }
        break;

      case 'achievement':
        const achievementMsg = gameMessage as AchievementMessage;
        setState(prev => ({
          ...prev,
          achievements: [...prev.achievements, achievementMsg.data],
          notifications: enableNotifications 
            ? [...prev.notifications, {
                id: `achievement-${achievementMsg.data.id}`,
                type: 'achievement',
                title: 'Achievement Unlocked!',
                message: achievementMsg.data.title,
                timestamp: achievementMsg.timestamp,
                data: achievementMsg.data
              }]
            : prev.notifications
        }));
        break;

      case 'level_up':
        const levelUpMsg = gameMessage as LevelUpMessage;
        if (enableNotifications) {
          setState(prev => ({
            ...prev,
            notifications: [...prev.notifications, {
              id: `levelup-${Date.now()}`,
              type: 'level',
              title: 'Level Up!',
              message: `Congratulations! You reached level ${levelUpMsg.data.newLevel}!`,
              timestamp: levelUpMsg.timestamp,
              data: levelUpMsg.data
            }]
          }));
        }
        break;
    }
  }, [dispatch, enableNotifications]);

  // Handle connection status changes
  const handleConnectionStatus = useCallback((connected: boolean) => {
    setState(prev => ({
      ...prev,
      isConnected: connected,
      connectionAttempts: connected ? 0 : prev.connectionAttempts + 1
    }));
    dispatch(setOnlineStatus(connected));

    if (!connected && autoReconnect && character) {
      // Schedule reconnection attempt
      const delay = Math.min(1000 * Math.pow(2, state.connectionAttempts), 30000); // Max 30 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, delay);
    }
  }, [dispatch, autoReconnect, character, state.connectionAttempts]);

  // Connect to WebSocket
  const connectWebSocket = useCallback(async () => {
    if (!character) return;

    try {
      await wsService.connect(character.userId);
      
      // Subscribe to messages and connection status
      const unsubscribeMessages = wsService.subscribe('*', handleWebSocketMessage);
      const unsubscribeStatus = wsService.onConnectionStatusChange(handleConnectionStatus);

      return () => {
        if (unsubscribeMessages) unsubscribeMessages();
        if (unsubscribeStatus) unsubscribeStatus();
      };
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      setState(prev => ({ ...prev, isConnected: false }));
    }
  }, [character, handleWebSocketMessage, handleConnectionStatus, wsService]);

  // Local progress updates for smooth animation
  const updateLocalProgress = useCallback(() => {
    if (!activityProgress || !character) return;

    const startTime = new Date(activityProgress.startedAt).getTime();
    const currentTime = Date.now();
    const timeDiff = currentTime - startTime;
    const minutesActive = Math.floor(timeDiff / (1000 * 60));
    const progressPercentage = Math.min((minutesActive / 60) * 100, 100);

    // Only update if there's a meaningful change
    if (Math.abs(progressPercentage - activityProgress.progressPercentage) > 0.1) {
      const updatedProgress = {
        ...activityProgress,
        minutesActive,
        progressPercentage,
      };

      dispatch(setActivityProgress(updatedProgress));
    }
  }, [activityProgress, character, dispatch]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!character) return;

    const cleanup = connectWebSocket();

    return () => {
      cleanup.then(fn => fn?.());
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [character, connectWebSocket]);

  // Set up local progress updates
  useEffect(() => {
    if (!activityProgress) return;

    updateIntervalRef.current = setInterval(updateLocalProgress, updateInterval);

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [activityProgress, updateLocalProgress, updateInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
      wsService.disconnect();
    };
  }, [wsService]);

  // Utility functions
  const removeNotification = useCallback((notificationId: string) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.filter(n => n.id !== notificationId)
    }));
  }, []);

  const removeAchievement = useCallback((achievementId: string) => {
    setState(prev => ({
      ...prev,
      achievements: prev.achievements.filter(a => a.id !== achievementId)
    }));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setState(prev => ({
      ...prev,
      notifications: []
    }));
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (state.isConnected) {
      wsService.send(message);
    } else {
      console.warn('Cannot send message: WebSocket not connected');
    }
  }, [state.isConnected, wsService]);

  const reconnect = useCallback(() => {
    if (character) {
      connectWebSocket();
    }
  }, [character, connectWebSocket]);

  return {
    // State
    isConnected: state.isConnected,
    lastUpdate: state.lastUpdate,
    connectionAttempts: state.connectionAttempts,
    notifications: state.notifications,
    achievements: state.achievements,
    
    // Actions
    removeNotification,
    removeAchievement,
    clearAllNotifications,
    sendMessage,
    reconnect,
    
    // Computed values
    hasUnreadNotifications: state.notifications.length > 0,
    hasNewAchievements: state.achievements.length > 0,
    connectionStatus: state.isConnected ? 'connected' : 'disconnected',
  };
};

export default useRealTimeProgress;