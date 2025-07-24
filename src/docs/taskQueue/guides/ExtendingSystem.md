# Extending the Task Queue System

## Overview

This guide covers how to extend the Task Queue System with new task types, custom validation rules, reward calculators, and integration patterns. The system is designed to be modular and extensible.

## Adding New Task Types

### 1. Define Task Type Interface

First, create the TypeScript interface for your new task type:

```typescript
// src/types/customTaskTypes.ts
export interface MiningTaskData {
  ore: string;
  location: string;
  quantity: number;
  depth: number;
  tools: string[];
}

export interface MiningTask extends Task {
  type: 'mining';
  activityData: MiningTaskData;
}
```

### 2. Create Task Configuration

Add configuration for the new task type:

```typescript
// src/config/taskTypes/miningConfig.ts
import { TaskTypeConfig } from '../taskTypeConfig';

export const miningTaskConfig: TaskTypeConfig = {
  type: 'mining',
  name: 'Mining',
  description: 'Extract valuable ores from underground deposits',
  
  minDuration: 60000,   // 1 minute
  maxDuration: 3600000, // 1 hour
  baseDuration: 300000, // 5 minutes
  
  requiredLevel: 5,
  requiredSkills: ['mining'],
  requiredItems: ['pickaxe'],
  
  resourceCosts: [
    { type: 'stamina', amount: 10 }
  ],
  
  baseRewards: [
    { type: 'experience', skill: 'mining', amount: 20 },
    { type: 'item', category: 'ore', amount: 1 }
  ],
  
  bonusRewards: [
    { type: 'rare_gem', chance: 0.05, amount: 1 }
  ],
  
  validationRules: [
    { type: 'level_requirement', minLevel: 5 },
    { type: 'tool_requirement', category: 'mining' },
    { type: 'location_access', required: true },
    { type: 'depth_requirement', maxDepth: 100 }
  ]
};
```

### 3. Implement Task Processor

Create the processing logic for your task type:

```typescript
// src/services/processors/miningTaskProcessor.ts
import { TaskProcessor } from '../taskProcessor';
import { MiningTask, MiningTaskData } from '../../types/customTaskTypes';

export class MiningTaskProcessor extends TaskProcessor<MiningTask> {
  async validateTask(task: MiningTask): Promise<boolean> {
    const { ore, location, quantity, depth, tools } = task.activityData;
    
    // Validate ore type exists
    if (!this.isValidOre(ore)) {
      throw new Error(`Invalid ore type: ${ore}`);
    }
    
    // Validate location access
    if (!await this.hasLocationAccess(task.playerId, location)) {
      throw new Error(`No access to location: ${location}`);
    }
    
    // Validate depth requirements
    if (depth > this.getMaxDepthForPlayer(task.playerId)) {
      throw new Error(`Depth ${depth} exceeds player limit`);
    }
    
    // Validate tools
    if (!await this.hasRequiredTools(task.playerId, tools)) {
      throw new Error('Missing required mining tools');
    }
    
    return true;
  }
  
  async calculateDuration(task: MiningTask): Promise<number> {
    const { ore, quantity, depth, tools } = task.activityData;
    const playerStats = await this.getPlayerStats(task.playerId);
    
    // Base duration per unit
    const baseDuration = this.getOreDifficulty(ore) * 1000;
    
    // Depth modifier (deeper = slower)
    const depthModifier = 1 + (depth / 100);
    
    // Tool efficiency modifier
    const toolModifier = this.calculateToolEfficiency(tools);
    
    // Player skill modifier
    const skillModifier = 1 - (playerStats.mining / 200);
    
    const totalDuration = baseDuration * quantity * depthModifier * skillModifier / toolModifier;
    
    return Math.max(this.config.minDuration, Math.min(totalDuration, this.config.maxDuration));
  }
  
  async calculateRewards(task: MiningTask): Promise<TaskReward[]> {
    const { ore, quantity, depth } = task.activityData;
    const playerStats = await this.getPlayerStats(task.playerId);
    
    const rewards: TaskReward[] = [];
    
    // Base ore rewards
    const oreAmount = this.calculateOreYield(ore, quantity, playerStats.mining);
    rewards.push({
      type: 'item',
      itemId: ore,
      amount: oreAmount,
      rarity: this.getOreRarity(ore)
    });
    
    // Experience reward
    const expAmount = quantity * 10 * (1 + depth / 50);
    rewards.push({
      type: 'experience',
      skill: 'mining',
      amount: Math.floor(expAmount)
    });
    
    // Rare gem chance (increases with depth)
    const gemChance = 0.01 + (depth / 1000);
    if (Math.random() < gemChance) {
      rewards.push({
        type: 'item',
        itemId: this.getRandomGem(),
        amount: 1,
        rarity: 'rare'
      });
    }
    
    return rewards;
  }
  
  private isValidOre(ore: string): boolean {
    const validOres = ['copper', 'iron', 'silver', 'gold', 'mithril'];
    return validOres.includes(ore);
  }
  
  private getOreDifficulty(ore: string): number {
    const difficulties = {
      copper: 1,
      iron: 2,
      silver: 3,
      gold: 4,
      mithril: 5
    };
    return difficulties[ore] || 1;
  }
  
  private calculateToolEfficiency(tools: string[]): number {
    // Calculate combined tool efficiency
    let efficiency = 1;
    for (const tool of tools) {
      efficiency *= this.getToolEfficiency(tool);
    }
    return efficiency;
  }
  
  private getToolEfficiency(tool: string): number {
    const efficiencies = {
      'bronze_pickaxe': 1.0,
      'iron_pickaxe': 1.2,
      'steel_pickaxe': 1.5,
      'mithril_pickaxe': 2.0
    };
    return efficiencies[tool] || 1.0;
  }
}
```

