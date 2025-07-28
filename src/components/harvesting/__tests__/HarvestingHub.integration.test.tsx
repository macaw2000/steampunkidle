/**
 * Harvesting Hub Integration Tests
 * Tests for activity queuing system and real-time synchronization
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('HarvestingHub Integration Tests', () => {
  const mockProps = {
    playerId: 'test-player-1',
    playerLevel: 10,
    playerStats: {
      intelligence: 15,
      dexterity: 12,
      strength: 18,
      perception: 14
    },
    onRewardsReceived: jest.fn(),
    onClose: jest.fn()
  };

  const mockActivities = [
    {
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
    },
    {
      id: 'mechanical-tinkering',
      name: 'Mechanical Tinkering',
      description: 'Work with gears and clockwork mechanisms',
      icon: '⚙️',
      category: HarvestingCategory.MECHANICAL,
      baseTime: 45,
      energyCost: 8,
      requiredLevel: 3,
      requiredStats: { dexterity: 8 },
      statBonuses: { dexterity: 3 },
      primaryMaterial: 'gear-components',
      exoticItems: ['precision-clockwork', 'steam-valve']
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock harvesting service
    mockHarvestingService.getAvailableActivities.mockReturnValue(mockActivities);
    mockHarvestingService.getPlayerStats.mockReturnValue({
      totalHarvests: 25,
      totalTimeSpent: 750,
      rareFindCount: 5,
      legendaryFindCount: 1,
      categoryLevels: {
        [HarvestingCategory.LITERARY]: 5,
        [HarvestingCategory.MECHANICAL]: 3,
        [HarvestingCategory.ALCHEMICAL]: 2,
        [HarvestingCategory.ARCHAEOLOGICAL]: 2,
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

  describe('Activity Queuing System', () => {
    test('should queue multiple activities sequentially', async () => {
      const user = userEvent.setup();
      render(<HarvestingHub {...mockProps} />);
      
      // Queue first activity
      const firstQueueButton = screen.getAllByText('➕ Queue')[0];
      await user.click(firstQueueButton);
      
      expect(mockServerTaskQueueService.queueHarvestingTask).toHaveBeenCalledWith(
        'test-player-1',
        expect.objectContaining({
          id: 'literary-research',
          name: 'Literary Research'
        }),
        expect.any(Object)
      );
      
      // Switch to mechanical category
      const mechanicalTab = screen.getByText('Mechanical Tinkering');
      await user.click(mechanicalTab);
      
      // Queue second activity
      const secondQueueButton = screen.getByText('➕ Queue');
      await user.click(secondQueueButton);
      
      expect(mockServerTaskQueueService.queueHarvestingTask).toHaveBeenCalledWith(
        'test-player-1',
        expect.objectContaining({
          id: 'mechanical-tinkering',
          name: 'Mechanical Tinkering'
        }),
        expect.any(Object)
      );
    });

    test('should display queued activities in order', () => {
      const queuedTasks = [
        {
          id: 'task-1',
          type: TaskType.HARVESTING,
          name: 'Literary Research',
          description: 'Study ancient texts',
          icon: '📚',
          duration: 30000,
          startTime: Date.now(),
          playerId: 'test-player-1',
          activityData: mockActivities[0],
          prerequisites: [],
          resourceRequirements: [],
          progress: 0,
          completed: false,
          rewards: [],
          priority: 1,
          estimatedCompletion: Date.now() + 30000,
          retryCount: 0,
          maxRetries: 3,
          isValid: true,
          validationErrors: []
        },
        {
          id: 'task-2',
          type: TaskType.HARVESTING,
          name: 'Mechanical Tinkering',
          description: 'Work with gears',
          icon: '⚙️',
          duration: 45000,
          startTime: Date.now(),
          playerId: 'test-player-1',
          activityData: mockActivities[1],
          prerequisites: [],
          resourceRequirements: [],
          progress: 0,
          completed: false,
          rewards: [],
          priority: 2,
          estimatedCompletion: Date.now() + 45000,
          retryCount: 0,
          maxRetries: 3,
          isValid: true,
          validationErrors: []
        }
      ];

      mockServerTaskQueueService.getQueueStatus.mockReturnValue({
        currentTask: null,
        queueLength: 2,
        queuedTasks: queuedTasks,
        isRunning: false,
        totalCompleted: 0
      });

      render(<HarvestingHub {...mockProps} />);
      
      expect(screen.getByText('📋 Queued Activities (2)')).toBeInTheDocument();
      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getByText('#2')).toBeInTheDocument();
      expect(screen.getByText('Literary Research')).toBeInTheDocument();
      expect(screen.getByText('Mechanical Tinkering')).toBeInTheDocument();
    });

    test('should show queue overflow indicator for many tasks', () => {
      const manyTasks = Array.from({ length: 5 }, (_, i) => ({
        id: `task-${i + 1}`,
        type: TaskType.HARVESTING,
        name: `Activity ${i + 1}`,
        description: `Description ${i + 1}`,
        icon: '🔧',
        duration: 30000,
        startTime: Date.now(),
        playerId: 'test-player-1',
        activityData: mockActivities[0],
        prerequisites: [],
        resourceRequirements: [],
        progress: 0,
        completed: false,
        rewards: [],
        priority: i + 1,
        estimatedCompletion: Date.now() + 30000,
        retryCount: 0,
        maxRetries: 3,
        isValid: true,
        validationErrors: []
      }));

      mockServerTaskQueueService.getQueueStatus.mockReturnValue({
        currentTask: null,
        queueLength: 5,
        queuedTasks: manyTasks,
        isRunning: false,
        totalCompleted: 0
      });

      render(<HarvestingHub {...mockProps} />);
      
      // Should show first 3 tasks
      expect(screen.getByText('Activity 1')).toBeInTheDocument();
      expect(screen.getByText('Activity 2')).toBeInTheDocument();
      expect(screen.getByText('Activity 3')).toBeInTheDocument();
      
      // Should show overflow indicator
      expect(screen.getByText('+2 more activities')).toBeInTheDocument();
    });
  });

  describe('Real-time Synchronization', () => {
    test('should update progress in real-time', async () => {
      jest.useFakeTimers();
      
      const currentTask = {
        id: 'current-task',
        type: TaskType.HARVESTING,
        name: 'Literary Research',
        description: 'Study ancient texts',
        icon: '📚',
        duration: 30000,
        startTime: Date.now(),
        playerId: 'test-player-1',
        activityData: mockActivities[0],
        prerequisites: [],
        resourceRequirements: [],
        progress: 0.3,
        completed: false,
        rewards: [],
        priority: 1,
        estimatedCompletion: Date.now() + 21000,
        retryCount: 0,
        maxRetries: 3,
        isValid: true,
        validationErrors: []
      };

      let progressCallback: ((progress: any) => void) | null = null;
      
      mockServerTaskQueueService.getQueueStatus.mockReturnValue({
        currentTask: currentTask,
        queueLength: 1,
        queuedTasks: [],
        isRunning: true,
        totalCompleted: 0
      });

      mockServerTaskQueueService.onProgress.mockImplementation((playerId, callback) => {
        progressCallback = callback;
      });

      render(<HarvestingHub {...mockProps} />);
      
      // Should show initial progress
      expect(screen.getByText('🔄 Active Harvesting Operations')).toBeInTheDocument();
      expect(screen.getByText('🟢 Active')).toBeInTheDocument();
      
      // Simulate progress update
      act(() => {
        progressCallback?.({
          taskId: 'current-task',
          progress: 0.6,
          timeRemaining: 12000,
          isComplete: false
        });
      });

      // Fast-forward time to trigger UI updates
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Should update queue status
      expect(mockServerTaskQueueService.getQueueStatus).toHaveBeenCalled();
      
      jest.useRealTimers();
    });

    test('should handle task completion and start next queued task', async () => {
      let taskCompleteCallback: ((result: any) => void) | null = null;
      
      const queuedTask = {
        id: 'queued-task',
        type: TaskType.HARVESTING,
        name: 'Mechanical Tinkering',
        description: 'Work with gears',
        icon: '⚙️',
        duration: 45000,
        startTime: Date.now(),
        playerId: 'test-player-1',
        activityData: mockActivities[1],
        prerequisites: [],
        resourceRequirements: [],
        progress: 0,
        completed: false,
        rewards: [],
        priority: 1,
        estimatedCompletion: Date.now() + 45000,
        retryCount: 0,
        maxRetries: 3,
        isValid: true,
        validationErrors: []
      };

      // Initially show current task with queued task
      mockServerTaskQueueService.getQueueStatus.mockReturnValueOnce({
        currentTask: {
          id: 'current-task',
          type: TaskType.HARVESTING,
          name: 'Literary Research',
          description: 'Study ancient texts',
          icon: '📚',
          duration: 30000,
          startTime: Date.now(),
          playerId: 'test-player-1',
          activityData: mockActivities[0],
          prerequisites: [],
          resourceRequirements: [],
          progress: 0.9,
          completed: false,
          rewards: [],
          priority: 1,
          estimatedCompletion: Date.now() + 3000,
          retryCount: 0,
          maxRetries: 3,
          isValid: true,
          validationErrors: []
        },
        queueLength: 2,
        queuedTasks: [queuedTask],
        isRunning: true,
        totalCompleted: 0
      });

      mockServerTaskQueueService.onTaskComplete.mockImplementation((playerId, callback) => {
        taskCompleteCallback = callback;
      });

      render(<HarvestingHub {...mockProps} />);
      
      // Should show current task and queued task
      expect(screen.getByText('Literary Research')).toBeInTheDocument();
      expect(screen.getByText('📋 Queued Activities (1)')).toBeInTheDocument();
      expect(screen.getByText('Mechanical Tinkering')).toBeInTheDocument();
      
      // After task completion, show next task as current
      mockServerTaskQueueService.getQueueStatus.mockReturnValue({
        currentTask: queuedTask,
        queueLength: 1,
        queuedTasks: [],
        isRunning: true,
        totalCompleted: 1
      });

      // Simulate task completion
      act(() => {
        taskCompleteCallback?.({
          taskId: 'current-task',
          taskName: 'Literary Research',
          success: true,
          rewards: [
            { type: 'resource', itemId: 'research-notes', quantity: 1, isRare: false }
          ],
          duration: 30000,
          completedAt: Date.now()
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Activity Completed!')).toBeInTheDocument();
      });
    });
  });

  describe('Performance and Optimization', () => {
    test('should not cause excessive re-renders during progress updates', async () => {
      jest.useFakeTimers();
      
      const renderSpy = jest.fn();
      const TestWrapper = (props: any) => {
        renderSpy();
        return <HarvestingHub {...props} />;
      };

      const currentTask = {
        id: 'current-task',
        type: TaskType.HARVESTING,
        name: 'Literary Research',
        description: 'Study ancient texts',
        icon: '📚',
        duration: 30000,
        startTime: Date.now(),
        playerId: 'test-player-1',
        activityData: mockActivities[0],
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

      mockServerTaskQueueService.getQueueStatus.mockReturnValue({
        currentTask: currentTask,
        queueLength: 1,
        queuedTasks: [],
        isRunning: true,
        totalCompleted: 0
      });

      render(<TestWrapper {...mockProps} />);
      
      const initialRenderCount = renderSpy.mock.calls.length;
      
      // Fast-forward multiple update cycles
      act(() => {
        jest.advanceTimersByTime(5000);
      });
      
      // Should not cause excessive re-renders
      const finalRenderCount = renderSpy.mock.calls.length;
      expect(finalRenderCount - initialRenderCount).toBeLessThan(10);
      
      jest.useRealTimers();
    });

    test('should handle rapid task completions without UI glitches', async () => {
      let taskCompleteCallback: ((result: any) => void) | null = null;
      
      mockServerTaskQueueService.onTaskComplete.mockImplementation((playerId, callback) => {
        taskCompleteCallback = callback;
      });

      render(<HarvestingHub {...mockProps} />);
      
      // Simulate rapid task completions
      const completions = [
        {
          taskId: 'task-1',
          taskName: 'Literary Research',
          success: true,
          rewards: [{ type: 'resource', itemId: 'research-notes', quantity: 1, isRare: false }],
          duration: 30000,
          completedAt: Date.now()
        },
        {
          taskId: 'task-2',
          taskName: 'Mechanical Tinkering',
          success: true,
          rewards: [{ type: 'resource', itemId: 'gear-components', quantity: 1, isRare: false }],
          duration: 45000,
          completedAt: Date.now() + 100
        },
        {
          taskId: 'task-3',
          taskName: 'Alchemical Studies',
          success: true,
          rewards: [{ type: 'resource', itemId: 'chemical-compounds', quantity: 1, isRare: true }],
          duration: 60000,
          completedAt: Date.now() + 200
        }
      ];

      // Trigger rapid completions
      completions.forEach((completion, index) => {
        setTimeout(() => {
          act(() => {
            taskCompleteCallback?.(completion);
          });
        }, index * 50);
      });

      // Wait for all completions to process
      await waitFor(() => {
        expect(screen.getAllByText('Activity Completed!')).toHaveLength(3);
      }, { timeout: 1000 });

      // Should show all rewards
      expect(screen.getByText(/research-notes/)).toBeInTheDocument();
      expect(screen.getByText(/gear-components/)).toBeInTheDocument();
      expect(screen.getByText(/chemical-compounds.*✨/)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty queue gracefully', () => {
      mockServerTaskQueueService.getQueueStatus.mockReturnValue({
        currentTask: null,
        queueLength: 0,
        queuedTasks: [],
        isRunning: false,
        totalCompleted: 0
      });

      render(<HarvestingHub {...mockProps} />);
      
      // Should not show progress section when no tasks
      expect(screen.queryByText('🔄 Active Harvesting Operations')).not.toBeInTheDocument();
    });

    test('should handle service errors during queue updates', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockServerTaskQueueService.getQueueStatus.mockImplementation(() => {
        throw new Error('Service unavailable');
      });

      render(<HarvestingHub {...mockProps} />);
      
      // Should handle error gracefully
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to update queue status:',
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });

    test('should handle malformed task completion results', async () => {
      let taskCompleteCallback: ((result: any) => void) | null = null;
      
      mockServerTaskQueueService.onTaskComplete.mockImplementation((playerId, callback) => {
        taskCompleteCallback = callback;
      });

      render(<HarvestingHub {...mockProps} />);
      
      // Simulate malformed completion result
      act(() => {
        taskCompleteCallback?.({
          // Missing required fields
          taskId: 'task-1',
          success: true
          // No taskName, rewards, etc.
        });
      });

      // Should not crash the component
      expect(screen.getByText('🔧 Steampunk Resource Harvesting')).toBeInTheDocument();
    });
  });
});