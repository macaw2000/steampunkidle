"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const databaseService_1 = require("../../services/databaseService");
const handler = async (event) => {
    try {
        const guildId = event.pathParameters?.guildId;
        const memberUserId = event.pathParameters?.userId;
        const kickerId = event.requestContext.authorizer?.userId;
        if (!guildId || !memberUserId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Guild ID and member user ID are required',
                }),
            };
        }
        if (!kickerId) {
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
        if (kickerId === memberUserId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Cannot kick yourself from the guild',
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
        const kickerMembership = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.GUILD_MEMBERS,
            Key: { guildId, userId: kickerId },
        });
        if (!kickerMembership) {
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
        if (!kickerMembership.permissions.includes('kick')) {
            return {
                statusCode: 403,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'User does not have permission to kick members',
                }),
            };
        }
        const memberToKick = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.GUILD_MEMBERS,
            Key: { guildId, userId: memberUserId },
        });
        if (!memberToKick) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Member not found in this guild',
                }),
            };
        }
        if (memberToKick.role === 'leader') {
            return {
                statusCode: 403,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Cannot kick the guild leader',
                }),
            };
        }
        if (kickerMembership.role === 'officer' && memberToKick.role === 'officer') {
            return {
                statusCode: 403,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Officers cannot kick other officers',
                }),
            };
        }
        await databaseService_1.DatabaseService.transactWrite({
            TransactItems: [
                {
                    Delete: {
                        TableName: databaseService_1.TABLE_NAMES.GUILD_MEMBERS,
                        Key: { guildId, userId: memberUserId },
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
                message: 'Member kicked successfully',
                kickedMember: {
                    userId: memberUserId,
                    characterName: memberToKick.characterName,
                    role: memberToKick.role,
                },
            }),
        };
    }
    catch (error) {
        console.error('Error kicking member:', error);
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
