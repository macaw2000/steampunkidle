/**
 * Simple Harvesting Hub Component
 * Integrates with the unified task queue system for proper idle game experience
 */

import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { serverTaskQueueService } from '../../services/serverTaskQueueService';
import { simpleHarvestingService } from '../../services/simpleHarvestingService';
import { HarvestingActivity } from '../../types/harvesting';
import './HarvestingHub.css';

interface SimpleHarvestingHubProps {
  userId: string;
  onClose?: () => void;
}

interface SimpleActivity {
  id: string;
  name: string;
  type: string;
  duration: number;
  description: string;
  icon: string;
  baseRewards: any[];
  requiredLevel?: number;
}

const SimpleHarvestingHub: React.FC<SimpleHarvestingHubProps> = ({
  userId,
  onClose
}) => {
  const [activities, setActivities] = useState<SimpleActivity[]>([]);
  const [character, setCharacter] = useState<any>(null);
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [selectedRounds, setSelectedRounds] = useState<{ [key: string]: number }>({});
  
  // Get character from Redux store
  const { character: reduxCharacter } = useSelector((state: RootState) => state.game);

  useEffect(() => {
    loadActivities();
    loadCharacter();
    
    // Update queue status periodically
    const interval = setInterval(() => {
      if (userId) {
        updateQueueStatus();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    // Use Redux character if available
    if (reduxCharacter) {
      setCharacter(reduxCharacter);
    }
  }, [reduxCharacter]);

  const loadActivities = () => {
    const availableActivities: SimpleActivity[] = [
      {
        id: 'copper_mining',
        name: 'Copper Mining',
        type: 'harvesting',
        duration: 30000, // 30 seconds
        description: 'Extract copper ore from steampunk mines using mechanical drills',
        icon: '⛏️',
        baseRewards: [
          { type: 'resource', itemId: 'copper_ore', quantity: 2 },
          { type: 'experience', quantity: 10 }
        ],
        requiredLevel: 1
      },
      {
        id: 'iron_mining',
        name: 'Iron Mining',
        type: 'harvesting',
        duration: 45000, // 45 seconds
        description: 'Mine iron ore using steam-powered equipment',
        icon: '⚒️',
        baseRewards: [
          { type: 'resource', itemId: 'iron_ore', quantity: 2 },
          { type: 'experience', quantity: 15 }
        ],
        requiredLevel: 5
      },
      {
        id: 'steam_research',
        name: 'Steam Research',
        type: 'harvesting',
        duration: 60000, // 60 seconds
        description: 'Research steam-powered technologies in the laboratory',
        icon: '🔬',
        baseRewards: [
          { type: 'resource', itemId: 'research_notes', quantity: 1 },
          { type: 'experience', quantity: 25 }
        ],
        requiredLevel: 3
      },
      {
        id: 'gear_collection',
        name: 'Gear Collection',
        type: 'harvesting',
        duration: 35000, // 35 seconds
        description: 'Collect mechanical gears from abandoned machinery',
        icon: '⚙️',
        baseRewards: [
          { type: 'resource', itemId: 'mechanical_gear', quantity: 1 },
          { type: 'experience', quantity: 12 }
        ],
        requiredLevel: 2
      }
    ];
    
    setActivities(availableActivities);
    
    // Initialize selected rounds for each activity
    const initialRounds: { [key: string]: number } = {};
    availableActivities.forEach(activity => {
      initialRounds[activity.id] = 1;
    });
    setSelectedRounds(initialRounds);
  };

  const loadCharacter = async () => {
    try {
      if (!reduxCharacter) {
        const characterData = await simpleHarvestingService.getCharacter(userId);
        setCharacter(characterData);
      }
    } catch (error) {
      console.error('Failed to load character:', error);
    }
  };

  const updateQueueStatus = async () => {
    try {
      // Use the simple activity progress instead of task queue
      const progressData = await simpleHarvestingService.getActivityProgress(userId);
      
      // Convert to a format similar to queue status
      const mockQueueStatus = {
        currentTask: progressData.progress > 0 ? {
          name: 'Current Activity',
          icon: '⚙️'
        } : null,
        queueLength: 0, // Simple system doesn't have queuing
        totalCompleted: 0,
        isRunning: progressData.progress > 0 && !progressData.isComplete
      };
      
      setQueueStatus(mockQueueStatus);
    } catch (error) {
      console.error('Failed to get activity status:', error);
    }
  };

  const startActivity = async (activity: SimpleActivity, addToQueue: boolean = false) => {
    try {
      const rounds = selectedRounds[activity.id] || 1;
      
      console.log('=== HARVESTING DEBUG ===');
      console.log('Starting activity:', activity.name);
      console.log('Rounds:', rounds);
      console.log('User ID:', userId);
      console.log('API URL:', process.env.REACT_APP_API_URL);
      console.log('Activity data:', {
        ...activity,
        duration: activity.duration * rounds
      });
      
      // For now, we'll use the simple activity service since the full task queue isn't deployed
      // This will start the activity using the existing /activity/switch endpoint
      await simpleHarvestingService.startActivity(userId, {
        ...activity,
        // Multiply duration by rounds for total time
        duration: activity.duration * rounds
      });

      console.log(`✅ Successfully started ${activity.name} activity (${rounds} rounds)`);
      
      // Close the modal and return to main screen
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Failed to start activity:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userId,
        activity: activity.name,
        rounds: selectedRounds[activity.id] || 1
      });
      
      // Show more detailed error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to start activity: ${errorMessage}\n\nCheck the browser console for more details.`);
    }
  };

  const handleRoundsChange = (activityId: string, rounds: number) => {
    setSelectedRounds(prev => ({
      ...prev,
      [activityId]: Math.max(1, rounds)
    }));
  };

  const formatTime = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <div className="harvesting-hub">
      <div className="harvesting-header">
        <h2>🔧 Steampunk Activities</h2>
        <p>Engage in various Victorian-era activities to gather resources and experience</p>
      </div>

      {/* Character Info */}
      {character && (
        <div className="character-info">
          <h3>👤 {character.name}</h3>
          <div className="character-stats">
            <span>Level: {character.level}</span>
            <span>Experience: {character.experience || 0}</span>
            <span>Currency: {character.currency || 0} Steam Coins</span>
          </div>
        </div>
      )}

      {/* Activity Status Info */}
      {queueStatus && (
        <div className="queue-status-info">
          <h3>⚙️ Activity Status</h3>
          <div className="queue-stats">
            {queueStatus.currentTask ? (
              <span>🔄 Currently: Active</span>
            ) : (
              <span>💤 No active activity</span>
            )}
            <span>✅ Ready to start new activities</span>
          </div>
          <p className="queue-info-text">
            Activities will run automatically in the background. Check the progress bar at the top of the screen!
          </p>
        </div>
      )}

      {/* Available Activities */}
      <div className="activities-section">
        <h3>Available Activities</h3>
        <div className="activities-grid">
          {activities.map(activity => (
            <div key={activity.id} className="activity-card">
              <div className="activity-header">
                <span className="activity-icon">{activity.icon}</span>
                <h4>{activity.name}</h4>
              </div>
              
              <p className="activity-description">{activity.description}</p>
              
              <div className="activity-stats">
                <div className="stat-row">
                  <span>⏱️ Duration: {formatTime(activity.duration)}</span>
                </div>
                <div className="stat-row">
                  <span>🎯 Type: {activity.type}</span>
                </div>
                <div className="stat-row">
                  <span>📊 Level: {activity.requiredLevel || 1}+</span>
                </div>
              </div>

              <div className="activity-rewards">
                <h5>Base Rewards:</h5>
                <div className="rewards-preview">
                  {activity.baseRewards.map((reward, index) => (
                    <span key={index} className="reward-preview">
                      {reward.quantity}x {reward.itemId || reward.type}
                    </span>
                  ))}
                </div>
              </div>

              <div className="activity-controls">
                <div className="rounds-control">
                  <label>Rounds:</label>
                  <div className="rounds-input">
                    <button 
                      onClick={() => handleRoundsChange(activity.id, (selectedRounds[activity.id] || 1) - 1)}
                      disabled={(selectedRounds[activity.id] || 1) <= 1}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="999"
                      value={selectedRounds[activity.id] || 1}
                      onChange={(e) => handleRoundsChange(activity.id, parseInt(e.target.value) || 1)}
                    />
                    <button 
                      onClick={() => handleRoundsChange(activity.id, (selectedRounds[activity.id] || 1) + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
                
                <div className="activity-actions">
                  <button
                    className="start-activity-btn"
                    onClick={() => startActivity(activity, false)}
                    disabled={character && character.level < (activity.requiredLevel || 1)}
                  >
                    🚀 Start Now
                  </button>
                  <button
                    className="queue-activity-btn"
                    onClick={() => startActivity(activity, true)}
                    disabled={character && character.level < (activity.requiredLevel || 1)}
                    title="Note: Queuing not available in simple mode - will start immediately"
                  >
                    🚀 Start Activity
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="instructions">
        <h4>How to Play:</h4>
        <ul>
          <li>🎯 Select an activity and choose how many rounds to perform</li>
          <li>🚀 Click "Start Now" to begin the activity immediately</li>
          <li>📊 Activities run automatically in the background - check the progress bar at the top!</li>
          <li>💎 Collect rewards and experience when activities complete</li>
          <li>🔄 Start new activities to keep your character busy while you're away</li>
        </ul>
        <div className="idle-game-tip">
          <strong>💡 Idle Game Tip:</strong> This is an idle game! Start your activities and let them run while you do other things. 
          The progress bar at the top shows your current activity status. Multiple rounds will run automatically!
        </div>
      </div>
    </div>
  );
};

export default SimpleHarvestingHub;