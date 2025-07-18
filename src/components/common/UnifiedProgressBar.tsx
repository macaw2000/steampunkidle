/**
 * Unified Progress Bar Component
 * Shows progress for all activities (harvesting, combat, crafting) at the top of the screen
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { taskQueueService } from '../../services/taskQueueService';
import { TaskProgress, TaskCompletionResult, Task } from '../../types/taskQueue';
import './UnifiedProgressBar.css';

interface UnifiedProgressBarProps {
  playerId: string;
}

const UnifiedProgressBar: React.FC<UnifiedProgressBarProps> = ({
  playerId
}) => {
  const [progress, setProgress] = useState<TaskProgress | null>(null);
  const [queueStatus, setQueueStatus] = useState<{
    currentTask: Task | null;
    queueLength: number;
    isRunning: boolean;
    totalCompleted: number;
  }>({
    currentTask: null,
    queueLength: 0,
    isRunning: false,
    totalCompleted: 0
  });
  const [recentRewards, setRecentRewards] = useState<any[]>([]);
  const [showRewards, setShowRewards] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const lastTaskIdRef = useRef<string | null>(null);
  const isTransitioningRef = useRef<boolean>(false);

  const updateQueueStatus = useCallback(() => {
    const status = taskQueueService.getQueueStatus(playerId);
    setQueueStatus(status);
  }, [playerId]);

  useEffect(() => {
    console.log('UnifiedProgressBar: Registering callbacks for player:', playerId);
    
    // Register progress callback
    taskQueueService.onProgress(playerId, (progressData: TaskProgress) => {
      console.log('UnifiedProgressBar: Progress update received:', progressData);
      
      // Check if this is a new task starting by comparing task IDs
      if (progressData.taskId !== lastTaskIdRef.current) {
        console.log('UnifiedProgressBar: New task detected, transitioning from', lastTaskIdRef.current, 'to', progressData.taskId);
        // New task detected - start transition
        setIsTransitioning(true);
        isTransitioningRef.current = true;
        lastTaskIdRef.current = progressData.taskId;
        
        // Reset progress to 0 for clean transition
        setProgress({
          ...progressData,
          progress: 0
        });
        
        // After a brief moment, allow normal progress updates
        setTimeout(() => {
          setIsTransitioning(false);
          isTransitioningRef.current = false;
          setProgress(progressData);
        }, 100);
      } else if (!isTransitioningRef.current) {
        // Normal progress update
        setProgress(progressData);
      }
      
      // Update queue status immediately when progress updates
      updateQueueStatus();
    });

    // Register completion callback
    taskQueueService.onTaskComplete(playerId, (result: TaskCompletionResult) => {
      console.log('UnifiedProgressBar: Task completed:', result);
      
      // Show completion at 100% briefly before transitioning
      setProgress(prev => prev ? { ...prev, progress: 1 } : null);
      
      // Show rewards briefly inline
      if (result.rewards && result.rewards.length > 0) {
        setRecentRewards(result.rewards);
        setShowRewards(true);
        
        // Hide rewards after 8 seconds
        setTimeout(() => {
          setShowRewards(false);
          setRecentRewards([]);
        }, 8000);
      }
      
      // Update queue status after completion
      updateQueueStatus();
    });

    // Initial queue status and current progress
    updateQueueStatus();
    
    // Get current progress if there's an active task
    const currentProgress = taskQueueService.getCurrentProgress(playerId);
    if (currentProgress) {
      console.log('UnifiedProgressBar: Found existing progress on mount:', currentProgress);
      setProgress(currentProgress);
      lastTaskIdRef.current = currentProgress.taskId;
    }

    // Set up a more frequent status check to catch task starts immediately
    const statusInterval = setInterval(updateQueueStatus, 200);

    // Cleanup on unmount
    return () => {
      console.log('UnifiedProgressBar: Cleaning up callbacks for player:', playerId);
      taskQueueService.removeCallbacks(playerId);
      clearInterval(statusInterval);
    };
  }, [playerId, updateQueueStatus]);

  const stopAllTasks = () => {
    taskQueueService.stopAllTasks(playerId);
    setProgress(null);
    updateQueueStatus();
  };

  const formatTime = (milliseconds: number): string => {
    const seconds = Math.ceil(milliseconds / 1000);
    return `${seconds}s`;
  };

  const getProgressPercentage = (): number => {
    return progress ? Math.round(progress.progress * 100) : 0;
  };

  // Show idle state if no active task
  const isIdle = !queueStatus.currentTask;

  return (
    <div className={`unified-progress-bar ${isIdle ? 'idle' : 'active'}`}>
      <div className="progress-container">
        <div className="task-info">
          <div className="task-header">
            <span className="task-icon">
              {isIdle ? '⚙️' : queueStatus.currentTask!.icon}
            </span>
            <span className="task-name">
              {isIdle ? 'Ready for Action' : queueStatus.currentTask!.name}
            </span>
            {!isIdle && queueStatus.queueLength > 0 && (
              <span className="queue-indicator">
                +{queueStatus.queueLength} queued
              </span>
            )}
          </div>
          <div className="task-description">
            {isIdle 
              ? 'Start an activity from the sidebar to begin earning rewards'
              : queueStatus.currentTask!.description
            }
          </div>
        </div>

        <div className="progress-section">
          <div className="progress-bar-container">
            <div className="progress-bar">
              <div 
                className={`progress-fill ${isIdle ? 'idle-fill' : ''} ${isTransitioning ? 'transitioning' : ''}`}
                style={{ width: `${getProgressPercentage()}%` }}
              />
            </div>
            <div className="progress-text">
              {isIdle ? 'Ready' : `${getProgressPercentage()}%`}
            </div>
          </div>
          
          <div className="progress-details">
            <div className="left-section">
              <span className="time-remaining">
                {isIdle ? 'No active tasks' : (progress ? formatTime(progress.timeRemaining) : '0s')}
              </span>
              <div className={`inline-rewards ${showRewards && recentRewards.length > 0 ? 'visible' : 'hidden'}`}>
                {showRewards && recentRewards.length > 0 ? (
                  recentRewards.map((reward, index) => (
                    <span key={index} className={`inline-reward ${reward.rarity || 'common'}`}>
                      <span className="reward-icon">
                        {reward.type === 'resource' ? '📦' : 
                         reward.type === 'experience' ? '⭐' : 
                         reward.type === 'currency' ? '💰' : '🎁'}
                      </span>
                      <span className="reward-amount">+{reward.quantity}</span>
                    </span>
                  ))
                ) : (
                  // Invisible placeholder to maintain layout space
                  <span className="reward-placeholder">&nbsp;</span>
                )}
              </div>
            </div>
            <span className="completed-count">
              Completed: {queueStatus.totalCompleted}
            </span>
          </div>
        </div>

        <div className="progress-actions">
          {!isIdle ? (
            <button 
              className="stop-button"
              onClick={stopAllTasks}
              title="Stop all tasks"
            >
              ⏹️ Stop
            </button>
          ) : (
            // Invisible placeholder to maintain layout space
            <div className="stop-button-placeholder"></div>
          )}
        </div>
      </div>


    </div>
  );
};

export default UnifiedProgressBar;