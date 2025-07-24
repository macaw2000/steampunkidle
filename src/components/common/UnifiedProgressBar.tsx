import React, { useEffect, useState } from 'react';
import { serverTaskQueueService } from '../../services/serverTaskQueueService';
import { Task } from '../../types/taskQueue';
import './UnifiedProgressBar.css';

interface UnifiedProgressBarProps {
  playerId: string;
  showQueuePreview?: boolean;
  maxPreviewTasks?: number;
  showEstimatedTimes?: boolean;
  enableCelebrations?: boolean;
}

// Helper function to format item names for display
const formatItemName = (itemId: string): string => {
  return itemId
    .replace(/_/g, ' ')           // Replace underscores with spaces
    .replace(/-/g, ' ')           // Replace hyphens with spaces
    .replace(/\b\w/g, (l: string) => l.toUpperCase()) // Capitalize first letter of each word
    .replace(/\s+/g, ' ')         // Remove extra spaces
    .trim();                      // Remove leading/trailing spaces
};

// Helper function to format item types
const formatItemType = (type: string): string => {
  if (type === 'experience') return 'XP';
  if (type === 'currency') return 'Gold';
  return type.charAt(0).toUpperCase() + type.slice(1);
};

// Interface for grouped items
interface GroupedItem {
  key: string;
  type: string;
  itemId?: string;
  totalQuantity: number;
  isRare: boolean;
  name: string;
  icon: string;
}

// Helper function to group identical items together
const getGroupedItems = (items: any[]): GroupedItem[] => {
  const grouped = items.reduce((acc, item) => {
    const key = `${item.type}-${item.itemId || 'generic'}`;
    if (!acc[key]) {
      acc[key] = {
        key,
        type: item.type,
        itemId: item.itemId,
        totalQuantity: 0,
        isRare: item.isRare,
        name: item.itemId ? formatItemName(item.itemId) : formatItemType(item.type),
        icon: getItemIcon(item)
      };
    }
    acc[key].totalQuantity += item.quantity;
    return acc;
  }, {} as Record<string, GroupedItem>);
  
  return Object.values(grouped);
};

// Helper function to format time duration
const formatDuration = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

// Helper function to calculate estimated completion time for queued tasks
const calculateEstimatedCompletionTime = (tasks: Task[], currentTaskTimeRemaining: number = 0): number => {
  let totalTime = currentTaskTimeRemaining;
  tasks.forEach(task => {
    totalTime += task.duration;
  });
  return totalTime;
};

// Helper function to get task type icon
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

// Helper function to get item icons
const getItemIcon = (item: any): string => {
  if (item.type === 'experience') return '📚';
  if (item.type === 'currency') return '💰';
  
  // Resource icons based on item ID
  if (item.itemId) {
    const itemId = item.itemId.toLowerCase();
    if (itemId.includes('copper')) return '🟤';
    if (itemId.includes('iron')) return '⚫';
    if (itemId.includes('gold')) return '🟡';
    if (itemId.includes('silver')) return '⚪';
    if (itemId.includes('crystal')) return '💎';
    if (itemId.includes('gem')) return '💍';
    if (itemId.includes('manuscript')) return '📜';
    if (itemId.includes('book')) return '📖';
    if (itemId.includes('scroll')) return '📃';
    if (itemId.includes('gear')) return '⚙️';
    if (itemId.includes('spring')) return '🌀';
    if (itemId.includes('valve')) return '🔧';
    if (itemId.includes('herb')) return '🌿';
    if (itemId.includes('flower')) return '🌸';
    if (itemId.includes('seed')) return '🌱';
    if (itemId.includes('fossil')) return '🦴';
    if (itemId.includes('artifact')) return '🏺';
    if (itemId.includes('relic')) return '⚱️';
  }
  
  // Default icons by rarity
  if (item.isRare) return '✨';
  return '📦';
};

