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
        const updateExpressions = [];
        const expressionAttributeNames = {};
        const expressionAttributeValues = {};
        if (request.stats) {
            updateExpressions.push('#stats = :stats');
            expressionAttributeNames['#stats'] = 'stats';
            expressionAttributeValues[':stats'] = {
                ...existingCharacter.stats,
                ...request.stats,
            };
        }
        if (request.specialization) {
            updateExpressions.push('#specialization = :specialization');
            expressionAttributeNames['#specialization'] = 'specialization';
            expressionAttributeValues[':specialization'] = {
                ...existingCharacter.specialization,
                ...request.specialization,
            };
        }
        if (request.currentActivity) {
            updateExpressions.push('#currentActivity = :currentActivity');
            expressionAttributeNames['#currentActivity'] = 'currentActivity';
            expressionAttributeValues[':currentActivity'] = request.currentActivity;
        }
        if (request.experience !== undefined) {
            updateExpressions.push('#experience = :experience');
            expressionAttributeNames['#experience'] = 'experience';
            expressionAttributeValues[':experience'] = request.experience;
        }
        if (request.level !== undefined) {
            updateExpressions.push('#level = :level');
            expressionAttributeNames['#level'] = 'level';
            expressionAttributeValues[':level'] = request.level;
        }
        if (request.currency !== undefined) {
            updateExpressions.push('#currency = :currency');
            expressionAttributeNames['#currency'] = 'currency';
            expressionAttributeValues[':currency'] = request.currency;
        }
        updateExpressions.push('#lastActiveAt = :lastActiveAt');
        expressionAttributeNames['#lastActiveAt'] = 'lastActiveAt';
        expressionAttributeValues[':lastActiveAt'] = request.lastActiveAt || new Date();
        if (updateExpressions.length === 1) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'No valid fields to update',
                }),
            };
        }
        const updatedCharacter = await databaseService_1.DatabaseService.updateItem({
            TableName: databaseService_1.TABLE_NAMES.CHARACTERS,
            Key: { userId },
            UpdateExpression: `SET ${updateExpressions.join(', ')}`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
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
            }),
        };
    }
    catch (error) {
        console.error('Error updating character:', error);
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
