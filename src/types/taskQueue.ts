/**
 * Unified Task Queue System Types
 * All activities (harvesting, combat, crafting) use this system
 */

import { HarvestingActivity, HarvestingResource } from './harvesting';
import { CraftingRecipe, CraftingMaterial, CraftingOutput } from './crafting';
import { Enemy, PlayerCombatStats } from './combat';
import { CharacterStats } from './character';

export interface Task {
  id: string;
  type: TaskType;
  name: string;
  description: string;
  icon: string;
  duration: number; // milliseconds
  startTime: number;
  playerId: string;
  
  // Activity-specific data
  activityData: HarvestingTaskData | CraftingTaskData | CombatTaskData;
  
  // Prerequisites and requirements
  prerequisites: TaskPrerequisite[];
  resourceRequirements: ResourceRequirement[];
  
  // Progress and completion
  progress: number; // 0-1
  completed: boolean;
  rewards: TaskReward[];
  
  // Metadata
  priority: number;
  estimatedCompletion: number;
  retryCount: number;
  maxRetries: number;
  
  // Validation state
  isValid: boolean;
  validationErrors: string[];
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
  
  // Queue status
  isRunning: boolean;
  isPaused: boolean;
  pauseReason?: string;
  canResume: boolean;
  
  // Statistics
  totalTasksCompleted: number;
  totalTimeSpent: number;
  totalRewardsEarned: TaskReward[];
  averageTaskDuration: number;
  taskCompletionRate: number;
  queueEfficiencyScore: number;
  totalPauseTime?: number;
  
  // Configuration
  config: TaskQueueConfiguration;
  
  // Processing metadata
  lastProcessed?: string;
  lastSaved?: number;
  
  // Timestamps
  lastUpdated: number;
  lastSynced: number;
  createdAt: number;
  pausedAt?: number;
  resumedAt?: number;
  
  // Persistence and integrity
  version: number;
  checksum: string;
  lastValidated: number;
  
