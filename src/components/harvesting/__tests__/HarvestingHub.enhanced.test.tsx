/**
 * Enhanced Harvesting Hub Component Tests
 * Tests for flexible controls, real-time progress, and completion notifications
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import HarvestingHub from '../HarvestingHub';
import { serverTaskQueueService } from '../../../services/serverTaskQueueService';
import { harvestingService } from '../../../services/harvestingService';
import { HarvestingCategory } from '../../../types/harvesting';
import { TaskType } from '../../../types/taskQueue';

// Mock services
jest.mock('../../../services/serverTaskQueueService');
jest.mock('../../../services/harvestingService');

const mockServerTaskQueueService = serverTaskQueueService as jest.Mocked<typeof serverTaskQueueService>;
const mockHarvestingService = harvestingService as jest.Mocked<typeof harvestingService>;

describe('HarvestingHub Enhanced Features', () => {
  const mockProps = {
    playerId: 'test-player-1',
    playerLevel: 5,
    playerStats: {
      intelligence: 10,
      dexterity: 8,
      strength: 12,
      perception: 9
    },
    onRewardsReceived: jest.fn(),
    onClose: jest.fn()
  };

  const mockActivity = {
    id: 'literary-research',
    name: 'Literary Research',
    description: 'Study ancient texts and manuscripts',
    icon: '📚',
    category: HarvestingCategory.LITERARY,
    baseTime: 30,
    energyCost: 5,
    requiredLevel: 1,
    requiredStats: { intelligence: 5 },
    statBonuses: { intelligence: 2 },
    primaryMaterial: 'research-notes',
    exoticItems: ['ancient-manuscript', 'rare-ink']
  };

  const mockTask = {
    id: 'task-1',
    type: TaskType.HARVESTING,
    name: 'Literary Research',
    description: 'Study ancient texts and manuscripts',
    icon: '📚',
    duration: 30000,
    startTime: Date.now(),
    playerId: 'test-player-1',
    activityData: mockActivity,
    prerequisites: [],
    resourceRequirements: [],
    progress: 0.5,
    completed: false,
    rewards: [],
    priority: 1,
    estimatedCompletion: Date.now() + 15000,
    retryCount: 0,
    maxRetries: 3,
    isValid: true,
    validationErrors: []
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock harvesting service
    mockHarvestingService.getAvailableActivities.mockReturnValue([mockActivity]);
    mockHarvestingService.getPlayerStats.mockReturnValue({
      totalHarvests: 10,
      totalTimeSpent: 300,
      rareFindCount: 2,
      legendaryFindCount: 0,
      categoryLevels: {
        [HarvestingCategory.LITERARY]: 3,
        [HarvestingCategory.MECHANICAL]: 1,
        [HarvestingCategory.ALCHEMICAL]: 1,
        [HarvestingCategory.ARCHAEOLOGICAL]: 1,
        [HarvestingCategory.BOTANICAL]: 1,
        [HarvestingCategory.METALLURGICAL]: 1,
        [HarvestingCategory.ELECTRICAL]: 1,
        [HarvestingCategory.AERONAUTICAL]: 1
      }
    });

    // Mock server task queue service
    mockServerTaskQueueService.getQueueStatus.mockReturnValue({
      currentTask: null,
      queueLength: 0,
      queuedTasks: [],
      isRunning: false,
      totalCompleted: 0
    });

    mockServerTaskQueueService.startHarvestingTask.mockResolvedValue(undefined);
    mockServerTaskQueueService.queueHarvestingTask.mockResolvedValue(undefined);
    mockServerTaskQueueService.onTaskComplete.mockImplementation(() => {});
    mockServerTaskQueueService.onProgress.mockImplementation(() => {});
    mockServerTaskQueueService.removeCallbacks.mockImplementation(() => {});
  });

  describe('Immediate Access Interface', () => {
    test('should display harvesting interface immediately without navigation delays', () => {
      render(<HarvestingHub {...mockProps} />);
      
      // Interface should be immediately visible
      expect(screen.getByText('🔧 Steampunk Resource Harvesting')).toBeInTheDocument();
      expect(screen.getByText('Choose Your Pursuit')).toBeInTheDocument();
      expect(screen.getByText('Literary Pursuits')).toBeInTheDocument();
    });

    test('should show available resources, collection rates, and activity categories', () => {
      render(<HarvestingHub {...mockProps} />);
      
      // Should display activity categories
      expect(screen.getByText('Literary Pursuits')).toBeInTheDocument();
      
      // Should display activity details
      expect(screen.getByText('Literary Research')).toBeInTheDocument();
      expect(screen.getByText('Study ancient texts and manuscripts')).toBeInTheDocument();
      
      // Should display collection rates and stats
      expect(screen.getByText(/Duration:/)).toBeInTheDocument();
      expect(screen.getByText(/Energy:/)).toBeInTheDocument();
      expect(screen.getByText(/Level:/)).toBeInTheDocument();
    });
  });

  describe('Flexible Control Options', () => {
    test('should show number input for rounds with infinite default option', () => {
      render(<HarvestingHub {...mockProps} />);
      
      // Should have rounds input with infinite symbol placeholder
      const roundsInput = screen.getByPlaceholderText('∞');
      expect(roundsInput).toBeInTheDocument();
      expect(roundsInput).toHaveValue('');
      
      // Should have infinite button
      const infiniteBtn = screen.getByText('∞');
      expect(infiniteBtn).toBeInTheDocument();
      expect(infiniteBtn).toHaveClass('active');
    });

    test('should allow setting specific number of rounds', async () => {
      render(<HarvestingHub {...mockProps} />);
      
      const roundsInput = screen.getByPlaceholderText('∞');
      
      // Enter specific number of rounds
      fireEvent.change(roundsInput, { target: { value: '5' } });
      expect(roundsInput).toHaveValue(5);
      
      // Infinite button should no longer be active
      const infiniteBtn = screen.getByText('∞');
      expect(infiniteBtn).not.toHaveClass('active');
    });

    test('should reset to infinite when clicking infinite button', async () => {
      render(<HarvestingHub {...mockProps} />);
      
      const roundsInput = screen.getByPlaceholderText('∞');
      const infiniteBtn = screen.getByText('∞');
      
      // Set specific rounds first
      fireEvent.change(roundsInput, { target: { value: '3' } });
      expect(roundsInput).toHaveValue(3);
      
      // Click infinite button
      fireEvent.click(infiniteBtn);
      expect(roundsInput).toHaveValue('');
      expect(infiniteBtn).toHaveClass('active');
    });

    test('should have Start Harvesting and Add to Queue buttons', () => {
      render(<HarvestingHub {...mockProps} />);
      
      expect(screen.getByText('🚀 Start')).toBeInTheDocument();
      expect(screen.getByText('➕ Queue')).toBeInTheDocument();
    });
  });

  describe('Activity Management', () => {
    test('should start harvesting immediately and close dialog', async () => {
      render(<HarvestingHub {...mockProps} />);
      
      const startButton = screen.getByText('🚀 Start');
      fireEvent.click(startButton);
      
      // Should call start harvesting with infinite rounds by default
      expect(mockServerTaskQueueService.startHarvestingTask).toHaveBeenCalledWith(
        'test-player-1',
        mockActivity,
        expect.any(Object)
      );
      
      // Should close dialog
      expect(mockProps.onClose).toHaveBeenCalled();
    });

    test('should start harvesting with specified rounds', async () => {
      render(<HarvestingHub {...mockProps} />);
      
      // Set specific rounds
      const roundsInput = screen.getByPlaceholderText('∞');
      fireEvent.change(roundsInput, { target: { value: '3' } });
      
      // Start harvesting
      const startButton = screen.getByText('🚀 Start');
      fireEvent.click(startButton);
      
      expect(mockServerTaskQueueService.startHarvestingTask).toHaveBeenCalledWith(
        'test-player-1',
        expect.objectContaining({
          ...mockActivity,
          rounds: 3
        }),
        expect.any(Object)
      );
    });

    test('should add to queue without interrupting current activities', async () => {
      render(<HarvestingHub {...mockProps} />);
      
      const queueButton = screen.getByText('➕ Queue');
      fireEvent.click(queueButton);
      
      expect(mockServerTaskQueueService.queueHarvestingTask).toHaveBeenCalledWith(
        'test-player-1',
        expect.objectContaining(mockActivity),
        expect.any(Object)
      );
      
      // Should close dialog
      expect(mockProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Real-time Progress Feedback', () => {
    test('should display current task progress when active', () => {
      // Mock active task
      mockServerTaskQueueService.getQueueStatus.mockReturnValue({
        currentTask: mockTask,
        queueLength: 1,
        queuedTasks: [],
        isRunning: true,
        totalCompleted: 0
      });

      render(<HarvestingHub {...mockProps} />);
      
      expect(screen.getByText('🔄 Active Harvesting Operations')).toBeInTheDocument();
      expect(screen.getByText('Literary Research')).toBeInTheDocument();
      expect(screen.getByText('🟢 Active')).toBeInTheDocument();
    });

    test('should show progress bar and time information', () => {
      mockServerTaskQueueService.getQueueStatus.mockReturnValue({
        currentTask: mockTask,
        queueLength: 1,
        queuedTasks: [],
        isRunning: true,
        totalCompleted: 0
      });

      render(<HarvestingHub {...mockProps} />);
      
      // Should have progress bar
      const progressBar = screen.getByRole('progressbar', { hidden: true }) || 
                         document.querySelector('.progress-bar');
      expect(progressBar).toBeInTheDocument();
    });

    test('should display queued tasks', () => {
      const queuedTask = { ...mockTask, id: 'queued-task-1', name: 'Queued Research' };
      
      mockServerTaskQueueService.getQueueStatus.mockReturnValue({
        currentTask: mockTask,
        queueLength: 2,
        queuedTasks: [queuedTask],
        isRunning: true,
        totalCompleted: 0
      });

      render(<HarvestingHub {...mockProps} />);
      
      expect(screen.getByText('📋 Queued Activities (1)')).toBeInTheDocument();
      expect(screen.getByText('Queued Research')).toBeInTheDocument();
    });

    test('should update progress in real-time', async () => {
      jest.useFakeTimers();
      
      mockServerTaskQueueService.getQueueStatus.mockReturnValue({
        currentTask: mockTask,
        queueLength: 1,
        queuedTasks: [],
        isRunning: true,
        totalCompleted: 0
      });

      render(<HarvestingHub {...mockProps} />);
      
      // Fast-forward time to trigger updates
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      // Should call getQueueStatus for updates
      expect(mockServerTaskQueueService.getQueueStatus).toHaveBeenCalled();
      
      jest.useRealTimers();
    });
  });

  describe('Completion Notifications', () => {
    test('should show completion notification when task completes', async () => {
      let taskCompleteCallback: ((result: any) => void) | null = null;
      
      mockServerTaskQueueService.onTaskComplete.mockImplementation((playerId, callback) => {
        taskCompleteCallback = callback;
      });

      render(<HarvestingHub {...mockProps} />);
      
      // Simulate task completion
      const completionResult = {
        taskId: 'task-1',
        taskName: 'Literary Research',
        success: true,
        rewards: [
          { type: 'resource', itemId: 'research-notes', quantity: 1, isRare: false },
          { type: 'resource', itemId: 'ancient-manuscript', quantity: 1, isRare: true }
        ],
        duration: 30000,
        completedAt: Date.now()
      };

      act(() => {
        taskCompleteCallback?.(completionResult);
      });

      await waitFor(() => {
        expect(screen.getByText('Activity Completed!')).toBeInTheDocument();
        expect(screen.getByText(/Literary Research.*has been completed!/)).toBeInTheDocument();
      });
    });

    test('should display earned rewards in notification', async () => {
      let taskCompleteCallback: ((result: any) => void) | null = null;
      
      mockServerTaskQueueService.onTaskComplete.mockImplementation((playerId, callback) => {
        taskCompleteCallback = callback;
      });

      render(<HarvestingHub {...mockProps} />);
      
      const completionResult = {
        taskId: 'task-1',
        taskName: 'Literary Research',
        success: true,
        rewards: [
          { type: 'resource', itemId: 'research-notes', quantity: 1, isRare: false },
          { type: 'resource', itemId: 'ancient-manuscript', quantity: 1, isRare: true }
        ],
        duration: 30000,
        completedAt: Date.now()
      };

      act(() => {
        taskCompleteCallback?.(completionResult);
      });

      await waitFor(() => {
        expect(screen.getByText('Rewards Earned:')).toBeInTheDocument();
        expect(screen.getAllByText('1x')).toHaveLength(2);
        expect(screen.getByText(/research-notes/)).toBeInTheDocument();
        expect(screen.getByText(/ancient-manuscript.*✨/)).toBeInTheDocument();
      });
    });

    test('should auto-hide notifications after 5 seconds', async () => {
      jest.useFakeTimers();
      
      let taskCompleteCallback: ((result: any) => void) | null = null;
      
      mockServerTaskQueueService.onTaskComplete.mockImplementation((playerId, callback) => {
        taskCompleteCallback = callback;
      });

      render(<HarvestingHub {...mockProps} />);
      
      const completionResult = {
        taskId: 'task-1',
        taskName: 'Literary Research',
        success: true,
        rewards: [],
        duration: 30000,
        completedAt: Date.now()
      };

      act(() => {
        taskCompleteCallback?.(completionResult);
      });

      // Notification should be visible
      await waitFor(() => {
        expect(screen.getByText('Activity Completed!')).toBeInTheDocument();
      });

      // Fast-forward 5 seconds
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // Notification should be hidden
      await waitFor(() => {
        expect(screen.queryByText('Activity Completed!')).not.toBeInTheDocument();
      });
      
      jest.useRealTimers();
    });

    test('should allow manual dismissal of notifications', async () => {
      let taskCompleteCallback: ((result: any) => void) | null = null;
      
      mockServerTaskQueueService.onTaskComplete.mockImplementation((playerId, callback) => {
        taskCompleteCallback = callback;
      });

      render(<HarvestingHub {...mockProps} />);
      
      const completionResult = {
        taskId: 'task-1',
        taskName: 'Literary Research',
        success: true,
        rewards: [],
        duration: 30000,
        completedAt: Date.now()
      };

      act(() => {
        taskCompleteCallback?.(completionResult);
      });

      // Notification should be visible
      await waitFor(() => {
        expect(screen.getByText('Activity Completed!')).toBeInTheDocument();
      });

      // Click close button
      const closeButton = screen.getByText('×');
      fireEvent.click(closeButton);

      // Notification should be hidden
      expect(screen.queryByText('Activity Completed!')).not.toBeInTheDocument();
    });

    test('should trigger rewards callback when task completes', async () => {
      let taskCompleteCallback: ((result: any) => void) | null = null;
      
      mockServerTaskQueueService.onTaskComplete.mockImplementation((playerId, callback) => {
        taskCompleteCallback = callback;
      });

      render(<HarvestingHub {...mockProps} />);
      
      const completionResult = {
        taskId: 'task-1',
        taskName: 'Literary Research',
        success: true,
        rewards: [
          { type: 'resource', itemId: 'research-notes', quantity: 1, isRare: false }
        ],
        duration: 30000,
        completedAt: Date.now()
      };

      act(() => {
        taskCompleteCallback?.(completionResult);
      });

      await waitFor(() => {
        expect(mockProps.onRewardsReceived).toHaveBeenCalledWith(completionResult.rewards);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle start harvesting errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();
      
      mockServerTaskQueueService.startHarvestingTask.mockRejectedValue(
        new Error('Server error')
      );

      render(<HarvestingHub {...mockProps} />);
      
      const startButton = screen.getByText('🚀 Start');
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error starting harvesting:', expect.any(Error));
        expect(alertSpy).toHaveBeenCalledWith('Failed to start harvesting activity');
      });

      consoleSpy.mockRestore();
      alertSpy.mockRestore();
    });

    test('should handle queue errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();
      
      mockServerTaskQueueService.queueHarvestingTask.mockRejectedValue(
        new Error('Queue error')
      );

      render(<HarvestingHub {...mockProps} />);
      
      const queueButton = screen.getByText('➕ Queue');
      fireEvent.click(queueButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error adding to queue:', expect.any(Error));
        expect(alertSpy).toHaveBeenCalledWith('Failed to add activity to queue');
      });

      consoleSpy.mockRestore();
      alertSpy.mockRestore();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup callbacks and intervals on unmount', () => {
      const { unmount } = render(<HarvestingHub {...mockProps} />);
      
      unmount();
      
      expect(mockServerTaskQueueService.removeCallbacks).toHaveBeenCalledWith('test-player-1');
    });
  });
});