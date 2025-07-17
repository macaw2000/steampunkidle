/**
 * Lambda function for joining an existing party
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DatabaseService, TABLE_NAMES } from '../../services/databaseService';
import { Party, JoinPartyRequest, PartyMember } from '../../types/zone';
import { Character } from '../../types/character';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const partyId = event.pathParameters?.partyId;
    
    if (!partyId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'partyId is required',
        }),
      };
    }

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

    const request: JoinPartyRequest = JSON.parse(event.body);

    // Validate required fields
    if (!request.userId || !request.preferredRole) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'userId and preferredRole are required',
        }),
      };
    }

    // Get party
    const party = await DatabaseService.getItem<Party>({
      TableName: TABLE_NAMES.PARTIES,
      Key: { partyId },
    });

    if (!party) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Party not found',
        }),
      };
    }

    // Get user character
    const character = await DatabaseService.getItem<Character>({
      TableName: TABLE_NAMES.CHARACTERS,
      Key: { userId: request.userId },
    });

    if (!character) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Character not found',
        }),
      };
    }

    // Check if user is already in the party
    const isAlreadyMember = party.members.some(member => member.userId === request.userId);
    if (isAlreadyMember) {
      return {
        statusCode: 409,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'User is already in this party',
        }),
      };
    }

    // Check if user is in another party
    const existingParty = await DatabaseService.scan({
      TableName: TABLE_NAMES.PARTIES,
      FilterExpression: 'contains(#members, :userId) AND #status = :status AND partyId <> :currentPartyId',
      ExpressionAttributeNames: {
        '#members': 'members',
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':userId': request.userId,
        ':status': 'forming',
        ':currentPartyId': partyId,
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
          error: 'User is already in another party',
        }),
      };
    }

    // Validate party can accept new members
    if (party.status !== 'forming') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Party is no longer accepting members',
        }),
      };
    }

    if (party.members.length >= party.maxMembers) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Party is full',
        }),
      };
    }

    // Check level requirements
    if (character.level < party.minLevel) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: `Minimum level required: ${party.minLevel}`,
        }),
      };
    }

    if (party.maxLevel && character.level > party.maxLevel) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: `Maximum level allowed: ${party.maxLevel}`,
        }),
      };
    }

    // Check guild visibility
    if (party.visibility === 'guild') {
      const guildMembership = await DatabaseService.getItem({
        TableName: TABLE_NAMES.GUILD_MEMBERS,
        Key: { guildId: party.guildId, userId: request.userId },
      });

      if (!guildMembership) {
        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: 'This party is restricted to guild members',
          }),
        };
      }
    }

    if (party.visibility === 'private') {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'This party is private',
        }),
      };
    }

    // Create new member
    const newMember: PartyMember = {
      userId: request.userId,
      characterName: character.name,
      level: character.level,
      role: request.preferredRole,
      isReady: false,
      joinedAt: new Date(),
    };

    // Update party with new member
    const updatedMembers = [...party.members, newMember];

    await DatabaseService.updateItem({
      TableName: TABLE_NAMES.PARTIES,
      Key: { partyId },
      UpdateExpression: 'SET #members = :members',
      ExpressionAttributeNames: {
        '#members': 'members',
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':members': updatedMembers,
        ':status': 'forming',
      },
      ConditionExpression: 'attribute_exists(partyId) AND #status = :status',
    });

    // Return updated party
    const updatedParty: Party = {
      ...party,
      members: updatedMembers,
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        party: updatedParty,
      }),
    };
  } catch (error) {
    console.error('Error joining party:', error);

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