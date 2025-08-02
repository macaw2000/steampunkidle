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
        const { userId, isReady } = JSON.parse(event.body);
        if (!userId || typeof isReady !== 'boolean') {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'userId and isReady (boolean) are required',
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
        const memberIndex = party.members.findIndex(member => member.userId === userId);
        if (memberIndex === -1) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'User is not in this party',
                }),
            };
        }
        const updatedMembers = [...party.members];
        updatedMembers[memberIndex] = {
            ...updatedMembers[memberIndex],
            isReady,
        };
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
        const allReady = updatedMembers.every(member => member.isReady);
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
                allReady,
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
                allReady,
            }),
        };
    }
    catch (error) {
        console.error('Error updating member readiness:', error);
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
