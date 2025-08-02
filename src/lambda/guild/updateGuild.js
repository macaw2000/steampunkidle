"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const databaseService_1 = require("../../services/databaseService");
const handler = async (event) => {
    try {
        const guildId = event.pathParameters?.guildId;
        const userId = event.requestContext.authorizer?.userId;
        if (!guildId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Guild ID is required',
                }),
            };
        }
        if (!userId) {
            return {
                statusCode: 401,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'User authentication required',
                }),
            };
        }
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
        const guild = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.GUILDS,
            Key: { guildId },
        });
        if (!guild) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Guild not found',
                }),
            };
        }
        const membership = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.GUILD_MEMBERS,
            Key: { guildId, userId },
        });
        if (!membership) {
            return {
                statusCode: 403,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'User is not a member of this guild',
                }),
            };
        }
        if (!membership.permissions.includes('edit_settings')) {
            return {
                statusCode: 403,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'User does not have permission to edit guild settings',
                }),
            };
        }
        if (request.name && (request.name.length < 3 || request.name.length > 30)) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Guild name must be between 3 and 30 characters',
                }),
            };
        }
        if (request.name && request.name !== guild.name) {
            const existingGuild = await databaseService_1.DatabaseService.scan({
                TableName: databaseService_1.TABLE_NAMES.GUILDS,
                FilterExpression: '#name = :name',
                ExpressionAttributeNames: {
                    '#name': 'name',
                },
                ExpressionAttributeValues: {
                    ':name': request.name,
                },
            });
            if (existingGuild.items.length > 0) {
                return {
                    statusCode: 409,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    },
                    body: JSON.stringify({
                        error: 'Guild name is already taken',
                    }),
                };
            }
        }
        const updateExpressions = [];
        const expressionAttributeNames = {};
        const expressionAttributeValues = {};
        if (request.name) {
            updateExpressions.push('#name = :name');
            expressionAttributeNames['#name'] = 'name';
            expressionAttributeValues[':name'] = request.name;
        }
        if (request.description !== undefined) {
            updateExpressions.push('description = :description');
            expressionAttributeValues[':description'] = request.description;
        }
        if (request.settings) {
            updateExpressions.push('#settings = :settings');
            expressionAttributeNames['#settings'] = 'settings';
            expressionAttributeValues[':settings'] = {
                ...guild.settings,
                ...request.settings,
            };
        }
        updateExpressions.push('updatedAt = :updatedAt');
        expressionAttributeValues[':updatedAt'] = new Date();
        const updatedGuild = await databaseService_1.DatabaseService.updateItem({
            TableName: databaseService_1.TABLE_NAMES.GUILDS,
            Key: { guildId },
            UpdateExpression: `SET ${updateExpressions.join(', ')}`,
            ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
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
                guild: updatedGuild,
            }),
        };
    }
    catch (error) {
        console.error('Error updating guild:', error);
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