  // Queue state tracking
  stateHistory: QueueStateSnapshot[];
  maxHistorySize: number;
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

// Activity-specific data structures
export interface HarvestingTaskData {
  activity: HarvestingActivity;
  playerStats: CharacterStats;
  location?: HarvestingLocation;
  tools: EquippedTool[];
  expectedYield: ResourceYield[];
}

export interface CraftingTaskData {
  recipe: CraftingRecipe;
  materials: CraftingMaterial[];
  craftingStation?: CraftingStation;
  playerSkillLevel: number;
  qualityModifier: number;
  expectedOutputs: CraftingOutput[];
}

export interface CombatTaskData {
  enemy: Enemy;
  playerLevel: number;
  playerStats: PlayerCombatStats;
  equipment: Equipment[];
  combatStrategy: CombatStrategy;
  estimatedOutcome: CombatEstimate;
}

// Prerequisites and requirements
export interface TaskPrerequisite {
  type: 'level' | 'skill' | 'item' | 'activity' | 'stat' | 'equipment';
  requirement: string | number;
  value?: any;
  description: string;
  isMet: boolean;
}

export interface ResourceRequirement {
  resourceId: string;
  resourceName: string;
  quantityRequired: number;
  quantityAvailable: number;
  isSufficient: boolean;
}

// Supporting interfaces
export interface HarvestingLocation {
  locationId: string;
  name: string;
  bonusModifiers: { [key: string]: number };
  requirements: TaskPrerequisite[];
}

export interface EquippedTool {
  toolId: string;
  name: string;
  type: 'harvesting' | 'crafting' | 'combat';
  bonuses: ToolBonus[];
  durability: number;
  maxDurability: number;
}

export interface ToolBonus {
  type: 'speed' | 'yield' | 'quality' | 'efficiency';
  value: number;
  description: string;
}

export interface ResourceYield {
  resourceId: string;
  minQuantity: number;
  maxQuantity: number;
  probability: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
}

export interface CraftingStation {
  stationId: string;
  name: string;
  type: 'basic' | 'advanced' | 'master';
  bonuses: CraftingBonus[];
  requirements: TaskPrerequisite[];
}

export interface CraftingBonus {
  type: 'speed' | 'quality' | 'material_efficiency' | 'experience';
  value: number;
  description: string;
}

// CraftingOutput is imported from crafting.ts

export interface Equipment {
  equipmentId: string;
  name: string;
  type: 'weapon' | 'armor' | 'accessory';
  stats: EquipmentStats;
  requirements: TaskPrerequisite[];
  durability: number;
  maxDurability: number;
}

export interface EquipmentStats {
  attack?: number;
  defense?: number;
  health?: number;
  speed?: number;
  criticalChance?: number;
  criticalDamage?: number;
}

export interface CombatStrategy {
  strategyId: string;
  name: string;
  description: string;
  modifiers: CombatModifier[];
}

export interface CombatModifier {
  type: 'damage' | 'defense' | 'speed' | 'accuracy';
  value: number;
  description: string;
}

export interface CombatEstimate {
  winProbability: number;
  estimatedDuration: number;
  expectedRewards: TaskReward[];
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
}

// Task validation interfaces
export interface TaskValidationResult {
  isValid: boolean;
  errors: TaskValidationError[];
  warnings: TaskValidationWarning[];
}

export interface TaskValidationError {
  code: string;
  message: string;
  field?: string;
  severity: 'error' | 'warning';
}

export interface TaskValidationWarning {
  code: string;
  message: string;
  suggestion?: string;
}

export interface TaskValidationOptions {
  bypassValidation?: boolean;
  bypassReason?: ValidationBypassReason;
  adminOverride?: boolean;
  testMode?: boolean;
  skipResourceCheck?: boolean;
  skipPrerequisiteCheck?: boolean;
  skipEquipmentCheck?: boolean;
  allowInvalidTasks?: boolean;
}

export enum ValidationBypassReason {
  ADMIN_OVERRIDE = 'admin_override',
  TESTING = 'testing',
  DEBUG = 'debug',
  EMERGENCY = 'emergency',
  MAINTENANCE = 'maintenance'
}

// Task processing interfaces
export interface TaskProcessor {
  processTask(task: Task): Promise<TaskCompletionResult>;
  validateTask(task: Task): Promise<TaskValidationResult>;
  calculateRewards(task: Task): Promise<TaskReward[]>;
  updatePlayerState(playerId: string, rewards: TaskReward[]): Promise<void>;
}

export interface TaskQueueManager {
  // Basic queue operations
  addTask(playerId: string, task: Task): Promise<void>;
  removeTask(playerId: string, taskId: string): Promise<void>;
  reorderTasks(playerId: string, taskIds: string[]): Promise<void>;
  clearQueue(playerId: string): Promise<void>;
  getQueueStatus(playerId: string): Promise<TaskQueue>;
  
  // Enhanced pause/resume functionality
  pauseQueue(playerId: string, reason?: string): Promise<void>;
  resumeQueue(playerId: string): Promise<void>;
  canResumeQueue(playerId: string): Promise<boolean>;
  getPauseReason(playerId: string): Promise<string | null>;
  
  // Queue configuration
  updateQueueConfig(playerId: string, config: Partial<TaskQueueConfiguration>): Promise<void>;
  getQueueConfig(playerId: string): Promise<TaskQueueConfiguration>;
  resetQueueConfig(playerId: string): Promise<void>;
  
  // Statistics and monitoring
  getQueueStatistics(playerId: string): Promise<QueueStatistics>;
  calculateEfficiencyScore(playerId: string): Promise<number>;
  getQueueHealth(playerId: string): Promise<QueueHealthStatus>;
  
