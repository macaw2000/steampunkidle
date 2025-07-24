/**
 * Task Queue Management Demo Component
 * For testing and demonstrating the queue management functionality
 */

import React from 'react';
import TaskQueueContainer from './TaskQueueContainer';
import { TaskCompletionResult } from '../../types/taskQueue';

const TaskQueueDemo: React.FC = () => {
  const mockPlayerId = 'demo-player-123';

  const handleTaskComplete = (result: TaskCompletionResult) => {
    console.log('Task completed:', result);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>Task Queue Management Demo</h2>
      <p>This demo shows the comprehensive task queue management interface with:</p>
      <ul>
        <li>✅ Comprehensive queue display with ETAs</li>
        <li>✅ Drag-and-drop task reordering</li>
        <li>✅ Task cancellation and queue clearing controls</li>
        <li>✅ Queue statistics display</li>
        <li>✅ Real-time progress updates</li>
        <li>✅ Mobile-responsive design</li>
      </ul>
      
      <TaskQueueContainer 
        playerId={mockPlayerId}
        defaultMode="management"
        onTaskComplete={handleTaskComplete}
      />
    </div>
  );
};

export default TaskQueueDemo;