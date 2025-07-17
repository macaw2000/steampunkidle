/**
 * Lambda function for leaving a guild
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

    // Get user's membership
    const membership = await DatabaseService.getItem<GuildMember>({
      TableName: TABLE_NAMES.GUILD_MEMBERS,
      Key: { guildId, userId },
    });

    if (!membership) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'User is not a member of this guild',
        }),
      };
    }

    // Guild leader cannot leave unless they're the only member or transfer leadership
    if (membership.role === 'leader') {
      // Check if there are other members
      const memberCount = await DatabaseService.query({
        TableName: TABLE_NAMES.GUILD_MEMBERS,
        KeyConditionExpression: 'guildId = :guildId',
        ExpressionAttributeValues: {
          ':guildId': guildId,
        },
        Select: 'COUNT',
      });

      if (memberCount.count > 1) {
        return {
          statusCode: 409,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: 'Guild leader must transfer leadership or disband the guild before leaving',
          }),
        };
      }

      // If leader is the only member, delete the entire guild
      await DatabaseService.transactWrite({
        TransactItems: [
          {
            Delete: {
              TableName: TABLE_NAMES.GUILD_MEMBERS,
              Key: { guildId, userId },
            },
          },
          {
            Delete: {
              TableName: TABLE_NAMES.GUILDS,
              Key: { guildId },
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
          message: 'Left guild successfully - guild disbanded as you were the only member',
          guildDisbanded: true,
        }),
      };
    }

    // Remove member from guild and update guild member count
    await DatabaseService.transactWrite({
      TransactItems: [
        {
          Delete: {
            TableName: TABLE_NAMES.GUILD_MEMBERS,
            Key: { guildId, userId },
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
        message: 'Left guild successfully',
        guildName: guild.name,
      }),
    };
  } catch (error) {
    console.error('Error leaving guild:', error);

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