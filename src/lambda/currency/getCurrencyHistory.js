"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const databaseService_1 = require("../../services/databaseService");
const currency_1 = require("../../types/currency");
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
        const page = parseInt(event.queryStringParameters?.page || '1');
        const limit = Math.min(parseInt(event.queryStringParameters?.limit || '20'), currency_1.CURRENCY_CONFIG.TRANSACTION_HISTORY_LIMIT);
        const source = event.queryStringParameters?.source;
        const queryParams = {
            TableName: databaseService_1.TABLE_NAMES.CURRENCY_TRANSACTIONS,
            IndexName: 'userId-timestamp-index',
            KeyConditionExpression: '#userId = :userId',
            ExpressionAttributeNames: {
                '#userId': 'userId',
            },
            ExpressionAttributeValues: {
                ':userId': userId,
            },
            ScanIndexForward: false,
            Limit: limit,
        };
        if (source) {
            queryParams.FilterExpression = '#source = :source';
            queryParams.ExpressionAttributeNames['#source'] = 'source';
            queryParams.ExpressionAttributeValues[':source'] = source;
        }
        if (page > 1) {
            const skipCount = (page - 1) * limit;
            const allItemsQuery = {
                ...queryParams,
                Limit: skipCount + limit,
            };
            const allItemsResult = await databaseService_1.DatabaseService.query(allItemsQuery);
            const transactions = allItemsResult.items?.slice(skipCount) || [];
            const countQuery = {
                ...queryParams,
                Select: 'COUNT',
                Limit: undefined,
            };
            const countResult = await databaseService_1.DatabaseService.query(countQuery);
            const totalCount = countResult.count || 0;
            const history = {
                userId,
                transactions: transactions,
                totalPages: Math.ceil(totalCount / limit),
                currentPage: page,
            };
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    history,
                }),
            };
        }
        else {
            const result = await databaseService_1.DatabaseService.query(queryParams);
            const countQuery = {
                ...queryParams,
                Select: 'COUNT',
                Limit: undefined,
            };
            const countResult = await databaseService_1.DatabaseService.query(countQuery);
            const totalCount = countResult.count || 0;
            const history = {
                userId,
                transactions: (result.items || []),
                totalPages: Math.ceil(totalCount / limit),
                currentPage: 1,
            };
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    history,
                }),
            };
        }
    }
    catch (error) {
        console.error('Error getting currency history:', error);
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
