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
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'User is not a member of this guild',
                }),
            };
        }
        if (membership.role === 'leader') {
            const memberCount = await databaseService_1.DatabaseService.query({
                TableName: databaseService_1.TABLE_NAMES.GUILD_MEMBERS,
                KeyConditionExpression: 'guildId = :guildId',
                ExpressionAttributeValues: {
                    ':guildId': guildId,
                },
                Select: 'COUNT',
            });
            if (memberCount.count > 1) {
                return {
                    statusCode: 409,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    },
                    body: JSON.stringify({
                        error: 'Guild leader must transfer leadership or disband the guild before leaving',
                    }),
                };
            }
            await databaseService_1.DatabaseService.transactWrite({
                TransactItems: [
                    {
                        Delete: {
                            TableName: databaseService_1.TABLE_NAMES.GUILD_MEMBERS,
                            Key: { guildId, userId },
                        },
                    },
                    {
                        Delete: {
                            TableName: databaseService_1.TABLE_NAMES.GUILDS,
                            Key: { guildId },
                        },
                    },
                ],
            });
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    message: 'Left guild successfully - guild disbanded as you were the only member',
                    guildDisbanded: true,
                }),
            };
        }
        await databaseService_1.DatabaseService.transactWrite({
            TransactItems: [
                {
                    Delete: {
                        TableName: databaseService_1.TABLE_NAMES.GUILD_MEMBERS,
                        Key: { guildId, userId },
                    },
                },
                {
                    Update: {
                        TableName: databaseService_1.TABLE_NAMES.GUILDS,
                        Key: { guildId },
                        UpdateExpression: 'SET memberCount = memberCount - :dec, updatedAt = :updatedAt',
                        ExpressionAttributeValues: {
                            ':dec': 1,
                            ':updatedAt': new Date(),
                        },
                    },
                },
            ],
        });
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                message: 'Left guild successfully',
                guildName: guild.name,
            }),
        };
    }
    catch (error) {
        console.error('Error leaving guild:', error);
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
