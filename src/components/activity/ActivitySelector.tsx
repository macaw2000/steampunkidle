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
  const dispatch = useDispatch();
  const { character } = useSelector((state: RootState) => state.game);
  const { user } = useSelector((state: RootState) => state.auth);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleActivitySwitch = async (activityType: ActivityType) => {
    if (!user?.userId || !character || switching) return;

    setSwitching(true);
    setError(null);

    try {
      const result = await ActivityService.switchActivity(user.userId, activityType);
      
      // Update character in Redux store
      dispatch(setCharacter(result.character));
      
      // Show success message if there were previous rewards
      if (result.previousActivityRewards && result.previousActivityRewards.length > 0) {
        console.log('Previous activity rewards:', result.previousActivityRewards);
        // TODO: Show rewards notification
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch activity');
    } finally {
      setSwitching(false);
    }
  };

  const getActivityInfo = (activityType: ActivityType) => {
    return ActivityService.getActivityDisplayInfo(activityType);
  };

  const getActivityEfficiency = (activityType: ActivityType) => {
    if (!character) return 1;
    return ActivityService.calculateActivityEfficiency(character, activityType);
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
          const info = getActivityInfo(activityType);
          const efficiency = getActivityEfficiency(activityType);
          const isCurrent = isCurrentActivity(activityType);
          
          return (
            <div
              key={activityType}
              className={`activity-card ${isCurrent ? 'active' : ''} ${switching ? 'disabled' : ''}`}
              onClick={() => !switching && !isCurrent && handleActivitySwitch(activityType)}
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

              {switching && (
                <div className="switching-overlay">
                  <div className="loading-spinner">⚙️</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {character.currentActivity && (
        <div className="current-activity-status">
          <h4>Current Activity Status</h4>
          <p>
            {ActivityService.getActivityStatusMessage({
              activityType: character.currentActivity.type,
              startedAt: new Date(character.currentActivity.startedAt),
              minutesActive: Math.floor(
                (Date.now() - new Date(character.currentActivity.startedAt).getTime()) / (1000 * 60)
              ),
              progressPercentage: character.currentActivity.progress,
              potentialRewards: character.currentActivity.rewards,
            })}
          </p>
        </div>
      )}
    </div>
  );
};

export default ActivitySelector;