### 4. Register Task Type

Register your new task type with the system:

```typescript
// src/services/taskRegistry.ts
import { TaskRegistry } from './taskRegistry';
import { MiningTaskProcessor } from './processors/miningTaskProcessor';
import { miningTaskConfig } from '../config/taskTypes/miningConfig';

// Register the new task type
TaskRegistry.registerTaskType('mining', {
  config: miningTaskConfig,
  processor: MiningTaskProcessor,
  validator: MiningTaskValidator
});
```

### 5. Add API Endpoints

Create API endpoints for the new task type:

```typescript
// src/api/routes/miningTasks.ts
import { Router } from 'express';
import { MiningTaskService } from '../services/miningTaskService';

const router = Router();
const miningService = new MiningTaskService();

router.post('/queue/:playerId/tasks/mining', async (req, res) => {
  try {
    const { playerId } = req.params;
    const miningData = req.body;
    
    const task = await miningService.addMiningTask(playerId, miningData);
    
    res.status(201).json({
      success: true,
      task
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/mining/locations', async (req, res) => {
  try {
    const locations = await miningService.getAvailableLocations();
    res.json(locations);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
```

## Custom Validation Rules

### 1. Create Validation Rule Interface

```typescript
// src/types/validationRules.ts
export interface ValidationRule {
  type: string;
  validate(task: Task, player: Player): Promise<ValidationResult>;
}

export interface ValidationResult {
  isValid: boolean;
  errorMessage?: string;
  warnings?: string[];
}
```

### 2. Implement Custom Validator

