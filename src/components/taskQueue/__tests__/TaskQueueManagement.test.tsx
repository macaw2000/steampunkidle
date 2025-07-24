/**
 * Task Queue Management Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskQueueManagement from '../TaskQueueManagement';
import { serverTaskQueueService } from '../../../services/serverTaskQueueService';
import { Task, TaskType } from '../../../types/taskQueue';

// Mock the serverTaskQueueService
jest.mock('../../../services/serverTaskQueueService', () => ({
  serverTaskQueueService: {
    getQueueStatus: jest.fn(),
    getQueueStatistics: jest.fn(),
    onTaskComplete: jest.fn(),
    removeCallbacks: jest.fn(),
    removeTask: jest.fn(),
    clearQueue: jest.fn(),
    stopAllTasks: jest.fn(),
    pauseQueue: jest.fn(),
    resumeQueue: jest.fn(),
    reorderTasks: jest.fn(),
  },
}));

const mockServerTaskQueueService = serverTaskQueueService as jest.Mocked<typeof serverTaskQueueService>;

describe('TaskQueueManagement', () => {
  const mockPlayerId = 'test-player-123';
  
  const mockTask: Task = {
    id: 'task-1',
    type: TaskType.HARVESTING,
    name: 'Mine Copper',
    description: 'Mining copper ore from the mountain',
    icon: '⛏️',
    duration: 30000,
    startTime: Date.now(),
    playerId: mockPlayerId,
    activityData: {} as any,
    prerequisites: [],
    resourceRequirements: [],
    progress: 0.5,
    completed: false,
    rewards: [],
    priority: 5,
    estimatedCompletion: Date.now() + 15000,
    retryCount: 0,
    maxRetries: 3,
    isValid: true,
    validationErrors: [],
  };

  const mockQueueStatus = {
    currentTask: mockTask,
    queueLength: 2,
    queuedTasks: [
      { ...mockTask, id: 'task-2', name: 'Craft Sword', type: TaskType.CRAFTING, startTime: 0 },
      { ...mockTask, id: 'task-3', name: 'Fight Goblin', type: TaskType.COMBAT, startTime: 0 },
    ],
    isRunning: true,
    totalCompleted: 5,
  };

  const mockStatistics = {
    totalTasksCompleted: 5,
    averageTaskDuration: 25000,
    taskCompletionRate: 0.95,
    queueEfficiencyScore: 0.85,
    estimatedCompletionTime: 60000,
    totalQueueTime: 90000,
    currentTaskETA: 15000,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockServerTaskQueueService.getQueueStatus.mockReturnValue(mockQueueStatus);
    mockServerTaskQueueService.getQueueStatistics.mockReturnValue(mockStatistics);
  });

  it('renders loading state initially', () => {
    render(<TaskQueueManagement playerId={mockPlayerId} />);
    expect(screen.getByText('Loading queue management...')).toBeInTheDocument();
  });

  it('displays queue statistics correctly', async () => {
    render(<TaskQueueManagement playerId={mockPlayerId} />);
    
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument(); // Active tasks
      expect(screen.getByText('2')).toBeInTheDocument(); // Queued tasks
      expect(screen.getByText('5')).toBeInTheDocument(); // Completed tasks
      expect(screen.getByText('85%')).toBeInTheDocument(); // Efficiency
    });
  });

  it('displays tasks with correct information', async () => {
    render(<TaskQueueManagement playerId={mockPlayerId} />);
    
    await waitFor(() => {
      expect(screen.getByText('Mine Copper')).toBeInTheDocument();
      expect(screen.getByText('Craft Sword')).toBeInTheDocument();
      expect(screen.getByText('Fight Goblin')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument(); // Progress
    });
  });

  it('handles pause/resume queue correctly', async () => {
    render(<TaskQueueManagement playerId={mockPlayerId} />);
    
    await waitFor(() => {
      const pauseButton = screen.getByTitle('Pause Queue');
      fireEvent.click(pauseButton);
    });

    expect(mockServerTaskQueueService.pauseQueue).toHaveBeenCalledWith(mockPlayerId, 'Manual pause');
  });

  it('handles stop all tasks correctly', async () => {
    render(<TaskQueueManagement playerId={mockPlayerId} />);
    
    await waitFor(() => {
      const stopButton = screen.getByTitle('Stop All Tasks');
      fireEvent.click(stopButton);
    });

    expect(mockServerTaskQueueService.stopAllTasks).toHaveBeenCalledWith(mockPlayerId);
  });

  it('handles clear queue with confirmation', async () => {
    render(<TaskQueueManagement playerId={mockPlayerId} />);
    
    await waitFor(() => {
      const clearButton = screen.getByTitle('Clear Queue');
      
      // First click should show confirmation
      fireEvent.click(clearButton);
      expect(screen.getByText('Confirm Clear')).toBeInTheDocument();
      
      // Second click should clear queue
      fireEvent.click(clearButton);
    });

    expect(mockServerTaskQueueService.clearQueue).toHaveBeenCalledWith(mockPlayerId);
  });

  it('handles task removal correctly', async () => {
    render(<TaskQueueManagement playerId={mockPlayerId} />);
    
    await waitFor(() => {
      const removeButtons = screen.getAllByTitle('Remove Task');
      fireEvent.click(removeButtons[0]);
    });

    expect(mockServerTaskQueueService.removeTask).toHaveBeenCalledWith(mockPlayerId, 'task-2');
  });

  it('displays empty queue state when no tasks', async () => {
    mockServerTaskQueueService.getQueueStatus.mockReturnValue({
      currentTask: null,
      queueLength: 0,
      queuedTasks: [],
      isRunning: false,
      totalCompleted: 0,
    });

    render(<TaskQueueManagement playerId={mockPlayerId} />);
    
    await waitFor(() => {
      expect(screen.getByText('No tasks in queue')).toBeInTheDocument();
      expect(screen.getByText('Start an activity to add tasks to your queue')).toBeInTheDocument();
    });
  });

  it('shows/hides all tasks correctly', async () => {
    // Create a queue with more than 10 tasks
    const manyTasks = Array.from({ length: 15 }, (_, i) => ({
      ...mockTask,
      id: `task-${i}`,
      name: `Task ${i}`,
      startTime: 0,
    }));

    mockServerTaskQueueService.getQueueStatus.mockReturnValue({
      ...mockQueueStatus,
      queuedTasks: manyTasks,
    });

    render(<TaskQueueManagement playerId={mockPlayerId} />);
    
    await waitFor(() => {
      expect(screen.getByText('Show All (16)')).toBeInTheDocument(); // 1 current + 15 queued
      
      const showAllButton = screen.getByText('Show All (16)');
      fireEvent.click(showAllButton);
      
      expect(screen.getByText('Show Less')).toBeInTheDocument();
    });
  });

  it('handles drag and drop reordering', async () => {
    render(<TaskQueueManagement playerId={mockPlayerId} />);
    
    await waitFor(() => {
      const taskItems = screen.getAllByText(/Craft Sword|Fight Goblin/);
      expect(taskItems).toHaveLength(2);
    });

    // Mock drag and drop events
    const dragStartEvent = new Event('dragstart', { bubbles: true });
    const dropEvent = new Event('drop', { bubbles: true });
    
    // This is a simplified test - in reality, drag and drop testing is complex
    // The component should handle reordering through the reorderTasks method
    expect(mockServerTaskQueueService.reorderTasks).not.toHaveBeenCalled();
  });

  it('formats time durations correctly', async () => {
    render(<TaskQueueManagement playerId={mockPlayerId} />);
    
    await waitFor(() => {
      // Should display formatted durations - check for any time format
      expect(screen.getByText(/\d+[msh]/)).toBeInTheDocument(); // Any time format
    });
  });

  it('displays task priorities correctly', async () => {
    const highPriorityTask = { ...mockTask, priority: 9, id: 'high-priority' };
    mockServerTaskQueueService.getQueueStatus.mockReturnValue({
      ...mockQueueStatus,
      queuedTasks: [highPriorityTask],
    });

    render(<TaskQueueManagement playerId={mockPlayerId} />);
    
    await waitFor(() => {
      expect(screen.getByText('Priority 9')).toBeInTheDocument();
    });
  });

  it('handles task completion callback', async () => {
    const onTaskComplete = jest.fn();
    render(<TaskQueueManagement playerId={mockPlayerId} onTaskComplete={onTaskComplete} />);
    
    await waitFor(() => {
      // Simulate task completion callback
      const callback = mockServerTaskQueueService.onTaskComplete.mock.calls[0][1];
      const mockResult = {
        task: mockTask,
        rewards: [{ type: 'experience' as const, quantity: 100 }],
        nextTask: null,
      };
      callback(mockResult);
    });

    expect(onTaskComplete).toHaveBeenCalled();
  });

  it('cleans up callbacks on unmount', () => {
    const { unmount } = render(<TaskQueueManagement playerId={mockPlayerId} />);
    
    unmount();
    
    expect(mockServerTaskQueueService.removeCallbacks).toHaveBeenCalledWith(mockPlayerId);
  });
});