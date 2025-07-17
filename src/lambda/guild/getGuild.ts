/**
 * Lambda function for retrieving guild information
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DatabaseService, TABLE_NAMES } from '../../services/databaseService';
import { Guild, GuildMember } from '../../types/guild';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const guildId = event.pathParameters?.guildId;

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

    // Get guild information
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

    // Get guild members
    const membersResult = await DatabaseService.query<GuildMember>({
      TableName: TABLE_NAMES.GUILD_MEMBERS,
      KeyConditionExpression: 'guildId = :guildId',
      ExpressionAttributeValues: {
        ':guildId': guildId,
      },
    });

    // Combine guild info with current members
    const guildWithMembers = {
      ...guild,
      members: membersResult.items,
      memberCount: membersResult.items.length,
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        guild: guildWithMembers,
      }),
    };
  } catch (error) {
    console.error('Error getting guild:', error);

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