/**
 * Task Queue Display Component
 * Shows the current task queue with up to 5 tasks and their details
 */

import React, { useEffect, useState } from 'react';
import { Task } from '../../types/taskQueue';
import { serverTaskQueueService } from '../../services/serverTaskQueueService';
import './TaskQueueDisplay.css';

interface TaskQueueDisplayProps {
  playerId: string;
  className?: string;
}

interface QueueStatus {
  currentTask: Task | null;
  queueLength: number;
  queuedTasks: Task[];
  isRunning: boolean;
  totalCompleted: number;
}

const TaskQueueDisplay: React.FC<TaskQueueDisplayProps> = ({ playerId, className = '' }) => {
  const [taskQueue, setTaskQueue] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!playerId) return;

    const updateQueue = () => {
      try {
        const status = serverTaskQueueService.getQueueStatus(playerId);
        setTaskQueue(status);
        setLoading(false);
      } catch (error) {
        console.error('Failed to get queue status:', error);
        setLoading(false);
      }
    };

    // Initial load
    updateQueue();

    // Update every second
    const interval = setInterval(updateQueue, 1000);

    // Listen for task completion events
    const handleTaskComplete = () => {
      updateQueue();
    };

    serverTaskQueueService.onTaskComplete(playerId, handleTaskComplete);

    return () => {
      clearInterval(interval);
      serverTaskQueueService.removeCallbacks(playerId);
    };
  }, [playerId]);

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

  const formatTimeRemaining = (task: Task): string => {
    if (!task.startTime || task.completed) return '';
    
    const elapsed = Date.now() - task.startTime;
    const remaining = Math.max(0, task.duration - elapsed);
    
    if (remaining === 0) return 'Completing...';
    return formatDuration(remaining);
  };

  const getTaskPriorityClass = (priority: number): string => {
    if (priority >= 8) return 'priority-high';
    if (priority >= 6) return 'priority-medium';
    return 'priority-low';
  };

  const getTaskTypeIcon = (task: Task): string => {
    switch (task.type) {
      case 'harvesting':
        return '⛏️';
      case 'crafting':
        return '🔧';
      case 'combat':
        return '⚔️';
      default:
        return '📋';
    }
  };

  const getTaskStatusClass = (task: Task, isCurrentTask: boolean): string => {
    if (isCurrentTask) return 'task-active';
    if (task.completed) return 'task-completed';
    if (!task.isValid) return 'task-invalid';
    return 'task-queued';
  };

  if (loading) {
    return (
      <div className={`task-queue-display loading ${className}`}>
        <div className="loading-spinner">
          <span className="spinner-icon">⚙️</span>
          <span>Loading queue...</span>
        </div>
      </div>
    );
  }

  if (!taskQueue) {
    return (
      <div className={`task-queue-display error ${className}`}>
        <div className="error-message">
          <span className="error-icon">❌</span>
          <span>Failed to load task queue</span>
        </div>
      </div>
    );
  }

  const allTasks = [
    ...(taskQueue.currentTask ? [taskQueue.currentTask] : []),
    ...taskQueue.queuedTasks
  ].slice(0, 5); // Show up to 5 tasks

  return (
    <div className={`task-queue-display ${className}`}>
      <div className="queue-header">
        <div className="queue-title">
          <span className="queue-icon">📋</span>
          <h3>Task Queue</h3>
        </div>
        <div className="queue-stats">
          <div className="queue-stat">
            <span className="stat-label">Active:</span>
            <span className="stat-value">{taskQueue.currentTask ? 1 : 0}</span>
          </div>
          <div className="queue-stat">
            <span className="stat-label">Queued:</span>
            <span className="stat-value">{taskQueue.queuedTasks.length}</span>
          </div>
          <div className="queue-stat">
            <span className="stat-label">Completed:</span>
            <span className="stat-value">{taskQueue.totalCompleted}</span>
          </div>
        </div>
      </div>

      <div className="task-list">
        {allTasks.length === 0 ? (
          <div className="empty-queue">
            <div className="empty-icon">📭</div>
            <div className="empty-message">
              <h4>No tasks in queue</h4>
              <p>Start an activity to add tasks to your queue</p>
            </div>
          </div>
        ) : (
          allTasks.map((task, index) => {
            const isCurrentTask = index === 0 && !!taskQueue.currentTask;
            const taskStatusClass = getTaskStatusClass(task, isCurrentTask);
            const priorityClass = getTaskPriorityClass(task.priority);

            return (
              <div
                key={task.id}
                className={`task-item ${taskStatusClass} ${priorityClass}`}
              >
                <div className="task-header">
                  <div className="task-icon-name">
                    <span className="task-type-icon">{getTaskTypeIcon(task)}</span>
                    <span className="task-icon">{task.icon}</span>
                    <div className="task-name-desc">
                      <h4 className="task-name">{task.name}</h4>
                      <p className="task-description">{task.description}</p>
                    </div>
                  </div>
                  <div className="task-status-info">
                    {isCurrentTask && (
                      <div className="task-status active">
                        <span className="status-icon">🟢</span>
                        <span className="status-text">Active</span>
                      </div>
                    )}
                    {!isCurrentTask && (
                      <div className="task-position">
                        <span className="position-text">#{index}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="task-details">
                  <div className="task-progress-info">
                    {isCurrentTask && task.startTime && (
                      <div className="progress-section">
                        <div className="progress-bar">
                          <div 
                            className="progress-fill"
                            style={{ 
                              width: `${Math.min(100, task.progress * 100)}%` 
                            }}
                          />
                        </div>
                        <div className="progress-text">
                          <span>{Math.round(task.progress * 100)}%</span>
                          <span className="time-remaining">
                            {formatTimeRemaining(task)}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {!isCurrentTask && (
                      <div className="task-duration">
                        <span className="duration-icon">⏱️</span>
                        <span className="duration-text">
                          {formatDuration(task.duration)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="task-meta">
                    <div className="task-priority">
                      <span className="priority-icon">
                        {task.priority >= 8 ? '🔴' : task.priority >= 6 ? '🟡' : '🟢'}
                      </span>
                      <span className="priority-text">
                        Priority {task.priority}
                      </span>
                    </div>
                    
                    {task.retryCount > 0 && (
                      <div className="task-retries">
                        <span className="retry-icon">🔄</span>
                        <span className="retry-text">
                          Retry {task.retryCount}/{task.maxRetries}
                        </span>
                      </div>
                    )}

                    {!task.isValid && task.validationErrors.length > 0 && (
                      <div className="task-errors">
                        <span className="error-icon">⚠️</span>
                        <span className="error-text">
                          {task.validationErrors[0]}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {task.prerequisites.length > 0 && (
                  <div className="task-prerequisites">
                    <div className="prerequisites-header">
                      <span className="prereq-icon">📋</span>
                      <span className="prereq-text">Requirements:</span>
                    </div>
                    <div className="prerequisites-list">
                      {task.prerequisites.slice(0, 3).map((prereq, idx) => (
                        <div 
                          key={idx} 
                          className={`prerequisite ${prereq.isMet ? 'met' : 'unmet'}`}
                        >
                          <span className="prereq-status">
                            {prereq.isMet ? '✅' : '❌'}
                          </span>
                          <span className="prereq-desc">{prereq.description}</span>
                        </div>
                      ))}
                      {task.prerequisites.length > 3 && (
                        <div className="prerequisites-more">
                          +{task.prerequisites.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {taskQueue.queuedTasks.length > 4 && (
        <div className="queue-overflow">
          <span className="overflow-icon">📋</span>
          <span className="overflow-text">
            +{taskQueue.queuedTasks.length - 4} more tasks in queue
          </span>
        </div>
      )}
    </div>
  );
};

export default TaskQueueDisplay;