"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const databaseService_1 = require("../../services/databaseService");
const getDefaultPermissions = (role) => {
    switch (role) {
        case 'leader':
            return ['invite', 'kick', 'promote', 'demote', 'edit_settings', 'manage_events'];
        case 'officer':
            return ['invite', 'kick', 'manage_events'];
        case 'member':
            return [];
        default:
            return [];
    }
};
const handler = async (event) => {
    try {
        const guildId = event.pathParameters?.guildId;
        const memberUserId = event.pathParameters?.userId;
        const updaterId = event.requestContext.authorizer?.userId;
        if (!guildId || !memberUserId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Guild ID and member user ID are required',
                }),
            };
        }
        if (!updaterId) {
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
        const { role, permissions } = JSON.parse(event.body);
        if (!role || !['leader', 'officer', 'member'].includes(role)) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Valid role is required (leader, officer, member)',
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
        const updaterMembership = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.GUILD_MEMBERS,
            Key: { guildId, userId: updaterId },
        });
        if (!updaterMembership) {
            return {
                statusCode: 403,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'User is not a member of this guild',
                }),
            };
        }
        const memberToUpdate = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.GUILD_MEMBERS,
            Key: { guildId, userId: memberUserId },
        });
        if (!memberToUpdate) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Member not found in this guild',
                }),
            };
        }
        const isPromoting = role === 'officer' && memberToUpdate.role === 'member';
        const isDemoting = role === 'member' && memberToUpdate.role === 'officer';
        const isTransferringLeadership = role === 'leader';
        if (isPromoting && !updaterMembership.permissions.includes('promote')) {
            return {
                statusCode: 403,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'User does not have permission to promote members',
                }),
            };
        }
        if (isDemoting && !updaterMembership.permissions.includes('demote')) {
            return {
                statusCode: 403,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'User does not have permission to demote members',
                }),
            };
        }
        if (isTransferringLeadership && updaterMembership.role !== 'leader') {
            return {
                statusCode: 403,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Only the current leader can transfer leadership',
                }),
            };
        }
        if (updaterId === memberUserId && !isTransferringLeadership) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Cannot change your own role',
                }),
            };
        }
        if (updaterMembership.role === 'officer' && memberToUpdate.role === 'officer' && !isTransferringLeadership) {
            return {
                statusCode: 403,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Officers cannot change other officers\' roles',
                }),
            };
        }
        const finalPermissions = permissions || getDefaultPermissions(role);
        const transactItems = [
            {
                Update: {
                    TableName: databaseService_1.TABLE_NAMES.GUILD_MEMBERS,
                    Key: { guildId, userId: memberUserId },
                    UpdateExpression: 'SET #role = :role, permissions = :permissions',
                    ExpressionAttributeNames: {
                        '#role': 'role',
                    },
                    ExpressionAttributeValues: {
                        ':role': role,
                        ':permissions': finalPermissions,
                    },
                },
            },
        ];
        if (isTransferringLeadership) {
            transactItems.push({
                Update: {
                    TableName: databaseService_1.TABLE_NAMES.GUILD_MEMBERS,
                    Key: { guildId, userId: updaterId },
                    UpdateExpression: 'SET #role = :role, permissions = :permissions',
                    ExpressionAttributeNames: {
                        '#role': 'role',
                    },
                    ExpressionAttributeValues: {
                        ':role': 'officer',
                        ':permissions': getDefaultPermissions('officer'),
                    },
                },
            });
            transactItems.push({
                Update: {
                    TableName: databaseService_1.TABLE_NAMES.GUILDS,
                    Key: { guildId },
                    UpdateExpression: 'SET leaderId = :leaderId, updatedAt = :updatedAt',
                    ExpressionAttributeValues: {
                        ':leaderId': memberUserId,
                        ':updatedAt': new Date(),
                    },
                },
            });
        }
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
                message: 'Member role updated successfully',
                updatedMember: {
                    userId: memberUserId,
                    characterName: memberToUpdate.characterName,
                    oldRole: memberToUpdate.role,
                    newRole: role,
                    permissions: finalPermissions,
                },
                ...(isTransferringLeadership && {
                    leadershipTransferred: true,
                    newLeader: memberUserId,
                    formerLeader: updaterId,
                }),
            }),
        };
    }
    catch (error) {
        console.error('Error updating member role:', error);
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
