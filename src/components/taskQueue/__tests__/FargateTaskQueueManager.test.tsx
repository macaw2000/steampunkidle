/**
 * Fargate Task Queue Manager Component Tests
 * Tests for UI components and real-time integration
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import FargateTaskQueueManager from '../FargateTaskQueueManager';
import { TaskType } from '../../../types/taskQueue';
import { TaskUtils } from '../../../utils/taskUtils';

// Mock the Fargate service
jest.mock('../../../services/fargateGameEngineService', () => {
  const mockFargateService = {
    syncPlayerQueue: jest.fn(),
    getLocalQueueStatus: jest.fn(),
    getQueueStatistics: jest.fn(),
    getHealthStatus: jest.fn(),
    addTaskToQueue: jest.fn(),
    stopAllTasks: jest.fn(),
    onProgress: jest.fn(),
    onTaskComplete: jest.fn(),
    onStatusChange: jest.fn(),
    removeCallbacks: jest.fn(),
  };

  return {
    fargateGameEngineService: mockFargateService,
    FargateGameEngineService: {
      getInstance: () => mockFargateService,
    },
  };
});

// Mock TaskUtils
jest.mock('../../../utils/taskUtils', () => ({
  TaskUtils: {
    createTaskFromActivity: jest.fn(),
  },
}));

// Get the mocked service for use in tests
const mockFargateService = require('../../../services/fargateGameEngineService').fargateGameEngineService;

describe('FargateTaskQueueManager', () => {
  const mockPlayerId = 'test-player-123';
  const mockOnTaskComplete = jest.fn();
  const mockOnStatusChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockFargateService.getHealthStatus.mockReturnValue({
      isHealthy: true,
      lastCheck: Date.now(),
    });
    
    mockFargateService.getLocalQueueStatus.mockReturnValue({
      currentTask: null,
      queueLength: 0,
      queuedTasks: [],
      isRunning: false,
      totalCompleted: 0,
    });
    
    mockFargateService.getQueueStatistics.mockReturnValue({
      totalTasksCompleted: 0,
      averageTaskDuration: 0,
      taskCompletionRate: 0,
      queueEfficiencyScore: 0.5,
      estimatedCompletionTime: 0,
    });
    
    mockFargateService.syncPlayerQueue.mockResolvedValue({
      currentTask: null,
      queueLength: 0,
      queuedTasks: [],
      isRunning: false,
      totalCompleted: 0,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Component Rendering', () => {
    it('should render loading state initially', () => {
      render(
        <FargateTaskQueueManager
          playerId={mockPlayerId}
          onTaskComplete={mockOnTaskComplete}
          onStatusChange={mockOnStatusChange}
        />
      );

      expect(screen.getByText('Connecting to game engine...')).toBeInTheDocument();
    });

    it('should render main interface after loading', async () => {
      render(
        <FargateTaskQueueManager
          playerId={mockPlayerId}
          onTaskComplete={mockOnTaskComplete}
          onStatusChange={mockOnStatusChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Fargate Game Engine')).toBeInTheDocument();
      });

      expect(screen.getByText('Online')).toBeInTheDocument();
      expect(screen.getByText('Start Activity')).toBeInTheDocument();
      expect(screen.getByText('Stop All')).toBeInTheDocument();
    });

    it('should show offline status when service is unhealthy', async () => {
      mockFargateService.getHealthStatus.mockReturnValue({
        isHealthy: false,
        lastCheck: Date.now(),
      });

      render(
        <FargateTaskQueueManager
          playerId={mockPlayerId}
          onTaskComplete={mockOnTaskComplete}
          onStatusChange={mockOnStatusChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Offline')).toBeInTheDocument();
      });
    });
  });

  describe('Queue Statistics', () => {
    it('should display queue statistics correctly', async () => {
      mockFargateService.getQueueStatistics.mockReturnValue({
        totalTasksCompleted: 15,
        averageTaskDuration: 30000,
        taskCompletionRate: 0.85,
        queueEfficiencyScore: 0.75,
        estimatedCompletionTime: 120000,
      });

      render(
        <FargateTaskQueueManager
          playerId={mockPlayerId}
          onTaskComplete={mockOnTaskComplete}
          onStatusChange={mockOnStatusChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('15')).toBeInTheDocument(); // Completed
        expect(screen.getByText('75%')).toBeInTheDocument(); // Efficiency
        expect(screen.getByText('2m')).toBeInTheDocument(); // Queue time
      });
    });
  });

  describe('Current Task Display', () => {
    it('should display current task when active', async () => {
      const mockTask = {
        id: 'test-task-123',
        name: 'Copper Mining',
        description: 'Mining copper ore from the steampunk mines',
        icon: '⛏️',
        progress: 0.6,
        startTime: Date.now() - 18000, // Started 18 seconds ago
        duration: 30000, // 30 seconds total
        type: TaskType.HARVESTING,
      };

      mockFargateService.getLocalQueueStatus.mockReturnValue({
        currentTask: mockTask,
        queueLength: 0,
        queuedTasks: [],
        isRunning: true,
        totalCompleted: 5,
      });

      render(
        <FargateTaskQueueManager
          playerId={mockPlayerId}
          onTaskComplete={mockOnTaskComplete}
          onStatusChange={mockOnStatusChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Current Task: Copper Mining')).toBeInTheDocument();
        expect(screen.getByText('60%')).toBeInTheDocument();
        expect(screen.getByText('Active')).toBeInTheDocument();
      });
    });

    it('should update progress in real-time', async () => {
      const mockTask = {
        id: 'test-task-123',
        name: 'Copper Mining',
        description: 'Mining copper ore',
        icon: '⛏️',
        progress: 0.3,
        startTime: Date.now() - 9000,
        duration: 30000,
        type: TaskType.HARVESTING,
      };

      mockFargateService.getLocalQueueStatus.mockReturnValue({
        currentTask: mockTask,
        queueLength: 0,
        queuedTasks: [],
        isRunning: true,
        totalCompleted: 0,
      });

      render(
        <FargateTaskQueueManager
          playerId={mockPlayerId}
          onTaskComplete={mockOnTaskComplete}
          onStatusChange={mockOnStatusChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('30%')).toBeInTheDocument();
      });

      // Simulate progress update
      const progressCallback = mockFargateService.onProgress.mock.calls[0][1];
      act(() => {
        progressCallback({
          taskId: 'test-task-123',
          progress: 0.7,
          timeRemaining: 9000,
          isComplete: false,
        });
      });

      await waitFor(() => {
        expect(screen.getByText('70%')).toBeInTheDocument();
      });
    });
  });

  describe('Queued Tasks Display', () => {
    it('should display queued tasks', async () => {
      const mockQueuedTasks = [
        {
          id: 'task-1',
          name: 'Gear Crafting',
          icon: '⚙️',
          duration: 45000,
          type: TaskType.CRAFTING,
        },
        {
          id: 'task-2',
          name: 'Steam Golem Combat',
          icon: '🤖',
          duration: 60000,
          type: TaskType.COMBAT,
        },
      ];

      mockFargateService.getLocalQueueStatus.mockReturnValue({
        currentTask: null,
        queueLength: 2,
        queuedTasks: mockQueuedTasks,
        isRunning: false,
        totalCompleted: 0,
      });

      render(
        <FargateTaskQueueManager
          playerId={mockPlayerId}
          onTaskComplete={mockOnTaskComplete}
          onStatusChange={mockOnStatusChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Queued Tasks (2)')).toBeInTheDocument();
        expect(screen.getByText('Gear Crafting')).toBeInTheDocument();
        expect(screen.getByText('Steam Golem Combat')).toBeInTheDocument();
        expect(screen.getByText('45s')).toBeInTheDocument();
        expect(screen.getByText('1m')).toBeInTheDocument();
      });
    });

    it('should show overflow indicator for many tasks', async () => {
      const mockQueuedTasks = Array.from({ length: 8 }, (_, i) => ({
        id: `task-${i}`,
        name: `Task ${i + 1}`,
        icon: '🔧',
        duration: 30000,
        type: TaskType.CRAFTING,
      }));

      mockFargateService.getLocalQueueStatus.mockReturnValue({
        currentTask: null,
        queueLength: 8,
        queuedTasks: mockQueuedTasks,
        isRunning: false,
        totalCompleted: 0,
      });

      render(
        <FargateTaskQueueManager
          playerId={mockPlayerId}
          onTaskComplete={mockOnTaskComplete}
          onStatusChange={mockOnStatusChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Queued Tasks (8)')).toBeInTheDocument();
        expect(screen.getByText('+3 more tasks')).toBeInTheDocument();
      });
    });
  });

  describe('Activity Selection', () => {
    it('should open activity selector when start button is clicked', async () => {
      render(
        <FargateTaskQueueManager
          playerId={mockPlayerId}
          onTaskComplete={mockOnTaskComplete}
          onStatusChange={mockOnStatusChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Start Activity')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Start Activity'));

      await waitFor(() => {
        expect(screen.getByText('Select Activity')).toBeInTheDocument();
        expect(screen.getByText('Copper Mining')).toBeInTheDocument();
        expect(screen.getByText('Gear Crafting')).toBeInTheDocument();
        expect(screen.getByText('Steam Golem Combat')).toBeInTheDocument();
      });
    });

    it('should close activity selector when backdrop is clicked', async () => {
      render(
        <FargateTaskQueueManager
          playerId={mockPlayerId}
          onTaskComplete={mockOnTaskComplete}
          onStatusChange={mockOnStatusChange}
        />
      );

      await waitFor(() => {
        fireEvent.click(screen.getByText('Start Activity'));
      });

      await waitFor(() => {
        expect(screen.getByText('Select Activity')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: '✕' }));

      await waitFor(() => {
        expect(screen.queryByText('Select Activity')).not.toBeInTheDocument();
      });
    });

    it('should start activity immediately when "Start Now" is clicked', async () => {
      const mockTask = { id: 'test-task', name: 'Test Task' };
      (TaskUtils.createTaskFromActivity as jest.Mock).mockReturnValue(mockTask);

      render(
        <FargateTaskQueueManager
          playerId={mockPlayerId}
          onTaskComplete={mockOnTaskComplete}
          onStatusChange={mockOnStatusChange}
        />
      );

      await waitFor(() => {
        fireEvent.click(screen.getByText('Start Activity'));
      });

      await waitFor(() => {
        expect(screen.getByText('Copper Mining')).toBeInTheDocument();
      });

      const startButtons = screen.getAllByText('▶️ Start Now');
      fireEvent.click(startButtons[0]);

      await waitFor(() => {
        expect(mockFargateService.stopAllTasks).toHaveBeenCalledWith(mockPlayerId);
        expect(mockFargateService.addTaskToQueue).toHaveBeenCalledWith(mockPlayerId, mockTask);
      });
    });

    it('should queue activity when "Queue" is clicked', async () => {
      const mockTask = { id: 'test-task', name: 'Test Task' };
      (TaskUtils.createTaskFromActivity as jest.Mock).mockReturnValue(mockTask);

      render(
        <FargateTaskQueueManager
          playerId={mockPlayerId}
          onTaskComplete={mockOnTaskComplete}
          onStatusChange={mockOnStatusChange}
        />
      );

      await waitFor(() => {
        fireEvent.click(screen.getByText('Start Activity'));
      });

      await waitFor(() => {
        expect(screen.getByText('Gear Crafting')).toBeInTheDocument();
      });

      const queueButtons = screen.getAllByText('📋 Queue');
      fireEvent.click(queueButtons[0]);

      await waitFor(() => {
        expect(mockFargateService.addTaskToQueue).toHaveBeenCalledWith(mockPlayerId, mockTask);
        expect(mockFargateService.stopAllTasks).not.toHaveBeenCalled();
      });
    });
  });

  describe('Task Management', () => {
    it('should stop all tasks when stop button is clicked', async () => {
      mockFargateService.getLocalQueueStatus.mockReturnValue({
        currentTask: { id: 'task-1', name: 'Active Task' },
        queueLength: 1,
        queuedTasks: [{ id: 'task-2', name: 'Queued Task' }],
        isRunning: true,
        totalCompleted: 0,
      });

      render(
        <FargateTaskQueueManager
          playerId={mockPlayerId}
          onTaskComplete={mockOnTaskComplete}
          onStatusChange={mockOnStatusChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Stop All')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Stop All'));

      await waitFor(() => {
        expect(mockFargateService.stopAllTasks).toHaveBeenCalledWith(mockPlayerId);
      });
    });

    it('should disable controls when service is unhealthy', async () => {
      mockFargateService.getHealthStatus.mockReturnValue({
        isHealthy: false,
        lastCheck: Date.now(),
      });

      render(
        <FargateTaskQueueManager
          playerId={mockPlayerId}
          onTaskComplete={mockOnTaskComplete}
          onStatusChange={mockOnStatusChange}
        />
      );

      await waitFor(() => {
        const startButton = screen.getByText('Start Activity');
        const stopButton = screen.getByText('Stop All');
        
        expect(startButton).toBeDisabled();
        expect(stopButton).toBeDisabled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error messages', async () => {
      mockFargateService.syncPlayerQueue.mockRejectedValue(new Error('Connection failed'));

      render(
        <FargateTaskQueueManager
          playerId={mockPlayerId}
          onTaskComplete={mockOnTaskComplete}
          onStatusChange={mockOnStatusChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Failed to connect to game engine')).toBeInTheDocument();
      });
    });

    it('should allow dismissing error messages', async () => {
      mockFargateService.addTaskToQueue.mockRejectedValue(new Error('Task failed'));

      render(
        <FargateTaskQueueManager
          playerId={mockPlayerId}
          onTaskComplete={mockOnTaskComplete}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Trigger an error by trying to add a task
      await waitFor(() => {
        fireEvent.click(screen.getByText('Start Activity'));
      });

      await waitFor(() => {
        const startButtons = screen.getAllByText('▶️ Start Now');
        fireEvent.click(startButtons[0]);
      });

      await waitFor(() => {
        expect(screen.getByText('Failed to start activity')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('✕'));

      await waitFor(() => {
        expect(screen.queryByText('Failed to start activity')).not.toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no tasks are active', async () => {
      render(
        <FargateTaskQueueManager
          playerId={mockPlayerId}
          onTaskComplete={mockOnTaskComplete}
          onStatusChange={mockOnStatusChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('No active tasks')).toBeInTheDocument();
        expect(screen.getByText('Start an activity to begin processing tasks with the Fargate game engine')).toBeInTheDocument();
        expect(screen.getByText('Start Your First Activity')).toBeInTheDocument();
      });
    });
  });

  describe('Callback Integration', () => {
    it('should call onTaskComplete when task completes', async () => {
      render(
        <FargateTaskQueueManager
          playerId={mockPlayerId}
          onTaskComplete={mockOnTaskComplete}
          onStatusChange={mockOnStatusChange}
        />
      );

      await waitFor(() => {
        expect(mockFargateService.onTaskComplete).toHaveBeenCalled();
      });

      const taskCompleteCallback = mockFargateService.onTaskComplete.mock.calls[0][1];
      const mockResult = {
        task: { id: 'test-task', name: 'Test Task', completed: true },
        rewards: [],
        nextTask: null,
      };

      act(() => {
        taskCompleteCallback(mockResult);
      });

      expect(mockOnTaskComplete).toHaveBeenCalledWith(mockResult);
    });

    it('should call onStatusChange when status changes', async () => {
      render(
        <FargateTaskQueueManager
          playerId={mockPlayerId}
          onTaskComplete={mockOnTaskComplete}
          onStatusChange={mockOnStatusChange}
        />
      );

      await waitFor(() => {
        expect(mockFargateService.onStatusChange).toHaveBeenCalled();
      });

      const statusChangeCallback = mockFargateService.onStatusChange.mock.calls[0][1];
      const mockStatus = {
        currentTask: null,
        queueLength: 0,
        queuedTasks: [],
        isRunning: false,
        totalCompleted: 5,
      };

      act(() => {
        statusChangeCallback(mockStatus);
      });

      expect(mockOnStatusChange).toHaveBeenCalledWith(mockStatus);
    });
  });

  describe('Cleanup', () => {
    it('should remove callbacks on unmount', async () => {
      const { unmount } = render(
        <FargateTaskQueueManager
          playerId={mockPlayerId}
          onTaskComplete={mockOnTaskComplete}
          onStatusChange={mockOnStatusChange}
        />
      );

      await waitFor(() => {
        expect(mockFargateService.onProgress).toHaveBeenCalled();
      });

      unmount();

      expect(mockFargateService.removeCallbacks).toHaveBeenCalledWith(mockPlayerId);
    });
  });
});