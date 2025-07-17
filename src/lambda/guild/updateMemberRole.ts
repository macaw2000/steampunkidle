/**
 * Lambda function for updating a guild member's role and permissions
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DatabaseService, TABLE_NAMES } from '../../services/databaseService';
import { Guild, GuildMember, GuildRole, GuildPermission } from '../../types/guild';

// Default permissions for each role
const getDefaultPermissions = (role: GuildRole): GuildPermission[] => {
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

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
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

    // Get guild to verify it exists
    const guild = await DatabaseService.getItem<Guild>({
      TableName: TABLE_NAMES.GUILDS,
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

    // Get updater's membership to check permissions
    const updaterMembership = await DatabaseService.getItem<GuildMember>({
      TableName: TABLE_NAMES.GUILD_MEMBERS,
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

    // Get member to be updated
    const memberToUpdate = await DatabaseService.getItem<GuildMember>({
      TableName: TABLE_NAMES.GUILD_MEMBERS,
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

    // Permission checks based on action
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

    // Only current leader can transfer leadership
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

    // Can't change your own role (except for leadership transfer)
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

    // Officers can only promote/demote members, not other officers
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

    // Determine final permissions (use provided permissions or defaults)
    const finalPermissions = permissions || getDefaultPermissions(role as GuildRole);

    // Prepare transaction items
    const transactItems: any[] = [
      {
        Update: {
          TableName: TABLE_NAMES.GUILD_MEMBERS,
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

    // If transferring leadership, demote the current leader to officer
    if (isTransferringLeadership) {
      transactItems.push({
        Update: {
          TableName: TABLE_NAMES.GUILD_MEMBERS,
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

      // Update guild leader
      transactItems.push({
        Update: {
          TableName: TABLE_NAMES.GUILDS,
          Key: { guildId },
          UpdateExpression: 'SET leaderId = :leaderId, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':leaderId': memberUserId,
            ':updatedAt': new Date(),
          },
        },
      });
    }

    // Execute transaction
    await DatabaseService.transactWrite({
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
  } catch (error) {
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