"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
const handler = async (event) => {
    try {
        const connectionId = event.requestContext.connectionId;
        const userId = event.queryStringParameters?.userId;
        if (!userId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'userId is required' }),
            };
        }
        await docClient.send(new lib_dynamodb_1.PutCommand({
            TableName: process.env.CHAT_CONNECTIONS_TABLE,
            Item: {
                connectionId,
                userId,
                connectedAt: new Date().toISOString(),
                ttl: Math.floor(Date.now() / 1000) + 86400,
            },
        }));
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Connected successfully' }),
        };
    }
    catch (error) {
        console.error('Connection error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to connect' }),
        };
    }
};
exports.handler = handler;
