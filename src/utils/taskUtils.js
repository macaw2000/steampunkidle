"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskUtils = void 0;
const taskQueue_1 = require("../types/taskQueue");
const harvesting_1 = require("../types/harvesting");
const taskValidation_1 = require("../services/taskValidation");
class TaskUtils {
    static createHarvestingTask(playerId, activity, playerStats, playerLevel, options = {}) {
        const taskId = `harvesting-${activity.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const prerequisites = [];
        if (activity.requiredLevel > 0) {
            prerequisites.push({
                type: 'level',
                requirement: activity.requiredLevel,
                description: `Requires level ${activity.requiredLevel}`,
                isMet: playerLevel >= activity.requiredLevel
            });
        }
        if (activity.requiredStats) {
            for (const [stat, required] of Object.entries(activity.requiredStats)) {
                prerequisites.push({
                    type: 'stat',
                    requirement: stat,
                    value: required,
                    description: `Requires ${stat} ${required}`,
                    isMet: this.getPlayerStat(playerStats, stat) >= required
                });
            }
        }
        const location = options.location;
        if (location) {
            for (const req of location.requirements) {
                let isMet = req.isMet;
                if (!isMet) {
                    if (req.type === 'level') {
                        isMet = playerLevel >= req.requirement;
                    }
                    else if (req.type === 'item' && options.playerInventory) {
                        isMet = (options.playerInventory[req.requirement] || 0) > 0;
                    }
                    else if (req.type === 'equipment' && options.playerEquipment) {
                        isMet = !!options.playerEquipment[req.requirement];
                    }
                }
                prerequisites.push({
                    ...req,
                    isMet
                });
            }
        }
        const tools = options.tools || [];
        for (const tool of tools) {
            if (tool.durability <= 0) {
                prerequisites.push({
                    type: 'equipment',
                    requirement: tool.toolId,
                    description: `Tool ${tool.name} needs repair`,
                    isMet: false
                });
            }
        }
        const resourceRequirements = [];
        if (activity.energyCost > 0) {
            const availableEnergy = options.playerInventory?.energy || 100;
            resourceRequirements.push({
                resourceId: 'energy',
                resourceName: 'Energy',
                quantityRequired: activity.energyCost,
                quantityAvailable: availableEnergy,
                isSufficient: availableEnergy >= activity.energyCost
            });
        }
        const duration = this.calculateEnhancedHarvestingDuration(activity, playerStats, tools, location);
        const harvestingData = {
            activity,
            playerStats,
            location,
            tools,
            expectedYield: this.calculateEnhancedExpectedYield(activity, playerStats, tools, location)
        };
        const task = {
            id: taskId,
            type: taskQueue_1.TaskType.HARVESTING,
            name: activity.name,
            description: activity.description,
            icon: activity.icon,
            duration,
            startTime: 0,
            playerId,
            activityData: harvestingData,
            prerequisites,
            resourceRequirements,
            progress: 0,
            completed: false,
            rewards: [],
            priority: options.priority || 5,
            estimatedCompletion: Date.now() + duration,
            retryCount: 0,
            maxRetries: 3,
            isValid: true,
            validationErrors: []
        };
        const playerInventory = options.playerInventory || {};
        const validation = taskValidation_1.TaskValidationService.validateTask(task, playerStats, playerLevel, playerInventory);
        task.isValid = validation.isValid;
        task.validationErrors = validation.errors.map(e => e.message);
        return task;
    }
    static createCraftingTask(playerId, recipe, playerStats, playerLevel, playerInventory, options = {}) {
        const taskId = `crafting-${recipe.recipeId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const quantity = options.quantity || 1;
        const prerequisites = [];
        if (recipe.requiredLevel > 0) {
            prerequisites.push({
                type: 'level',
                requirement: recipe.requiredLevel,
                description: `Requires level ${recipe.requiredLevel}`,
                isMet: playerLevel >= recipe.requiredLevel
            });
        }
        prerequisites.push({
            type: 'skill',
            requirement: recipe.requiredSkill,
            value: recipe.requiredLevel,
            description: `Requires ${recipe.requiredSkill} level ${recipe.requiredLevel}`,
            isMet: this.getCraftingSkillLevel(playerStats, recipe.requiredSkill) >= recipe.requiredLevel
        });
        const resourceRequirements = [];
        for (const material of recipe.materials) {
            const required = material.quantity * quantity;
            const available = playerInventory[material.materialId] || 0;
            resourceRequirements.push({
                resourceId: material.materialId,
                resourceName: material.name,
                quantityRequired: required,
                quantityAvailable: available,
                isSufficient: available >= required
            });
        }
        const craftingData = {
            recipe,
            materials: recipe.materials.map(m => ({
                materialId: m.materialId,
                name: m.name,
                quantity: m.quantity * quantity,
                type: m.type
            })),
            craftingStation: options.craftingStation,
            playerSkillLevel: this.getCraftingSkillLevel(playerStats, recipe.requiredSkill),
            qualityModifier: this.calculateQualityModifier(playerStats, recipe),
            expectedOutputs: recipe.outputs.map(output => ({
                itemId: output.itemId,
                name: output.name,
                quantity: output.quantity * quantity,
                baseStats: output.baseStats,
                qualityModifier: output.qualityModifier
            }))
        };
        const task = {
            id: taskId,
            type: taskQueue_1.TaskType.CRAFTING,
            name: `Craft ${recipe.name}${quantity > 1 ? ` (x${quantity})` : ''}`,
            description: recipe.description,
            icon: '🔧',
            duration: recipe.craftingTime * 1000 * quantity,
            startTime: 0,
            playerId,
            activityData: craftingData,
            prerequisites,
            resourceRequirements,
            progress: 0,
            completed: false,
            rewards: [],
            priority: options.priority || 5,
            estimatedCompletion: Date.now() + (recipe.craftingTime * 1000 * quantity),
            retryCount: 0,
            maxRetries: 2,
            isValid: true,
            validationErrors: []
        };
        const validation = taskValidation_1.TaskValidationService.validateTask(task, playerStats, playerLevel, playerInventory);
        task.isValid = validation.isValid;
        task.validationErrors = validation.errors.map(e => e.message);
        return task;
    }
    static createCombatTask(playerId, enemy, playerStats, playerLevel, playerCombatStats, options = {}) {
        const taskId = `combat-${enemy.enemyId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const prerequisites = [];
        const recommendedLevel = Math.max(1, enemy.level - 2);
        prerequisites.push({
            type: 'level',
            requirement: recommendedLevel,
            description: `Recommended level ${recommendedLevel} for ${enemy.name}`,
            isMet: playerLevel >= recommendedLevel
        });
        const resourceRequirements = [];
        resourceRequirements.push({
            resourceId: 'health',
            resourceName: 'Health',
            quantityRequired: Math.floor(playerCombatStats.maxHealth * 0.5),
            quantityAvailable: playerCombatStats.health,
            isSufficient: playerCombatStats.health >= Math.floor(playerCombatStats.maxHealth * 0.5)
        });
        const combatEstimate = this.calculateCombatEstimate(playerCombatStats, enemy, playerLevel);
        const combatData = {
            enemy,
            playerLevel,
            playerStats: playerCombatStats,
            equipment: options.equipment || [],
            combatStrategy: options.strategy || {
                strategyId: 'balanced',
                name: 'Balanced',
                description: 'Balanced attack and defense',
                modifiers: []
            },
            estimatedOutcome: combatEstimate
        };
        const task = {
            id: taskId,
            type: taskQueue_1.TaskType.COMBAT,
            name: `Fight ${enemy.name}`,
            description: `Engage in combat with ${enemy.name} (Level ${enemy.level})`,
            icon: '⚔️',
            duration: combatEstimate.estimatedDuration * 1000,
            startTime: 0,
            playerId,
            activityData: combatData,
            prerequisites,
            resourceRequirements,
            progress: 0,
            completed: false,
            rewards: [],
            priority: options.priority || 5,
            estimatedCompletion: Date.now() + (combatEstimate.estimatedDuration * 1000),
            retryCount: 0,
            maxRetries: 1,
            isValid: true,
            validationErrors: []
        };
        const validation = taskValidation_1.TaskValidationService.validateTask(task, playerStats, playerLevel, {});
        task.isValid = validation.isValid;
        task.validationErrors = validation.errors.map(e => e.message);
        return task;
    }
    static calculateExpectedYield(activity, playerStats) {
        const yields = [];
        for (const [rarity, drops] of Object.entries(activity.dropTable)) {
            for (const drop of drops) {
                yields.push({
                    resourceId: drop.itemId,
                    minQuantity: drop.minQuantity,
                    maxQuantity: drop.maxQuantity,
                    probability: drop.dropRate,
                    rarity
                });
            }
        }
        return yields;
    }
    static calculateEnhancedExpectedYield(activity, playerStats, tools = [], location) {
        const yields = [];
        let yieldMultiplier = 1.0;
        let qualityBonus = 0.0;
        for (const tool of tools) {
            for (const bonus of tool.bonuses) {
                if (bonus.type === 'yield') {
                    yieldMultiplier += bonus.value;
                }
                if (bonus.type === 'quality') {
                    qualityBonus += bonus.value;
                }
            }
        }
        if (location) {
            const categoryYieldKey = `${activity.category.toLowerCase()}_yield`;
            if (location.bonusModifiers[categoryYieldKey]) {
                yieldMultiplier += location.bonusModifiers[categoryYieldKey];
            }
            if (location.bonusModifiers.rare_find) {
                qualityBonus += location.bonusModifiers.rare_find;
            }
        }
        const relevantStat = this.getRelevantStatForCategory(activity.category);
        const statValue = this.getPlayerStat(playerStats, relevantStat);
        const statBonus = Math.min(0.5, (statValue / 100));
        yieldMultiplier += statBonus;
        for (const [rarityKey, drops] of Object.entries(activity.dropTable)) {
            const rarity = rarityKey;
            for (const drop of drops) {
                let adjustedProbability = drop.dropRate;
                if (rarity === 'uncommon') {
                    adjustedProbability *= (1 + qualityBonus * 0.5);
                }
                else if (rarity === 'rare') {
                    adjustedProbability *= (1 + qualityBonus);
                }
                else if (rarity === 'legendary') {
                    adjustedProbability *= (1 + qualityBonus * 1.5);
                }
                adjustedProbability = Math.min(rarity === 'common' ? 0.8 :
                    rarity === 'uncommon' ? 0.4 :
                        rarity === 'rare' ? 0.2 : 0.05, adjustedProbability);
                const minQuantity = Math.round(drop.minQuantity * yieldMultiplier);
                const maxQuantity = Math.round(drop.maxQuantity * yieldMultiplier);
                yields.push({
                    resourceId: drop.itemId,
                    minQuantity,
                    maxQuantity,
                    probability: adjustedProbability,
                    rarity
                });
            }
        }
        return yields;
    }
    static calculateHarvestingDuration(activity, playerStats) {
        let duration = activity.baseTime * 1000;
        if (activity.requiredStats) {
            for (const [stat, required] of Object.entries(activity.requiredStats)) {
                const playerStat = this.getPlayerStat(playerStats, stat);
                if (playerStat > required) {
                    const bonus = (playerStat - required) * 0.01;
                    duration *= (1 - Math.min(bonus, 0.5));
                }
            }
        }
        return Math.max(1000, Math.floor(duration));
    }
    static calculateEnhancedHarvestingDuration(activity, playerStats, tools = [], location) {
        let duration = activity.baseTime * 1000;
        if (activity.requiredStats) {
            for (const [stat, required] of Object.entries(activity.requiredStats)) {
                const playerStat = this.getPlayerStat(playerStats, stat);
                if (playerStat > required) {
                    const bonus = Math.min(0.5, (playerStat - required) * 0.01);
                    duration *= (1 - bonus);
                }
            }
        }
        for (const tool of tools) {
            for (const bonus of tool.bonuses) {
                if (bonus.type === 'speed') {
                    duration *= (1 - bonus.value);
                }
            }
        }
        if (location) {
            const categoryQualityKey = `${activity.category.toLowerCase()}_quality`;
            if (location.bonusModifiers[categoryQualityKey]) {
                const qualityBonus = location.bonusModifiers[categoryQualityKey] * 0.5;
                duration *= (1 - qualityBonus);
            }
        }
        const skillLevel = this.getHarvestingSkillLevel(playerStats, activity.category);
        const skillBonus = Math.min(0.4, skillLevel * 0.01);
        duration *= (1 - skillBonus);
        return Math.max(1000, Math.floor(duration));
    }
    static getRelevantStatForCategory(category) {
        switch (category) {
            case harvesting_1.HarvestingCategory.LITERARY:
                return 'intelligence';
            case harvesting_1.HarvestingCategory.MECHANICAL:
                return 'dexterity';
            case harvesting_1.HarvestingCategory.ALCHEMICAL:
                return 'intelligence';
            case harvesting_1.HarvestingCategory.ARCHAEOLOGICAL:
                return 'perception';
            case harvesting_1.HarvestingCategory.ELECTRICAL:
                return 'intelligence';
            case harvesting_1.HarvestingCategory.AERONAUTICAL:
                return 'perception';
            case harvesting_1.HarvestingCategory.METALLURGICAL:
                return 'strength';
            default:
                return 'intelligence';
        }
    }
    static getHarvestingSkillLevel(playerStats, category) {
        if (!playerStats.harvestingSkills) {
            return 1;
        }
        switch (category) {
            case harvesting_1.HarvestingCategory.LITERARY:
                return playerStats.harvestingSkills.level || 1;
            case harvesting_1.HarvestingCategory.MECHANICAL:
                return playerStats.harvestingSkills.salvaging || 1;
            case harvesting_1.HarvestingCategory.ALCHEMICAL:
                return playerStats.harvestingSkills.level || 1;
            case harvesting_1.HarvestingCategory.ARCHAEOLOGICAL:
                return playerStats.harvestingSkills.level || 1;
            case harvesting_1.HarvestingCategory.ELECTRICAL:
                return playerStats.harvestingSkills.level || 1;
            case harvesting_1.HarvestingCategory.AERONAUTICAL:
                return playerStats.harvestingSkills.level || 1;
            case harvesting_1.HarvestingCategory.METALLURGICAL:
                return playerStats.harvestingSkills.mining || 1;
            default:
                return 1;
        }
    }
    static calculateQualityModifier(playerStats, recipe) {
        const skillLevel = this.getCraftingSkillLevel(playerStats, recipe.requiredSkill);
        const skillBonus = Math.max(0, skillLevel - recipe.requiredLevel) * 0.02;
        return Math.min(1.5, 0.8 + skillBonus);
    }
    static calculateCombatEstimate(playerStats, enemy, playerLevel) {
        const playerPower = playerStats.attack + playerStats.defense + (playerStats.health / 10);
        const enemyPower = enemy.stats.attack + enemy.stats.defense + (enemy.stats.health / 10);
        const powerRatio = playerPower / enemyPower;
        const winProbability = Math.max(0.05, Math.min(0.95, 0.5 + (powerRatio - 1) * 0.3));
        const estimatedDuration = Math.max(10, Math.floor((enemy.stats.health / Math.max(1, playerStats.attack - enemy.stats.defense)) * 3));
        let riskLevel = 'medium';
        if (winProbability > 0.8)
            riskLevel = 'low';
        else if (winProbability > 0.6)
            riskLevel = 'medium';
        else if (winProbability > 0.3)
            riskLevel = 'high';
        else
            riskLevel = 'extreme';
        return {
            winProbability,
            estimatedDuration,
            expectedRewards: enemy.lootTable.map(loot => ({
                type: 'item',
                itemId: loot.itemId,
                quantity: loot.quantity,
                rarity: loot.rarity,
                isRare: loot.rarity !== 'common'
            })),
            riskLevel
        };
    }
    static getPlayerStat(playerStats, statName) {
        switch (statName.toLowerCase()) {
            case 'strength':
                return playerStats.strength;
            case 'dexterity':
                return playerStats.dexterity;
            case 'intelligence':
                return playerStats.intelligence;
            case 'vitality':
                return playerStats.vitality;
            default:
                return 0;
        }
    }
    static getCraftingSkillLevel(playerStats, skillType) {
        switch (skillType) {
            case 'clockmaking':
                return playerStats.craftingSkills.clockmaking;
            case 'engineering':
                return playerStats.craftingSkills.engineering;
            case 'alchemy':
                return playerStats.craftingSkills.alchemy;
            case 'steamcraft':
                return playerStats.craftingSkills.steamcraft;
            default:
                return 0;
        }
    }
    static updateTaskProgress(task, progressDelta) {
        const newProgress = Math.min(1, Math.max(0, task.progress + progressDelta));
        return {
            ...task,
            progress: newProgress,
            completed: newProgress >= 1
        };
    }
    static canRetryTask(task) {
        return task.retryCount < task.maxRetries && !task.completed;
    }
    static createRetryTask(originalTask) {
        return {
            ...originalTask,
            id: `${originalTask.id}-retry-${originalTask.retryCount + 1}`,
            retryCount: originalTask.retryCount + 1,
            progress: 0,
            completed: false,
            startTime: 0,
            estimatedCompletion: Date.now() + originalTask.duration
        };
    }
    static calculateQueueDuration(tasks) {
        return tasks.reduce((total, task) => total + task.duration, 0);
    }
    static sortTasksByPriority(tasks) {
        return [...tasks].sort((a, b) => b.priority - a.priority);
    }
    static filterValidTasks(tasks) {
        return tasks.filter(task => task.isValid && task.validationErrors.length === 0);
    }
    static createTaskFromActivity(playerId, activity) {
        const taskId = `${activity.type.toLowerCase()}-${activity.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const prerequisites = [];
        if (activity.requirements) {
            for (const requirement of activity.requirements) {
                prerequisites.push({
                    type: 'activity',
                    requirement,
                    description: requirement,
                    isMet: true
                });
            }
        }
        const task = {
            id: taskId,
            type: activity.type,
            name: activity.name,
            description: activity.description,
            icon: activity.icon,
            duration: activity.duration,
            startTime: 0,
            playerId,
            activityData: {
                activity: {
                    id: activity.id,
                    name: activity.name,
                    description: activity.description,
                    icon: activity.icon,
                    category: harvesting_1.HarvestingCategory.MECHANICAL,
                    requiredLevel: 1,
                    baseTime: activity.duration / 1000,
                    energyCost: 10,
                    dropTable: {
                        guaranteed: [],
                        common: [],
                        uncommon: [],
                        rare: [],
                        legendary: []
                    },
                    statBonuses: {
                        experience: 10
                    }
                },
                playerStats: {
                    strength: 10,
                    dexterity: 10,
                    intelligence: 10,
                    vitality: 10,
                    harvestingSkills: { level: 1, mining: 1, foraging: 1, salvaging: 1, crystal_extraction: 1, experience: 0 },
                    craftingSkills: { level: 1, experience: 0, clockmaking: 1, engineering: 1, alchemy: 1, steamcraft: 1 },
                    combatSkills: { level: 1, melee: 1, ranged: 1, defense: 1, tactics: 1, experience: 0 }
                },
                tools: [],
                expectedYield: []
            },
            prerequisites,
            resourceRequirements: [],
            progress: 0,
            completed: false,
            rewards: [],
            priority: 5,
            estimatedCompletion: Date.now() + activity.duration,
            retryCount: 0,
            maxRetries: 3,
            isValid: true,
            validationErrors: []
        };
        return task;
    }
    static calculateChecksum(data) {
        let hash = 0;
        if (data.length === 0)
            return hash.toString();
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }
}
exports.TaskUtils = TaskUtils;
