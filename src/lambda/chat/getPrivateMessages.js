"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
const handler = async (event) => {
    try {
        const { limit = '50', lastEvaluatedKey } = event.queryStringParameters || {};
        const userId = event.requestContext.authorizer?.userId;
        if (!userId) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: 'Unauthorized' }),
            };
        }
        const queryParams = {
            TableName: process.env.CHAT_MESSAGES_TABLE,
            IndexName: 'recipient-index',
            KeyConditionExpression: 'recipientId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId,
            },
            ScanIndexForward: false,
            Limit: parseInt(limit),
        };
        if (lastEvaluatedKey) {
            queryParams.ExclusiveStartKey = JSON.parse(decodeURIComponent(lastEvaluatedKey));
        }
        const result = await docClient.send(new lib_dynamodb_1.QueryCommand(queryParams));
        const sentMessagesParams = {
            TableName: process.env.CHAT_MESSAGES_TABLE,
            FilterExpression: 'senderId = :userId AND messageType = :messageType',
            ExpressionAttributeValues: {
                ':userId': userId,
                ':messageType': 'private',
            },
            ScanIndexForward: false,
            Limit: parseInt(limit),
        };
        const sentResult = await docClient.send(new lib_dynamodb_1.QueryCommand(sentMessagesParams));
        const allMessages = [
            ...(result.Items || []),
            ...(sentResult.Items || []),
        ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const uniqueMessages = allMessages
            .filter((message, index, self) => index === self.findIndex(m => m.messageId === message.messageId))
            .slice(0, parseInt(limit));
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                messages: uniqueMessages,
                lastEvaluatedKey: result.LastEvaluatedKey ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey)) : null,
            }),
        };
    }
    catch (error) {
        console.error('Get private messages error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to get private messages' }),
        };
    }
};
exports.handler = handler;
