"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const databaseService_1 = require("../../services/databaseService");
const currency_1 = require("../../types/currency");
const uuid_1 = require("uuid");
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
        if (!request.userId || request.amount === undefined || request.amount === null || !request.source || !request.description) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'userId, amount, source, and description are required',
                }),
            };
        }
        if (request.amount < currency_1.CURRENCY_CONFIG.MIN_TRANSACTION) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: `Minimum transaction amount is ${currency_1.CURRENCY_CONFIG.MIN_TRANSACTION}`,
                }),
            };
        }
        const character = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.CHARACTERS,
            Key: { userId: request.userId },
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
        const currentBalance = character.currency || 0;
        const newBalance = currentBalance + request.amount;
        if (newBalance > currency_1.CURRENCY_CONFIG.MAX_BALANCE) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Maximum balance exceeded',
                    maxBalance: currency_1.CURRENCY_CONFIG.MAX_BALANCE,
                    currentBalance,
                }),
            };
        }
        const transaction = {
            transactionId: (0, uuid_1.v4)(),
            userId: request.userId,
            type: 'earned',
            amount: request.amount,
            source: request.source,
            description: request.description,
            metadata: request.metadata,
            timestamp: new Date(),
            balanceAfter: newBalance,
        };
        try {
            await databaseService_1.DatabaseService.updateItem({
                TableName: databaseService_1.TABLE_NAMES.CHARACTERS,
                Key: { userId: request.userId },
                UpdateExpression: 'SET #currency = :currency, #lastActiveAt = :lastActiveAt',
                ExpressionAttributeNames: {
                    '#currency': 'currency',
                    '#lastActiveAt': 'lastActiveAt',
                },
                ExpressionAttributeValues: {
                    ':currency': newBalance,
                    ':lastActiveAt': new Date(),
                },
            });
            await databaseService_1.DatabaseService.putItem({
                TableName: databaseService_1.TABLE_NAMES.CURRENCY_TRANSACTIONS,
                Item: transaction,
            });
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    transaction,
                    newBalance,
                    message: `Earned ${request.amount} steam coins`,
                }),
            };
        }
        catch (dbError) {
            console.error('Database error:', dbError);
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Failed to process currency transaction',
                }),
            };
        }
    }
    catch (error) {
        console.error('Error earning currency:', error);
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
