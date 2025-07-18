/**
 * Harvesting Rewards Component
 * Displays rewards earned from harvesting activities
 */

import React, { useState, useEffect } from 'react';
import { HarvestingReward, ResourceRarity } from '../../types/harvesting';
import { harvestingService } from '../../services/harvestingService';
import './HarvestingRewards.css';

interface HarvestingRewardsProps {
  rewards: HarvestingReward[];
  onClose: () => void;
  visible: boolean;
}

const HarvestingRewards: React.FC<HarvestingRewardsProps> = ({
  rewards,
  onClose,
  visible
}) => {
  const [animatedRewards, setAnimatedRewards] = useState<HarvestingReward[]>([]);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (visible && rewards.length > 0) {
      // Animate rewards appearing one by one
      setAnimatedRewards([]);
      setShowDetails(false);
      
      rewards.forEach((reward, index) => {
        setTimeout(() => {
          setAnimatedRewards(prev => [...prev, reward]);
        }, index * 200);
      });

      // Show details after all rewards are animated
      setTimeout(() => {
        setShowDetails(true);
      }, rewards.length * 200 + 500);
    }
  }, [visible, rewards]);

  if (!visible) return null;

  const getRarityClass = (rarity: ResourceRarity): string => {
    switch (rarity) {
      case ResourceRarity.COMMON:
        return 'common';
      case ResourceRarity.UNCOMMON:
        return 'uncommon';
      case ResourceRarity.RARE:
        return 'rare';
      case ResourceRarity.LEGENDARY:
        return 'legendary';
      default:
        return 'common';
    }
  };

  const getRarityColor = (rarity: ResourceRarity): string => {
    switch (rarity) {
      case ResourceRarity.COMMON:
        return '#ffffff';
      case ResourceRarity.UNCOMMON:
        return '#1eff00';
      case ResourceRarity.RARE:
        return '#0070dd';
      case ResourceRarity.LEGENDARY:
        return '#a335ee';
      default:
        return '#ffffff';
    }
  };

  const getTotalValue = (): number => {
    return rewards.reduce((total, reward) => {
      const resource = harvestingService.getResource(reward.itemId);
      return total + (resource?.value || 0) * reward.quantity;
    }, 0);
  };

  const getRareCount = (): number => {
    return rewards.filter(reward => reward.isRare).length;
  };

  return (
    <div className="rewards-overlay">
      <div className="rewards-modal">
        <div className="rewards-header">
          <h2>🎉 Harvesting Complete!</h2>
          <p>You've gathered valuable resources and treasures!</p>
        </div>

        <div className="rewards-content">
          <div className="rewards-grid">
            {animatedRewards.map((reward, index) => {
              const resource = harvestingService.getResource(reward.itemId);
              if (!resource) return null;

              return (
                <div
                  key={`${reward.itemId}-${index}`}
                  className={`reward-item ${getRarityClass(reward.rarity)} ${reward.isRare ? 'rare-glow' : ''}`}
                  style={{
                    animationDelay: `${index * 0.2}s`,
                    borderColor: getRarityColor(reward.rarity)
                  }}
                >
                  <div className="reward-icon">
                    {resource.icon}
                  </div>
                  <div className="reward-info">
                    <h4 style={{ color: getRarityColor(reward.rarity) }}>
                      {resource.name}
                    </h4>
                    <div className="reward-quantity">
                      x{reward.quantity}
                    </div>
                    <div className="reward-value">
                      💰 {(resource.value * reward.quantity).toLocaleString()}
                    </div>
                  </div>
                  {reward.isRare && (
                    <div className="rare-indicator">
                      ✨ {reward.rarity.toUpperCase()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {showDetails && (
            <div className="rewards-summary">
              <div className="summary-stats">
                <div className="summary-stat">
                  <span className="stat-label">Total Items:</span>
                  <span className="stat-value">{rewards.length}</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">Total Value:</span>
                  <span className="stat-value">💰 {getTotalValue().toLocaleString()}</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">Rare Finds:</span>
                  <span className="stat-value rare-text">{getRareCount()}</span>
                </div>
              </div>

              {getRareCount() > 0 && (
                <div className="rare-celebration">
                  <div className="celebration-text">
                    🌟 Exceptional Discovery! 🌟
                  </div>
                  <p>You've found rare treasures that will be invaluable for crafting!</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rewards-actions">
          <button className="collect-btn" onClick={onClose}>
            Collect All Rewards
          </button>
        </div>
      </div>
    </div>
  );
};

export default HarvestingRewards;