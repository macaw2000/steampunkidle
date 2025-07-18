/**
 * Unified Task Queue System Types
 * All activities (harvesting, combat, crafting) use this system
 */

export interface Task {
  id: string;
  type: TaskType;
  name: string;
  description: string;
  icon: string;
  duration: number; // milliseconds
  startTime: number;
  playerId: string;
  activityData: any; // Specific data for the activity type
  rewards?: TaskReward[];
  completed: boolean;
}

export enum TaskType {
  HARVESTING = 'harvesting',
  COMBAT = 'combat',
  CRAFTING = 'crafting'
}

export interface TaskReward {
  type: 'experience' | 'currency' | 'item' | 'resource';
  itemId?: string;
  quantity: number;
  rarity?: string;
  isRare?: boolean;
}

export interface TaskQueue {
  playerId: string;
  currentTask: Task | null;
  queuedTasks: Task[];
  isRunning: boolean;
  totalTasksCompleted: number;
  totalTimeSpent: number;
}

export interface TaskProgress {
  taskId: string;
  progress: number; // 0-1
  timeRemaining: number; // milliseconds
  isComplete: boolean;
}

export interface TaskCompletionResult {
  task: Task;
  rewards: TaskReward[];
  nextTask: Task | null;
}