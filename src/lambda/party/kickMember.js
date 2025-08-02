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
        const { leaderId, memberUserId } = JSON.parse(event.body);
        if (!leaderId || !memberUserId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'leaderId and memberUserId are required',
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
        if (party.leaderId !== leaderId) {
            return {
                statusCode: 403,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Only the party leader can kick members',
                }),
            };
        }
        const memberIndex = party.members.findIndex(member => member.userId === memberUserId);
        if (memberIndex === -1) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Member not found in party',
                }),
            };
        }
        if (memberUserId === leaderId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Leader cannot kick themselves. Use leave party instead.',
                }),
            };
        }
        const updatedMembers = party.members.filter(member => member.userId !== memberUserId);
        await databaseService_1.DatabaseService.updateItem({
            TableName: databaseService_1.TABLE_NAMES.PARTIES,
            Key: { partyId },
            UpdateExpression: 'SET #members = :members',
            ExpressionAttributeNames: {
                '#members': 'members',
            },
            ExpressionAttributeValues: {
                ':members': updatedMembers,
            },
        });
        const roleCount = { tank: 0, healer: 0, dps: 0 };
        const readyCount = updatedMembers.filter(m => m.isReady).length;
        updatedMembers.forEach(member => {
            roleCount[member.role]++;
        });
        const updatedParty = {
            ...party,
            members: updatedMembers,
            composition: {
                totalMembers: updatedMembers.length,
                maxMembers: party.maxMembers,
                readyMembers: readyCount,
                roleDistribution: roleCount,
                allReady: readyCount === updatedMembers.length && updatedMembers.length > 0,
            },
        };
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                party: updatedParty,
                kickedMember: party.members[memberIndex],
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
