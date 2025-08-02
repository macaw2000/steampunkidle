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
        const { userId } = JSON.parse(event.body);
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
        const updatedMembers = party.members.filter(member => member.userId !== userId);
        let newLeaderId = party.leaderId;
        if (party.leaderId === userId && updatedMembers.length > 0) {
            newLeaderId = updatedMembers[0].userId;
        }
        if (updatedMembers.length === 0) {
            await databaseService_1.DatabaseService.updateItem({
                TableName: databaseService_1.TABLE_NAMES.PARTIES,
                Key: { partyId },
                UpdateExpression: 'SET #status = :status',
                ExpressionAttributeNames: {
                    '#status': 'status',
                },
                ExpressionAttributeValues: {
                    ':status': 'disbanded',
                },
            });
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    message: 'Party disbanded - no members remaining',
                }),
            };
        }
        await databaseService_1.DatabaseService.updateItem({
            TableName: databaseService_1.TABLE_NAMES.PARTIES,
            Key: { partyId },
            UpdateExpression: 'SET #members = :members, leaderId = :leaderId',
            ExpressionAttributeNames: {
                '#members': 'members',
            },
            ExpressionAttributeValues: {
                ':members': updatedMembers,
                ':leaderId': newLeaderId,
            },
        });
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                message: 'Successfully left party',
                newLeader: newLeaderId !== party.leaderId ? newLeaderId : undefined,
            }),
        };
    }
    catch (error) {
        console.error('Error leaving party:', error);
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
