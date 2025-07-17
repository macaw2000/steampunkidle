/**
 * Activity Progress Component - Shows real-time activity progress and rewards
 */

import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store/store';
import { ActivityService, ActivityProgress as ActivityProgressType } from '../../services/activityService';
import { setActivityProgress, setError } from '../../store/slices/gameSlice';
import RealTimeProgressTracker from '../progress/RealTimeProgressTracker';
import './ActivityProgress.css';

const ActivityProgress: React.FC = () => {
  const dispatch = useDispatch();
  const { character, activityProgress } = useSelector((state: RootState) => state.game);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch activity progress on component mount and periodically
  useEffect(() => {
    if (!character) return;

    const fetchProgress = async () => {
      setIsLoading(true);
      try {
        const progress = await ActivityService.getActivityProgress(character.userId);
        dispatch(setActivityProgress(progress));
      } catch (error) {
        console.error('Failed to fetch activity progress:', error);
        dispatch(setError(error instanceof Error ? error.message : 'Failed to fetch progress'));
      } finally {
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchProgress();

    // Set up periodic updates every 30 seconds
    const interval = setInterval(fetchProgress, 30000);

    return () => clearInterval(interval);
  }, [character, dispatch]);

  // Real-time progress updates every second
  useEffect(() => {
    if (!activityProgress) return;

    const updateProgress = () => {
      const startTime = new Date(activityProgress.startedAt).getTime();
      const currentTime = Date.now();
      const timeDiff = currentTime - startTime;
      const minutesActive = Math.floor(timeDiff / (1000 * 60));
      const progressPercentage = Math.min((minutesActive / 60) * 100, 100);

      // Update progress locally for real-time feel
      const updatedProgress: ActivityProgressType = {
        ...activityProgress,
        minutesActive,
        progressPercentage,
      };

      dispatch(setActivityProgress(updatedProgress));
    };

    // Update every second
    const interval = setInterval(updateProgress, 1000);

    return () => clearInterval(interval);
  }, [activityProgress, dispatch]);

  if (!character) {
    return null;
  }

  if (isLoading && !activityProgress) {
    return (
      <div className="activity-progress">
        <div className="activity-progress__loading">
          Loading activity progress...
        </div>
      </div>
    );
  }

  if (!activityProgress) {
    return (
      <div className="activity-progress">
        <div className="activity-progress__empty">
          <div className="activity-progress__empty-icon">⚡</div>
          <h3>No Active Activity</h3>
          <p>Select an activity to start earning rewards!</p>
        </div>
      </div>
    );
  }

  const activityInfo = ActivityService.getActivityDisplayInfo(activityProgress.activityType);
  const statusMessage = ActivityService.getActivityStatusMessage(activityProgress);
  const durationFormatted = ActivityService.formatActivityDuration(activityProgress.minutesActive);
  const nextMilestone = ActivityService.calculateNextRewardMilestone(activityProgress);

  return (
    <div className="activity-progress">
      {/* Real-time Progress Tracker */}
      <RealTimeProgressTracker className="activity-progress__real-time" />
      
      {/* Traditional Progress Display (fallback/detailed view) */}
      <div className="activity-progress__traditional">
        <div className="activity-progress__header">
          <div className="activity-progress__icon">{activityInfo.icon}</div>
          <div className="activity-progress__info">
            <h3 className="activity-progress__title">{activityInfo.name}</h3>
            <p className="activity-progress__status">{statusMessage}</p>
          </div>
        </div>

        <div className="activity-progress__bar-container">
          <div className="activity-progress__bar">
            <div 
              className="activity-progress__bar-fill"
              style={{ width: `${Math.min(activityProgress.progressPercentage, 100)}%` }}
            />
          </div>
          <div className="activity-progress__percentage">
            {Math.floor(activityProgress.progressPercentage)}%
          </div>
        </div>

        <div className="activity-progress__stats">
          <div className="activity-progress__stat">
            <span className="activity-progress__stat-label">Time Active</span>
            <span className="activity-progress__stat-value">{durationFormatted}</span>
          </div>
          <div className="activity-progress__stat">
            <span className="activity-progress__stat-label">Next Milestone</span>
            <span className="activity-progress__stat-value">
              {nextMilestone.timeRemaining > 0 
                ? `${nextMilestone.timeRemaining}m` 
                : 'Reached!'
              }
            </span>
          </div>
        </div>

        {activityProgress.potentialRewards.length > 0 && (
          <div className="activity-progress__rewards">
            <h4 className="activity-progress__rewards-title">Current Rewards</h4>
            <div className="activity-progress__rewards-list">
              {activityProgress.potentialRewards.map((reward, index) => (
                <div key={index} className="activity-progress__reward">
                  <span className="activity-progress__reward-icon">
                    {reward.type === 'experience' ? '⭐' : 
                     reward.type === 'currency' ? '💰' : 
                     reward.type === 'resource' ? '📦' : '🎁'}
                  </span>
                  <span className="activity-progress__reward-amount">
                    +{reward.amount.toLocaleString()}
                  </span>
                  <span className="activity-progress__reward-type">
                    {reward.type === 'experience' ? 'XP' :
                     reward.type === 'currency' ? 'Gold' :
                     reward.type === 'resource' ? 'Resources' : 'Items'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {nextMilestone.timeRemaining > 0 && nextMilestone.rewardPreview.length > 0 && (
          <div className="activity-progress__milestone">
            <h4 className="activity-progress__milestone-title">
              Next Milestone ({nextMilestone.nextMilestoneMinutes}m)
            </h4>
            <div className="activity-progress__milestone-rewards">
              {nextMilestone.rewardPreview.map((reward, index) => (
                <div key={index} className="activity-progress__milestone-reward">
                  <span className="activity-progress__reward-icon">
                    {reward.type === 'experience' ? '⭐' : 
                     reward.type === 'currency' ? '💰' : 
                     reward.type === 'resource' ? '📦' : '🎁'}
                  </span>
                  <span className="activity-progress__reward-amount">
                    +{reward.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="activity-progress__efficiency">
          <div className="activity-progress__efficiency-info">
            <span className="activity-progress__efficiency-label">Efficiency:</span>
            <span className="activity-progress__efficiency-value">
              {(ActivityService.calculateActivityEfficiency(character, activityProgress.activityType) * 100).toFixed(0)}%
            </span>
          </div>
          <p className="activity-progress__efficiency-tip">
            Increase your {activityInfo.primaryStat} to improve efficiency!
          </p>
        </div>
      </div>
    </div>
  );
};

export default ActivityProgress;