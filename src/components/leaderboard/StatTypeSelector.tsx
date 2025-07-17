/**
 * Stat type selector component for leaderboards
 * Allows filtering by different stat categories
 */

import React from 'react';
import { LeaderboardStatType } from '../../types/leaderboard';
import { getStatTypeDisplayName } from '../../services/leaderboardService';
import './StatTypeSelector.css';

interface StatTypeSelectorProps {
  availableStatTypes: LeaderboardStatType[];
  selectedStatType: LeaderboardStatType;
  onStatTypeChange: (statType: LeaderboardStatType) => void;
}

const StatTypeSelector: React.FC<StatTypeSelectorProps> = ({
  availableStatTypes,
  selectedStatType,
  onStatTypeChange,
}) => {
  const getStatTypeIcon = (statType: LeaderboardStatType): string => {
    const icons: Record<LeaderboardStatType, string> = {
      level: '⭐',
      totalExperience: '📈',
      craftingLevel: '🔧',
      harvestingLevel: '⛏️',
      combatLevel: '⚔️',
      currency: '💰',
      itemsCreated: '🛠️',
      zonesCompleted: '🗺️',
      dungeonsCompleted: '🏰',
      guildLevel: '🏛️',
    };
    return icons[statType] || '📊';
  };

  const getStatTypeDescription = (statType: LeaderboardStatType): string => {
    const descriptions: Record<LeaderboardStatType, string> = {
      level: 'Overall character progression',
      totalExperience: 'Total experience gained',
      craftingLevel: 'Steampunk crafting mastery',
      harvestingLevel: 'Resource gathering expertise',
      combatLevel: 'Battle prowess and skill',
      currency: 'Steam Coins accumulated',
      itemsCreated: 'Items crafted and created',
      zonesCompleted: 'Exploration achievements',
      dungeonsCompleted: 'Group content mastery',
      guildLevel: 'Guild progression level',
    };
    return descriptions[statType] || 'Player ranking';
  };

  return (
    <div className="stat-type-selector">
      <div className="selector-header">
        <h3>📊 Choose Category</h3>
        <p>Select a stat to view rankings</p>
      </div>

      <div className="stat-type-grid">
        {availableStatTypes.map((statType) => (
          <button
            key={statType}
            className={`stat-type-button ${
              selectedStatType === statType ? 'selected' : ''
            }`}
            onClick={() => onStatTypeChange(statType)}
            title={getStatTypeDescription(statType)}
          >
            <div className="stat-type-icon">
              {getStatTypeIcon(statType)}
            </div>
            <div className="stat-type-info">
              <div className="stat-type-name">
                {getStatTypeDisplayName(statType)}
              </div>
              <div className="stat-type-description">
                {getStatTypeDescription(statType)}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default StatTypeSelector;