/**
 * Lambda function for kicking a member from a guild
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DatabaseService, TABLE_NAMES } from '../../services/databaseService';
import { Guild, GuildMember } from '../../types/guild';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const guildId = event.pathParameters?.guildId;
    const memberUserId = event.pathParameters?.userId;
    const kickerId = event.requestContext.authorizer?.userId;

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

    if (!kickerId) {
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

    // Can't kick yourself
    if (kickerId === memberUserId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Cannot kick yourself from the guild',
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

    // Get kicker's membership to check permissions
    const kickerMembership = await DatabaseService.getItem<GuildMember>({
      TableName: TABLE_NAMES.GUILD_MEMBERS,
      Key: { guildId, userId: kickerId },
    });

    if (!kickerMembership) {
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

    if (!kickerMembership.permissions.includes('kick')) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'User does not have permission to kick members',
        }),
      };
    }

    // Get member to be kicked
    const memberToKick = await DatabaseService.getItem<GuildMember>({
      TableName: TABLE_NAMES.GUILD_MEMBERS,
      Key: { guildId, userId: memberUserId },
    });

    if (!memberToKick) {
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

    // Can't kick the guild leader
    if (memberToKick.role === 'leader') {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Cannot kick the guild leader',
        }),
      };
    }

    // Officers can only kick members, not other officers (unless they're the leader)
    if (kickerMembership.role === 'officer' && memberToKick.role === 'officer') {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Officers cannot kick other officers',
        }),
      };
    }

    // Remove member from guild and update guild member count
    await DatabaseService.transactWrite({
      TransactItems: [
        {
          Delete: {
            TableName: TABLE_NAMES.GUILD_MEMBERS,
            Key: { guildId, userId: memberUserId },
          },
        },
        {
          Update: {
            TableName: TABLE_NAMES.GUILDS,
            Key: { guildId },
            UpdateExpression: 'SET memberCount = memberCount - :dec, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
              ':dec': 1,
              ':updatedAt': new Date(),
            },
          },
        },
      ],
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Member kicked successfully',
        kickedMember: {
          userId: memberUserId,
          characterName: memberToKick.characterName,
          role: memberToKick.role,
        },
      }),
    };
  } catch (error) {
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