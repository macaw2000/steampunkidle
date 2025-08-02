"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const databaseService_1 = require("../../services/databaseService");
const uuid_1 = require("uuid");
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
        if (!request.leaderId || !request.name || !request.type) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'leaderId, name, and type are required',
                }),
            };
        }
        if (request.type === 'zone' && (request.maxMembers < 1 || request.maxMembers > 3)) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Zone parties must have 1-3 max members',
                }),
            };
        }
        if (request.type === 'dungeon' && (request.maxMembers < 5 || request.maxMembers > 8)) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Dungeon parties must have 5-8 max members',
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
        const existingParty = await databaseService_1.DatabaseService.scan({
            TableName: databaseService_1.TABLE_NAMES.PARTIES,
            FilterExpression: 'contains(#members, :leaderId) AND #status = :status',
            ExpressionAttributeNames: {
                '#members': 'members',
                '#status': 'status',
            },
            ExpressionAttributeValues: {
                ':leaderId': request.leaderId,
                ':status': 'forming',
            },
        });
        if (existingParty.items.length > 0) {
            return {
                statusCode: 409,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Leader is already in a party',
                }),
            };
        }
        if (request.visibility === 'guild') {
            if (!request.guildId) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    },
                    body: JSON.stringify({
                        error: 'guildId is required for guild visibility',
                    }),
                };
            }
            const guildMembership = await databaseService_1.DatabaseService.getItem({
                TableName: databaseService_1.TABLE_NAMES.GUILD_MEMBERS,
                Key: { guildId: request.guildId, userId: request.leaderId },
            });
            if (!guildMembership) {
                return {
                    statusCode: 403,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    },
                    body: JSON.stringify({
                        error: 'Leader is not a member of the specified guild',
                    }),
                };
            }
        }
        const getRecommendedRole = (character) => {
            const spec = character.specialization;
            const maxProgress = Math.max(spec.tankProgress, spec.healerProgress, spec.dpsProgress);
            if (spec.tankProgress === maxProgress)
                return 'tank';
            if (spec.healerProgress === maxProgress)
                return 'healer';
            return 'dps';
        };
        const now = new Date();
        const partyId = (0, uuid_1.v4)();
        const leaderMember = {
            userId: request.leaderId,
            characterName: leaderCharacter.name,
            level: leaderCharacter.level,
            role: getRecommendedRole(leaderCharacter),
            isReady: false,
            joinedAt: now,
        };
        const party = {
            partyId,
            leaderId: request.leaderId,
            name: request.name,
            type: request.type,
            visibility: request.visibility,
            members: [leaderMember],
            maxMembers: request.maxMembers,
            minLevel: request.minLevel,
            maxLevel: request.maxLevel,
            guildId: request.guildId,
            createdAt: now,
            status: 'forming',
        };
        await databaseService_1.DatabaseService.putItem({
            TableName: databaseService_1.TABLE_NAMES.PARTIES,
            Item: party,
            ConditionExpression: 'attribute_not_exists(partyId)',
        });
        return {
            statusCode: 201,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                party,
            }),
        };
    }
    catch (error) {
        console.error('Error creating party:', error);
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
