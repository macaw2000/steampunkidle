/**
 * Task Validation Service Tests
 */

import { TaskValidationService } from '../taskValidation';
import { TaskUtils } from '../../utils/taskUtils';
import { 
  Task, 
  TaskType, 
  TaskValidationResult,
  HarvestingTaskData,
  CraftingTaskData,
  CombatTaskData,
  ResourceRequirement,
  TaskPrerequisite
} from '../../types/taskQueue';
import { CharacterStats } from '../../types/character';
import { HarvestingActivity, HarvestingCategory } from '../../types/harvesting';
import { CraftingRecipe } from '../../types/crafting';
import { Enemy, PlayerCombatStats } from '../../types/combat';

describe('TaskValidationService', () => {
  
  // Mock player data
  const mockPlayerStats: CharacterStats = {
    strength: 10,
    dexterity: 15,
    intelligence: 20,
    vitality: 12,
    craftingSkills: {
      clockmaking: 5,
      engineering: 8,
      alchemy: 3,
      steamcraft: 6,
      level: 10,
      experience: 1500
    },
    harvestingSkills: {
      mining: 7,
      foraging: 9,
      salvaging: 4,
      crystal_extraction: 2,
      level: 8,
      experience: 1200
    },
    combatSkills: {
      melee: 6,
      ranged: 4,
      defense: 8,
      tactics: 5,
      level: 7,
      experience: 1000
    }
  };

  const mockPlayerLevel = 15;
  const mockPlayerInventory = {
    'copper-ingot': 10,
    'iron-ingot': 5,
    'steam-core': 2,
    'energy': 100
  };

  // Mock harvesting activity
  const mockHarvestingActivity: HarvestingActivity = {
    id: 'copper-mining',
    name: 'Copper Mining',
    description: 'Extract copper ore from steam-powered mines',
    category: HarvestingCategory.METALLURGICAL,
    icon: '⛏️',
    baseTime: 30,
    energyCost: 10,
    requiredLevel: 5,
    requiredStats: {
      strength: 8,
      dexterity: 5
    },
    statBonuses: {
      strength: 1,
      experience: 25
    },
    dropTable: {
      guaranteed: [{
        itemId: 'copper-ore',
        minQuantity: 1,
        maxQuantity: 3,
        dropRate: 1.0
      }],
      common: [],
      uncommon: [],
      rare: [],
      legendary: []
    }
  };

  // Mock crafting recipe
  const mockCraftingRecipe: CraftingRecipe = {
    recipeId: 'steam-gear',
    name: 'Steam Gear',
    description: 'A precision-crafted gear for steam machinery',
    category: 'materials',
    requiredSkill: 'engineering',
    requiredLevel: 5,
    craftingTime: 60,
    materials: [{
      materialId: 'copper-ingot',
      name: 'Copper Ingot',
      quantity: 2,
      type: 'basic'
    }],
    outputs: [{
      itemId: 'steam-gear',
      name: 'Steam Gear',
      quantity: 1,
      qualityModifier: 1.0
    }],
    experienceGain: 50,
    steampunkTheme: {
      flavorText: 'Essential component for steam machinery',
      visualDescription: 'Gleaming copper gear with intricate teeth'
    }
  };

  // Mock enemy
  const mockEnemy: Enemy = {
    enemyId: 'rogue-automaton',
    name: 'Rogue Automaton',
    description: 'A malfunctioning steam-powered automaton',
    type: 'automaton',
    level: 12,
    stats: {
      health: 150,
      attack: 25,
      defense: 15,
      speed: 10,
      resistances: {},
      abilities: []
    },
    lootTable: [{
      itemId: 'scrap-metal',
      name: 'Scrap Metal',
      quantity: 2,
      dropChance: 0.8,
      rarity: 'common'
    }],
    experienceReward: 100,
    steampunkTheme: {
      appearance: 'Brass and copper construct with glowing steam vents',
      backstory: 'Once a helpful assistant, now corrupted by steam pressure',
      combatStyle: 'Aggressive melee with steam-powered attacks'
    }
  };

  const mockPlayerCombatStats: PlayerCombatStats = {
    health: 120,
    maxHealth: 120,
    attack: 30,
    defense: 20,
    speed: 15,
    abilities: []
  };

  describe('validateTask', () => {
    
    it('should validate a valid harvesting task', () => {
      const task = TaskUtils.createHarvestingTask(
        'player-123',
        mockHarvestingActivity,
        mockPlayerStats,
        mockPlayerLevel
      );

      const result = TaskValidationService.validateTask(
        task,
        mockPlayerStats,
        mockPlayerLevel,
        mockPlayerInventory
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject harvesting task with insufficient level', () => {
      const lowLevelActivity = {
        ...mockHarvestingActivity,
        requiredLevel: 20
      };

      const task = TaskUtils.createHarvestingTask(
        'player-123',
        lowLevelActivity,
        mockPlayerStats,
        mockPlayerLevel
      );

      const result = TaskValidationService.validateTask(
        task,
        mockPlayerStats,
        mockPlayerLevel,
        mockPlayerInventory
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'INSUFFICIENT_LEVEL')).toBe(true);
    });

    it('should reject harvesting task with insufficient stats', () => {
      const highStatActivity = {
        ...mockHarvestingActivity,
        requiredStats: {
          strength: 50,
          dexterity: 30
        }
      };

      const task = TaskUtils.createHarvestingTask(
        'player-123',
        highStatActivity,
        mockPlayerStats,
        mockPlayerLevel
      );

      const result = TaskValidationService.validateTask(
        task,
        mockPlayerStats,
        mockPlayerLevel,
        mockPlayerInventory
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'INSUFFICIENT_STAT')).toBe(true);
    });

    it('should validate a valid crafting task', () => {
      const task = TaskUtils.createCraftingTask(
        'player-123',
        mockCraftingRecipe,
        mockPlayerStats,
        mockPlayerLevel,
        mockPlayerInventory
      );

      const result = TaskValidationService.validateTask(
        task,
        mockPlayerStats,
        mockPlayerLevel,
        mockPlayerInventory
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject crafting task with insufficient materials', () => {
      const emptyInventory = {};

      const task = TaskUtils.createCraftingTask(
        'player-123',
        mockCraftingRecipe,
        mockPlayerStats,
        mockPlayerLevel,
        emptyInventory
      );

      const result = TaskValidationService.validateTask(
        task,
        mockPlayerStats,
        mockPlayerLevel,
        emptyInventory
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'INSUFFICIENT_MATERIALS')).toBe(true);
    });

    it('should reject crafting task with insufficient skill level', () => {
      const highSkillRecipe = {
        ...mockCraftingRecipe,
        requiredLevel: 20
      };

      const task = TaskUtils.createCraftingTask(
        'player-123',
        highSkillRecipe,
        mockPlayerStats,
        mockPlayerLevel,
        mockPlayerInventory
      );

      const result = TaskValidationService.validateTask(
        task,
        mockPlayerStats,
        mockPlayerLevel,
        mockPlayerInventory
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'INSUFFICIENT_SKILL')).toBe(true);
    });

    it('should validate a valid combat task', () => {
      const task = TaskUtils.createCombatTask(
        'player-123',
        mockEnemy,
        mockPlayerStats,
        mockPlayerLevel,
        mockPlayerCombatStats,
        {
          equipment: [{
            equipmentId: 'basic-sword',
            name: 'Basic Sword',
            type: 'weapon',
            stats: { attack: 10 },
            requirements: [],
            durability: 100,
            maxDurability: 100
          }]
        }
      );

      const result = TaskValidationService.validateTask(
        task,
        mockPlayerStats,
        mockPlayerLevel,
        mockPlayerInventory
      );

      // If it fails, log the errors for debugging
      if (!result.isValid) {
        console.log('Combat task validation errors:', result.errors);
      }

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should warn about challenging combat task', () => {
      const strongEnemy = {
        ...mockEnemy,
        level: 25 // Much higher than player level
      };

      const task = TaskUtils.createCombatTask(
        'player-123',
        strongEnemy,
        mockPlayerStats,
        mockPlayerLevel,
        mockPlayerCombatStats,
        {
          equipment: [{
            equipmentId: 'basic-sword',
            name: 'Basic Sword',
            type: 'weapon',
            stats: { attack: 10 },
            requirements: [],
            durability: 100,
            maxDurability: 100
          }]
        }
      );

      const result = TaskValidationService.validateTask(
        task,
        mockPlayerStats,
        mockPlayerLevel,
        mockPlayerInventory
      );

      // If it fails, log the errors for debugging
      if (!result.isValid) {
        console.log('Strong enemy validation errors:', result.errors);
      }

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'ENEMY_TOO_STRONG')).toBe(true);
    });

    it('should reject task with invalid basic properties', () => {
      const invalidTask: Task = {
        id: '', // Invalid empty ID
        type: TaskType.HARVESTING,
        name: 'Test Task',
        description: 'Test',
        icon: '⛏️',
        duration: -100, // Invalid negative duration
        startTime: 0,
        playerId: '',
        activityData: {} as HarvestingTaskData,
        prerequisites: [],
        resourceRequirements: [],
        progress: 0,
        completed: false,
        rewards: [],
        priority: -1, // Invalid priority
        estimatedCompletion: 0,
        retryCount: 0,
        maxRetries: -1, // Invalid max retries
        isValid: true,
        validationErrors: []
      };

      const result = TaskValidationService.validateTask(
        invalidTask,
        mockPlayerStats,
        mockPlayerLevel,
        mockPlayerInventory
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'INVALID_TASK_ID')).toBe(true);
      expect(result.errors.some(e => e.code === 'INVALID_DURATION')).toBe(true);
      expect(result.errors.some(e => e.code === 'INVALID_PRIORITY')).toBe(true);
    });
  });

  describe('validateTaskQueue', () => {
    
    it('should validate a normal task queue', () => {
      const tasks = [
        TaskUtils.createHarvestingTask('player-123', mockHarvestingActivity, mockPlayerStats, mockPlayerLevel),
        TaskUtils.createCraftingTask('player-123', mockCraftingRecipe, mockPlayerStats, mockPlayerLevel, mockPlayerInventory)
      ];

      const result = TaskValidationService.validateTaskQueue(tasks, 50, 7 * 24 * 60 * 60 * 1000);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject queue that exceeds maximum size', () => {
      const tasks = Array(60).fill(null).map((_, i) => 
        TaskUtils.createHarvestingTask(`player-123`, mockHarvestingActivity, mockPlayerStats, mockPlayerLevel)
      );

      const result = TaskValidationService.validateTaskQueue(tasks, 50, 7 * 24 * 60 * 60 * 1000);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'QUEUE_SIZE_EXCEEDED')).toBe(true);
    });

    it('should warn about long queue duration', () => {
      const longTask = TaskUtils.createHarvestingTask('player-123', {
        ...mockHarvestingActivity,
        baseTime: 3600 // 1 hour
      }, mockPlayerStats, mockPlayerLevel);

      const tasks = Array(200).fill(longTask); // Very long total duration

      const result = TaskValidationService.validateTaskQueue(tasks, 250, 7 * 24 * 60 * 60 * 1000);

      expect(result.warnings.some(w => w.code === 'LONG_QUEUE_DURATION')).toBe(true);
    });

    it('should detect duplicate task IDs', () => {
      const task1 = TaskUtils.createHarvestingTask('player-123', mockHarvestingActivity, mockPlayerStats, mockPlayerLevel);
      const task2 = { ...task1 }; // Same ID

      const result = TaskValidationService.validateTaskQueue([task1, task2], 50, 7 * 24 * 60 * 60 * 1000);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'DUPLICATE_TASK_ID')).toBe(true);
    });
  });

  describe('Validation Bypass and Admin Functions', () => {
    
    it('should bypass validation with admin override', () => {
      const invalidTask: Task = {
        id: 'invalid-task',
        type: TaskType.HARVESTING,
        name: 'Invalid Task',
        description: 'This task should fail validation',
        icon: '⛏️',
        duration: -100, // Invalid duration
        startTime: 0,
        playerId: 'player-123',
        activityData: {} as HarvestingTaskData,
        prerequisites: [{
          type: 'level',
          requirement: 100, // Impossible level
          description: 'Requires level 100',
          isMet: false
        }],
        resourceRequirements: [{
          resourceId: 'impossible-resource',
          resourceName: 'Impossible Resource',
          quantityRequired: 1000,
          quantityAvailable: 0,
          isSufficient: false
        }],
        progress: 0,
        completed: false,
        rewards: [],
        priority: 5,
        estimatedCompletion: 0,
        retryCount: 0,
        maxRetries: 3,
        isValid: false,
        validationErrors: []
      };

      const adminOptions = TaskValidationService.createAdminValidationOptions('Testing admin bypass');
      const result = TaskValidationService.validateTask(
        invalidTask,
        mockPlayerStats,
        mockPlayerLevel,
        mockPlayerInventory,
        adminOptions
      );

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.code === 'VALIDATION_BYPASSED')).toBe(true);
    });

    it('should bypass validation in test mode', () => {
      const invalidTask = TaskUtils.createHarvestingTask(
        'player-123',
        {
          ...mockHarvestingActivity,
          requiredLevel: 100 // Impossible level
        },
        mockPlayerStats,
        mockPlayerLevel
      );

      const testOptions = TaskValidationService.createTestValidationOptions();
      const result = TaskValidationService.validateTask(
        invalidTask,
        mockPlayerStats,
        mockPlayerLevel,
        mockPlayerInventory,
        testOptions
      );

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.code === 'VALIDATION_BYPASSED')).toBe(true);
    });

    it('should validate with debug options but still show issues', () => {
      const invalidTask = TaskUtils.createCraftingTask(
        'player-123',
        {
          ...mockCraftingRecipe,
          materials: [{
            materialId: 'rare-material',
            name: 'Rare Material',
            quantity: 100,
            type: 'rare'
          }]
        },
        mockPlayerStats,
        mockPlayerLevel,
        {} // Empty inventory
      );

      const debugOptions = TaskValidationService.createDebugValidationOptions();
      const result = TaskValidationService.validateTask(
        invalidTask,
        mockPlayerStats,
        mockPlayerLevel,
        {},
        debugOptions
      );

      // Log for debugging
      console.log('Debug validation result:', { isValid: result.isValid, errors: result.errors, warnings: result.warnings });

      // Debug mode allows invalid tasks but still reports issues
      expect(result.isValid).toBe(true); // allowInvalidTasks is true
      expect(result.errors.length).toBeGreaterThan(0); // But errors are still reported
    });

    it('should skip specific validation checks when requested', () => {
      const taskWithMissingResources = TaskUtils.createCraftingTask(
        'player-123',
        mockCraftingRecipe,
        mockPlayerStats,
        mockPlayerLevel,
        {} // Empty inventory
      );

      const skipResourceOptions = {
        skipResourceCheck: true
      };

      const result = TaskValidationService.validateTask(
        taskWithMissingResources,
        mockPlayerStats,
        mockPlayerLevel,
        {},
        skipResourceOptions
      );

      // Log for debugging
      console.log('Skip resource validation result:', { isValid: result.isValid, errors: result.errors });

      // Should pass because resource check is skipped
      expect(result.isValid).toBe(true);
      expect(result.errors.some(e => e.code === 'INSUFFICIENT_MATERIALS')).toBe(false);
    });

    it('should validate resource availability separately', () => {
      const requirements: ResourceRequirement[] = [
        {
          resourceId: 'copper-ingot',
          resourceName: 'Copper Ingot',
          quantityRequired: 5,
          quantityAvailable: 2,
          isSufficient: false
        },
        {
          resourceId: 'iron-ingot',
          resourceName: 'Iron Ingot',
          quantityRequired: 3,
          quantityAvailable: 3,
          isSufficient: true
        }
      ];

      const result = TaskValidationService.validateResourceAvailability(
        requirements,
        { 'copper-ingot': 2, 'iron-ingot': 3 }
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'INSUFFICIENT_RESOURCES')).toBe(true);
      expect(result.warnings.some(w => w.code === 'EXACT_RESOURCE_MATCH')).toBe(true);
    });

    it('should validate prerequisites separately', () => {
      const prerequisites: TaskPrerequisite[] = [
        {
          type: 'level',
          requirement: 20,
          description: 'Requires level 20',
          isMet: false
        },
        {
          type: 'stat',
          requirement: 'strength',
          value: 25,
          description: 'Requires 25 strength',
          isMet: false
        }
      ];

      const result = TaskValidationService.validatePrerequisiteRequirements(
        prerequisites,
        mockPlayerStats,
        mockPlayerLevel,
        mockPlayerInventory
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(2);
      expect(result.errors.some(e => e.message.includes('Level too low'))).toBe(true);
      expect(result.errors.some(e => e.message.includes('strength too low'))).toBe(true);
    });

    it('should create audit log for validation with context', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const task = TaskUtils.createHarvestingTask(
        'player-123',
        mockHarvestingActivity,
        mockPlayerStats,
        mockPlayerLevel
      );

      const auditContext = {
        userId: 'user-456',
        sessionId: 'session-789',
        reason: 'Regular gameplay validation'
      };

      TaskValidationService.validateTaskWithAudit(
        task,
        mockPlayerStats,
        mockPlayerLevel,
        mockPlayerInventory,
        {},
        auditContext
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[TASK VALIDATION AUDIT]',
        expect.objectContaining({
          taskId: task.id,
          playerId: task.playerId,
          userId: 'user-456',
          sessionId: 'session-789',
          validationResult: true
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Enhanced Equipment Validation', () => {
    
    it('should validate harvesting equipment', () => {
      const taskWithBrokenTool = TaskUtils.createHarvestingTask(
        'player-123',
        mockHarvestingActivity,
        mockPlayerStats,
        mockPlayerLevel,
        {
          tools: [{
            toolId: 'broken-pickaxe',
            name: 'Broken Pickaxe',
            type: 'harvesting',
            bonuses: [],
            durability: 0,
            maxDurability: 100
          }]
        }
      );

      const result = TaskValidationService.validateTask(
        taskWithBrokenTool,
        mockPlayerStats,
        mockPlayerLevel,
        mockPlayerInventory
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'BROKEN_HARVESTING_TOOL')).toBe(true);
    });

    it('should validate combat equipment', () => {
      const taskWithBrokenEquipment = TaskUtils.createCombatTask(
        'player-123',
        mockEnemy,
        mockPlayerStats,
        mockPlayerLevel,
        mockPlayerCombatStats,
        {
          equipment: [{
            equipmentId: 'broken-sword',
            name: 'Broken Sword',
            type: 'weapon',
            stats: { attack: 10 },
            requirements: [],
            durability: 0,
            maxDurability: 100
          }]
        }
      );

      const result = TaskValidationService.validateTask(
        taskWithBrokenEquipment,
        mockPlayerStats,
        mockPlayerLevel,
        mockPlayerInventory
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'BROKEN_EQUIPMENT')).toBe(true);
    });

    it('should warn about missing combat equipment', () => {
      const taskWithNoEquipment = TaskUtils.createCombatTask(
        'player-123',
        mockEnemy,
        mockPlayerStats,
        mockPlayerLevel,
        mockPlayerCombatStats,
        {
          equipment: []
        }
      );

      const result = TaskValidationService.validateTask(
        taskWithNoEquipment,
        mockPlayerStats,
        mockPlayerLevel,
        mockPlayerInventory
      );

      expect(result.warnings.some(w => w.code === 'NO_COMBAT_EQUIPMENT')).toBe(true);
    });
  });
});