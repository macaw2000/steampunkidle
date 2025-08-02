"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const databaseService_1 = require("../../services/databaseService");
const uuid_1 = require("uuid");
const handler = async (event) => {
    try {
        const guildId = event.pathParameters?.guildId;
        const inviterId = event.requestContext.authorizer?.userId;
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
        if (!inviterId) {
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
        const { inviteeId } = JSON.parse(event.body);
        if (!inviteeId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Invitee ID is required',
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
        const inviterMembership = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.GUILD_MEMBERS,
            Key: { guildId, userId: inviterId },
        });
        if (!inviterMembership) {
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
        if (!inviterMembership.permissions.includes('invite')) {
            return {
                statusCode: 403,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'User does not have permission to invite members',
                }),
            };
        }
        const inviteeCharacter = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.CHARACTERS,
            Key: { userId: inviteeId },
        });
        if (!inviteeCharacter) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Invitee character not found',
                }),
            };
        }
        const existingMembership = await databaseService_1.DatabaseService.query({
            TableName: databaseService_1.TABLE_NAMES.GUILD_MEMBERS,
            IndexName: 'user-guild-index',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': inviteeId,
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
        const existingInvitation = await databaseService_1.DatabaseService.scan({
            TableName: databaseService_1.TABLE_NAMES.GUILD_INVITATIONS || 'steampunk-idle-game-guild-invitations',
            FilterExpression: 'guildId = :guildId AND inviteeId = :inviteeId AND #status = :status',
            ExpressionAttributeNames: {
                '#status': 'status',
            },
            ExpressionAttributeValues: {
                ':guildId': guildId,
                ':inviteeId': inviteeId,
                ':status': 'pending',
            },
        });
        if (existingInvitation.items.length > 0) {
            return {
                statusCode: 409,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'User already has a pending invitation to this guild',
                }),
            };
        }
        const currentMemberCount = await databaseService_1.DatabaseService.query({
            TableName: databaseService_1.TABLE_NAMES.GUILD_MEMBERS,
            KeyConditionExpression: 'guildId = :guildId',
            ExpressionAttributeValues: {
                ':guildId': guildId,
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
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const invitation = {
            invitationId: (0, uuid_1.v4)(),
            guildId,
            inviterId,
            inviteeId,
            status: 'pending',
            createdAt: now,
            expiresAt,
        };
        await databaseService_1.DatabaseService.putItem({
            TableName: databaseService_1.TABLE_NAMES.GUILD_INVITATIONS || 'steampunk-idle-game-guild-invitations',
            Item: invitation,
        });
        return {
            statusCode: 201,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                invitation,
                inviteeCharacterName: inviteeCharacter.name,
                guildName: guild.name,
            }),
        };
    }
    catch (error) {
        console.error('Error inviting to guild:', error);
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
