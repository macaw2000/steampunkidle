/**
 * Lambda function for updating party member readiness
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DatabaseService, TABLE_NAMES } from '../../services/databaseService';
import { Party } from '../../types/zone';

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

    const { userId, isReady } = JSON.parse(event.body);

    if (!userId || typeof isReady !== 'boolean') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'userId and isReady (boolean) are required',
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

    // Check if user is in the party
    const memberIndex = party.members.findIndex(member => member.userId === userId);
    if (memberIndex === -1) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'User is not in this party',
        }),
      };
    }

    // Update member readiness
    const updatedMembers = [...party.members];
    updatedMembers[memberIndex] = {
      ...updatedMembers[memberIndex],
      isReady,
    };

    // Update party in database
    await DatabaseService.updateItem({
      TableName: TABLE_NAMES.PARTIES,
      Key: { partyId },
      UpdateExpression: 'SET #members = :members',
      ExpressionAttributeNames: {
        '#members': 'members',
      },
      ExpressionAttributeValues: {
        ':members': updatedMembers,
      },
    });

    // Check if all members are ready
    const allReady = updatedMembers.every(member => member.isReady);
    
    // Return updated party with composition info
    const roleCount = { tank: 0, healer: 0, dps: 0 };
    const readyCount = updatedMembers.filter(m => m.isReady).length;
    
    updatedMembers.forEach(member => {
      roleCount[member.role]++;
    });

    const updatedParty = {
      ...party,
      members: updatedMembers,
      composition: {
        totalMembers: updatedMembers.length,
        maxMembers: party.maxMembers,
        readyMembers: readyCount,
        roleDistribution: roleCount,
        allReady,
      },
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        party: updatedParty,
        allReady,
      }),
    };
  } catch (error) {
    console.error('Error updating member readiness:', error);

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