"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const databaseService_1 = require("../../services/databaseService");
const handler = async (event) => {
    try {
        const userId = event.pathParameters?.userId;
        if (!userId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'userId is required',
                }),
            };
        }
        const result = await databaseService_1.DatabaseService.scan({
            TableName: databaseService_1.TABLE_NAMES.PARTIES,
            FilterExpression: 'contains(#members, :userId) AND (#status = :forming OR #status = :active)',
            ExpressionAttributeNames: {
                '#members': 'members',
                '#status': 'status',
            },
            ExpressionAttributeValues: {
                ':userId': userId,
                ':forming': 'forming',
                ':active': 'active',
            },
        });
        if (result.items.length === 0) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'User is not in any party',
                }),
            };
        }
        const party = result.items[0];
        const userMember = party.members.find(member => member.userId === userId);
        if (!userMember) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'User is not in any party',
                }),
            };
        }
        const roleCount = { tank: 0, healer: 0, dps: 0 };
        const readyCount = party.members.filter(m => m.isReady).length;
        party.members.forEach(member => {
            roleCount[member.role]++;
        });
        const partyWithComposition = {
            ...party,
            composition: {
                totalMembers: party.members.length,
                maxMembers: party.maxMembers,
                readyMembers: readyCount,
                roleDistribution: roleCount,
                allReady: readyCount === party.members.length && party.members.length > 0,
            },
            userMember,
        };
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                party: partyWithComposition,
            }),
        };
    }
    catch (error) {
        console.error('Error getting user party:', error);
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