```typescript
// src/validators/customValidators.ts
import { ValidationRule, ValidationResult } from '../types/validationRules';

export class WeatherValidationRule implements ValidationRule {
  type = 'weather_requirement';
  
  async validate(task: Task, player: Player): Promise<ValidationResult> {
    const weatherService = new WeatherService();
    const currentWeather = await weatherService.getCurrentWeather(task.activityData.location);
    
    // Some tasks require specific weather conditions
    const requiredWeather = task.activityData.requiredWeather;
    
    if (requiredWeather && currentWeather !== requiredWeather) {
      return {
        isValid: false,
        errorMessage: `Task requires ${requiredWeather} weather, but current weather is ${currentWeather}`
      };
    }
    
    return { isValid: true };
  }
}

export class SeasonValidationRule implements ValidationRule {
  type = 'season_requirement';
  
  async validate(task: Task, player: Player): Promise<ValidationResult> {
    const gameTimeService = new GameTimeService();
    const currentSeason = gameTimeService.getCurrentSeason();
    
    const requiredSeason = task.activityData.requiredSeason;
    
    if (requiredSeason && currentSeason !== requiredSeason) {
      return {
        isValid: false,
        errorMessage: `Task can only be performed in ${requiredSeason}, current season is ${currentSeason}`
      };
    }
    
    return { isValid: true };
  }
}
```

### 3. Register Custom Validators

```typescript
// src/services/validationRegistry.ts
import { ValidationRegistry } from './validationRegistry';
import { WeatherValidationRule, SeasonValidationRule } from '../validators/customValidators';

// Register custom validation rules
ValidationRegistry.registerRule(new WeatherValidationRule());
ValidationRegistry.registerRule(new SeasonValidationRule());
```

## Custom Reward Calculators

### 1. Create Reward Calculator Interface

```typescript
// src/types/rewardCalculators.ts
export interface RewardCalculator {
  calculateRewards(task: Task, player: Player, completionData: CompletionData): Promise<TaskReward[]>;
}

export interface CompletionData {
  actualDuration: number;
  efficiency: number;
  bonusMultiplier: number;
  criticalSuccess: boolean;
}
```

### 2. Implement Custom Calculator

```typescript
// src/calculators/seasonalRewardCalculator.ts
import { RewardCalculator, CompletionData } from '../types/rewardCalculators';

export class SeasonalRewardCalculator implements RewardCalculator {
  async calculateRewards(task: Task, player: Player, completionData: CompletionData): Promise<TaskReward[]> {
    const baseRewards = await this.getBaseRewards(task);
    const seasonalMultiplier = this.getSeasonalMultiplier(task.type);
    const playerBonuses = await this.getPlayerBonuses(player);
    
    const enhancedRewards: TaskReward[] = [];
    
    for (const reward of baseRewards) {
      const enhancedReward = { ...reward };
      
      // Apply seasonal multiplier
      if (reward.type === 'experience' || reward.type === 'gold') {
        enhancedReward.amount = Math.floor(reward.amount * seasonalMultiplier);
      }
      
      // Apply player bonuses
      if (playerBonuses[reward.type]) {
        enhancedReward.amount = Math.floor(enhancedReward.amount * playerBonuses[reward.type]);
      }
      
      // Apply completion efficiency bonus
      if (completionData.efficiency > 1.0) {
        enhancedReward.amount = Math.floor(enhancedReward.amount * completionData.efficiency);
      }
      
      enhancedRewards.push(enhancedReward);
    }
    
    // Add seasonal bonus items
    const seasonalBonuses = await this.getSeasonalBonuses(task);
    enhancedRewards.push(...seasonalBonuses);
    
    return enhancedRewards;
  }
  
  private getSeasonalMultiplier(taskType: string): number {
    const gameTimeService = new GameTimeService();
    const currentSeason = gameTimeService.getCurrentSeason();
    
    const seasonalMultipliers = {
      spring: { harvesting: 1.2, crafting: 1.0, combat: 0.9 },
      summer: { harvesting: 1.1, crafting: 1.1, combat: 1.0 },
      autumn: { harvesting: 1.3, crafting: 1.2, combat: 0.8 },
      winter: { harvesting: 0.8, crafting: 1.3, combat: 1.2 }
    };
    
    return seasonalMultipliers[currentSeason][taskType] || 1.0;
  }
  
  private async getSeasonalBonuses(task: Task): Promise<TaskReward[]> {
    const gameTimeService = new GameTimeService();
    const currentSeason = gameTimeService.getCurrentSeason();
    
    const bonuses: TaskReward[] = [];
    
    // Spring: Chance for rare seeds
    if (currentSeason === 'spring' && task.type === 'harvesting') {
      if (Math.random() < 0.1) {
        bonuses.push({
          type: 'item',
          itemId: 'rare_seed',
          amount: 1,
          rarity: 'rare'
        });
      }
    }
    
    // Winter: Bonus experience for indoor activities
    if (currentSeason === 'winter' && task.type === 'crafting') {
      bonuses.push({
        type: 'experience',
        skill: 'crafting',
        amount: 25
      });
    }
    
    return bonuses;
  }
}
```

