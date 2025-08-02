"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const databaseService_1 = require("../../services/databaseService");
const taskQueue_1 = require("../../types/taskQueue");
const crypto_1 = require("crypto");
function generateChecksum(data) {
    return (0, crypto_1.createHash)('sha256').update(data).digest('hex');
}
const websocketNotificationService_1 = require("./websocketNotificationService");
const handler = async (event) => {
    try {
        if ('source' in event && event.source === 'aws.events') {
            console.log('Processing all task queues (scheduled)');
            await processAllTaskQueues();
            return;
        }
        const apiEvent = event;
        if (apiEvent.httpMethod === 'GET' && apiEvent.pathParameters?.playerId) {
            return await getTaskQueueStatus(apiEvent.pathParameters.playerId);
        }
        if (apiEvent.httpMethod === 'POST') {
            const body = JSON.parse(apiEvent.body || '{}');
            if (body.action === 'sync') {
                return await syncTaskQueue(body.playerId);
            }
            if (body.action === 'addTask') {
                return await addTaskToQueue(body.playerId, body.task);
            }
            if (body.action === 'stopTasks') {
                return await stopAllTasks(body.playerId);
            }
        }
        return {
            statusCode: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ error: 'Invalid request' }),
        };
    }
    catch (error) {
        console.error('Error in task queue processor:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ error: 'Internal server error' }),
        };
    }
};
exports.handler = handler;
async function processAllTaskQueues() {
    try {
        const result = await databaseService_1.DatabaseService.scan({
            TableName: databaseService_1.TABLE_NAMES.TASK_QUEUES,
            FilterExpression: 'isRunning = :running',
            ExpressionAttributeValues: {
                ':running': true,
            },
        });
        console.log(`Found ${result.items.length} active task queues to process`);
        for (const queue of result.items) {
            try {
                await processTaskQueue(queue);
            }
            catch (error) {
                console.error(`Error processing queue for player ${queue.playerId}:`, error);
            }
        }
    }
    catch (error) {
        console.error('Error processing all task queues:', error);
        throw error;
    }
}
class EnhancedTaskProcessor {
    async processTask(task) {
        console.log(`Processing ${task.type} task ${task.id} for player ${task.playerId}`);
        const isValid = await this.validateTaskExecution(task);
        if (!isValid) {
            throw new Error(`Task ${task.id} failed validation`);
        }
        const playerStats = await this.getPlayerStats(task.playerId);
        const playerLevel = await this.getPlayerLevel(task.playerId);
        const executionResult = await this.executeActivityLogic(task, playerStats);
        const rewards = await this.calculateRewards(task, playerStats, playerLevel);
        task.completed = true;
        task.rewards = rewards;
        task.progress = 1.0;
        await this.applyRewardsToCharacter(task.playerId, rewards);
        const nextTask = await this.getNextQueuedTask(task.playerId);
        const result = {
            task,
            rewards,
            nextTask
        };
        await this.notifyTaskCompletion(task.playerId, result);
        return result;
    }
    async validateTaskExecution(task) {
        try {
            const character = await databaseService_1.DatabaseService.getItem({
                TableName: databaseService_1.TABLE_NAMES.CHARACTERS,
                Key: { userId: task.playerId }
            });
            if (!character) {
                console.warn(`Character not found for task ${task.id}`);
                return false;
            }
            switch (task.type) {
                case taskQueue_1.TaskType.HARVESTING:
                    return await this.validateHarvestingTask(task, character);
                case taskQueue_1.TaskType.CRAFTING:
                    return await this.validateCraftingTask(task, character);
                case taskQueue_1.TaskType.COMBAT:
                    return await this.validateCombatTask(task, character);
                default:
                    console.warn(`Unknown task type: ${task.type}`);
                    return false;
            }
        }
        catch (error) {
            console.error(`Error validating task ${task.id}:`, error);
            return false;
        }
    }
    async executeActivityLogic(task, playerStats) {
        switch (task.type) {
            case taskQueue_1.TaskType.HARVESTING:
                return await this.executeHarvestingLogic(task, playerStats);
            case taskQueue_1.TaskType.CRAFTING:
                return await this.executeCraftingLogic(task, playerStats);
            case taskQueue_1.TaskType.COMBAT:
                return await this.executeCombatLogic(task, playerStats);
            default:
                throw new Error(`Unsupported task type: ${task.type}`);
        }
    }
    async calculateRewards(task, playerStats, playerLevel = 1) {
        const rewards = [];
        const baseRewardMultiplier = 1 + (playerLevel * 0.05);
        switch (task.type) {
            case taskQueue_1.TaskType.HARVESTING:
                rewards.push(...await this.calculateHarvestingRewards(task, playerStats, baseRewardMultiplier));
                break;
            case taskQueue_1.TaskType.CRAFTING:
                rewards.push(...await this.calculateCraftingRewards(task, playerStats, baseRewardMultiplier));
                break;
            case taskQueue_1.TaskType.COMBAT:
                rewards.push(...await this.calculateCombatRewards(task, playerStats, baseRewardMultiplier));
                break;
        }
        return rewards;
    }
    async notifyTaskCompletion(playerId, result) {
        const notification = {
            type: 'task_completed',
            playerId,
            taskId: result.task.id,
            data: {
                task: result.task,
                rewards: result.rewards,
                nextTask: result.nextTask
            },
            timestamp: Date.now()
        };
        await this.sendWebSocketNotification(notification);
        console.log(`Task ${result.task.id} completed for player ${playerId} with ${result.rewards.length} rewards`);
    }
    async executeHarvestingLogic(task, playerStats) {
        const { activity, tools, location } = task.activityData;
        const toolBonus = tools.reduce((bonus, tool) => {
            return bonus + tool.bonuses.reduce((toolBonus, b) => toolBonus + (b.type === 'yield' ? b.value : 0), 0);
        }, 0);
        const getSkillForCategory = (category) => {
            switch (category) {
                case 'metallurgical':
                case 'mechanical':
                    return 'mining';
                case 'botanical':
                case 'alchemical':
                    return 'foraging';
                case 'archaeological':
                    return 'salvaging';
                case 'electrical':
                case 'aeronautical':
                    return 'crystal_extraction';
                default:
                    return 'mining';
            }
        };
        const relevantSkill = getSkillForCategory(activity.category);
        const skillBonus = playerStats.harvestingSkills?.[relevantSkill] || 0;
        const locationBonus = location?.bonusModifiers?.yield || 0;
        const totalEfficiency = 1 + (toolBonus * 0.01) + (skillBonus * 0.02) + (locationBonus * 0.01);
        const baseYield = activity.dropTable.guaranteed.length +
            activity.dropTable.common.length +
            activity.dropTable.uncommon.length;
        return {
            efficiency: totalEfficiency,
            baseYield: Math.max(1, baseYield),
            rareChance: Math.min(0.1 + (skillBonus * 0.001), 0.3)
        };
    }
    async executeCraftingLogic(task, playerStats) {
        const { recipe, materials, craftingStation, playerSkillLevel } = task.activityData;
        const skillBonus = playerSkillLevel * 0.02;
        const stationBonus = craftingStation?.bonuses.reduce((bonus, b) => {
            return bonus + (b.type === 'quality' ? b.value : 0);
        }, 0) || 0;
        const successRate = Math.min(0.7 + skillBonus + (stationBonus * 0.01), 0.95);
        const qualityBonus = skillBonus + (stationBonus * 0.01);
        return {
            successRate,
            qualityBonus,
            materialEfficiency: 1 + (skillBonus * 0.5),
            experienceMultiplier: recipe.requiredLevel * 0.1
        };
    }
    async executeCombatLogic(task, playerStats) {
        const { enemy, playerLevel, playerStats: combatStats, equipment } = task.activityData;
        const levelAdvantage = Math.max(0, playerLevel - enemy.level) * 0.1;
        const equipmentBonus = equipment.reduce((bonus, eq) => {
            return bonus + (eq.stats.attack || 0) + (eq.stats.defense || 0);
        }, 0) * 0.01;
        const winProbability = Math.min(0.5 + levelAdvantage + equipmentBonus, 0.9);
        const experienceMultiplier = enemy.level * 0.15;
        return {
            winProbability,
            experienceMultiplier,
            lootMultiplier: 1 + (enemy.level > 10 ? 0.5 : enemy.level > 20 ? 1.0 : 0),
            damageDealt: combatStats.attack + (equipmentBonus * 10)
        };
    }
    async calculateHarvestingRewards(task, playerStats, multiplier) {
        const rewards = [];
        const harvestingData = task.activityData;
        const executionResult = await this.executeHarvestingLogic(task, playerStats);
        const baseExp = 25 * multiplier * executionResult.efficiency;
        rewards.push({
            type: 'experience',
            quantity: Math.floor(baseExp),
        });
        const resourceQuantity = Math.floor(executionResult.baseYield * executionResult.efficiency * (1 + Math.random() * 0.5));
        const primaryResource = harvestingData.activity.dropTable.guaranteed[0]?.itemId ||
            harvestingData.activity.dropTable.common[0]?.itemId ||
            'generic_material';
        rewards.push({
            type: 'resource',
            itemId: primaryResource,
            quantity: resourceQuantity,
            rarity: 'common'
        });
        if (Math.random() < executionResult.rareChance) {
            const rareResource = harvestingData.activity.dropTable.rare[0]?.itemId ||
                harvestingData.activity.dropTable.uncommon[0]?.itemId ||
                'steam_crystal';
            rewards.push({
                type: 'resource',
                itemId: rareResource,
                quantity: 1,
                rarity: 'rare',
                isRare: true
            });
        }
        return rewards;
    }
    async calculateCraftingRewards(task, playerStats, multiplier) {
        const rewards = [];
        const craftingData = task.activityData;
        const executionResult = await this.executeCraftingLogic(task, playerStats);
        const baseExp = 30 * multiplier * executionResult.experienceMultiplier;
        rewards.push({
            type: 'experience',
            quantity: Math.floor(baseExp),
        });
        if (Math.random() < executionResult.successRate) {
            craftingData.expectedOutputs.forEach(output => {
                const quality = executionResult.qualityBonus > 0.5 ? 'uncommon' : 'common';
                rewards.push({
                    type: 'item',
                    itemId: output.itemId,
                    quantity: output.quantity,
                    rarity: quality
                });
            });
        }
        return rewards;
    }
    async calculateCombatRewards(task, playerStats, multiplier) {
        const rewards = [];
        const combatData = task.activityData;
        const executionResult = await this.executeCombatLogic(task, playerStats);
        const baseExp = 35 * multiplier * executionResult.experienceMultiplier;
        rewards.push({
            type: 'experience',
            quantity: Math.floor(baseExp),
        });
        if (Math.random() < executionResult.winProbability) {
            const currencyReward = Math.floor(15 * multiplier * executionResult.lootMultiplier);
            rewards.push({
                type: 'currency',
                quantity: currencyReward,
            });
            if (Math.random() < 0.3 * executionResult.lootMultiplier) {
                const loot = combatData.enemy.lootTable?.[0];
                rewards.push({
                    type: 'item',
                    itemId: loot?.itemId || 'combat_trophy',
                    quantity: loot?.quantity || 1,
                    rarity: loot?.rarity || 'common'
                });
            }
        }
        return rewards;
    }
    async getPlayerStats(playerId) {
        const character = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.CHARACTERS,
            Key: { userId: playerId }
        });
        return character?.stats || {
            strength: 10,
            dexterity: 10,
            intelligence: 10,
            vitality: 10,
            craftingSkills: {},
            harvestingSkills: {},
            combatSkills: {}
        };
    }
    async getPlayerLevel(playerId) {
        const character = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.CHARACTERS,
            Key: { userId: playerId }
        });
        return character?.level || 1;
    }
    async getNextQueuedTask(playerId) {
        const queue = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.TASK_QUEUES,
            Key: { playerId }
        });
        return queue?.queuedTasks[0] || null;
    }
    async applyRewardsToCharacter(playerId, rewards) {
        try {
            let experienceGained = 0;
            let currencyGained = 0;
            for (const reward of rewards) {
                switch (reward.type) {
                    case 'experience':
                        experienceGained += reward.quantity;
                        break;
                    case 'currency':
                        currencyGained += reward.quantity;
                        break;
                }
            }
            if (experienceGained > 0 || currencyGained > 0) {
                const updateExpression = [];
                const expressionAttributeValues = {};
                if (experienceGained > 0) {
                    updateExpression.push('experience = experience + :exp');
                    expressionAttributeValues[':exp'] = experienceGained;
                }
                if (currencyGained > 0) {
                    updateExpression.push('currency = currency + :currency');
                    expressionAttributeValues[':currency'] = currencyGained;
                }
                await databaseService_1.DatabaseService.updateItem({
                    TableName: databaseService_1.TABLE_NAMES.CHARACTERS,
                    Key: { userId: playerId },
                    UpdateExpression: `SET ${updateExpression.join(', ')}`,
                    ExpressionAttributeValues: expressionAttributeValues,
                });
                console.log(`Applied rewards to ${playerId}: ${experienceGained} exp, ${currencyGained} currency`);
            }
        }
        catch (error) {
            console.error(`Error applying rewards to character ${playerId}:`, error);
        }
    }
    async sendWebSocketNotification(notification) {
        try {
            const wsService = new websocketNotificationService_1.WebSocketNotificationService();
            await wsService.sendToPlayer(notification.playerId, notification);
        }
        catch (error) {
            console.error('Error sending WebSocket notification:', error);
        }
    }
    async validateHarvestingTask(task, character) {
        const harvestingData = task.activityData;
        if (harvestingData.tools.length === 0) {
            console.warn(`No tools available for harvesting task ${task.id}`);
            return false;
        }
        if (harvestingData.location) {
            for (const req of harvestingData.location.requirements) {
                if (!req.isMet) {
                    console.warn(`Location requirement not met for task ${task.id}: ${req.description}`);
                    return false;
                }
            }
        }
        return true;
    }
    async validateCraftingTask(task, character) {
        const craftingData = task.activityData;
        for (const material of craftingData.materials) {
            console.log(`Checking material: ${material.name}`);
        }
        if (craftingData.craftingStation) {
            for (const req of craftingData.craftingStation.requirements) {
                if (!req.isMet) {
                    console.warn(`Crafting station requirement not met for task ${task.id}: ${req.description}`);
                    return false;
                }
            }
        }
        return true;
    }
    async validateCombatTask(task, character) {
        const combatData = task.activityData;
        if (character.level < combatData.enemy.level - 5) {
            console.warn(`Player level too low for combat task ${task.id}`);
            return false;
        }
        for (const equipment of combatData.equipment) {
            if (equipment.durability <= 0) {
                console.warn(`Equipment ${equipment.name} is broken for task ${task.id}`);
                return false;
            }
        }
        return true;
    }
}
async function processTaskQueue(queue) {
    const now = Date.now();
    let updated = false;
    const processor = new EnhancedTaskProcessor();
    if (queue.currentTask && queue.isRunning) {
        const task = queue.currentTask;
        const elapsed = now - task.startTime;
        if (elapsed > 0) {
            const progress = Math.min(elapsed / task.duration, 1);
            await sendProgressUpdate(queue.playerId, task.id, progress, task.duration - elapsed);
        }
        if (elapsed >= task.duration) {
            console.log(`Task ${task.id} completed for player ${queue.playerId}`);
            try {
                const result = await processor.processTask(task);
                queue.totalTasksCompleted++;
                queue.totalTimeSpent += task.duration;
                const nextTask = queue.queuedTasks.shift();
                if (nextTask) {
                    nextTask.startTime = now;
                    queue.currentTask = nextTask;
                    await sendTaskStartedNotification(queue.playerId, nextTask);
                }
                else {
                    queue.currentTask = null;
                    queue.isRunning = false;
                }
                updated = true;
            }
            catch (error) {
                console.error(`Error processing task ${task.id}:`, error);
                task.retryCount = (task.retryCount || 0) + 1;
                if (task.retryCount < task.maxRetries) {
                    task.startTime = now;
                    console.log(`Retrying task ${task.id}, attempt ${task.retryCount}`);
                }
                else {
                    console.log(`Task ${task.id} failed after ${task.retryCount} retries, skipping`);
                    const nextTask = queue.queuedTasks.shift();
                    if (nextTask) {
                        nextTask.startTime = now;
                        queue.currentTask = nextTask;
                    }
                    else {
                        queue.currentTask = null;
                        queue.isRunning = false;
                    }
                    updated = true;
                }
            }
        }
    }
    queue.lastProcessed = new Date().toISOString();
    if (updated) {
        await databaseService_1.DatabaseService.putItem({
            TableName: databaseService_1.TABLE_NAMES.TASK_QUEUES,
            Item: queue,
        });
        await sendQueueUpdateNotification(queue.playerId, queue);
    }
    return queue;
}
async function sendProgressUpdate(playerId, taskId, progress, timeRemaining) {
    const notification = {
        type: 'task_progress',
        playerId,
        taskId,
        data: {
            progress,
            timeRemaining,
            isComplete: progress >= 1
        },
        timestamp: Date.now()
    };
    const wsService = new websocketNotificationService_1.WebSocketNotificationService();
    await wsService.sendToPlayer(playerId, notification);
}
async function sendTaskStartedNotification(playerId, task) {
    const notification = {
        type: 'task_started',
        playerId,
        taskId: task.id,
        data: {
            task: {
                id: task.id,
                name: task.name,
                type: task.type,
                duration: task.duration,
                estimatedCompletion: task.startTime + task.duration
            }
        },
        timestamp: Date.now()
    };
    const wsService = new websocketNotificationService_1.WebSocketNotificationService();
    await wsService.sendToPlayer(playerId, notification);
}
async function sendQueueUpdateNotification(playerId, queue) {
    const notification = {
        type: 'queue_updated',
        playerId,
        data: {
            currentTask: queue.currentTask,
            queueLength: queue.queuedTasks.length,
            isRunning: queue.isRunning,
            totalCompleted: queue.totalTasksCompleted
        },
        timestamp: Date.now()
    };
    const wsService = new websocketNotificationService_1.WebSocketNotificationService();
    await wsService.sendToPlayer(playerId, notification);
}
async function getTaskQueueStatus(playerId) {
    try {
        const queue = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.TASK_QUEUES,
            Key: { playerId },
        });
        if (!queue) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({ error: 'Task queue not found' }),
            };
        }
        let currentProgress = null;
        if (queue.currentTask && queue.isRunning) {
            const elapsed = Date.now() - queue.currentTask.startTime;
            const progress = Math.min(elapsed / queue.currentTask.duration, 1);
            const timeRemaining = Math.max(queue.currentTask.duration - elapsed, 0);
            currentProgress = {
                taskId: queue.currentTask.id,
                progress,
                timeRemaining,
                isComplete: progress >= 1,
            };
        }
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                queue: {
                    currentTask: queue.currentTask,
                    queueLength: queue.queuedTasks.length,
                    queuedTasks: queue.queuedTasks,
                    isRunning: queue.isRunning,
                    totalCompleted: queue.totalTasksCompleted,
                },
                currentProgress,
            }),
        };
    }
    catch (error) {
        console.error('Error getting task queue status:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ error: 'Internal server error' }),
        };
    }
}
async function syncTaskQueue(playerId) {
    try {
        let queue = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.TASK_QUEUES,
            Key: { playerId },
        });
        if (!queue) {
            const now = Date.now();
            queue = {
                playerId,
                currentTask: null,
                queuedTasks: [],
                isRunning: false,
                isPaused: false,
                pauseReason: undefined,
                canResume: true,
                totalTasksCompleted: 0,
                totalTimeSpent: 0,
                totalRewardsEarned: [],
                averageTaskDuration: 0,
                taskCompletionRate: 0,
                queueEfficiencyScore: 0,
                totalPauseTime: 0,
                config: {
                    maxQueueSize: 50,
                    maxTaskDuration: 86400000,
                    maxTotalQueueDuration: 604800000,
                    autoStart: true,
                    priorityHandling: true,
                    retryEnabled: true,
                    maxRetries: 3,
                    validationEnabled: true,
                    syncInterval: 5000,
                    offlineProcessingEnabled: true,
                    pauseOnError: true,
                    resumeOnResourceAvailable: true,
                    persistenceInterval: 60000,
                    integrityCheckInterval: 300000,
                    maxHistorySize: 100
                },
                lastProcessed: new Date().toISOString(),
                lastSaved: now,
                lastUpdated: now,
                lastSynced: now,
                createdAt: now,
                version: 1,
                checksum: generateChecksum(playerId + now),
                lastValidated: now,
                stateHistory: [],
                maxHistorySize: 10
            };
            await databaseService_1.DatabaseService.putItem({
                TableName: databaseService_1.TABLE_NAMES.TASK_QUEUES,
                Item: queue,
            });
        }
        else {
            queue = await processTaskQueue(queue);
        }
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                queue: {
                    currentTask: queue.currentTask,
                    queueLength: queue.queuedTasks.length,
                    queuedTasks: queue.queuedTasks,
                    isRunning: queue.isRunning,
                    totalCompleted: queue.totalTasksCompleted,
                },
                message: 'Task queue synced successfully',
            }),
        };
    }
    catch (error) {
        console.error('Error syncing task queue:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ error: 'Internal server error' }),
        };
    }
}
async function addTaskToQueue(playerId, task) {
    try {
        let queue = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.TASK_QUEUES,
            Key: { playerId },
        });
        if (!queue) {
            const now = Date.now();
            queue = {
                playerId,
                currentTask: null,
                queuedTasks: [],
                isRunning: false,
                isPaused: false,
                pauseReason: undefined,
                canResume: true,
                totalTasksCompleted: 0,
                totalTimeSpent: 0,
                totalRewardsEarned: [],
                averageTaskDuration: 0,
                taskCompletionRate: 0,
                queueEfficiencyScore: 0,
                totalPauseTime: 0,
                config: {
                    maxQueueSize: 50,
                    maxTaskDuration: 86400000,
                    maxTotalQueueDuration: 604800000,
                    autoStart: true,
                    priorityHandling: true,
                    retryEnabled: true,
                    maxRetries: 3,
                    validationEnabled: true,
                    syncInterval: 5000,
                    offlineProcessingEnabled: true,
                    pauseOnError: true,
                    resumeOnResourceAvailable: true,
                    persistenceInterval: 60000,
                    integrityCheckInterval: 300000,
                    maxHistorySize: 100
                },
                lastProcessed: new Date().toISOString(),
                lastSaved: now,
                lastUpdated: now,
                lastSynced: now,
                createdAt: now,
                version: 1,
                checksum: generateChecksum(playerId + now),
                lastValidated: now,
                stateHistory: [],
                maxHistorySize: 10
            };
        }
        if (!queue.currentTask) {
            task.startTime = Date.now();
            queue.currentTask = task;
            queue.isRunning = true;
        }
        else {
            queue.queuedTasks.push(task);
        }
        await databaseService_1.DatabaseService.putItem({
            TableName: databaseService_1.TABLE_NAMES.TASK_QUEUES,
            Item: queue,
        });
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                message: 'Task added to queue successfully',
                taskId: task.id,
            }),
        };
    }
    catch (error) {
        console.error('Error adding task to queue:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ error: 'Internal server error' }),
        };
    }
}
async function stopAllTasks(playerId) {
    try {
        const queue = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.TASK_QUEUES,
            Key: { playerId },
        });
        if (!queue) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({ error: 'Task queue not found' }),
            };
        }
        queue.currentTask = null;
        queue.queuedTasks = [];
        queue.isRunning = false;
        await databaseService_1.DatabaseService.putItem({
            TableName: databaseService_1.TABLE_NAMES.TASK_QUEUES,
            Item: queue,
        });
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                message: 'All tasks stopped successfully',
            }),
        };
    }
    catch (error) {
        console.error('Error stopping tasks:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ error: 'Internal server error' }),
        };
    }
}
async function generateTaskRewards(task) {
    const processor = new EnhancedTaskProcessor();
    const playerStats = await processor['getPlayerStats'](task.playerId);
    const playerLevel = await processor['getPlayerLevel'](task.playerId);
    return await processor.calculateRewards(task, playerStats, playerLevel);
}
async function applyRewardsToCharacter(playerId, rewards) {
    const processor = new EnhancedTaskProcessor();
    return await processor['applyRewardsToCharacter'](playerId, rewards);
}
function createIdenticalTask(originalTask) {
    return {
        ...originalTask,
        id: `${originalTask.type}-${Date.now()}`,
        startTime: 0,
        completed: false,
        rewards: [],
    };
}
