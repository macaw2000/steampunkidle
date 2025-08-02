"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client_apigatewaymanagementapi_1 = require("@aws-sdk/client-apigatewaymanagementapi");
const uuid_1 = require("uuid");
const client = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
const handler = async (event) => {
    try {
        const connectionId = event.requestContext.connectionId;
        const domainName = event.requestContext.domainName;
        const stage = event.requestContext.stage;
        const apiGatewayClient = new client_apigatewaymanagementapi_1.ApiGatewayManagementApiClient({
            endpoint: `https://${domainName}/${stage}`,
        });
        const connectionResult = await docClient.send(new lib_dynamodb_1.GetCommand({
            TableName: process.env.CHAT_CONNECTIONS_TABLE,
            Key: {
                connectionId: connectionId,
            },
        }));
        if (!connectionResult.Item) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Connection not found' }),
            };
        }
        const connection = connectionResult.Item;
        const senderId = connection.userId;
        const characterResult = await docClient.send(new lib_dynamodb_1.GetCommand({
            TableName: process.env.CHARACTERS_TABLE,
            Key: { userId: senderId },
        }));
        if (!characterResult.Item) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Character not found' }),
            };
        }
        const senderName = characterResult.Item.name;
        const body = JSON.parse(event.body || '{}');
        const { content, messageType, channelId, recipientId } = body;
        if (!content || !messageType) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Content and messageType are required' }),
            };
        }
        if (messageType === 'guild') {
            const guildMemberResult = await docClient.send(new lib_dynamodb_1.QueryCommand({
                TableName: process.env.GUILD_MEMBERS_TABLE,
                IndexName: 'user-guild-index',
                KeyConditionExpression: 'userId = :userId',
                ExpressionAttributeValues: {
                    ':userId': senderId,
                },
            }));
            if (!guildMemberResult.Items || guildMemberResult.Items.length === 0) {
                return {
                    statusCode: 403,
                    body: JSON.stringify({ error: 'Not a guild member' }),
                };
            }
        }
        if (messageType === 'private' && !recipientId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'recipientId is required for private messages' }),
            };
        }
        const messageId = (0, uuid_1.v4)();
        const timestamp = new Date().toISOString();
        let finalChannelId = channelId;
        if (messageType === 'general') {
            finalChannelId = 'general';
        }
        else if (messageType === 'guild') {
            const guildMemberResult = await docClient.send(new lib_dynamodb_1.QueryCommand({
                TableName: process.env.GUILD_MEMBERS_TABLE,
                IndexName: 'user-guild-index',
                KeyConditionExpression: 'userId = :userId',
                ExpressionAttributeValues: {
                    ':userId': senderId,
                },
            }));
            finalChannelId = guildMemberResult.Items[0].guildId;
        }
        else if (messageType === 'private') {
            const ids = [senderId, recipientId].sort();
            finalChannelId = `private_${ids[0]}_${ids[1]}`;
        }
        const message = {
            messageId,
            channelId: finalChannelId,
            senderId,
            senderName,
            content,
            timestamp,
            messageType,
            recipientId,
        };
        await docClient.send(new lib_dynamodb_1.PutCommand({
            TableName: process.env.CHAT_MESSAGES_TABLE,
            Item: {
                ...message,
                ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
            },
        }));
        let targetConnections = [];
        if (messageType === 'general') {
            const allConnectionsResult = await docClient.send(new lib_dynamodb_1.QueryCommand({
                TableName: process.env.CHAT_CONNECTIONS_TABLE,
                IndexName: 'userId-index',
                KeyConditionExpression: 'userId = :userId',
                ExpressionAttributeValues: {
                    ':userId': senderId,
                },
            }));
            const scanResult = await docClient.send(new lib_dynamodb_1.QueryCommand({
                TableName: process.env.CHAT_CONNECTIONS_TABLE,
                IndexName: 'connectionId-index',
            }));
            targetConnections = scanResult.Items || [];
        }
        else if (messageType === 'guild') {
            const guildMemberResult = await docClient.send(new lib_dynamodb_1.QueryCommand({
                TableName: process.env.GUILD_MEMBERS_TABLE,
                IndexName: 'user-guild-index',
                KeyConditionExpression: 'userId = :userId',
                ExpressionAttributeValues: {
                    ':userId': senderId,
                },
            }));
            if (guildMemberResult.Items && guildMemberResult.Items.length > 0) {
                const guildId = guildMemberResult.Items[0].guildId;
                const allGuildMembersResult = await docClient.send(new lib_dynamodb_1.QueryCommand({
                    TableName: process.env.GUILD_MEMBERS_TABLE,
                    KeyConditionExpression: 'guildId = :guildId',
                    ExpressionAttributeValues: {
                        ':guildId': guildId,
                    },
                }));
                const memberIds = allGuildMembersResult.Items?.map(member => member.userId) || [];
                const connectionPromises = memberIds.map(userId => docClient.send(new lib_dynamodb_1.QueryCommand({
                    TableName: process.env.CHAT_CONNECTIONS_TABLE,
                    IndexName: 'userId-index',
                    KeyConditionExpression: 'userId = :userId',
                    ExpressionAttributeValues: {
                        ':userId': userId,
                    },
                })));
                const connectionResults = await Promise.all(connectionPromises);
                targetConnections = connectionResults.flatMap(result => result.Items || []);
            }
        }
        else if (messageType === 'private') {
            const senderConnectionsResult = await docClient.send(new lib_dynamodb_1.QueryCommand({
                TableName: process.env.CHAT_CONNECTIONS_TABLE,
                IndexName: 'userId-index',
                KeyConditionExpression: 'userId = :userId',
                ExpressionAttributeValues: {
                    ':userId': senderId,
                },
            }));
            const recipientConnectionsResult = await docClient.send(new lib_dynamodb_1.QueryCommand({
                TableName: process.env.CHAT_CONNECTIONS_TABLE,
                IndexName: 'userId-index',
                KeyConditionExpression: 'userId = :userId',
                ExpressionAttributeValues: {
                    ':userId': recipientId,
                },
            }));
            targetConnections = [
                ...(senderConnectionsResult.Items || []),
                ...(recipientConnectionsResult.Items || []),
            ];
        }
        const sendPromises = targetConnections.map(async (connection) => {
            try {
                await apiGatewayClient.send(new client_apigatewaymanagementapi_1.PostToConnectionCommand({
                    ConnectionId: connection.connectionId,
                    Data: JSON.stringify({
                        type: 'message',
                        data: message,
                    }),
                }));
            }
            catch (error) {
                console.error(`Failed to send message to connection ${connection.connectionId}:`, error);
                await docClient.send(new lib_dynamodb_1.DeleteCommand({
                    TableName: process.env.CHAT_CONNECTIONS_TABLE,
                    Key: {
                        connectionId: connection.connectionId,
                    },
                }));
            }
        });
        await Promise.all(sendPromises);
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Message sent successfully',
                messageId,
            }),
        };
    }
    catch (error) {
        console.error('Send message error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to send message' }),
        };
    }
};
exports.handler = handler;