## Plugin System

### 1. Plugin Interface

```typescript
// src/plugins/pluginInterface.ts
export interface TaskQueuePlugin {
  name: string;
  version: string;
  description: string;
  
  // Lifecycle hooks
  onInstall?(): Promise<void>;
  onUninstall?(): Promise<void>;
  onEnable?(): Promise<void>;
  onDisable?(): Promise<void>;
  
  // Task processing hooks
  beforeTaskStart?(task: Task): Promise<Task>;
  afterTaskComplete?(task: Task, rewards: TaskReward[]): Promise<void>;
  onTaskFailed?(task: Task, error: Error): Promise<void>;
  
  // Queue management hooks
  beforeQueueUpdate?(queue: TaskQueue): Promise<TaskQueue>;
  afterQueueUpdate?(queue: TaskQueue): Promise<void>;
  
  // Custom endpoints
  getRoutes?(): Router[];
  
  // Configuration
  getConfig?(): PluginConfig;
}

export interface PluginConfig {
  settings: Record<string, any>;
  dependencies: string[];
  permissions: string[];
}
```

### 2. Example Plugin Implementation

```typescript
// src/plugins/achievementPlugin.ts
import { TaskQueuePlugin, PluginConfig } from './pluginInterface';

export class AchievementPlugin implements TaskQueuePlugin {
  name = 'achievement-system';
  version = '1.0.0';
  description = 'Adds achievement tracking to task completion';
  
  private achievementService: AchievementService;
  
  constructor() {
    this.achievementService = new AchievementService();
  }
  
  async onInstall(): Promise<void> {
    // Create achievement tables
    await this.achievementService.createTables();
    console.log('Achievement plugin installed');
  }
  
  async afterTaskComplete(task: Task, rewards: TaskReward[]): Promise<void> {
    // Check for achievement progress
    await this.achievementService.updateProgress(task.playerId, {
      taskType: task.type,
      taskCompleted: true,
      rewardsEarned: rewards
    });
    
    // Check for new achievements
    const newAchievements = await this.achievementService.checkAchievements(task.playerId);
    
    if (newAchievements.length > 0) {
      // Notify player of new achievements
      await this.notifyAchievements(task.playerId, newAchievements);
    }
  }
  
  getRoutes(): Router[] {
    const router = Router();
    
    router.get('/achievements/:playerId', async (req, res) => {
      const { playerId } = req.params;
      const achievements = await this.achievementService.getPlayerAchievements(playerId);
      res.json(achievements);
    });
    
    return [router];
  }
  
  getConfig(): PluginConfig {
    return {
      settings: {
        enableNotifications: true,
        achievementPoints: true
      },
      dependencies: ['notification-service'],
      permissions: ['read:achievements', 'write:achievements']
    };
  }
  
  private async notifyAchievements(playerId: string, achievements: Achievement[]): Promise<void> {
    const notificationService = new NotificationService();
    
    for (const achievement of achievements) {
      await notificationService.send(playerId, {
        type: 'ACHIEVEMENT_UNLOCKED',
        title: 'Achievement Unlocked!',
        message: `You've earned: ${achievement.name}`,
        data: achievement
      });
    }
  }
}
```

### 3. Plugin Manager

```typescript
// src/plugins/pluginManager.ts
export class PluginManager {
  private plugins: Map<string, TaskQueuePlugin> = new Map();
  private enabledPlugins: Set<string> = new Set();
  
