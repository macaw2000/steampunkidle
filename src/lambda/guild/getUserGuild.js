"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const databaseService_1 = require("../../services/databaseService");
const handler = async (event) => {
    try {
        const userId = event.requestContext.authorizer?.userId || event.pathParameters?.userId;
        if (!userId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'User ID is required',
                }),
            };
        }
        const membershipResult = await databaseService_1.DatabaseService.query({
            TableName: databaseService_1.TABLE_NAMES.GUILD_MEMBERS,
            IndexName: 'user-guild-index',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId,
            },
        });
        if (membershipResult.items.length === 0) {
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    guild: null,
                    membership: null,
                }),
            };
        }
        const membership = membershipResult.items[0];
        const guild = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.GUILDS,
            Key: { guildId: membership.guildId },
        });
        if (!guild) {
            await databaseService_1.DatabaseService.deleteItem({
                TableName: databaseService_1.TABLE_NAMES.GUILD_MEMBERS,
                Key: { guildId: membership.guildId, userId },
            });
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    guild: null,
                    membership: null,
                }),
            };
        }
        const allMembersResult = await databaseService_1.DatabaseService.query({
            TableName: databaseService_1.TABLE_NAMES.GUILD_MEMBERS,
            KeyConditionExpression: 'guildId = :guildId',
            ExpressionAttributeValues: {
                ':guildId': membership.guildId,
            },
        });
        const guildWithMembers = {
            ...guild,
            members: allMembersResult.items,
            memberCount: allMembersResult.items.length,
        };
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                guild: guildWithMembers,
                membership,
            }),
        };
    }
    catch (error) {
        console.error('Error getting user guild:', error);
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
