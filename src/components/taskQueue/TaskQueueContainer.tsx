/**
 * Task Queue Container Component
 * Provides both basic display and full management interfaces
 */

import React, { useState } from 'react';
import TaskQueueDisplay from './TaskQueueDisplay';
import TaskQueueManagement from './TaskQueueManagement';
import { TaskCompletionResult } from '../../types/taskQueue';
import './TaskQueueContainer.css';

interface TaskQueueContainerProps {
  playerId: string;
  className?: string;
  defaultMode?: 'display' | 'management';
  onTaskComplete?: (result: TaskCompletionResult) => void;
}

const TaskQueueContainer: React.FC<TaskQueueContainerProps> = ({ 
  playerId, 
  className = '',
  defaultMode = 'display',
  onTaskComplete 
}) => {
  const [mode, setMode] = useState<'display' | 'management'>(defaultMode);

  const toggleMode = () => {
    setMode(prev => prev === 'display' ? 'management' : 'display');
  };

  return (
    <div className={`task-queue-container ${className}`}>
      <div className="queue-mode-toggle">
        <button 
          className={`mode-btn ${mode === 'display' ? 'active' : ''}`}
          onClick={() => setMode('display')}
          title="Basic Queue Display"
        >
          📋 Display
        </button>
        <button 
          className={`mode-btn ${mode === 'management' ? 'active' : ''}`}
          onClick={() => setMode('management')}
          title="Full Queue Management"
        >
          ⚙️ Manage
        </button>
      </div>

      {mode === 'display' ? (
        <TaskQueueDisplay 
          playerId={playerId}
          className="queue-component"
        />
      ) : (
        <TaskQueueManagement 
          playerId={playerId}
          className="queue-component"
          onTaskComplete={onTaskComplete}
        />
      )}
    </div>
  );
};

export default TaskQueueContainer;