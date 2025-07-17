/**
 * Lambda function for creating a new guild
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DatabaseService, TABLE_NAMES } from '../../services/databaseService';
import { Guild, CreateGuildRequest, GuildSettings, GuildMember } from '../../types/guild';
import { Character } from '../../types/character';
import { v4 as uuidv4 } from 'uuid';

// Default guild settings for new guilds
const createDefaultGuildSettings = (): GuildSettings => ({
  isPublic: true,
  requireApproval: false,
  maxMembers: 50,
  description: '',
  allowedActivities: ['crafting', 'harvesting', 'combat'],
});

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Parse request body
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

    const request: CreateGuildRequest = JSON.parse(event.body);

    // Validate required fields
    if (!request.leaderId || !request.name) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'leaderId and name are required',
        }),
      };
    }

    // Validate guild name
    if (request.name.length < 3 || request.name.length > 30) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Guild name must be between 3 and 30 characters',
        }),
      };
    }

    // Check if leader exists and get their character info
    const leaderCharacter = await DatabaseService.getItem<Character>({
      TableName: TABLE_NAMES.CHARACTERS,
      Key: { userId: request.leaderId },
    });

    if (!leaderCharacter) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Leader character not found',
        }),
      };
    }

    // Check if leader is already in a guild
    const existingMembership = await DatabaseService.query({
      TableName: TABLE_NAMES.GUILD_MEMBERS,
      IndexName: 'user-guild-index',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': request.leaderId,
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

    // Check if guild name is already taken
    const existingGuild = await DatabaseService.scan({
      TableName: TABLE_NAMES.GUILDS,
      FilterExpression: '#name = :name',
      ExpressionAttributeNames: {
        '#name': 'name',
      },
      ExpressionAttributeValues: {
        ':name': request.name,
      },
    });

    if (existingGuild.items.length > 0) {
      return {
        statusCode: 409,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Guild name is already taken',
        }),
      };
    }

    // Create guild
    const now = new Date();
    const guildId = uuidv4();
    const guild: Guild = {
      guildId,
      name: request.name,
      description: request.description || '',
      leaderId: request.leaderId,
      members: [],
      settings: { ...createDefaultGuildSettings(), ...request.settings },
      createdAt: now,
      updatedAt: now,
      memberCount: 1,
      level: 1,
      experience: 0,
    };

    // Create leader membership
    const leaderMember: GuildMember = {
      guildId,
      userId: request.leaderId,
      characterName: leaderCharacter.name,
      role: 'leader',
      joinedAt: now,
      permissions: ['invite', 'kick', 'promote', 'demote', 'edit_settings', 'manage_events'],
      lastActiveAt: leaderCharacter.lastActiveAt,
    };

    // Use transaction to create guild and add leader as member
    await DatabaseService.transactWrite({
      TransactItems: [
        {
          Put: {
            TableName: TABLE_NAMES.GUILDS,
            Item: guild,
            ConditionExpression: 'attribute_not_exists(guildId)',
          },
        },
        {
          Put: {
            TableName: TABLE_NAMES.GUILD_MEMBERS,
            Item: {
              ...leaderMember,
            },
            ConditionExpression: 'attribute_not_exists(guildId) AND attribute_not_exists(userId)',
          },
        },
      ],
    });

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        guild,
        membership: leaderMember,
      }),
    };
  } catch (error) {
    console.error('Error creating guild:', error);

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