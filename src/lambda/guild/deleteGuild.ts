/**
 * Lambda function for deleting a guild
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DatabaseService, TABLE_NAMES } from '../../services/databaseService';
import { Guild, GuildMember } from '../../types/guild';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
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

    // Only guild leader can delete the guild
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

    // Get all guild members to delete their memberships
    const membersResult = await DatabaseService.query<GuildMember>({
      TableName: TABLE_NAMES.GUILD_MEMBERS,
      KeyConditionExpression: 'guildId = :guildId',
      ExpressionAttributeValues: {
        ':guildId': guildId,
      },
    });

    // Prepare transaction items to delete guild and all memberships
    const transactItems = [
      {
        Delete: {
          TableName: TABLE_NAMES.GUILDS,
          Key: { guildId },
        },
      },
    ];

    // Add delete operations for all members
    membersResult.items.forEach(member => {
      transactItems.push({
        Delete: {
          TableName: TABLE_NAMES.GUILD_MEMBERS,
          Key: { guildId, userId: member.userId } as any,
        },
      });
    });

    // Execute transaction to delete guild and all memberships
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
        message: 'Guild deleted successfully',
        deletedMembers: membersResult.items.length,
      }),
    };
  } catch (error) {
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