  async installPlugin(plugin: TaskQueuePlugin): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin ${plugin.name} is already installed`);
    }
    
    // Validate plugin
    await this.validatePlugin(plugin);
    
    // Install plugin
    if (plugin.onInstall) {
      await plugin.onInstall();
    }
    
    this.plugins.set(plugin.name, plugin);
    console.log(`Plugin ${plugin.name} installed successfully`);
  }
  
  async enablePlugin(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} is not installed`);
    }
    
    if (plugin.onEnable) {
      await plugin.onEnable();
    }
    
    this.enabledPlugins.add(pluginName);
    console.log(`Plugin ${pluginName} enabled`);
  }
  
  async executeHook(hookName: string, ...args: any[]): Promise<any[]> {
    const results: any[] = [];
    
    for (const pluginName of this.enabledPlugins) {
      const plugin = this.plugins.get(pluginName);
      if (plugin && plugin[hookName]) {
        try {
          const result = await plugin[hookName](...args);
          results.push(result);
        } catch (error) {
          console.error(`Plugin ${pluginName} hook ${hookName} failed:`, error);
        }
      }
    }
    
    return results;
  }
  
  getPluginRoutes(): Router[] {
    const routes: Router[] = [];
    
    for (const pluginName of this.enabledPlugins) {
      const plugin = this.plugins.get(pluginName);
      if (plugin && plugin.getRoutes) {
        routes.push(...plugin.getRoutes());
      }
    }
    
    return routes;
  }
  
  private async validatePlugin(plugin: TaskQueuePlugin): Promise<void> {
    // Validate required properties
    if (!plugin.name || !plugin.version) {
      throw new Error('Plugin must have name and version');
    }
    
    // Check dependencies
    const config = plugin.getConfig?.();
    if (config?.dependencies) {
      for (const dependency of config.dependencies) {
        if (!this.isServiceAvailable(dependency)) {
          throw new Error(`Plugin dependency ${dependency} is not available`);
        }
      }
    }
  }
  
  private isServiceAvailable(serviceName: string): boolean {
    // Check if required service is available
    // Implementation depends on your service registry
    return true;
  }
}
```

## Integration Patterns

### 1. Event-Driven Extensions

```typescript
// src/extensions/eventDrivenExtension.ts
export class EventDrivenExtension {
  private eventBus: EventBus;
  
  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.setupEventHandlers();
  }
  
  private setupEventHandlers(): void {
    // Listen for task events
    this.eventBus.on('task.started', this.onTaskStarted.bind(this));
    this.eventBus.on('task.completed', this.onTaskCompleted.bind(this));
    this.eventBus.on('task.failed', this.onTaskFailed.bind(this));
    
    // Listen for queue events
    this.eventBus.on('queue.updated', this.onQueueUpdated.bind(this));
    this.eventBus.on('queue.paused', this.onQueuePaused.bind(this));
  }
  
  private async onTaskStarted(data: { task: Task }): Promise<void> {
    // Custom logic when task starts
    await this.logTaskStart(data.task);
    await this.updatePlayerActivity(data.task.playerId, 'task_started');
  }
  
  private async onTaskCompleted(data: { task: Task, rewards: TaskReward[] }): Promise<void> {
    // Custom logic when task completes
    await this.updateStatistics(data.task, data.rewards);
    await this.checkMilestones(data.task.playerId);
  }
}
```

### 2. Middleware Pattern

```typescript
// src/middleware/taskMiddleware.ts
export interface TaskMiddleware {
  process(task: Task, next: () => Promise<Task>): Promise<Task>;
}

export class LoggingMiddleware implements TaskMiddleware {
  async process(task: Task, next: () => Promise<Task>): Promise<Task> {
    console.log(`Processing task ${task.id} of type ${task.type}`);
    const startTime = Date.now();
    
    try {
      const result = await next();
      const duration = Date.now() - startTime;
      console.log(`Task ${task.id} completed in ${duration}ms`);
      return result;
    } catch (error) {
      console.error(`Task ${task.id} failed:`, error);
      throw error;
    }
  }
}

