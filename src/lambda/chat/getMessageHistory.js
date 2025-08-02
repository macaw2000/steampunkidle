"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
const handler = async (event) => {
    try {
        const { channelId, messageType, limit = '50', lastEvaluatedKey } = event.queryStringParameters || {};
        const userId = event.requestContext.authorizer?.userId;
        if (!userId) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: 'Unauthorized' }),
            };
        }
        if (!channelId || !messageType) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'channelId and messageType are required' }),
            };
        }
        if (messageType === 'guild') {
            const guildMemberResult = await docClient.send(new lib_dynamodb_1.QueryCommand({
                TableName: process.env.GUILD_MEMBERS_TABLE,
                KeyConditionExpression: 'guildId = :guildId AND userId = :userId',
                ExpressionAttributeValues: {
                    ':guildId': channelId,
                    ':userId': userId,
                },
            }));
            if (!guildMemberResult.Items || guildMemberResult.Items.length === 0) {
                return {
                    statusCode: 403,
                    body: JSON.stringify({ error: 'Access denied to guild channel' }),
                };
            }
        }
        else if (messageType === 'private') {
            if (!channelId.includes(userId)) {
                return {
                    statusCode: 403,
                    body: JSON.stringify({ error: 'Access denied to private conversation' }),
                };
            }
        }
        const queryParams = {
            TableName: process.env.CHAT_MESSAGES_TABLE,
            KeyConditionExpression: 'channelId = :channelId',
            ExpressionAttributeValues: {
                ':channelId': channelId,
            },
            ScanIndexForward: false,
            Limit: parseInt(limit),
        };
        if (lastEvaluatedKey) {
            queryParams.ExclusiveStartKey = JSON.parse(decodeURIComponent(lastEvaluatedKey));
        }
        const result = await docClient.send(new lib_dynamodb_1.QueryCommand(queryParams));
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                messages: result.Items || [],
                lastEvaluatedKey: result.LastEvaluatedKey ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey)) : null,
            }),
        };
    }
    catch (error) {
        console.error('Get message history error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to get message history' }),
        };
    }
};
exports.handler = handler;