const UnifiedProgressBar: React.FC<UnifiedProgressBarProps> = ({ 
  playerId, 
  showQueuePreview = true,
  maxPreviewTasks = 3,
  showEstimatedTimes = true,
  enableCelebrations = true
}) => {
  const [currentTask, setCurrentTask] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [recentItems, setRecentItems] = useState<any[]>([]);
  const [showMockProgress, setShowMockProgress] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false); // Track transition state
  const [showBlankState, setShowBlankState] = useState(false); // Track blank state
  const [uiControlled, setUiControlled] = useState(false); // When true, UI ignores all backend updates
  const [queuePreview, setQueuePreview] = useState<Task[]>([]);
  const [totalEstimatedTime, setTotalEstimatedTime] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState('');

  useEffect(() => {
    // Set up progress tracking
    serverTaskQueueService.onProgress(playerId, (progressData) => {
      // Completely ignore backend updates when UI is in control
      if (!uiControlled && !isTransitioning && !showBlankState) {
        setProgress(progressData.progress);
        setTimeRemaining(progressData.timeRemaining);
      }
    });

    // Set up task completion tracking
    serverTaskQueueService.onTaskComplete(playerId, (result) => {
      // Take full UI control - ignore all backend updates
      setUiControlled(true);
      setIsTransitioning(true);
      
      // Step 1: Force progress to 100%
      setProgress(1);
      setTimeRemaining(0);
      
      // Show celebration if enabled
      if (enableCelebrations) {
        const taskName = result.task.name || 'Task';
        setCelebrationMessage(`${taskName} completed!`);
        setShowCelebration(true);
        
        // Hide celebration after 2 seconds
        setTimeout(() => {
          setShowCelebration(false);
          setCelebrationMessage('');
        }, 2000);
      }
      
      // Add rewards to recent items display
      if (result.rewards && result.rewards.length > 0) {
        const newItems = result.rewards.map(reward => ({
          id: `${reward.type}-${reward.itemId || 'generic'}-${Date.now()}`,
          type: reward.type,
          itemId: reward.itemId,
          quantity: reward.quantity,
          rarity: reward.rarity,
          isRare: reward.isRare,
          timestamp: Date.now()
        }));
        
        setRecentItems(prev => {
          // Keep only the last 10 items and add new ones
          const updated = [...prev, ...newItems].slice(-10);
          return updated;
        });
        
        // Remove items after 8 seconds
        newItems.forEach(item => {
          setTimeout(() => {
            setRecentItems(prev => prev.filter(existingItem => existingItem.id !== item.id));
          }, 8000);
        });
      }
      
      // Step 2: After showing 100%, go to blank state
      setTimeout(() => {
        setShowBlankState(true);
        setCurrentTask(null);
        setProgress(0);
        setTimeRemaining(0);
        
        // Step 3: After blank state, load new task and return control to backend
        setTimeout(() => {
          const status = serverTaskQueueService.getQueueStatus(playerId);
          setQueueStatus(status);
          setCurrentTask(status.currentTask);
          
          // Reset progress to 0 and return control to backend
          setProgress(0);
          setTimeRemaining(0);
          setShowBlankState(false);
          setIsTransitioning(false);
          setUiControlled(false); // Return control to backend
        }, 1000); // Show blank state for 1 second
      }, 800); // Show 100% for 800ms before blanking
    });

    // Update queue status periodically (but not during UI control)
    const interval = setInterval(() => {
      if (!uiControlled && !isTransitioning && !showBlankState) {
        const status = serverTaskQueueService.getQueueStatus(playerId);
        setQueueStatus(status);
        setCurrentTask(status.currentTask);
        
        // Update queue preview
        if (showQueuePreview && status.queuedTasks) {
          const previewTasks = status.queuedTasks.slice(0, maxPreviewTasks);
          setQueuePreview(previewTasks);
          
          // Calculate total estimated time
          if (showEstimatedTimes) {
            const estimatedTime = calculateEstimatedCompletionTime(previewTasks, timeRemaining);
            setTotalEstimatedTime(estimatedTime);
          }
        }
      }
    }, 1000);

    // Initial load
    const initialStatus = serverTaskQueueService.getQueueStatus(playerId);
    setQueueStatus(initialStatus);
    setCurrentTask(initialStatus.currentTask);
    
    // Initialize queue preview
    if (showQueuePreview && initialStatus.queuedTasks) {
      const previewTasks = initialStatus.queuedTasks.slice(0, maxPreviewTasks);
      setQueuePreview(previewTasks);
      
      if (showEstimatedTimes) {
        const estimatedTime = calculateEstimatedCompletionTime(previewTasks, 0);
        setTotalEstimatedTime(estimatedTime);
      }
    }

    // Add mock progress for development if no real tasks
    if (!initialStatus.currentTask && process.env.NODE_ENV === 'development') {
      console.log('UnifiedProgressBar: No active tasks found, showing mock progress for development');
      setShowMockProgress(true);
      
      // Create mock task
      const mockTask = {
        id: 'mock-task-1',
        name: 'Reading Jules Verne Novels',
        icon: '📚',
        description: 'Immersing in steampunk literature'
      };
      setCurrentTask(mockTask);
      
      // Simulate progress
      let mockProgress = 0;
      let isCompleting = false;
      const mockInterval = setInterval(() => {
        if (!isCompleting) {
          mockProgress += 0.01; // 1% per 100ms = 10 seconds total
          if (mockProgress >= 1) {
            isCompleting = true;
            setProgress(1); // Ensure it shows 100%
            setTimeRemaining(0);
            
            // Add mock rewards
            setRecentItems(prev => {
              const newItem = {
                id: `mock-item-${Date.now()}`,
                type: 'resource',
                itemId: 'book_page',
                quantity: Math.floor(Math.random() * 3) + 1,
                rarity: 'common',
                isRare: Math.random() < 0.2,
                timestamp: Date.now()
              };
              const updated = [...prev, newItem].slice(-10);
              
              // Remove after 8 seconds
              setTimeout(() => {
                setRecentItems(current => current.filter(item => item.id !== newItem.id));
              }, 8000);
              
              return updated;
            });
            
            // Wait at 100%, then go through blank state sequence
            setTimeout(() => {
              setUiControlled(true); // Take UI control
              setIsTransitioning(true);
              
              // Step 2: Show blank state
              setTimeout(() => {
                setShowBlankState(true);
                setCurrentTask(null);
                setProgress(0);
                setTimeRemaining(0);
                
                // Step 3: Restart with new task
                setTimeout(() => {
                  const mockTask = {
                    id: `mock-task-${Date.now()}`,
                    name: 'Reading Jules Verne Novels',
                    icon: '📚',
                    description: 'Immersing in steampunk literature'
                  };
                  setCurrentTask(mockTask);
                  mockProgress = 0;
                  isCompleting = false;
                  setShowBlankState(false);
                  setIsTransitioning(false);
                  setUiControlled(false); // Return control
                }, 1000); // Blank state duration
              }, 800); // Show 100% duration
            }, 500);
          } else {
            setProgress(mockProgress);
            setTimeRemaining((1 - mockProgress) * 10000); // 10 seconds total
          }
        }
      }, 100);
      
      return () => {
        clearInterval(mockInterval);
        clearInterval(interval);
      };
    }

    return () => {
      // Clean up callbacks
      serverTaskQueueService.removeCallbacks(playerId);
      clearInterval(interval);
    };
  }, [playerId]);

  // Show blank state during transition - but keep progress bar visible
  if (showBlankState) {
    return (
      <div className="unified-progress-bar active">
        <div className="progress-main">
          <div className="task-info">
            <span className="task-icon">⏳</span>
            <span className="task-name">Loading next task...</span>
            <span className="task-time">-</span>
          </div>
          
          <div className="progress-container">
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: '0%' }}
              />
            </div>
            <span className="progress-text">0%</span>
          </div>

          <div className="progress-controls">
            <button 
              className="stop-button"
              onClick={() => serverTaskQueueService.stopAllTasks(playerId)}
              title="Stop all tasks"
            >
              ⏹️
            </button>
          </div>
        </div>
        
        {/* Keep recent items visible during blank state */}
        <div className="recent-items">
          <div className="items-list">
            {getGroupedItems(recentItems).map(groupedItem => (
              <div 
                key={groupedItem.key} 
                className={`item-display ${groupedItem.isRare ? 'rare-item' : 'common-item'}`}
                title={groupedItem.name}
              >
                <span className="item-quantity">{groupedItem.totalQuantity}</span>
                <span className="item-icon">{groupedItem.icon}</span>
                {groupedItem.isRare && <span className="rare-indicator">✨</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!currentTask && !isTransitioning) {
    return (
      <div className="unified-progress-bar idle">
        <div className="no-activity">
          <span>No active tasks</span>
        </div>
      </div>
    );
  }

  return (
    <div className="unified-progress-bar active">
      {/* Celebration Overlay */}
      {showCelebration && (
        <div className="celebration-overlay">
          <div className="celebration-content">
            <div className="celebration-icon">🎉</div>
            <div className="celebration-message">{celebrationMessage}</div>
            <div className="celebration-sparkles">✨ ⭐ ✨</div>
          </div>
        </div>
      )}
      
      <div className="progress-main">
        <div className="task-info">
          <span className="task-icon">{currentTask.icon}</span>
          <span className="task-name">
            {currentTask.name}
            {showMockProgress && <span className="mock-indicator"> (Demo)</span>}
          </span>
          <span className="task-time">{Math.ceil(timeRemaining / 1000)}s</span>
        </div>
        
        <div className="progress-container">
          <div className="progress-bar">
            <div 
              className={`progress-fill ${showCelebration ? 'celebrating' : ''}`}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <span className="progress-text">{Math.round(progress * 100)}%</span>
        </div>

        <div className="progress-controls">
          {queueStatus && queueStatus.queueLength > 0 && (
            <div className="queue-info">
              <span>+{queueStatus.queueLength} queued</span>
              {showEstimatedTimes && totalEstimatedTime > 0 && (
                <span className="estimated-time">
                  (~{formatDuration(totalEstimatedTime)})
                </span>
              )}
            </div>
          )}
          <button 
            className="stop-button"
            onClick={() => serverTaskQueueService.stopAllTasks(playerId)}
            title="Stop all tasks"
          >
            ⏹️
          </button>
        </div>
      </div>
      
      {/* Queue Preview */}
      {showQueuePreview && queuePreview.length > 0 && (
        <div className="queue-preview">
          <div className="queue-preview-header">
            <span className="preview-icon">📋</span>
            <span className="preview-title">Next Tasks</span>
            {showEstimatedTimes && totalEstimatedTime > 0 && (
              <span className="preview-total-time">
                Total: {formatDuration(totalEstimatedTime)}
              </span>
            )}
          </div>
          <div className="queue-preview-list">
            {queuePreview.map((task, index) => (
              <div key={task.id} className="preview-task">
                <div className="preview-task-info">
                  <span className="preview-task-icon">{getTaskTypeIcon(task)}</span>
                  <span className="preview-task-emoji">{task.icon}</span>
                  <span className="preview-task-name">{task.name}</span>
                </div>
                <div className="preview-task-meta">
                  <span className="preview-task-position">#{index + 1}</span>
                  {showEstimatedTimes && (
                    <span className="preview-task-duration">
                      {formatDuration(task.duration)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Recent Items Display - Below Progress Bar */}
      <div className="recent-items">
        <div className="items-list">
          {getGroupedItems(recentItems).map(groupedItem => (
            <div 
              key={groupedItem.key} 
              className={`item-display ${groupedItem.isRare ? 'rare-item' : 'common-item'}`}
              title={groupedItem.name}
            >
              <span className="item-quantity">{groupedItem.totalQuantity}</span>
              <span className="item-icon">{groupedItem.icon}</span>
              {groupedItem.isRare && <span className="rare-indicator">✨</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UnifiedProgressBar;