export class ValidationMiddleware implements TaskMiddleware {
  async process(task: Task, next: () => Promise<Task>): Promise<Task> {
    // Pre-validation
    await this.validateTask(task);
    
    const result = await next();
    
    // Post-validation
    await this.validateResult(result);
    
    return result;
  }
  
  private async validateTask(task: Task): Promise<void> {
    // Custom validation logic
  }
  
  private async validateResult(task: Task): Promise<void> {
    // Validate task result
  }
}
```

## Testing Extensions

### 1. Test Utilities for Extensions

```typescript
// src/testing/extensionTestUtils.ts
export class ExtensionTestUtils {
  static createMockTask(overrides: Partial<Task> = {}): Task {
    return {
      id: 'test-task-123',
      type: 'harvesting',
      name: 'Test Task',
      playerId: 'test-player',
      progress: 0,
      startTime: Date.now(),
      duration: 300000,
      activityData: {
        activity: 'chop_oak_trees',
        location: 'test_forest'
      },
      ...overrides
    };
  }
  
  static createMockPlayer(overrides: Partial<Player> = {}): Player {
    return {
      id: 'test-player',
      level: 10,
      experience: 1000,
      skills: {
        harvesting: 25,
        crafting: 15,
        combat: 20
      },
      inventory: [],
      equipment: [],
      ...overrides
    };
  }
  
  static async testTaskProcessor(
    processor: TaskProcessor,
    task: Task,
    expectedRewards: TaskReward[]
  ): Promise<void> {
    const rewards = await processor.calculateRewards(task);
    
    expect(rewards).toHaveLength(expectedRewards.length);
    
    for (let i = 0; i < expectedRewards.length; i++) {
      expect(rewards[i]).toMatchObject(expectedRewards[i]);
    }
  }
}
```

### 2. Integration Tests for Extensions

```typescript
// src/testing/extensionIntegration.test.ts
describe('Task Queue Extensions', () => {
  let taskQueueService: TaskQueueService;
  let pluginManager: PluginManager;
  
  beforeEach(async () => {
    taskQueueService = new TaskQueueService();
    pluginManager = new PluginManager();
  });
  
  it('should process custom task type', async () => {
    // Install mining plugin
    const miningPlugin = new MiningPlugin();
    await pluginManager.installPlugin(miningPlugin);
    await pluginManager.enablePlugin('mining-system');
    
    // Create mining task
    const task = ExtensionTestUtils.createMockTask({
      type: 'mining',
      activityData: {
        ore: 'iron',
        location: 'mountain_cave',
        quantity: 10,
        depth: 50,
        tools: ['iron_pickaxe']
      }
    });
    
    // Process task
    const result = await taskQueueService.processTask(task);
    
    expect(result.rewards).toContainEqual(
      expect.objectContaining({
        type: 'item',
        itemId: 'iron',
        amount: expect.any(Number)
      })
    );
  });
  
  it('should apply custom validation rules', async () => {
    // Install weather plugin
    const weatherPlugin = new WeatherPlugin();
    await pluginManager.installPlugin(weatherPlugin);
    await pluginManager.enablePlugin('weather-system');
    
    // Create task requiring sunny weather
    const task = ExtensionTestUtils.createMockTask({
      activityData: {
        activity: 'harvest_grapes',
        location: 'vineyard',
        requiredWeather: 'sunny'
      }
    });
    
    // Mock rainy weather
    jest.spyOn(WeatherService.prototype, 'getCurrentWeather')
      .mockResolvedValue('rainy');
    
    // Task should fail validation
    await expect(taskQueueService.addTask('test-player', task))
      .rejects.toThrow('Task requires sunny weather');
  });
});
```

This guide provides comprehensive examples for extending the Task Queue System with new functionality while maintaining system integrity and performance.