import { Task, TaskType, TaskQueue } from '../../../types/taskQueue';
import { HarvestingActivity } from '../../../types/harvesting';
import { CraftingRecipe } from '../../../types/crafting';
import { Enemy } from '../../../types/combat';

/**
 * Generates realistic test data for user acceptance testing
 */
export class TestDataGenerator {
  private playerIdCounter = 1;
  private taskIdCounter = 1;

  /**
   * Generate a realistic test player
   */
  generateTestPlayer(playerType: PlayerType = 'CASUAL'): Player {
    const playerId = `test-player-${this.playerIdCounter++}`;
    
    const basePlayer = {
      id: playerId,
      username: `TestPlayer${this.playerIdCounter}`,
      level: 1,
      experience: 0,
      stats: {
        strength: 10,
        dexterity: 10,
        intelligence: 10,
        constitution: 10
      },
      inventory: {
        items: [],
        capacity: 100,
        gold: 1000
      },
      equipment: {
        weapon: null,
        armor: null,
        tools: []
      },
      skills: {
        harvesting: 1,
        crafting: 1,
        combat: 1
      },
      createdAt: Date.now(),
      lastActive: Date.now()
    };

    // Customize based on player type
    switch (playerType) {
      case 'CASUAL':
        return {
          ...basePlayer,
          level: Math.floor(Math.random() * 10) + 1,
          stats: {
            strength: Math.floor(Math.random() * 20) + 10,
            dexterity: Math.floor(Math.random() * 20) + 10,
            intelligence: Math.floor(Math.random() * 20) + 10,
            constitution: Math.floor(Math.random() * 20) + 10
          }
        };
      
      case 'HARDCORE':
        return {
          ...basePlayer,
          level: Math.floor(Math.random() * 50) + 20,
          stats: {
            strength: Math.floor(Math.random() * 50) + 30,
            dexterity: Math.floor(Math.random() * 50) + 30,
            intelligence: Math.floor(Math.random() * 50) + 30,
            constitution: Math.floor(Math.random() * 50) + 30
          },
          inventory: {
            ...basePlayer.inventory,
            gold: 10000
          }
        };
      
      case 'NEWBIE':
        return basePlayer;
      
      default:
        return basePlayer;
    }
  }

  /**
   * Generate a realistic task queue for testing
   */
  generateTestTaskQueue(playerId: string, queueType: QueueType = 'MIXED'): TaskQueue {
    const tasks = this.generateTasksForQueue(queueType, 5 + Math.floor(Math.random() * 10));
    
    return {
      playerId,
      currentTask: tasks.length > 0 ? tasks[0] : null,
      queuedTasks: tasks.slice(1),
      isRunning: true,
      isPaused: false,
      canResume: true,
      totalTasksCompleted: Math.floor(Math.random() * 100),
      totalTimeSpent: Math.floor(Math.random() * 86400000), // Up to 24 hours
      totalRewardsEarned: [],
      averageTaskDuration: 60000,
      taskCompletionRate: 0.95,
      queueEfficiencyScore: 0.85,
      config: {
        maxQueueSize: 50,
        maxTaskDuration: 3600000,
        maxTotalQueueDuration: 86400000,
        autoStart: true,
        priorityHandling: false,
        retryEnabled: true,
        maxRetries: 3,
        validationEnabled: true,
        syncInterval: 30000,
        offlineProcessingEnabled: true,
        pauseOnError: false,
        resumeOnResourceAvailable: true,
        persistenceInterval: 60000,
        integrityCheckInterval: 300000,
        maxHistorySize: 100
      },
      lastUpdated: Date.now(),
      lastSynced: Date.now() - Math.floor(Math.random() * 60000), // Within last minute
      createdAt: Date.now() - Math.floor(Math.random() * 2592000000), // Within last 30 days
      version: 1,
      checksum: 'test-checksum',
      lastValidated: Date.now(),
      stateHistory: [],
      maxHistorySize: 100
    };
  }

  /**
   * Generate tasks based on queue type
   */
  private generateTasksForQueue(queueType: QueueType, count: number): Task[] {
    const tasks: Task[] = [];
    
    for (let i = 0; i < count; i++) {
      let taskType: TaskType;
      
      switch (queueType) {
        case 'HARVESTING_ONLY':
          taskType = TaskType.HARVESTING;
          break;
        case 'CRAFTING_ONLY':
          taskType = TaskType.CRAFTING;
          break;
        case 'COMBAT_ONLY':
          taskType = TaskType.COMBAT;
          break;
        case 'MIXED':
        default:
          const types: TaskType[] = [TaskType.HARVESTING, TaskType.CRAFTING, TaskType.COMBAT];
          taskType = types[Math.floor(Math.random() * types.length)];
          break;
      }
      
      tasks.push(this.generateTask(taskType));
    }
    
    return tasks;
  }

