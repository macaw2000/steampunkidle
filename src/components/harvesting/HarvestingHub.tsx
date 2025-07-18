/**
 * Harvesting Hub Component
 * Main interface for steampunk resource gathering activities
 */

import React, { useState, useEffect } from 'react';
import { harvestingService } from '../../services/harvestingService';
import { taskQueueService } from '../../services/taskQueueService';
import { 
  HarvestingActivity, 
  HarvestingCategory, 
  HarvestingReward,
  PlayerHarvestingStats
} from '../../types/harvesting';
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

  useEffect(() => {
    loadAvailableActivities();
    loadHarvestingStats();
  }, [playerId, playerLevel, playerStats]);

  const loadAvailableActivities = () => {
    const activities = harvestingService.getAvailableActivities(playerId, playerLevel, playerStats);
    setAvailableActivities(activities);
  };

  const loadHarvestingStats = () => {
    const stats = harvestingService.getPlayerStats(playerId);
    setHarvestingStats(stats);
  };

  const startHarvesting = (activity: HarvestingActivity, rounds: number | 'infinite' = 'infinite') => {
    try {
      // Start task immediately, replacing any current task
      const taskData = {
        ...activity,
        rounds: rounds,
        metadata: { rounds }
      };
      taskQueueService.startHarvestingTask(playerId, taskData, playerStats);
      
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
      taskQueueService.queueHarvestingTask(playerId, taskData, playerStats);
      
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