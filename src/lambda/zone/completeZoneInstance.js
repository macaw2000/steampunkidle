"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const databaseService_1 = require("../../services/databaseService");
const handler = async (event) => {
    try {
        const instanceId = event.pathParameters?.instanceId;
        if (!instanceId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'instanceId is required',
                }),
            };
        }
        const instance = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.ZONE_INSTANCES,
            Key: { instanceId },
        });
        if (!instance) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Zone instance not found',
                }),
            };
        }
        if (instance.status !== 'completed') {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Zone instance is not completed',
                }),
            };
        }
        const rewardsByUser = new Map();
        instance.rewards.forEach(reward => {
            if (!rewardsByUser.has(reward.recipientId)) {
                rewardsByUser.set(reward.recipientId, []);
            }
            rewardsByUser.get(reward.recipientId).push(reward);
        });
        for (const [userId, userRewards] of Array.from(rewardsByUser.entries())) {
            const character = await databaseService_1.DatabaseService.getItem({
                TableName: databaseService_1.TABLE_NAMES.CHARACTERS,
                Key: { userId },
            });
            if (character) {
                let updateExpression = '';
                const expressionAttributeValues = {};
                const expressionAttributeNames = {};
                const expRewards = userRewards.filter(r => r.type === 'experience');
                if (expRewards.length > 0) {
                    const totalExp = expRewards.reduce((sum, r) => sum + r.amount, 0);
                    updateExpression += 'ADD experience :exp';
                    expressionAttributeValues[':exp'] = totalExp;
                }
                const currencyRewards = userRewards.filter(r => r.type === 'currency');
                if (currencyRewards.length > 0) {
                    const totalCurrency = currencyRewards.reduce((sum, r) => sum + r.amount, 0);
                    if (updateExpression)
                        updateExpression += ', ';
                    updateExpression += 'ADD currency :currency';
                    expressionAttributeValues[':currency'] = totalCurrency;
                }
                if (updateExpression) {
                    await databaseService_1.DatabaseService.updateItem({
                        TableName: databaseService_1.TABLE_NAMES.CHARACTERS,
                        Key: { userId },
                        UpdateExpression: updateExpression,
                        ExpressionAttributeValues: expressionAttributeValues,
                        ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
                    });
                }
                const itemRewards = userRewards.filter(r => r.type === 'item');
                for (const itemReward of itemRewards) {
                    if (itemReward.itemId) {
                        try {
                            await databaseService_1.DatabaseService.updateItem({
                                TableName: databaseService_1.TABLE_NAMES.INVENTORY,
                                Key: { userId, itemId: itemReward.itemId },
                                UpdateExpression: 'ADD quantity :quantity',
                                ExpressionAttributeValues: {
                                    ':quantity': itemReward.amount,
                                },
                            });
                        }
                        catch (error) {
                            await databaseService_1.DatabaseService.putItem({
                                TableName: databaseService_1.TABLE_NAMES.INVENTORY,
                                Item: {
                                    userId,
                                    itemId: itemReward.itemId,
                                    quantity: itemReward.amount,
                                    acquiredAt: new Date().toISOString(),
                                },
                                ConditionExpression: 'attribute_not_exists(userId) AND attribute_not_exists(itemId)',
                            });
                        }
                    }
                }
            }
        }
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                rewards: instance.rewards,
                message: 'Zone instance completed and rewards distributed',
            }),
        };
    }
    catch (error) {
        console.error('Error completing zone instance:', error);
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