  /**
   * Generate a single task of specified type
   */
  generateTask(type: TaskType): Task {
    const taskId = `test-task-${this.taskIdCounter++}`;
    const baseTask = {
      id: taskId,
      type,
      playerId: `test-player-${this.playerIdCounter}`,
      progress: 0,
      completed: false,
      rewards: [],
      priority: Math.floor(Math.random() * 10),
      estimatedCompletion: Date.now() + Math.floor(Math.random() * 3600000), // Within next hour
      retryCount: 0,
      maxRetries: 3,
      startTime: Date.now(),
      prerequisites: [],
      resourceRequirements: []
    };

    switch (type) {
      case TaskType.HARVESTING:
        return {
          ...baseTask,
          name: 'Harvest Wood',
          description: 'Gather wood from the forest',
          icon: '🌲',
          duration: 30000 + Math.floor(Math.random() * 120000), // 30s to 2.5min
          activityData: this.generateHarvestingData(),
          isValid: true,
          validationErrors: []
        };
      
      case TaskType.CRAFTING:
        return {
          ...baseTask,
          name: 'Craft Iron Sword',
          description: 'Forge a basic iron sword',
          icon: '⚔️',
          duration: 60000 + Math.floor(Math.random() * 300000), // 1min to 5min
          activityData: this.generateCraftingData(),
          isValid: true,
          validationErrors: []
        };
      
      case TaskType.COMBAT:
        return {
          ...baseTask,
          name: 'Fight Goblin',
          description: 'Battle a goblin warrior',
          icon: '👹',
          duration: 45000 + Math.floor(Math.random() * 180000), // 45s to 3min
          activityData: this.generateCombatData(),
          isValid: true,
          validationErrors: []
        };
      
      default:
        throw new Error(`Unknown task type: ${type}`);
    }
  }

  private generateHarvestingData(): any {
    return {
      activity: {
        id: 'wood-harvesting',
        name: 'Wood Harvesting',
        baseTime: 30000,
        baseReward: { wood: 1 }
      },
      location: {
        id: 'forest-1',
        name: 'Whispering Woods',
        level: 1
      },
      tools: []
    };
  }

  private generateCraftingData(): any {
    return {
      recipe: {
        id: 'iron-sword',
        name: 'Iron Sword',
        materials: [
          { item: 'iron-ingot', quantity: 2 },
          { item: 'wood', quantity: 1 }
        ],
        craftingTime: 60000
      },
      craftingStation: {
        id: 'forge',
        name: 'Blacksmith Forge'
      }
    };
  }

  private generateCombatData(): any {
    return {
      enemy: {
        id: 'goblin-warrior',
        name: 'Goblin Warrior',
        level: 3,
        health: 50,
        damage: 8
      },
      combatStrategy: 'AGGRESSIVE'
    };
  }

  /**
   * Generate multiple test players for load testing
   */
  generateTestPlayers(count: number, distribution?: PlayerTypeDistribution): Player[] {
    const players: Player[] = [];
    const dist = distribution || { CASUAL: 0.6, HARDCORE: 0.3, NEWBIE: 0.1 };
    
    for (let i = 0; i < count; i++) {
      const rand = Math.random();
      let playerType: PlayerType;
      
      if (rand < dist.NEWBIE) {
        playerType = 'NEWBIE';
      } else if (rand < dist.NEWBIE + dist.CASUAL) {
        playerType = 'CASUAL';
      } else {
        playerType = 'HARDCORE';
      }
      
      players.push(this.generateTestPlayer(playerType));
    }
    
    return players;
  }

  /**
   * Generate realistic usage scenarios
   */
  generateUsageScenarios(): UsageScenario[] {
    return [
      {
        name: 'Morning Routine',
        description: 'Player logs in, checks progress, adds new tasks',
        steps: [
          'LOGIN',
          'CHECK_QUEUE_STATUS',
          'COLLECT_REWARDS',
          'ADD_HARVESTING_TASKS',
          'ADD_CRAFTING_TASKS',
          'LOGOUT'
        ],
        expectedDuration: 300000 // 5 minutes
      },
      {
        name: 'Extended Play Session',
        description: 'Player actively manages queue for extended period',
        steps: [
          'LOGIN',
          'CHECK_QUEUE_STATUS',
          'REORDER_TASKS',
          'ADD_MULTIPLE_TASKS',
          'MONITOR_PROGRESS',
          'ADJUST_STRATEGY',
          'LOGOUT'
        ],
        expectedDuration: 1800000 // 30 minutes
      },
      {
        name: 'Quick Check',
        description: 'Player quickly checks progress and logs out',
        steps: [
          'LOGIN',
          'CHECK_QUEUE_STATUS',
          'COLLECT_REWARDS',
          'LOGOUT'
        ],
        expectedDuration: 60000 // 1 minute
      }
    ];
  }
}

export type PlayerType = 'CASUAL' | 'HARDCORE' | 'NEWBIE';
export type QueueType = 'MIXED' | 'HARVESTING_ONLY' | 'CRAFTING_ONLY' | 'COMBAT_ONLY';

export interface PlayerTypeDistribution {
  CASUAL: number;
  HARDCORE: number;
  NEWBIE: number;
}

export interface UsageScenario {
  name: string;
  description: string;
  steps: string[];
  expectedDuration: number;
}

export interface Player {
  id: string;
  username: string;
  level: number;
  experience: number;
  stats: {
    strength: number;
    dexterity: number;
    intelligence: number;
    constitution: number;
  };
  inventory: {
    items: any[];
    capacity: number;
    gold: number;
  };
  equipment: {
    weapon: any;
    armor: any;
    tools: any[];
  };
  skills: {
    harvesting: number;
    crafting: number;
    combat: number;
  };
  createdAt: number;
  lastActive: number;
}