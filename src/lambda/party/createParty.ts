/**
 * Lambda function for creating a new party
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DatabaseService, TABLE_NAMES } from '../../services/databaseService';
import { Party, CreatePartyRequest, PartyMember } from '../../types/zone';
import { Character } from '../../types/character';
import { Guild } from '../../types/guild';
import { v4 as uuidv4 } from 'uuid';

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

    const request: CreatePartyRequest = JSON.parse(event.body);

    // Validate required fields
    if (!request.leaderId || !request.name || !request.type) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'leaderId, name, and type are required',
        }),
      };
    }

    // Validate party type and max members
    if (request.type === 'zone' && (request.maxMembers < 1 || request.maxMembers > 3)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Zone parties must have 1-3 max members',
        }),
      };
    }

    if (request.type === 'dungeon' && (request.maxMembers < 5 || request.maxMembers > 8)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Dungeon parties must have 5-8 max members',
        }),
      };
    }

    // Get leader character
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

    // Check if leader is already in a party
    const existingParty = await DatabaseService.scan({
      TableName: TABLE_NAMES.PARTIES,
      FilterExpression: 'contains(#members, :leaderId) AND #status = :status',
      ExpressionAttributeNames: {
        '#members': 'members',
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':leaderId': request.leaderId,
        ':status': 'forming',
      },
    });

    if (existingParty.items.length > 0) {
      return {
        statusCode: 409,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Leader is already in a party',
        }),
      };
    }

    // Validate guild visibility
    if (request.visibility === 'guild') {
      if (!request.guildId) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: 'guildId is required for guild visibility',
          }),
        };
      }

      // Verify leader is in the specified guild
      const guildMembership = await DatabaseService.getItem({
        TableName: TABLE_NAMES.GUILD_MEMBERS,
        Key: { guildId: request.guildId, userId: request.leaderId },
      });

      if (!guildMembership) {
        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: 'Leader is not a member of the specified guild',
          }),
        };
      }
    }

    // Determine recommended role for leader
    const getRecommendedRole = (character: Character) => {
      const spec = character.specialization;
      const maxProgress = Math.max(spec.tankProgress, spec.healerProgress, spec.dpsProgress);
      
      if (spec.tankProgress === maxProgress) return 'tank';
      if (spec.healerProgress === maxProgress) return 'healer';
      return 'dps';
    };

    // Create party
    const now = new Date();
    const partyId = uuidv4();
    
    const leaderMember: PartyMember = {
      userId: request.leaderId,
      characterName: leaderCharacter.name,
      level: leaderCharacter.level,
      role: getRecommendedRole(leaderCharacter),
      isReady: false,
      joinedAt: now,
    };

    const party: Party = {
      partyId,
      leaderId: request.leaderId,
      name: request.name,
      type: request.type,
      visibility: request.visibility,
      members: [leaderMember],
      maxMembers: request.maxMembers,
      minLevel: request.minLevel,
      maxLevel: request.maxLevel,
      guildId: request.guildId,
      createdAt: now,
      status: 'forming',
    };

    // Save party to database
    await DatabaseService.putItem({
      TableName: TABLE_NAMES.PARTIES,
      Item: party,
      ConditionExpression: 'attribute_not_exists(partyId)',
    });

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        party,
      }),
    };
  } catch (error) {
    console.error('Error creating party:', error);

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