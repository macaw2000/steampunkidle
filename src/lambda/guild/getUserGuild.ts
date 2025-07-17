/**
 * Lambda function for getting a user's current guild membership
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DatabaseService, TABLE_NAMES } from '../../services/databaseService';
import { Guild, GuildMember } from '../../types/guild';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
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

    // Find user's guild membership
    const membershipResult = await DatabaseService.query<GuildMember>({
      TableName: TABLE_NAMES.GUILD_MEMBERS,
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

    // Get guild information
    const guild = await DatabaseService.getItem<Guild>({
      TableName: TABLE_NAMES.GUILDS,
      Key: { guildId: membership.guildId },
    });

    if (!guild) {
      // Guild was deleted but membership still exists - clean up
      await DatabaseService.deleteItem({
        TableName: TABLE_NAMES.GUILD_MEMBERS,
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

    // Get all guild members for complete guild info
    const allMembersResult = await DatabaseService.query<GuildMember>({
      TableName: TABLE_NAMES.GUILD_MEMBERS,
      KeyConditionExpression: 'guildId = :guildId',
      ExpressionAttributeValues: {
        ':guildId': membership.guildId,
      },
    });

    // Combine guild info with current members
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
  } catch (error) {
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