"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const databaseService_1 = require("../../services/databaseService");
const handler = async (event) => {
    try {
        const invitationId = event.pathParameters?.invitationId;
        const userId = event.requestContext.authorizer?.userId;
        if (!invitationId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Invitation ID is required',
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
        const { response } = JSON.parse(event.body);
        if (!response || !['accepted', 'declined'].includes(response)) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Response must be "accepted" or "declined"',
                }),
            };
        }
        const invitation = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.GUILD_INVITATIONS || 'steampunk-idle-game-guild-invitations',
            Key: { invitationId },
        });
        if (!invitation) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Invitation not found',
                }),
            };
        }
        if (invitation.inviteeId !== userId) {
            return {
                statusCode: 403,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'User is not the recipient of this invitation',
                }),
            };
        }
        if (invitation.status !== 'pending') {
            return {
                statusCode: 409,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Invitation has already been responded to',
                }),
            };
        }
        if (new Date() > invitation.expiresAt) {
            return {
                statusCode: 409,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Invitation has expired',
                }),
            };
        }
        await databaseService_1.DatabaseService.updateItem({
            TableName: databaseService_1.TABLE_NAMES.GUILD_INVITATIONS || 'steampunk-idle-game-guild-invitations',
            Key: { invitationId },
            UpdateExpression: 'SET #status = :status',
            ExpressionAttributeNames: {
                '#status': 'status',
            },
            ExpressionAttributeValues: {
                ':status': response,
            },
        });
        if (response === 'accepted') {
            const guild = await databaseService_1.DatabaseService.getItem({
                TableName: databaseService_1.TABLE_NAMES.GUILDS,
                Key: { guildId: invitation.guildId },
            });
            if (!guild) {
                return {
                    statusCode: 404,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    },
                    body: JSON.stringify({
                        error: 'Guild no longer exists',
                    }),
                };
            }
            const existingMembership = await databaseService_1.DatabaseService.query({
                TableName: databaseService_1.TABLE_NAMES.GUILD_MEMBERS,
                IndexName: 'user-guild-index',
                KeyConditionExpression: 'userId = :userId',
                ExpressionAttributeValues: {
                    ':userId': userId,
                },
            });
            if (existingMembership.items.length > 0) {
                return {
                    statusCode: 409,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    },
                    body: JSON.stringify({
                        error: 'User is already in a guild',
                    }),
                };
            }
            const currentMemberCount = await databaseService_1.DatabaseService.query({
                TableName: databaseService_1.TABLE_NAMES.GUILD_MEMBERS,
                KeyConditionExpression: 'guildId = :guildId',
                ExpressionAttributeValues: {
                    ':guildId': invitation.guildId,
                },
                Select: 'COUNT',
            });
            if (currentMemberCount.count >= guild.settings.maxMembers) {
                return {
                    statusCode: 409,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    },
                    body: JSON.stringify({
                        error: 'Guild is at maximum capacity',
                    }),
                };
            }
            const character = await databaseService_1.DatabaseService.getItem({
                TableName: databaseService_1.TABLE_NAMES.CHARACTERS,
                Key: { userId },
            });
            if (!character) {
                return {
                    statusCode: 404,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    },
                    body: JSON.stringify({
                        error: 'Character not found',
                    }),
                };
            }
            const now = new Date();
            const membership = {
                guildId: invitation.guildId,
                userId,
                characterName: character.name,
                role: 'member',
                joinedAt: now,
                permissions: [],
                lastActiveAt: character.lastActiveAt,
            };
            await databaseService_1.DatabaseService.transactWrite({
                TransactItems: [
                    {
                        Put: {
                            TableName: databaseService_1.TABLE_NAMES.GUILD_MEMBERS,
                            Item: {
                                ...membership,
                            },
                            ConditionExpression: 'attribute_not_exists(guildId) AND attribute_not_exists(userId)',
                        },
                    },
                    {
                        Update: {
                            TableName: databaseService_1.TABLE_NAMES.GUILDS,
                            Key: { guildId: invitation.guildId },
                            UpdateExpression: 'SET memberCount = memberCount + :inc, updatedAt = :updatedAt',
                            ExpressionAttributeValues: {
                                ':inc': 1,
                                ':updatedAt': now,
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
                    message: 'Invitation accepted successfully',
                    membership,
                    guildName: guild.name,
                }),
            };
        }
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                message: 'Invitation declined successfully',
            }),
        };
    }
    catch (error) {
        console.error('Error responding to invitation:', error);
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
