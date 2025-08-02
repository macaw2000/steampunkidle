"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const databaseService_1 = require("../../services/databaseService");
const handler = async (event) => {
    try {
        const partyId = event.pathParameters?.partyId;
        if (!partyId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'partyId is required',
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
        if (!request.userId || !request.preferredRole) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'userId and preferredRole are required',
                }),
            };
        }
        const party = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.PARTIES,
            Key: { partyId },
        });
        if (!party) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Party not found',
                }),
            };
        }
        const character = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.CHARACTERS,
            Key: { userId: request.userId },
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
        const isAlreadyMember = party.members.some(member => member.userId === request.userId);
        if (isAlreadyMember) {
            return {
                statusCode: 409,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'User is already in this party',
                }),
            };
        }
        const existingParty = await databaseService_1.DatabaseService.scan({
            TableName: databaseService_1.TABLE_NAMES.PARTIES,
            FilterExpression: 'contains(#members, :userId) AND #status = :status AND partyId <> :currentPartyId',
            ExpressionAttributeNames: {
                '#members': 'members',
                '#status': 'status',
            },
            ExpressionAttributeValues: {
                ':userId': request.userId,
                ':status': 'forming',
                ':currentPartyId': partyId,
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
                    error: 'User is already in another party',
                }),
            };
        }
        if (party.status !== 'forming') {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Party is no longer accepting members',
                }),
            };
        }
        if (party.members.length >= party.maxMembers) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Party is full',
                }),
            };
        }
        if (character.level < party.minLevel) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: `Minimum level required: ${party.minLevel}`,
                }),
            };
        }
        if (party.maxLevel && character.level > party.maxLevel) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: `Maximum level allowed: ${party.maxLevel}`,
                }),
            };
        }
        if (party.visibility === 'guild') {
            const guildMembership = await databaseService_1.DatabaseService.getItem({
                TableName: databaseService_1.TABLE_NAMES.GUILD_MEMBERS,
                Key: { guildId: party.guildId, userId: request.userId },
            });
            if (!guildMembership) {
                return {
                    statusCode: 403,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    },
                    body: JSON.stringify({
                        error: 'This party is restricted to guild members',
                    }),
                };
            }
        }
        if (party.visibility === 'private') {
            return {
                statusCode: 403,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'This party is private',
                }),
            };
        }
        const newMember = {
            userId: request.userId,
            characterName: character.name,
            level: character.level,
            role: request.preferredRole,
            isReady: false,
            joinedAt: new Date(),
        };
        const updatedMembers = [...party.members, newMember];
        await databaseService_1.DatabaseService.updateItem({
            TableName: databaseService_1.TABLE_NAMES.PARTIES,
            Key: { partyId },
            UpdateExpression: 'SET #members = :members',
            ExpressionAttributeNames: {
                '#members': 'members',
                '#status': 'status',
            },
            ExpressionAttributeValues: {
                ':members': updatedMembers,
                ':status': 'forming',
            },
            ConditionExpression: 'attribute_exists(partyId) AND #status = :status',
        });
        const updatedParty = {
            ...party,
            members: updatedMembers,
        };
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                party: updatedParty,
            }),
        };
    }
    catch (error) {
        console.error('Error joining party:', error);
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
