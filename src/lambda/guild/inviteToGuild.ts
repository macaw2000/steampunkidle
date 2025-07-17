/**
 * Lambda function for inviting a user to a guild
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DatabaseService, TABLE_NAMES } from '../../services/databaseService';
import { Guild, GuildMember, GuildInvitation } from '../../types/guild';
import { Character } from '../../types/character';
import { v4 as uuidv4 } from 'uuid';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const guildId = event.pathParameters?.guildId;
    const inviterId = event.requestContext.authorizer?.userId;

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

    if (!inviterId) {
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

    const { inviteeId } = JSON.parse(event.body);

    if (!inviteeId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Invitee ID is required',
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

    // Check if inviter has permission to invite
    const inviterMembership = await DatabaseService.getItem<GuildMember>({
      TableName: TABLE_NAMES.GUILD_MEMBERS,
      Key: { guildId, userId: inviterId },
    });

    if (!inviterMembership) {
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

    if (!inviterMembership.permissions.includes('invite')) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'User does not have permission to invite members',
        }),
      };
    }

    // Check if invitee exists
    const inviteeCharacter = await DatabaseService.getItem<Character>({
      TableName: TABLE_NAMES.CHARACTERS,
      Key: { userId: inviteeId },
    });

    if (!inviteeCharacter) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Invitee character not found',
        }),
      };
    }

    // Check if invitee is already in a guild
    const existingMembership = await DatabaseService.query({
      TableName: TABLE_NAMES.GUILD_MEMBERS,
      IndexName: 'user-guild-index',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': inviteeId,
      },
    });

    if (existingMembership.items.length > 0) {
      return {
        statusCode: 409,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'User is already in a guild',
        }),
      };
    }

    // Check if there's already a pending invitation
    const existingInvitation = await DatabaseService.scan({
      TableName: TABLE_NAMES.GUILD_INVITATIONS || 'steampunk-idle-game-guild-invitations',
      FilterExpression: 'guildId = :guildId AND inviteeId = :inviteeId AND #status = :status',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':guildId': guildId,
        ':inviteeId': inviteeId,
        ':status': 'pending',
      },
    });

    if (existingInvitation.items.length > 0) {
      return {
        statusCode: 409,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'User already has a pending invitation to this guild',
        }),
      };
    }

    // Check if guild is at max capacity
    const currentMemberCount = await DatabaseService.query({
      TableName: TABLE_NAMES.GUILD_MEMBERS,
      KeyConditionExpression: 'guildId = :guildId',
      ExpressionAttributeValues: {
        ':guildId': guildId,
      },
      Select: 'COUNT',
    });

    if (currentMemberCount.count >= guild.settings.maxMembers) {
      return {
        statusCode: 409,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Guild is at maximum capacity',
        }),
      };
    }

    // Create invitation
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    const invitation: GuildInvitation = {
      invitationId: uuidv4(),
      guildId,
      inviterId,
      inviteeId,
      status: 'pending',
      createdAt: now,
      expiresAt,
    };

    // Save invitation
    await DatabaseService.putItem({
      TableName: TABLE_NAMES.GUILD_INVITATIONS || 'steampunk-idle-game-guild-invitations',
      Item: invitation,
    });

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        invitation,
        inviteeCharacterName: inviteeCharacter.name,
        guildName: guild.name,
      }),
    };
  } catch (error) {
    console.error('Error inviting to guild:', error);

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