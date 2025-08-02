"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const databaseService_1 = require("../../services/databaseService");
const uuid_1 = require("uuid");
const createDefaultGuildSettings = () => ({
    isPublic: true,
    requireApproval: false,
    maxMembers: 50,
    description: '',
    allowedActivities: ['crafting', 'harvesting', 'combat'],
});
const handler = async (event) => {
    try {
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
        if (!request.leaderId || !request.name) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'leaderId and name are required',
                }),
            };
        }
        if (request.name.length < 3 || request.name.length > 30) {
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
        const leaderCharacter = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.CHARACTERS,
            Key: { userId: request.leaderId },
        });
        if (!leaderCharacter) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Leader character not found',
                }),
            };
        }
        const existingMembership = await databaseService_1.DatabaseService.query({
            TableName: databaseService_1.TABLE_NAMES.GUILD_MEMBERS,
            IndexName: 'user-guild-index',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': request.leaderId,
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
        const now = new Date();
        const guildId = (0, uuid_1.v4)();
        const guild = {
            guildId,
            name: request.name,
            description: request.description || '',
            leaderId: request.leaderId,
            members: [],
            settings: { ...createDefaultGuildSettings(), ...request.settings },
            createdAt: now,
            updatedAt: now,
            memberCount: 1,
            level: 1,
            experience: 0,
        };
        const leaderMember = {
            guildId,
            userId: request.leaderId,
            characterName: leaderCharacter.name,
            role: 'leader',
            joinedAt: now,
            permissions: ['invite', 'kick', 'promote', 'demote', 'edit_settings', 'manage_events'],
            lastActiveAt: leaderCharacter.lastActiveAt,
        };
        await databaseService_1.DatabaseService.transactWrite({
            TransactItems: [
                {
                    Put: {
                        TableName: databaseService_1.TABLE_NAMES.GUILDS,
                        Item: guild,
                        ConditionExpression: 'attribute_not_exists(guildId)',
                    },
                },
                {
                    Put: {
                        TableName: databaseService_1.TABLE_NAMES.GUILD_MEMBERS,
                        Item: {
                            ...leaderMember,
                        },
                        ConditionExpression: 'attribute_not_exists(guildId) AND attribute_not_exists(userId)',
                    },
                },
            ],
        });
        return {
            statusCode: 201,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                guild,
                membership: leaderMember,
            }),
        };
    }
    catch (error) {
        console.error('Error creating guild:', error);
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
