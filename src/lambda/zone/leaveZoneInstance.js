"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const databaseService_1 = require("../../services/databaseService");
const handler = async (event) => {
    try {
        const instanceId = event.pathParameters?.instanceId;
        if (!instanceId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'instanceId is required',
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
        const instance = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.ZONE_INSTANCES,
            Key: { instanceId },
        });
        if (!instance) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Zone instance not found',
                }),
            };
        }
        const party = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.PARTIES,
            Key: { partyId: instance.partyId },
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
        const isMember = party.members.some((member) => member.userId === userId);
        if (!isMember) {
            return {
                statusCode: 403,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'User is not a member of this party',
                }),
            };
        }
        if (instance.status === 'active') {
            await databaseService_1.DatabaseService.updateItem({
                TableName: databaseService_1.TABLE_NAMES.ZONE_INSTANCES,
                Key: { instanceId },
                UpdateExpression: 'SET #status = :status, completedAt = :completedAt',
                ExpressionAttributeNames: {
                    '#status': 'status',
                },
                ExpressionAttributeValues: {
                    ':status': 'failed',
                    ':completedAt': new Date().toISOString(),
                },
            });
            await databaseService_1.DatabaseService.updateItem({
                TableName: databaseService_1.TABLE_NAMES.PARTIES,
                Key: { partyId: instance.partyId },
                UpdateExpression: 'SET #status = :status',
                ExpressionAttributeNames: {
                    '#status': 'status',
                },
                ExpressionAttributeValues: {
                    ':status': 'forming',
                },
            });
        }
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                message: 'Successfully left zone instance',
            }),
        };
    }
    catch (error) {
        console.error('Error leaving zone instance:', error);
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
