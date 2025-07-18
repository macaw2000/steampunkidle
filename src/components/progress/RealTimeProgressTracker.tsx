/**
 * Real-time Progress Tracker Component
 * Displays live progress updates with animations and notifications
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store/store';
import { setActivityProgress, addExperience, updateCurrency, setOnlineStatus } from '../../store/slices/gameSlice';
import WebSocketService, { WebSocketMessage, GameWebSocketMessage, ProgressUpdateMessage, NotificationMessage, AchievementMessage, LevelUpMessage } from '../../services/websocketService';
import { ActivityService } from '../../services/activityService';
import NotificationToast from './NotificationToast';

import './RealTimeProgressTracker.css';

interface RealTimeProgressTrackerProps {
  className?: string;
}

const RealTimeProgressTracker: React.FC<RealTimeProgressTrackerProps> = ({ className }) => {
  const dispatch = useDispatch();
  const { character, activityProgress } = useSelector((state: RootState) => state.game);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [lastProgressUpdate, setLastProgressUpdate] = useState<Date | null>(null);

  const wsService = WebSocketService.getInstance();

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    const gameMessage = message as GameWebSocketMessage;
    
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
        setLastProgressUpdate(new Date());
        break;

      case 'notification':
        const notificationMsg = gameMessage as NotificationMessage;
        setNotifications(prev => [...prev, notificationMsg.data]);
        break;

      case 'achievement':
        const achievementMsg = gameMessage as AchievementMessage;
        setAchievements(prev => [...prev, achievementMsg.data]);
        // Also show as notification
        setNotifications(prev => [...prev, {
          id: `achievement-${achievementMsg.data.id}`,
          type: 'achievement',
          title: 'Achievement Unlocked!',
          message: achievementMsg.data.title,
          timestamp: achievementMsg.timestamp,
          data: achievementMsg.data
        }]);
        break;

      case 'level_up':
        const levelUpMsg = gameMessage as LevelUpMessage;
        setNotifications(prev => [...prev, {
          id: `levelup-${Date.now()}`,
          type: 'level',
          title: 'Level Up!',
          message: `Congratulations! You reached level ${levelUpMsg.data.newLevel}!`,
          timestamp: levelUpMsg.timestamp,
          data: levelUpMsg.data
        }]);
        break;
    }
  }, [dispatch]);

  // Handle connection status changes
  const handleConnectionStatus = useCallback((connected: boolean) => {
    setConnectionStatus(connected ? 'connected' : 'disconnected');
    dispatch(setOnlineStatus(connected));
  }, [dispatch]);

  // Initialize progress tracking (mock for development)
  useEffect(() => {
    if (!character || !character.currentActivity) {
      setConnectionStatus('disconnected');
      return;
    }

    // In development mode, simulate connection and progress
    if (process.env.NODE_ENV === 'development') {
      setConnectionStatus('connecting');
      
      // Simulate connection delay
      const connectTimer = setTimeout(() => {
        setConnectionStatus('connected');
        dispatch(setOnlineStatus(true));
        
        // Create initial activity progress
        const startTime = new Date(character.currentActivity.startedAt);
        const minutesActive = Math.floor((Date.now() - startTime.getTime()) / (1000 * 60));
        
        const initialProgress = {
          activityType: character.currentActivity.type,
          startedAt: startTime,
          minutesActive,
          progressPercentage: Math.min((minutesActive / 60) * 100, 100),
          potentialRewards: [
            {
              type: 'experience' as const,
              amount: Math.floor(minutesActive * 2),
              description: 'Experience gained from activity',
            },
            ...(minutesActive >= 5 ? [{
              type: 'currency' as const,
              amount: Math.floor(minutesActive * 0.5),
              description: 'Coins earned',
            }] : [])
          ],
        };
        
        dispatch(setActivityProgress(initialProgress));
      }, 1000);

      return () => {
        clearTimeout(connectTimer);
        setConnectionStatus('disconnected');
        dispatch(setOnlineStatus(false));
      };
    } else {
      // Production WebSocket connection
      setConnectionStatus('connecting');

      const connectWebSocket = async () => {
        try {
          await wsService.connect(character.userId);
          
          // Subscribe to messages
          const unsubscribeMessages = wsService.subscribe('*', handleWebSocketMessage);
          const unsubscribeStatus = wsService.onConnectionStatusChange(handleConnectionStatus);

          return () => {
            if (unsubscribeMessages) unsubscribeMessages();
            if (unsubscribeStatus) unsubscribeStatus();
          };
        } catch (error) {
          console.error('Failed to connect to WebSocket:', error);
          setConnectionStatus('disconnected');
        }
      };

      const cleanup = connectWebSocket();

      return () => {
        cleanup.then(fn => fn?.());
      };
    }
  }, [character, handleWebSocketMessage, handleConnectionStatus, wsService, dispatch]);

  // Clean up notifications after they're shown
  const removeNotification = useCallback((notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  }, []);

  // Clean up achievements after they're shown
  const removeAchievement = useCallback((achievementId: string) => {
    setAchievements(prev => prev.filter(a => a.id !== achievementId));
  }, []);

  // Real-time progress calculation for smooth updates
  useEffect(() => {
    if (!activityProgress || !character) return;

    const updateLocalProgress = () => {
      const startTime = new Date(activityProgress.startedAt).getTime();
      const currentTime = Date.now();
      const timeDiff = currentTime - startTime;
      const minutesActive = Math.floor(timeDiff / (1000 * 60));
      const secondsActive = Math.floor(timeDiff / 1000);
      
      // Calculate smooth progress percentage
      const progressPercentage = Math.min((minutesActive / 60) * 100, 100);
      
      // Update progress locally for smooth animation
      const updatedProgress = {
        ...activityProgress,
        minutesActive,
        progressPercentage,
        secondsActive, // Add seconds for smoother updates
      };

      dispatch(setActivityProgress(updatedProgress));
    };

    // Update every second for smooth progress
    const interval = setInterval(updateLocalProgress, 1000);

    return () => clearInterval(interval);
  }, [activityProgress, character, dispatch]);

  if (!character) {
    return null;
  }

  return (
    <div className={`real-time-progress-tracker ${className || ''}`}>
      {/* Connection Status Indicator */}
      <div className={`connection-status connection-status--${connectionStatus}`} role="status">
        <div className="connection-indicator">
          <div className="connection-dot" />
          <span className="connection-text">
            {connectionStatus === 'connecting' && 'Connecting...'}
            {connectionStatus === 'connected' && 'Live'}
            {connectionStatus === 'disconnected' && 'Offline'}
          </span>
        </div>
        {lastProgressUpdate && (
          <div className="last-update">
            Last update: {lastProgressUpdate.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Progress Status - Text Only */}
      {activityProgress && (
        <div className="progress-status-text">
          <p>Activity: {activityProgress.activityType}</p>
          <p>Progress: {Math.floor(activityProgress.progressPercentage)}%</p>
          <p><em>Visual progress shown in Current Operations section</em></p>
        </div>
      )}

      {/* Notification Toasts */}
      <div className="notification-container">
        {notifications.map((notification) => (
          <NotificationToast
            key={notification.id}
            notification={notification}
            onClose={() => removeNotification(notification.id)}
            autoClose={5000}
          />
        ))}
      </div>

      {/* Achievement Celebrations */}
      <div className="achievement-container">
        {achievements.map((achievement) => (
          <div
            key={achievement.id}
            className="achievement-celebration"
            onAnimationEnd={() => removeAchievement(achievement.id)}
          >
            <div className="achievement-content">
              <div className="achievement-icon">{achievement.icon}</div>
              <div className="achievement-text">
                <h3 className="achievement-title">{achievement.title}</h3>
                <p className="achievement-description">{achievement.description}</p>
                {achievement.rewards && achievement.rewards.length > 0 && (
                  <div className="achievement-rewards">
                    {achievement.rewards.map((reward: any, index: number) => (
                      <span key={index} className="achievement-reward">
                        +{reward.amount} {reward.type}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Real-time Stats Display */}
      {activityProgress && (
        <div className="real-time-stats">
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Active Time</span>
              <span className="stat-value">
                {ActivityService.formatActivityDuration(activityProgress.minutesActive)}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Progress</span>
              <span className="stat-value">
                {Math.floor(activityProgress.progressPercentage)}%
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Efficiency</span>
              <span className="stat-value">
                {(ActivityService.calculateActivityEfficiency(character, activityProgress.activityType) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RealTimeProgressTracker;