"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
const LEADERBOARDS_TABLE = process.env.LEADERBOARDS_TABLE;
async function getUserPositionInLeaderboard(statType, userId) {
    try {
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
    catch (error) {
        console.error(`Error getting user position for ${statType}:`, error);
        return null;
    }
}
async function getUserRankings(userId) {
    const statTypes = [
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
    const rankings = [];
    for (const statType of statTypes) {
        const position = await getUserPositionInLeaderboard(statType, userId);
        if (position) {
            rankings.push(position);
        }
    }
    rankings.sort((a, b) => a.rank - b.rank);
    return rankings;
}
const handler = async (event) => {
    console.log('Getting user rankings', JSON.stringify(event, null, 2));
    try {
        const pathParams = event.pathParameters || {};
        const userId = pathParams.userId;
        if (!userId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Missing required parameter: userId',
                }),
            };
        }
        const rankings = await getUserRankings(userId);
        const totalRankings = rankings.length;
        const averagePercentile = totalRankings > 0
            ? rankings.reduce((sum, r) => sum + r.percentile, 0) / totalRankings
            : 0;
        const bestRank = totalRankings > 0 ? Math.min(...rankings.map(r => r.rank)) : null;
        const bestCategory = rankings.length > 0 ? rankings[0].statType : null;
        const response = {
            userId,
            rankings,
            summary: {
                totalCategories: totalRankings,
                averagePercentile: Math.round(averagePercentile * 100) / 100,
                bestRank,
                bestCategory,
            },
            lastUpdated: new Date().toISOString(),
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
        console.error('Error getting user rankings:', error);
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
