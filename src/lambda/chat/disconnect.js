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
        await docClient.send(new lib_dynamodb_1.DeleteCommand({
            TableName: process.env.CHAT_CONNECTIONS_TABLE,
            Key: {
                connectionId,
            },
        }));
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Disconnected successfully' }),
        };
    }
    catch (error) {
        console.error('Disconnection error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to disconnect' }),
        };
    }
};
exports.handler = handler;
