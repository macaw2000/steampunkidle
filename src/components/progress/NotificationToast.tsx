/**
 * Notification Toast Component
 * Displays animated notifications for game events
 */

import React, { useEffect, useState } from 'react';
import { GameNotification } from '../../services/notificationService';
import './NotificationToast.css';

interface NotificationToastProps {
  notification: GameNotification | any; // Allow for extended notification types
  onClose: () => void;
  autoClose?: number; // Auto-close delay in milliseconds
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onClose,
  autoClose = 5000,
  position = 'top-right'
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Show animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Auto-close timer
  useEffect(() => {
    if (autoClose > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, autoClose);
      return () => clearTimeout(timer);
    }
  }, [autoClose]);

  const handleClose = () => {
    if (isClosing) return; // Prevent multiple calls
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300); // Match CSS animation duration
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'progress':
        return '⚡';
      case 'achievement':
        return '🏆';
      case 'level':
        return '⭐';
      case 'item':
        return '📦';
      case 'currency':
        return '💰';
      case 'skill':
        return '🔧';
      case 'general':
        return 'ℹ️';
      default:
        return '🔔';
    }
  };

  const getNotificationClass = (type: string) => {
    return `notification-toast--${type}`;
  };

  return (
    <div
      className={`
        notification-toast
        ${getNotificationClass(notification.type)}
        notification-toast--${position}
        ${isVisible ? 'notification-toast--visible' : ''}
        ${isClosing ? 'notification-toast--closing' : ''}
      `}
    >
      <div className="notification-content">
        <div className="notification-icon">
          {getNotificationIcon(notification.type)}
        </div>
        <div className="notification-text">
          <h4 className="notification-title">{notification.title}</h4>
          <p className="notification-message">{notification.message}</p>
          {notification.data && (
            <div className="notification-details">
              {notification.type === 'progress' && notification.data.experienceGained && (
                <span className="detail-item">+{notification.data.experienceGained} XP</span>
              )}
              {notification.type === 'progress' && notification.data.currencyGained && (
                <span className="detail-item">+{notification.data.currencyGained} Gold</span>
              )}
              {notification.type === 'achievement' && notification.data.rewards && (
                <div className="achievement-rewards">
                  {notification.data.rewards.map((reward: any, index: number) => (
                    <span key={index} className="detail-item">
                      +{reward.amount} {reward.type}
                    </span>
                  ))}
                </div>
              )}
              {notification.type === 'level' && notification.data.newLevel && (
                <span className="detail-item">Level {notification.data.newLevel}</span>
              )}
            </div>
          )}
        </div>
        <button
          className="notification-close"
          onClick={handleClose}
          aria-label="Close notification"
        >
          ×
        </button>
      </div>
      
      {/* Progress bar for auto-close */}
      {autoClose > 0 && (
        <div className="notification-progress" role="progressbar" aria-label="Auto-close progress">
          <div 
            className="notification-progress-bar"
            style={{ 
              animationDuration: `${autoClose}ms`,
              animationPlayState: isClosing ? 'paused' : 'running'
            }}
          />
        </div>
      )}
    </div>
  );
};

export default NotificationToast;