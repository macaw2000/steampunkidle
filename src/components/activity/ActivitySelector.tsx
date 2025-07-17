/**
 * Activity selector component for switching between crafting, harvesting, and combat
 */

import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store/store';
import { ActivityType } from '../../types/character';
import { ActivityService } from '../../services/activityService';
import { setCharacter } from '../../store/slices/gameSlice';
import './ActivitySelector.css';

const ActivitySelector: React.FC = () => {
  const { character } = useSelector((state: RootState) => state.game);
  const [error, setError] = useState<string | null>(null);

  // Simple error handling wrapper for ActivityService calls
  const safeGetActivityInfo = (activityType: ActivityType) => {
    try {
      return ActivityService.getActivityDisplayInfo(activityType);
    } catch (err) {
      console.error('Error getting activity info:', err);
      return {
        name: 'Unknown Activity',
        description: 'Activity information unavailable',
        icon: '❓',
        primaryStat: 'Unknown',
        rewards: ['Unknown'],
        steampunkFlavor: 'Activity details unavailable',
      };
    }
  };

  const safeGetActivityEfficiency = (activityType: ActivityType) => {
    try {
      if (!character) return 1;
      return ActivityService.calculateActivityEfficiency(character, activityType);
    } catch (err) {
      console.error('Error calculating efficiency:', err);
      return 1;
    }
  };

  const isCurrentActivity = (activityType: ActivityType) => {
    return character?.currentActivity?.type === activityType;
  };

  const activities: ActivityType[] = ['crafting', 'harvesting', 'combat'];

  if (!character) {
    return <div className="activity-selector">Loading character...</div>;
  }

  return (
    <div className="activity-selector">
      <h3>Select Activity</h3>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="activities-grid">
        {activities.map((activityType) => {
          const info = safeGetActivityInfo(activityType);
          const efficiency = safeGetActivityEfficiency(activityType);
          const isCurrent = isCurrentActivity(activityType);
          
          return (
            <div
              key={activityType}
              className={`activity-card ${isCurrent ? 'active' : ''}`}
            >
              <div className="activity-icon">{info.icon}</div>
              <div className="activity-name">{info.name}</div>
              <div className="activity-description">{info.description}</div>
              
              <div className="activity-stats">
                <div className="primary-stat">
                  Primary: {info.primaryStat}
                </div>
                <div className="efficiency">
                  Efficiency: {efficiency.toFixed(1)}x
                </div>
              </div>

              <div className="activity-rewards">
                <strong>Rewards:</strong>
                <ul>
                  {info.rewards.map((reward, index) => (
                    <li key={index}>{reward}</li>
                  ))}
                </ul>
              </div>

              <div className="steampunk-flavor">
                {info.steampunkFlavor}
              </div>

              {isCurrent && (
                <div className="current-activity-badge">
                  ⚡ Active
                </div>
              )}
            </div>
          );
        })}
      </div>

      {character.currentActivity && (
        <div className="current-activity-status">
          <h4>Current Activity Status</h4>
          <p>Current Activity: {character.currentActivity.type}</p>
        </div>
      )}
    </div>
  );
};

export default ActivitySelector;