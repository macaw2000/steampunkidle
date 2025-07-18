import React, { useEffect, useState } from 'react';
import { serverTaskQueueService } from '../../services/serverTaskQueueService';
import './UnifiedProgressBar.css';

interface UnifiedProgressBarProps {
  playerId: string;
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

const UnifiedProgressBar: React.FC<UnifiedProgressBarProps> = ({ playerId }) => {
  const [currentTask, setCurrentTask] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [recentItems, setRecentItems] = useState<any[]>([]);

  useEffect(() => {
    // Set up progress tracking
    serverTaskQueueService.onProgress(playerId, (progressData) => {
      setProgress(progressData.progress);
      setTimeRemaining(progressData.timeRemaining);
    });

    // Set up task completion tracking
    serverTaskQueueService.onTaskComplete(playerId, (result) => {
      // Update queue status after completion
      const status = serverTaskQueueService.getQueueStatus(playerId);
      setQueueStatus(status);
      setCurrentTask(status.currentTask);
      
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
    });

    // Update queue status periodically
    const interval = setInterval(() => {
      const status = serverTaskQueueService.getQueueStatus(playerId);
      setQueueStatus(status);
      setCurrentTask(status.currentTask);
    }, 1000);

    // Initial load
    const initialStatus = serverTaskQueueService.getQueueStatus(playerId);
    setQueueStatus(initialStatus);
    setCurrentTask(initialStatus.currentTask);

    return () => {
      // Clean up callbacks
      serverTaskQueueService.removeCallbacks(playerId);
      clearInterval(interval);
    };
  }, [playerId]);

  if (!currentTask) {
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
      <div className="progress-main">
        <div className="task-info">
          <span className="task-icon">{currentTask.icon}</span>
          <span className="task-name">{currentTask.name}</span>
          <span className="task-time">{Math.ceil(timeRemaining / 1000)}s</span>
        </div>
        
        <div className="progress-container">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <span className="progress-text">{Math.round(progress * 100)}%</span>
        </div>

        <div className="progress-controls">
          {queueStatus && queueStatus.queueLength > 0 && (
            <div className="queue-info">
              <span>+{queueStatus.queueLength} queued</span>
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