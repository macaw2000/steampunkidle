"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
const LEADERBOARDS_TABLE = process.env.LEADERBOARDS_TABLE;
async function getLeaderboardEntries(statType, limit = 100, offset = 0) {
    console.log(`Getting leaderboard for ${statType}, limit: ${limit}, offset: ${offset}`);
    const result = await docClient.send(new lib_dynamodb_1.QueryCommand({
        TableName: LEADERBOARDS_TABLE,
        KeyConditionExpression: 'statType = :statType',
        ExpressionAttributeValues: {
            ':statType': statType,
        },
        ScanIndexForward: true,
        Limit: limit + offset,
    }));
    if (!result.Items || result.Items.length === 0) {
        return {
            statType,
            entries: [],
            totalEntries: 0,
            lastRefreshed: new Date(),
        };
    }
    const items = result.Items.slice(offset);
    const entries = items.map(item => ({
        rank: item.rank,
        userId: item.userId,
        characterName: item.characterName,
        guildName: item.guildName,
        statValue: item.statValue,
        lastUpdated: new Date(item.lastUpdated),
    }));
    const countResult = await docClient.send(new lib_dynamodb_1.QueryCommand({
        TableName: LEADERBOARDS_TABLE,
        KeyConditionExpression: 'statType = :statType',
        ExpressionAttributeValues: {
            ':statType': statType,
        },
        Select: 'COUNT',
    }));
    return {
        statType,
        entries,
        totalEntries: countResult.Count || 0,
        lastRefreshed: entries.length > 0 ? entries[0].lastUpdated : new Date(),
    };
}
async function getUserPosition(statType, userId) {
    console.log(`Finding position for user ${userId} in ${statType} leaderboard`);
    const result = await docClient.send(new lib_dynamodb_1.QueryCommand({
        TableName: LEADERBOARDS_TABLE,
        KeyConditionExpression: 'statType = :statType',
        FilterExpression: 'userId = :userId',
        ExpressionAttributeValues: {
            ':statType': statType,
            ':userId': userId,
        },
        Limit: 1,
    }));
    if (!result.Items || result.Items.length === 0) {
        return null;
    }
    const item = result.Items[0];
    const countResult = await docClient.send(new lib_dynamodb_1.QueryCommand({
        TableName: LEADERBOARDS_TABLE,
        KeyConditionExpression: 'statType = :statType',
        ExpressionAttributeValues: {
            ':statType': statType,
        },
        Select: 'COUNT',
    }));
    const totalEntries = countResult.Count || 0;
    const percentile = totalEntries > 0 ? ((totalEntries - item.rank + 1) / totalEntries) * 100 : 0;
    return {
        statType,
        rank: item.rank,
        statValue: item.statValue,
        percentile: Math.round(percentile * 100) / 100,
    };
}
const handler = async (event) => {
    console.log('Getting leaderboard data', JSON.stringify(event, null, 2));
    try {
        const queryParams = event.queryStringParameters || {};
        const pathParams = event.pathParameters || {};
        const statType = (pathParams.statType || queryParams.statType);
        const limit = parseInt(queryParams.limit || '100');
        const offset = parseInt(queryParams.offset || '0');
        const userId = queryParams.userId;
        if (!statType) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Missing required parameter: statType',
                }),
            };
        }
        const validStatTypes = [
            'level',
            'totalExperience',
            'craftingLevel',
            'harvestingLevel',
            'combatLevel',
            'currency',
            'itemsCreated',
            'zonesCompleted',
            'dungeonsCompleted',
            'guildLevel',
        ];
        if (!validStatTypes.includes(statType)) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Invalid stat type',
                    validStatTypes,
                }),
            };
        }
        if (limit < 1 || limit > 100) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Limit must be between 1 and 100',
                }),
            };
        }
        if (offset < 0) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Offset must be non-negative',
                }),
            };
        }
        const leaderboard = await getLeaderboardEntries(statType, limit, offset);
        let userPosition = null;
        if (userId) {
            userPosition = await getUserPosition(statType, userId);
        }
        const response = {
            leaderboard,
            userPosition,
        };
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=300',
            },
            body: JSON.stringify(response),
        };
    }
    catch (error) {
        console.error('Error getting leaderboard data:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error',
            }),
        };
    }
};
exports.handler = handler;
