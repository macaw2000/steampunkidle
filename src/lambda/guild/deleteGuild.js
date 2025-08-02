"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const databaseService_1 = require("../../services/databaseService");
const handler = async (event) => {
    try {
        const guildId = event.pathParameters?.guildId;
        const userId = event.requestContext.authorizer?.userId;
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
        if (guild.leaderId !== userId) {
            return {
                statusCode: 403,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Only the guild leader can delete the guild',
                }),
            };
        }
        const membersResult = await databaseService_1.DatabaseService.query({
            TableName: databaseService_1.TABLE_NAMES.GUILD_MEMBERS,
            KeyConditionExpression: 'guildId = :guildId',
            ExpressionAttributeValues: {
                ':guildId': guildId,
            },
        });
        const transactItems = [
            {
                Delete: {
                    TableName: databaseService_1.TABLE_NAMES.GUILDS,
                    Key: { guildId },
                },
            },
        ];
        membersResult.items.forEach(member => {
            transactItems.push({
                Delete: {
                    TableName: databaseService_1.TABLE_NAMES.GUILD_MEMBERS,
                    Key: { guildId, userId: member.userId },
                },
            });
        });
        await databaseService_1.DatabaseService.transactWrite({
            TransactItems: transactItems,
        });
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                message: 'Guild deleted successfully',
                deletedMembers: membersResult.items.length,
            }),
        };
    }
    catch (error) {
        console.error('Error deleting guild:', error);
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
