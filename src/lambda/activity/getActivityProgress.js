"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const databaseService_1 = require("../../services/databaseService");
const handler = async (event) => {
    try {
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
        const character = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.CHARACTERS,
            Key: { userId },
        });
        if (!character) {
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
        if (!character.currentActivity) {
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    progress: null,
                    message: 'No active activity',
                }),
            };
        }
        const startTime = new Date(character.currentActivity.startedAt).getTime();
        const currentTime = Date.now();
        const timeDiff = currentTime - startTime;
        const progressMinutes = Math.floor(timeDiff / (1000 * 60));
        const potentialRewards = calculatePotentialRewards(character.currentActivity.type, progressMinutes, character);
        const progressPercentage = Math.min((progressMinutes / 60) * 100, 100);
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                progress: {
                    activityType: character.currentActivity.type,
                    startedAt: character.currentActivity.startedAt,
                    minutesActive: progressMinutes,
                    progressPercentage,
                    potentialRewards,
                },
            }),
        };
    }
    catch (error) {
        console.error('Error getting activity progress:', error);
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
function calculatePotentialRewards(activityType, minutes, character) {
    const rewards = [];
    const baseRewardRate = 10;
    if (minutes <= 0) {
        return rewards;
    }
    switch (activityType) {
        case 'crafting':
            rewards.push({
                type: 'experience',
                amount: Math.floor(minutes * baseRewardRate * (1 + character.stats.craftingSkills.level * 0.1)),
            });
            rewards.push({
                type: 'currency',
                amount: Math.floor(minutes * 2 * (1 + character.stats.craftingSkills.level * 0.05)),
            });
            break;
        case 'harvesting':
            rewards.push({
                type: 'experience',
                amount: Math.floor(minutes * baseRewardRate * (1 + character.stats.harvestingSkills.level * 0.1)),
            });
            rewards.push({
                type: 'resource',
                amount: Math.floor(minutes * 1.5 * (1 + character.stats.harvestingSkills.level * 0.1)),
            });
            break;
        case 'combat':
            rewards.push({
                type: 'experience',
                amount: Math.floor(minutes * baseRewardRate * (1 + character.stats.combatSkills.level * 0.1)),
            });
            rewards.push({
                type: 'currency',
                amount: Math.floor(minutes * 3 * (1 + character.stats.combatSkills.level * 0.05)),
            });
            break;
    }
    return rewards;
}
