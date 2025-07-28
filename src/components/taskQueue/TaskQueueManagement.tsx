/**
 * Task Queue Management Component
 * Comprehensive queue management UI with drag-and-drop, statistics, and controls
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Task, TaskProgress, TaskCompletionResult } from '../../types/taskQueue';
import { serverTaskQueueService } from '../../services/serverTaskQueueService';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import './TaskQueueManagement.css';

interface TaskQueueManagementProps {
  playerId: string;
  className?: string;
  onTaskComplete?: (result: TaskCompletionResult) => void;
}

interface QueueStatus {
  currentTask: Task | null;
  queueLength: number;
  queuedTasks: Task[];
  isRunning: boolean;
  totalCompleted: number;
}

interface QueueStatistics {
  totalTasksCompleted: number;
  averageTaskDuration: number;
  taskCompletionRate: number;
  queueEfficiencyScore: number;
  estimatedCompletionTime: number;
  totalQueueTime: number;
  currentTaskETA: number;
}

const TaskQueueManagement: React.FC<TaskQueueManagementProps> = ({ 
  playerId, 
  className = '',
  onTaskComplete 
}) => {
  const [taskQueue, setTaskQueue] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState<QueueStatistics | null>(null);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // Update queue state
  const updateQueue = useCallback(() => {
    if (!playerId) return;

    try {
      const status = serverTaskQueueService.getQueueStatus(playerId);
      const stats = serverTaskQueueService.getQueueStatistics(playerId);
      
      setTaskQueue(status);
      
      // Calculate additional statistics
      const totalQueueTime = status.queuedTasks.reduce((total, task) => total + task.duration, 0);
      const currentTaskETA = status.currentTask && status.currentTask.startTime 
        ? Math.max(0, status.currentTask.duration - (Date.now() - status.currentTask.startTime))
        : 0;

      setStatistics({
        ...stats,
        totalQueueTime,
        currentTaskETA
      });
      
      setLoading(false);
    } catch (error) {
      console.error('Failed to get queue status:', error);
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    if (!playerId) return;

    // Initial load
    updateQueue();

    // Update every second
    const interval = setInterval(updateQueue, 1000);

    // Listen for task completion events
    const handleTaskComplete = (result: TaskCompletionResult) => {
      updateQueue();
      onTaskComplete?.(result);
    };

    serverTaskQueueService.onTaskComplete(playerId, handleTaskComplete);

    return () => {
      clearInterval(interval);
      serverTaskQueueService.removeCallbacks(playerId);
    };
  }, [playerId, updateQueue, onTaskComplete]);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTask(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (!draggedTask || !taskQueue) return;

    const draggedIndex = taskQueue.queuedTasks.findIndex(task => task.id === draggedTask);
    if (draggedIndex === -1 || draggedIndex === dropIndex) {
      setDraggedTask(null);
      setDragOverIndex(null);
      return;
    }

    try {
      // Create new task order
      const newTasks = [...taskQueue.queuedTasks];
      const [draggedTaskObj] = newTasks.splice(draggedIndex, 1);
      newTasks.splice(dropIndex, 0, draggedTaskObj);
      
      const newTaskIds = newTasks.map(task => task.id);
      
      // Update server
      await serverTaskQueueService.reorderTasks(playerId, newTaskIds);
      
      // Update local state immediately for better UX
      setTaskQueue(prev => prev ? {
        ...prev,
        queuedTasks: newTasks
      } : null);
      
    } catch (error) {
      console.error('Failed to reorder tasks:', error);
    }

    setDraggedTask(null);
    setDragOverIndex(null);
  };

  // Task management handlers
  const handleRemoveTask = async (taskId: string) => {
    try {
      await serverTaskQueueService.removeTask(playerId, taskId);
      updateQueue();
    } catch (error) {
      console.error('Failed to remove task:', error);
    }
  };

  const handleClearQueue = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
      return;
    }

    try {
      await serverTaskQueueService.clearQueue(playerId);
      updateQueue();
      setConfirmClear(false);
    } catch (error) {
      console.error('Failed to clear queue:', error);
    }
  };

  const handleStopAllTasks = async () => {
    try {
      await serverTaskQueueService.stopAllTasks(playerId);
      updateQueue();
    } catch (error) {
      console.error('Failed to stop all tasks:', error);
    }
  };

  const handlePauseQueue = async () => {
    try {
      await serverTaskQueueService.pauseQueue(playerId, 'Manual pause');
      updateQueue();
    } catch (error) {
      console.error('Failed to pause queue:', error);
    }
  };

  const handleResumeQueue = async () => {
    try {
      await serverTaskQueueService.resumeQueue(playerId);
      updateQueue();
    } catch (error) {
      console.error('Failed to resume queue:', error);
    }
  };

  // Utility functions
  const formatDuration = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
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

  const getTaskTypeIcon = (task: Task): string => {
    switch (task.type) {
      case 'harvesting': return '⛏️';
      case 'crafting': return '🔧';
      case 'combat': return '⚔️';
      default: return '📋';
    }
  };

  const getTaskStatusClass = (task: Task, isCurrentTask: boolean): string => {
    if (isCurrentTask) return 'task-active';
    if (task.completed) return 'task-completed';
    if (!task.isValid) return 'task-invalid';
    return 'task-queued';
  };

  const getPriorityClass = (priority: number): string => {
    if (priority >= 8) return 'priority-high';
    if (priority >= 6) return 'priority-medium';
    return 'priority-low';
  };

  if (loading) {
    return (
      <div className={`task-queue-management loading ${className}`}>
        <div className="loading-spinner">
          <span className="spinner-icon">⚙️</span>
          <span>Loading queue management...</span>
        </div>
      </div>
    );
  }

  if (!taskQueue) {
    return (
      <div className={`task-queue-management error ${className}`}>
        <div className="error-message">
          <span className="error-icon">❌</span>
          <span>Failed to load task queue</span>
        </div>
      </div>
    );
  }

  const allTasks = [
    ...(taskQueue.currentTask ? [taskQueue.currentTask] : []),
    ...(taskQueue.queuedTasks || [])
  ];

  const displayTasks = showAllTasks ? allTasks : allTasks.slice(0, 10);

  return (
    <div className={`task-queue-management ${className}`}>
      {/* Queue Header with Statistics */}
      <div className="queue-header">
        <div className="queue-title">
          <span className="queue-icon">📋</span>
          <h3>Task Queue Management</h3>
          <SyncStatusIndicator 
            playerId={playerId}
            className="queue-sync-status"
            showDetails={false}
            onSyncComplete={updateQueue}
          />
        </div>
        
        <div className="queue-controls">
          <button 
            className="control-btn pause-btn"
            onClick={taskQueue.isRunning ? handlePauseQueue : handleResumeQueue}
            title={taskQueue.isRunning ? "Pause Queue" : "Resume Queue"}
          >
            {taskQueue.isRunning ? '⏸️' : '▶️'}
            {taskQueue.isRunning ? 'Pause' : 'Resume'}
          </button>
          
          <button 
            className="control-btn stop-btn"
            onClick={handleStopAllTasks}
            title="Stop All Tasks"
          >
            ⏹️ Stop All
          </button>
          
          <button 
            className={`control-btn clear-btn ${confirmClear ? 'confirm' : ''}`}
            onClick={handleClearQueue}
            title="Clear Queue"
          >
            🗑️ {confirmClear ? 'Confirm Clear' : 'Clear Queue'}
          </button>
        </div>
      </div>

      {/* Queue Statistics */}
      {statistics && (
        <div className="queue-statistics">
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Active</span>
              <span className="stat-value">{taskQueue.currentTask ? 1 : 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Queued</span>
              <span className="stat-value">{taskQueue.queuedTasks.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Completed</span>
              <span className="stat-value">{statistics.totalTasksCompleted}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total Time</span>
              <span className="stat-value">{formatDuration(statistics.totalQueueTime)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">ETA</span>
              <span className="stat-value">
                {statistics.currentTaskETA > 0 
                  ? formatDuration(statistics.currentTaskETA)
                  : 'N/A'
                }
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Efficiency</span>
              <span className="stat-value">
                {Math.round(statistics.queueEfficiencyScore * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Task List */}
      <div className="task-list-container">
        <div className="task-list-header">
          <h4>Tasks ({allTasks.length})</h4>
          {allTasks.length > 10 && (
            <button 
              className="toggle-view-btn"
              onClick={() => setShowAllTasks(!showAllTasks)}
            >
              {showAllTasks ? 'Show Less' : `Show All (${allTasks.length})`}
            </button>
          )}
        </div>

        <div className="task-list">
          {displayTasks.length === 0 ? (
            <div className="empty-queue">
              <div className="empty-icon">📭</div>
              <div className="empty-message">
                <h4>No tasks in queue</h4>
                <p>Start an activity to add tasks to your queue</p>
              </div>
            </div>
          ) : (
            displayTasks.map((task, index) => {
              const isCurrentTask = index === 0 && !!taskQueue.currentTask;
              const taskStatusClass = getTaskStatusClass(task, isCurrentTask);
              const priorityClass = getPriorityClass(task.priority);
              const isDragOver = dragOverIndex === index;
              const canDrag = !isCurrentTask && taskQueue.queuedTasks.length > 1;

              return (
                <div
                  key={task.id}
                  className={`task-item ${taskStatusClass} ${priorityClass} ${isDragOver ? 'drag-over' : ''}`}
                  draggable={canDrag}
                  onDragStart={(e) => canDrag && handleDragStart(e, task.id)}
                  onDragOver={(e) => canDrag && handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => canDrag && handleDrop(e, index)}
                >
                  <div className="task-header">
                    <div className="task-icon-name">
                      {canDrag && (
                        <span className="drag-handle" title="Drag to reorder">
                          ⋮⋮
                        </span>
                      )}
                      <span className="task-type-icon">{getTaskTypeIcon(task)}</span>
                      <span className="task-icon">{task.icon}</span>
                      <div className="task-name-desc">
                        <h4 className="task-name">{task.name}</h4>
                        <p className="task-description">{task.description}</p>
                      </div>
                    </div>
                    
                    <div className="task-actions">
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
                      
                      {!isCurrentTask && (
                        <button
                          className="remove-task-btn"
                          onClick={() => handleRemoveTask(task.id)}
                          title="Remove Task"
                        >
                          ❌
                        </button>
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

        {!showAllTasks && allTasks.length > 10 && (
          <div className="queue-overflow">
            <span className="overflow-icon">📋</span>
            <span className="overflow-text">
              +{allTasks.length - 10} more tasks in queue
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskQueueManagement;