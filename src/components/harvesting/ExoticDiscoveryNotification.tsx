/**
 * Exotic Discovery Notification Component
 * Shows exciting notifications when players discover rare exotic items
 */

import React, { useEffect, useState } from 'react';
import { ExoticItem } from '../../types/harvesting';
import './ExoticDiscoveryNotification.css';

interface ExoticDiscoveryNotificationProps {
  exoticItem: ExoticItem | null;
  visible: boolean;
  onClose: () => void;
}

const ExoticDiscoveryNotification: React.FC<ExoticDiscoveryNotificationProps> = ({
  exoticItem,
  visible,
  onClose
}) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (visible && exoticItem) {
      setIsAnimating(true);
      
      // Auto-close after 5 seconds
      const timer = setTimeout(() => {
        handleClose();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [visible, exoticItem]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      onClose();
    }, 300); // Wait for animation to complete
  };

  if (!visible || !exoticItem) {
    return null;
  }

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'rare': return '#ffd700';
      case 'epic': return '#a335ee';
      case 'legendary': return '#ff8000';
      default: return '#ffd700';
    }
  };

  const getRarityGlow = (rarity: string) => {
    switch (rarity) {
      case 'rare': return '0 0 20px rgba(255, 215, 0, 0.6)';
      case 'epic': return '0 0 20px rgba(163, 53, 238, 0.6)';
      case 'legendary': return '0 0 20px rgba(255, 128, 0, 0.6)';
      default: return '0 0 20px rgba(255, 215, 0, 0.6)';
    }
  };

  return (
    <div className={`exotic-notification-overlay ${isAnimating ? 'show' : ''}`}>
      <div 
        className={`exotic-notification ${isAnimating ? 'animate' : ''}`}
        style={{
          borderColor: getRarityColor(exoticItem.rarity),
          boxShadow: getRarityGlow(exoticItem.rarity)
        }}
      >
        <div className="notification-header">
          <div className="discovery-title">
            <span className="sparkle">✨</span>
            <h2>EXOTIC DISCOVERY!</h2>
            <span className="sparkle">✨</span>
          </div>
          <button className="close-notification" onClick={handleClose}>×</button>
        </div>

        <div className="exotic-item-display">
          <div 
            className="item-icon"
            style={{ color: getRarityColor(exoticItem.rarity) }}
          >
            {exoticItem.icon}
          </div>
          
          <div className="item-details">
            <h3 
              className="item-name"
              style={{ color: getRarityColor(exoticItem.rarity) }}
            >
              {exoticItem.name}
            </h3>
            <p className="item-rarity">
              {exoticItem.rarity.toUpperCase()} TREASURE
            </p>
            <p className="item-description">
              {exoticItem.description}
            </p>
            <div className="item-value">
              <span>Value: </span>
              <span className="value-amount">{exoticItem.value.toLocaleString()} coins</span>
            </div>
          </div>
        </div>

        <div className="celebration-message">
          <p>🎉 Congratulations on this incredible find! 🎉</p>
          <p className="rarity-message">
            {exoticItem.rarity === 'legendary' && "This is an extremely rare legendary treasure!"}
            {exoticItem.rarity === 'epic' && "You've discovered an epic treasure!"}
            {exoticItem.rarity === 'rare' && "A rare treasure has been found!"}
          </p>
        </div>

        <div className="notification-actions">
          <button className="celebrate-btn" onClick={handleClose}>
            Amazing! 🎊
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExoticDiscoveryNotification;