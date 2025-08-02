"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const databaseService_1 = require("../../services/databaseService");
const handler = async (event) => {
    try {
        if (!event.body) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Request body is required',
                }),
            };
        }
        const request = JSON.parse(event.body);
        const userId = event.pathParameters?.userId;
        if (!userId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'userId is required',
                }),
            };
        }
        const validActivities = ['crafting', 'harvesting', 'combat'];
        if (!validActivities.includes(request.activityType)) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Invalid activity type. Must be one of: crafting, harvesting, combat',
                }),
            };
        }
        const existingCharacter = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.CHARACTERS,
            Key: { userId },
        });
        if (!existingCharacter) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Character not found',
                }),
            };
        }
        let previousActivityRewards = [];
        if (existingCharacter.currentActivity) {
            const timeDiff = Date.now() - new Date(existingCharacter.currentActivity.startedAt).getTime();
            const progressMinutes = Math.floor(timeDiff / (1000 * 60));
            if (progressMinutes > 0) {
                previousActivityRewards = calculateActivityRewards(existingCharacter.currentActivity.type, progressMinutes, existingCharacter);
            }
        }
        const newActivity = {
            type: request.activityType,
            startedAt: new Date(),
            progress: 0,
            rewards: [],
        };
        const updatedCharacter = await databaseService_1.DatabaseService.updateItem({
            TableName: databaseService_1.TABLE_NAMES.CHARACTERS,
            Key: { userId },
            UpdateExpression: 'SET #currentActivity = :currentActivity, #lastActiveAt = :lastActiveAt',
            ExpressionAttributeNames: {
                '#currentActivity': 'currentActivity',
                '#lastActiveAt': 'lastActiveAt',
            },
            ExpressionAttributeValues: {
                ':currentActivity': newActivity,
                ':lastActiveAt': new Date(),
            },
            ReturnValues: 'ALL_NEW',
        });
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                character: updatedCharacter,
                previousActivityRewards,
                message: `Successfully switched to ${request.activityType}`,
            }),
        };
    }
    catch (error) {
        console.error('Error switching activity:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                error: 'Internal server error',
            }),
        };
    }
};
exports.handler = handler;
function calculateActivityRewards(activityType, minutes, character) {
    const rewards = [];
    const baseRewardRate = 10;
    const currencyRates = {
        crafting: { baseRate: 5, skillMultiplier: 0.1 },
        harvesting: { baseRate: 3, skillMultiplier: 0.08 },
        combat: { baseRate: 8, skillMultiplier: 0.12 },
    };
    switch (activityType) {
        case 'crafting':
            rewards.push({
                type: 'experience',
                amount: Math.floor(minutes * baseRewardRate * (1 + character.stats.craftingSkills.level * 0.1)),
                skillType: 'crafting',
            });
            const craftingCurrency = Math.floor(minutes * currencyRates.crafting.baseRate *
                (1 + character.stats.craftingSkills.level * currencyRates.crafting.skillMultiplier));
            rewards.push({
                type: 'currency',
                amount: Math.max(1, craftingCurrency),
            });
            break;
        case 'harvesting':
            rewards.push({
                type: 'experience',
                amount: Math.floor(minutes * baseRewardRate * (1 + character.stats.harvestingSkills.level * 0.1)),
                skillType: 'harvesting',
            });
            const harvestingCurrency = Math.floor(minutes * currencyRates.harvesting.baseRate *
                (1 + character.stats.harvestingSkills.level * currencyRates.harvesting.skillMultiplier));
            rewards.push({
                type: 'currency',
                amount: Math.max(1, harvestingCurrency),
            });
            break;
        case 'combat':
            rewards.push({
                type: 'experience',
                amount: Math.floor(minutes * baseRewardRate * (1 + character.stats.combatSkills.level * 0.1)),
                skillType: 'combat',
            });
            const combatCurrency = Math.floor(minutes * currencyRates.combat.baseRate *
                (1 + character.stats.combatSkills.level * currencyRates.combat.skillMultiplier));
            rewards.push({
                type: 'currency',
                amount: Math.max(1, combatCurrency),
            });
            break;
    }
    return rewards;
}