  // State management and persistence
  validateQueueIntegrity(playerId: string): Promise<QueueValidationResult>;
  repairQueue(playerId: string): Promise<TaskQueue>;
  createBackup(playerId: string): Promise<string>;
  restoreFromBackup(playerId: string, backupId: string): Promise<TaskQueue>;
  
  // Atomic operations
  atomicQueueUpdate(playerId: string, updateFn: (queue: TaskQueue) => TaskQueue): Promise<TaskQueue>;
}

// Queue statistics
export interface QueueStatistics {
  totalTasksCompleted: number;
  totalTimeSpent: number;
  averageTaskDuration: number;
  taskCompletionRate: number;
  queueEfficiencyScore: number;
  mostCommonTaskType: TaskType;
  taskTypeDistribution: { [key in TaskType]: number };
  rewardsEarned: TaskReward[];
  uptime: number;
  pauseTime: number;
  errorRate: number;
  estimatedCompletionTime: number;
  totalQueuedTasks: number;
  totalRetries: number;
  lastCalculated: number;
}

// Queue health monitoring
export interface QueueHealthStatus {
  overall: 'healthy' | 'warning' | 'critical';
  issues: QueueHealthIssue[];
  recommendations: string[];
  lastChecked: number;
  nextCheckDue: number;
}

export interface QueueHealthIssue {
  type: 'performance' | 'data_integrity' | 'configuration' | 'resource';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  affectedComponent: string;
  suggestedAction: string;
}

// Task synchronization interfaces
export interface TaskSyncData {
  playerId: string;
  queueState: TaskQueue;
  lastSyncTimestamp: number;
  conflictResolution: 'server_wins' | 'client_wins' | 'merge';
}

export interface TaskSyncResult {
  success: boolean;
  conflicts: TaskSyncConflict[];
  resolvedQueue: TaskQueue;
  syncTimestamp: number;
}

export interface TaskSyncConflict {
  type: 'task_modified' | 'task_added' | 'task_removed' | 'queue_state_changed';
  taskId?: string;
  serverValue: any;
  clientValue: any;
  resolution: 'use_server' | 'use_client' | 'merge';
}

export interface IncrementalSyncData {
  playerId: string;
  fromVersion: number;
  toVersion: number;
  operations: OfflineOperation[];
  timestamp: number;
  checksum: string;
}

export interface OfflineOperation {
  id: string;
  type: 'add_task' | 'remove_task' | 'update_task' | 'reorder_tasks' | 'pause_queue' | 'resume_queue' | 'clear_queue';
  timestamp: number;
  taskId?: string;
  playerId: string;
  localVersion: number;
  data: any;
  applied: boolean;
}

// Task metrics and analytics
export interface TaskMetrics {
  playerId: string;
  totalTasksCompleted: number;
  totalTimeSpent: number;
  averageTaskDuration: number;
  taskCompletionRate: number;
  mostCommonTaskType: TaskType;
  totalRewardsEarned: TaskReward[];
  efficiencyScore: number;
  lastCalculated: number;
}

export interface TaskPerformanceData {
  taskType: TaskType;
  averageDuration: number;
  successRate: number;
  commonFailureReasons: string[];
  playerLevelDistribution: { [level: number]: number };
  popularityScore: number;
}

// Task queue configuration
export interface TaskQueueConfig {
  maxQueueSize: number;
  maxTaskDuration: number;
  maxTotalQueueDuration: number;
  autoStartEnabled: boolean;
  retryEnabled: boolean;
  maxRetries: number;
  priorityEnabled: boolean;
  validationEnabled: boolean;
  syncInterval: number;
  offlineProcessingEnabled: boolean;
}

// Enhanced task queue configuration
export interface TaskQueueConfiguration {
  maxQueueSize: number;
  maxTaskDuration: number;
  maxTotalQueueDuration: number;
  autoStart: boolean;
  priorityHandling: boolean;
  retryEnabled: boolean;
  maxRetries: number;
  validationEnabled: boolean;
  syncInterval: number;
  offlineProcessingEnabled: boolean;
  pauseOnError: boolean;
  resumeOnResourceAvailable: boolean;
  persistenceInterval: number;
  integrityCheckInterval: number;
  maxHistorySize: number;
}

// Queue state management
export interface QueueStateSnapshot {
  timestamp: number;
  currentTaskId: string | null;
  queuedTaskIds: string[];
  isRunning: boolean;
  isPaused: boolean;
  pauseReason?: string;
  totalTasksCompleted: number;
  checksum: string;
}

export interface QueueStateManager {
  saveState(queue: TaskQueue): Promise<void>;
  loadState(playerId: string): Promise<TaskQueue | null>;
  validateState(queue: TaskQueue): Promise<QueueValidationResult>;
  repairState(queue: TaskQueue): Promise<TaskQueue>;
  createSnapshot(queue: TaskQueue): QueueStateSnapshot;
  restoreFromSnapshot(playerId: string, snapshot: QueueStateSnapshot): Promise<TaskQueue>;
  atomicUpdate(playerId: string, updateFn: (queue: TaskQueue) => TaskQueue | Promise<TaskQueue>): Promise<TaskQueue>;
}

export interface QueueValidationResult {
  isValid: boolean;
  errors: QueueValidationError[];
  warnings: QueueValidationWarning[];
  integrityScore: number;
  canRepair: boolean;
  repairActions: QueueRepairAction[];
}

export interface QueueValidationError {
  code: string;
  message: string;
  severity: 'critical' | 'major' | 'minor';
  field?: string;
  suggestedFix?: string;
}

export interface QueueValidationWarning {
  code: string;
  message: string;
  impact: 'performance' | 'functionality' | 'data_integrity';
  suggestion?: string;
}

export interface QueueRepairAction {
  type: 'remove_invalid_task' | 'fix_timestamps' | 'recalculate_stats' | 'reset_state' | 'update_checksum';
  description: string;
  taskId?: string;
  data?: any;
}

// Task event system
export interface TaskEvent {
  eventId: string;
  eventType: TaskEventType;
  playerId: string;
  taskId?: string;
  timestamp: number;
  data: any;
}

export enum TaskEventType {
  TASK_ADDED = 'task_added',
  TASK_STARTED = 'task_started',
  TASK_PROGRESS = 'task_progress',
  TASK_COMPLETED = 'task_completed',
  TASK_FAILED = 'task_failed',
  TASK_CANCELLED = 'task_cancelled',
  QUEUE_PAUSED = 'queue_paused',
  QUEUE_RESUMED = 'queue_resumed',
  QUEUE_CLEARED = 'queue_cleared'
}

export interface TaskEventHandler {
  handleEvent(event: TaskEvent): Promise<void>;
}

// Task persistence interfaces
export interface TaskPersistenceService {
  saveTask(task: Task): Promise<void>;
  loadTask(taskId: string): Promise<Task | null>;
  saveQueue(queue: TaskQueue): Promise<void>;
  loadQueue(playerId: string): Promise<TaskQueue | null>;
  deleteTask(taskId: string): Promise<void>;
  deleteQueue(playerId: string): Promise<void>;
}

// Task recovery interfaces
export interface TaskRecoveryService {
  recoverCorruptedQueue(playerId: string): Promise<TaskQueue>;
  validateQueueIntegrity(queue: TaskQueue): Promise<boolean>;
  repairQueue(queue: TaskQueue): Promise<TaskQueue>;
  createBackup(queue: TaskQueue): Promise<string>;
  restoreFromBackup(backupId: string): Promise<TaskQueue>;
}

// Admin interface statistics
export interface TaskQueueStats {
  totalTasks: number;
  completedTasks: number;
  activeTasks: number;
  queuedTasks: number;
  averageTaskDuration: number;
  totalTimeSpent: number;
  successRate: number;
  errorRate: number;
  lastActivity: number;
  queueHealth: 'healthy' | 'warning' | 'critical';
}