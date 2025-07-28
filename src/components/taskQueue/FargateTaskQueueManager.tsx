/**
 * Fargate Task Queue Manager Component
 * UI for starting, stopping, and queuing activities with real-time progress
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Task, TaskProgress, TaskCompletionResult, TaskType } from '../../types/taskQueue';
import { fargateGameEngineService, FargateTaskQueue, TaskQueueStatistics } from '../../services/fargateGameEngineService';
import { TaskUtils } from '../../utils/taskUtils';
import './FargateTaskQueueManager.css';

interface FargateTaskQueueManagerProps {
  playerId: string;
  className?: string;
  onTaskComplete?: (result: TaskCompletionResult) => void;
  onStatusChange?: (status: FargateTaskQueue) => void;
}

interface ActivityOption {
  id: string;
  name: string;
  type: TaskType;
  icon: string;
  description: string;
  duration: number;
  requirements?: string[];
}

const FargateTaskQueueManager: React.FC<FargateTaskQueueManagerProps> = ({ 
  playerId, 
  className = '',
  onTaskComplete,
  onStatusChange
}) => {
  const [queueStatus, setQueueStatus] = useState<FargateTaskQueue | null>(null);
  const [statistics, setStatistics] = useState<TaskQueueStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHealthy, setIsHealthy] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<ActivityOption | null>(null);
  const [showActivitySelector, setShowActivitySelector] = useState(false);
  const [taskProgress, setTaskProgress] = useState<TaskProgress | null>(null);

  // Sample activities for demonstration
  const availableActivities: ActivityOption[] = [
    {
      id: 'copper_mining',
      name: 'Copper Mining',
      type: TaskType.HARVESTING,
      icon: '⛏️',
      description: 'Mine copper ore from the steampunk mines',
      duration: 30000, // 30 seconds
      requirements: ['Mining Level 1']
    },
    {
      id: 'gear_crafting',
      name: 'Gear Crafting',
      type: TaskType.CRAFTING,
      icon: '⚙️',
      description: 'Craft clockwork gears for machinery',
      duration: 45000, // 45 seconds
      requirements: ['Clockmaking Level 1', '3x Copper Ore']
    },
    {
      id: 'steam_golem_combat',
      name: 'Steam Golem Combat',
      type: TaskType.COMBAT,
      icon: '🤖',
      description: 'Battle steam-powered golems',
      duration: 60000, // 60 seconds
      requirements: ['Combat Level 1', 'Steam Weapon']
    },
    {
      id: 'crystal_harvesting',
      name: 'Crystal Harvesting',
      type: TaskType.HARVESTING,
      icon: '💎',
      description: 'Harvest energy crystals from crystal caves',
      duration: 40000, // 40 seconds
      requirements: ['Crystal Extraction Level 1']
    },
    {
      id: 'automaton_crafting',
      name: 'Automaton Crafting',
      type: TaskType.CRAFTING,
      icon: '🔧',
      description: 'Build mechanical automatons',
      duration: 90000, // 90 seconds
      requirements: ['Engineering Level 2', '5x Gears', '2x Crystals']
    }
  ];

  // Update queue status
  const updateQueueStatus = useCallback(async () => {
    if (!playerId) return;

    try {
      const status = fargateGameEngineService.getLocalQueueStatus(playerId);
      const stats = fargateGameEngineService.getQueueStatistics(playerId);
      const health = fargateGameEngineService.getHealthStatus();
      
      setQueueStatus(status);
      setStatistics(stats);
      setIsHealthy(health.isHealthy);
      setError(null);
      
      if (status) {
        onStatusChange?.(status);
      }
      
    } catch (err: any) {
      console.error('Failed to update queue status:', err);
      setError(err.message || 'Failed to update queue status');
    }
  }, [playerId, onStatusChange]);

  // Initialize and sync with Fargate service
  useEffect(() => {
    if (!playerId) return;

    const initializeQueue = async () => {
      try {
        setLoading(true);
        await fargateGameEngineService.syncPlayerQueue(playerId);
        await updateQueueStatus();
      } catch (err: any) {
        console.error('Failed to initialize queue:', err);
        setError(err.message || 'Failed to connect to game engine');
      } finally {
        setLoading(false);
      }
    };

    initializeQueue();

    // Set up callbacks
    const handleProgress = (progress: TaskProgress) => {
      setTaskProgress(progress);
    };

    const handleTaskComplete = (result: TaskCompletionResult) => {
      setTaskProgress(null);
      updateQueueStatus();
      onTaskComplete?.(result);
    };

    const handleStatusChange = (status: FargateTaskQueue) => {
      setQueueStatus(status);
      onStatusChange?.(status);
    };

    fargateGameEngineService.onProgress(playerId, handleProgress);
    fargateGameEngineService.onTaskComplete(playerId, handleTaskComplete);
    fargateGameEngineService.onStatusChange(playerId, handleStatusChange);

    // Update status every 5 seconds
    const statusInterval = setInterval(updateQueueStatus, 5000);

    return () => {
      clearInterval(statusInterval);
      fargateGameEngineService.removeCallbacks(playerId);
    };
  }, [playerId, updateQueueStatus, onTaskComplete, onStatusChange]);

  // Handle starting an activity immediately
  const handleStartActivity = async (activity: ActivityOption) => {
    if (!playerId) return;

    try {
      setError(null);
      
      // Create task from activity
      const task = TaskUtils.createTaskFromActivity(playerId, activity);
      
      // Stop current tasks first
      await fargateGameEngineService.stopAllTasks(playerId);
      
      // Add new task
      await fargateGameEngineService.addTaskToQueue(playerId, task);
      
      setShowActivitySelector(false);
      setSelectedActivity(null);
      
    } catch (err: any) {
      console.error('Failed to start activity:', err);
      setError(err.message || 'Failed to start activity');
    }
  };

  // Handle queuing an activity
  const handleQueueActivity = async (activity: ActivityOption) => {
    if (!playerId) return;

    try {
      setError(null);
      
      // Create task from activity
      const task = TaskUtils.createTaskFromActivity(playerId, activity);
      
      // Add to queue without stopping current task
      await fargateGameEngineService.addTaskToQueue(playerId, task);
      
      setShowActivitySelector(false);
      setSelectedActivity(null);
      
    } catch (err: any) {
      console.error('Failed to queue activity:', err);
      setError(err.message || 'Failed to queue activity');
    }
  };

  // Handle stopping all tasks
  const handleStopAllTasks = async () => {
    if (!playerId) return;

    try {
      setError(null);
      await fargateGameEngineService.stopAllTasks(playerId);
      setTaskProgress(null);
    } catch (err: any) {
      console.error('Failed to stop tasks:', err);
      setError(err.message || 'Failed to stop tasks');
    }
  };

  // Format duration helper
  const formatDuration = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Format time remaining for current task
  const formatTimeRemaining = (task: Task): string => {
    if (!task.startTime || task.completed) return '';
    
    const elapsed = Date.now() - task.startTime;
    const remaining = Math.max(0, task.duration - elapsed);
    
    if (remaining === 0) return 'Completing...';
    return formatDuration(remaining);
  };

  // Get task type icon
  const getTaskTypeIcon = (type: TaskType): string => {
    switch (type) {
      case TaskType.HARVESTING: return '⛏️';
      case TaskType.CRAFTING: return '🔧';
      case TaskType.COMBAT: return '⚔️';
      default: return '📋';
    }
  };

  if (loading) {
    return (
      <div className={`fargate-task-queue-manager loading ${className}`}>
        <div className="loading-spinner">
          <span className="spinner-icon">⚙️</span>
          <span>Connecting to game engine...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`fargate-task-queue-manager ${className}`}>
      {/* Header with health status */}
      <div className="queue-header">
        <div className="queue-title">
          <span className="queue-icon">🎮</span>
          <h3>Fargate Game Engine</h3>
          <div className={`health-indicator ${isHealthy ? 'healthy' : 'unhealthy'}`}>
            <span className="health-icon">{isHealthy ? '🟢' : '🔴'}</span>
            <span className="health-text">{isHealthy ? 'Online' : 'Offline'}</span>
          </div>
        </div>
        
        <div className="queue-controls">
          <button 
            className="control-btn start-btn"
            onClick={() => setShowActivitySelector(true)}
            disabled={!isHealthy}
            title="Start New Activity"
          >
            ▶️ Start Activity
          </button>
          
          <button 
            className="control-btn stop-btn"
            onClick={handleStopAllTasks}
            disabled={!isHealthy || !queueStatus?.isRunning}
            title="Stop All Tasks"
          >
            ⏹️ Stop All
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="error-banner">
          <span className="error-icon">❌</span>
          <span className="error-message">{error}</span>
          <button 
            className="error-dismiss"
            onClick={() => setError(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Queue statistics */}
      {statistics && (
        <div className="queue-statistics">
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Active</span>
              <span className="stat-value">{queueStatus?.currentTask ? 1 : 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Queued</span>
              <span className="stat-value">{queueStatus?.queuedTasks.length || 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Completed</span>
              <span className="stat-value">{statistics.totalTasksCompleted}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Queue Time</span>
              <span className="stat-value">{formatDuration(statistics.estimatedCompletionTime)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Efficiency</span>
              <span className="stat-value">{Math.round(statistics.queueEfficiencyScore * 100)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Current task display */}
      {queueStatus?.currentTask && (
        <div className="current-task">
          <div className="current-task-header">
            <h4>
              <span className="task-icon">{queueStatus.currentTask.icon}</span>
              Current Task: {queueStatus.currentTask.name}
            </h4>
            <div className="task-status">
              <span className="status-icon">🟢</span>
              <span className="status-text">Active</span>
            </div>
          </div>
          
          <div className="current-task-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ 
                  width: `${Math.min(100, (taskProgress?.progress || queueStatus.currentTask.progress) * 100)}%` 
                }}
              />
            </div>
            <div className="progress-info">
              <span className="progress-percentage">
                {Math.round((taskProgress?.progress || queueStatus.currentTask.progress) * 100)}%
              </span>
              <span className="time-remaining">
                {taskProgress?.timeRemaining 
                  ? formatDuration(taskProgress.timeRemaining)
                  : formatTimeRemaining(queueStatus.currentTask)
                }
              </span>
            </div>
          </div>
          
          <p className="task-description">{queueStatus.currentTask.description}</p>
        </div>
      )}

      {/* Queued tasks display */}
      {queueStatus?.queuedTasks && queueStatus.queuedTasks.length > 0 && (
        <div className="queued-tasks">
          <h4>Queued Tasks ({queueStatus.queuedTasks.length})</h4>
          <div className="task-list">
            {queueStatus.queuedTasks.slice(0, 5).map((task, index) => (
              <div key={task.id} className="queued-task-item">
                <div className="task-info">
                  <span className="task-position">#{index + 1}</span>
                  <span className="task-icon">{task.icon}</span>
                  <div className="task-details">
                    <span className="task-name">{task.name}</span>
                    <span className="task-duration">{formatDuration(task.duration)}</span>
                  </div>
                </div>
                <div className="task-type">
                  <span className="type-icon">{getTaskTypeIcon(task.type)}</span>
                </div>
              </div>
            ))}
            {queueStatus.queuedTasks.length > 5 && (
              <div className="more-tasks">
                +{queueStatus.queuedTasks.length - 5} more tasks
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!queueStatus?.currentTask && (!queueStatus?.queuedTasks || queueStatus.queuedTasks.length === 0) && (
        <div className="empty-queue">
          <div className="empty-icon">🎮</div>
          <div className="empty-message">
            <h4>No active tasks</h4>
            <p>Start an activity to begin processing tasks with the Fargate game engine</p>
            <button 
              className="start-activity-btn"
              onClick={() => setShowActivitySelector(true)}
              disabled={!isHealthy}
            >
              Start Your First Activity
            </button>
          </div>
        </div>
      )}

      {/* Activity selector modal */}
      {showActivitySelector && (
        <div className="activity-selector-modal">
          <div className="modal-backdrop" onClick={() => setShowActivitySelector(false)} />
          <div className="modal-content">
            <div className="modal-header">
              <h3>Select Activity</h3>
              <button 
                className="modal-close"
                onClick={() => setShowActivitySelector(false)}
              >
                ✕
              </button>
            </div>
            
            <div className="activity-list">
              {availableActivities.map(activity => (
                <div key={activity.id} className="activity-option">
                  <div className="activity-info">
                    <div className="activity-header">
                      <span className="activity-icon">{activity.icon}</span>
                      <h4 className="activity-name">{activity.name}</h4>
                      <span className="activity-type">{getTaskTypeIcon(activity.type)}</span>
                    </div>
                    <p className="activity-description">{activity.description}</p>
                    <div className="activity-meta">
                      <span className="activity-duration">
                        ⏱️ {formatDuration(activity.duration)}
                      </span>
                      {activity.requirements && (
                        <div className="activity-requirements">
                          <span className="req-label">Requires:</span>
                          <span className="req-list">{activity.requirements.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="activity-actions">
                    <button 
                      className="action-btn start-btn"
                      onClick={() => handleStartActivity(activity)}
                      title="Start immediately (stops current task)"
                    >
                      ▶️ Start Now
                    </button>
                    <button 
                      className="action-btn queue-btn"
                      onClick={() => handleQueueActivity(activity)}
                      title="Add to queue"
                    >
                      📋 Queue
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FargateTaskQueueManager;