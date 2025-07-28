/**
 * Harvesting Hub Component
 * Main interface for steampunk resource gathering activities
 */

import React, { useState, useEffect, useCallback } from 'react';
import { harvestingService } from '../../services/harvestingService';
import { serverTaskQueueService } from '../../services/serverTaskQueueService';
import { 
  HarvestingActivity, 
  HarvestingCategory, 
  HarvestingReward,
  PlayerHarvestingStats
} from '../../types/harvesting';
import { Task, TaskProgress, TaskCompletionResult } from '../../types/taskQueue';
import './HarvestingHub.css';

interface HarvestingHubProps {
  playerId: string;
  playerLevel: number;
  playerStats: {
    intelligence: number;
    dexterity: number;
    strength: number;
    perception: number;
  };
  onRewardsReceived: (rewards: HarvestingReward[]) => void;
  onClose?: () => void;
}

const HarvestingHub: React.FC<HarvestingHubProps> = ({
  playerId,
  playerLevel,
  playerStats,
  onRewardsReceived,
  onClose
}) => {
  const [selectedCategory, setSelectedCategory] = useState<HarvestingCategory>(HarvestingCategory.LITERARY);
  const [availableActivities, setAvailableActivities] = useState<HarvestingActivity[]>([]);
  const [harvestingStats, setHarvestingStats] = useState<PlayerHarvestingStats | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<HarvestingActivity | null>(null);
  const [activityRounds, setActivityRounds] = useState<{[key: string]: number | 'infinite'}>({});
  
  // Real-time progress tracking
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [taskProgress, setTaskProgress] = useState<TaskProgress | null>(null);
  const [queuedTasks, setQueuedTasks] = useState<Task[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [completionNotifications, setCompletionNotifications] = useState<TaskCompletionResult[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const updateQueueStatus = useCallback(() => {
    if (!playerId) return;

    try {
      const queueStatus = serverTaskQueueService.getQueueStatus(playerId);
      setCurrentTask(queueStatus.currentTask);
      setQueuedTasks(queueStatus.queuedTasks);
      setIsProcessing(queueStatus.isRunning);
    } catch (error) {
      console.error('Failed to update queue status:', error);
    }
  }, [playerId]);

  // Real-time progress tracking setup
  const setupRealTimeTracking = useCallback(() => {
    if (!playerId) return;

    // Update queue status every second
    const updateInterval = setInterval(() => {
      updateQueueStatus();
    }, 1000);

    // Listen for task completion events
    const handleTaskComplete = (result: TaskCompletionResult) => {
      console.log('Harvesting task completed:', result);
      
      // Add completion notification
      setCompletionNotifications(prev => [...prev, result]);
      setShowNotifications(true);
      
      // Auto-hide notification after 5 seconds
      setTimeout(() => {
        setCompletionNotifications(prev => prev.filter(n => n !== result));
      }, 5000);
      
      // Trigger rewards callback
      if (result.rewards && onRewardsReceived) {
        onRewardsReceived(result.rewards as HarvestingReward[]);
      }
      
      // Update queue status
      updateQueueStatus();
    };

    // Listen for progress updates
    const handleProgressUpdate = (progress: TaskProgress) => {
      setTaskProgress(progress);
    };

    serverTaskQueueService.onTaskComplete(playerId, handleTaskComplete);
    serverTaskQueueService.onProgress(playerId, handleProgressUpdate);

    return () => {
      clearInterval(updateInterval);
      serverTaskQueueService.removeCallbacks(playerId);
    };
  }, [playerId, onRewardsReceived, updateQueueStatus]);

  useEffect(() => {
    loadAvailableActivities();
    loadHarvestingStats();
    const cleanup = setupRealTimeTracking();
    return cleanup;
  }, [playerId, playerLevel, playerStats, setupRealTimeTracking]);

  const loadAvailableActivities = () => {
    const activities = harvestingService.getAvailableActivities(playerId, playerLevel, playerStats);
    setAvailableActivities(activities);
  };

  const loadHarvestingStats = () => {
    const stats = harvestingService.getPlayerStats(playerId);
    setHarvestingStats(stats);
  };

  const createFullPlayerStats = () => ({
    strength: playerStats.strength,
    dexterity: playerStats.dexterity,
    intelligence: playerStats.intelligence,
    vitality: playerStats.perception, // Use perception as vitality
    craftingSkills: {
      clockmaking: 1,
      engineering: 1,
      alchemy: 1,
      steamcraft: 1,
      level: 1,
      experience: 0
    },
    harvestingSkills: {
      mining: 1,
      foraging: 1,
      salvaging: 1,
      crystal_extraction: 1,
      level: 1,
      experience: 0
    },
    combatSkills: {
      melee: 1,
      ranged: 1,
      defense: 1,
      tactics: 1,
      level: 1,
      experience: 0
    }
  });

  const startHarvesting = (activity: HarvestingActivity, rounds: number | 'infinite' = 'infinite') => {
    try {
      // Start task immediately, replacing any current task
      const taskData = {
        ...activity,
        rounds: rounds,
        metadata: { rounds }
      };
      const fullPlayerStats = createFullPlayerStats();
      serverTaskQueueService.startHarvestingTask(playerId, taskData, fullPlayerStats);
      
      console.log(`Started ${activity.name} immediately with ${rounds === 'infinite' ? 'infinite' : rounds} rounds`);
      
      // Close the dialog after starting the activity
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Error starting harvesting:', error);
      alert('Failed to start harvesting activity');
    }
  };

  const addToQueue = (activity: HarvestingActivity, rounds: number | 'infinite' = 'infinite') => {
    try {
      // Add task to queue without interrupting current activity
      const taskData = {
        ...activity,
        rounds: rounds,
        metadata: { rounds, queued: true }
      };
      const fullPlayerStats = createFullPlayerStats();
      serverTaskQueueService.queueHarvestingTask(playerId, taskData, fullPlayerStats);
      
      console.log(`Added ${activity.name} to queue with ${rounds === 'infinite' ? 'infinite' : rounds} rounds`);
      
      // Close the dialog after adding to queue
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Error adding to queue:', error);
      alert('Failed to add activity to queue');
    }
  };

  const getRoundsForActivity = (activityId: string): number | 'infinite' => {
    return activityRounds[activityId] || 'infinite';
  };

  const setRoundsForActivity = (activityId: string, rounds: number | 'infinite') => {
    setActivityRounds(prev => ({
      ...prev,
      [activityId]: rounds
    }));
  };

  const formatTime = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getCategoryActivities = () => {
    return availableActivities.filter(activity => activity.category === selectedCategory);
  };

  const getCategoryDisplayName = (category: HarvestingCategory): string => {
    const names = {
      [HarvestingCategory.LITERARY]: 'Literary Pursuits',
      [HarvestingCategory.MECHANICAL]: 'Mechanical Tinkering',
      [HarvestingCategory.ALCHEMICAL]: 'Alchemical Studies',
      [HarvestingCategory.ARCHAEOLOGICAL]: 'Archaeological Expeditions',
      [HarvestingCategory.BOTANICAL]: 'Botanical Research',
      [HarvestingCategory.METALLURGICAL]: 'Metallurgical Mining',
      [HarvestingCategory.ELECTRICAL]: 'Electrical Experiments',
      [HarvestingCategory.AERONAUTICAL]: 'Aeronautical Adventures'
    };
    return names[category];
  };

  const canStartActivity = (activity: HarvestingActivity): boolean => {
    // All activities can be started - they'll be queued if needed
    return true;
  };

  return (
    <div className="harvesting-hub">
      <div className="harvesting-header">
        <h2>🔧 Steampunk Resource Harvesting</h2>
        <p>Gather materials and treasures through various Victorian-era activities</p>
      </div>

      {/* Real-time Progress Section */}
      {(currentTask || queuedTasks.length > 0) && (
        <div className="progress-section">
          <h3>🔄 Active Harvesting Operations</h3>
          
          {/* Current Task Progress */}
          {currentTask && (
            <div className="current-task-progress">
              <div className="task-header">
                <span className="task-icon">{currentTask.icon}</span>
                <div className="task-info">
                  <h4>{currentTask.name}</h4>
                  <p className="task-description">{currentTask.description}</p>
                </div>
                <div className="task-status">
                  {isProcessing ? (
                    <span className="status-active">🟢 Active</span>
                  ) : (
                    <span className="status-paused">🟡 Paused</span>
                  )}
                </div>
              </div>
              
              {taskProgress && (
                <div className="progress-details">
                  <div className="progress-bar-container">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${taskProgress.progress * 100}%` }}
                      />
                    </div>
                    <span className="progress-text">
                      {Math.round(taskProgress.progress * 100)}%
                    </span>
                  </div>
                  
                  <div className="time-info">
                    <span className="time-remaining">
                      ⏱️ {formatTime(taskProgress.timeRemaining)}
                    </span>
                    <span className="estimated-completion">
                      🎯 ETA: {new Date(Date.now() + taskProgress.timeRemaining).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Queued Tasks */}
          {queuedTasks.length > 0 && (
            <div className="queued-tasks">
              <h4>📋 Queued Activities ({queuedTasks.length})</h4>
              <div className="queue-list">
                {queuedTasks.slice(0, 3).map((task, index) => (
                  <div key={task.id} className="queued-task">
                    <span className="queue-position">#{index + 1}</span>
                    <span className="task-icon">{task.icon}</span>
                    <span className="task-name">{task.name}</span>
                    <span className="task-duration">{formatTime(task.duration)}</span>
                  </div>
                ))}
                {queuedTasks.length > 3 && (
                  <div className="queue-overflow">
                    +{queuedTasks.length - 3} more activities
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Completion Notifications */}
      {showNotifications && completionNotifications.length > 0 && (
        <div className="completion-notifications">
          {completionNotifications.map((notification, index) => (
            <div key={index} className="notification-card">
              <div className="notification-header">
                <span className="notification-icon">✅</span>
                <h4>Activity Completed!</h4>
                <button 
                  className="close-notification"
                  onClick={() => setCompletionNotifications(prev => prev.filter((_, i) => i !== index))}
                >
                  ×
                </button>
              </div>
              
              <div className="notification-content">
                <p><strong>{notification.task.name}</strong> has been completed!</p>
                
                {notification.rewards && notification.rewards.length > 0 && (
                  <div className="rewards-earned">
                    <h5>Rewards Earned:</h5>
                    <div className="rewards-list">
                      {notification.rewards.map((reward, rewardIndex) => (
                        <div key={rewardIndex} className={`reward-item ${reward.isRare ? 'rare' : 'common'}`}>
                          <span className="reward-quantity">{reward.quantity}x</span>
                          <span className="reward-name">
                            {reward.itemId || `${reward.type} reward`}
                            {reward.isRare && ' ✨'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}



      {/* Category Selection */}
      <div className="category-selection">
        <h3>Choose Your Pursuit</h3>
        <div className="category-tabs">
          {Object.values(HarvestingCategory).map(category => (
            <button
              key={category}
              className={`category-tab ${selectedCategory === category ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category)}
            >
              {getCategoryDisplayName(category)}
              {harvestingStats && (
                <span className="category-level">
                  Lv.{harvestingStats.categoryLevels[category]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Activities Grid */}
      <div className="activities-section">
        <h3>{getCategoryDisplayName(selectedCategory)}</h3>
        <div className="activities-grid">
          {getCategoryActivities().map(activity => (
            <div key={activity.id} className="activity-card">
              <div className="activity-header">
                <span className="activity-icon">{activity.icon}</span>
                <h4>{activity.name}</h4>
              </div>
              
              <p className="activity-description">{activity.description}</p>
              
              <div className="activity-stats">
                <div className="stat-row">
                  <span>⏱️ Duration: {formatTime(activity.baseTime * 1000)}</span>
                </div>
                <div className="stat-row">
                  <span>⚡ Energy: {activity.energyCost}</span>
                </div>
                <div className="stat-row">
                  <span>📊 Level: {activity.requiredLevel}</span>
                </div>
              </div>

              {activity.requiredStats && (
                <div className="required-stats">
                  <h5>Required Stats:</h5>
                  {Object.entries(activity.requiredStats).map(([stat, value]) => (
                    <div key={stat} className="stat-requirement">
                      <span>{stat}: {value}</span>
                      <span className={playerStats[stat as keyof typeof playerStats] >= value ? 'met' : 'not-met'}>
                        ({playerStats[stat as keyof typeof playerStats] || 0})
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="stat-bonuses">
                <h5>Stat Bonuses:</h5>
                {Object.entries(activity.statBonuses).map(([stat, bonus]) => (
                  <span key={stat} className="bonus">+{bonus} {stat}</span>
                ))}
              </div>

              {/* Primary Material Reward */}
              <div className="primary-reward">
                <h5>Primary Material:</h5>
                <div className="reward-info">
                  <span className="guaranteed">✅ Guaranteed reward each harvest</span>
                </div>
              </div>

              {/* Exotic Discovery Chance */}
              <div className="exotic-chance">
                <h5>Exotic Discovery:</h5>
                <div className="chance-info">
                  <span className="rare-chance">✨ Very rare chance (&lt;1%) for exotic treasures</span>
                  {harvestingStats && (
                    <span className="skill-bonus">
                      Skill Lv.{harvestingStats.categoryLevels[activity.category]} 
                      (+{Math.round(harvestingStats.categoryLevels[activity.category] * 2)}% chance)
                    </span>
                  )}
                </div>
              </div>

              {/* Rounds Selection */}
              <div className="rounds-selection">
                <h5>Rounds:</h5>
                <div className="rounds-input-group">
                  <input
                    type="number"
                    min="1"
                    value={getRoundsForActivity(activity.id) === 'infinite' ? '' : getRoundsForActivity(activity.id)}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || value === '0') {
                        setRoundsForActivity(activity.id, 'infinite');
                      } else {
                        setRoundsForActivity(activity.id, parseInt(value));
                      }
                    }}
                    placeholder="∞"
                    className="rounds-input"
                  />
                  <button
                    className={`infinite-btn ${getRoundsForActivity(activity.id) === 'infinite' ? 'active' : ''}`}
                    onClick={() => setRoundsForActivity(activity.id, 'infinite')}
                  >
                    ∞
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="activity-actions">
                <button
                  className="start-activity-btn"
                  onClick={() => startHarvesting(activity, getRoundsForActivity(activity.id))}
                  disabled={!canStartActivity(activity)}
                >
                  🚀 Start
                </button>
                <button
                  className="queue-activity-btn"
                  onClick={() => addToQueue(activity, getRoundsForActivity(activity.id))}
                >
                  ➕ Queue
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>



      {/* Player Stats */}
      {harvestingStats && (
        <div className="harvesting-stats">
          <h3>Your Harvesting Progress</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <h4>Total Harvests</h4>
              <span className="stat-value">{harvestingStats.totalHarvests}</span>
            </div>
            <div className="stat-card">
              <h4>Time Spent</h4>
              <span className="stat-value">{formatTime(harvestingStats.totalTimeSpent * 1000)}</span>
            </div>
            <div className="stat-card">
              <h4>Rare Finds</h4>
              <span className="stat-value">{harvestingStats.rareFindCount}</span>
            </div>
            <div className="stat-card">
              <h4>Legendary Finds</h4>
              <span className="stat-value">{harvestingStats.legendaryFindCount}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HarvestingHub;