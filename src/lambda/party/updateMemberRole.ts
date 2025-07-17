/**
 * Lambda function for updating party member role
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DatabaseService, TABLE_NAMES } from '../../services/databaseService';
import { Party, PartyRole } from '../../types/zone';

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

    const { userId, role } = JSON.parse(event.body);

    if (!userId || !role) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'userId and role are required',
        }),
      };
    }

    // Validate role
    const validRoles: PartyRole[] = ['tank', 'healer', 'dps'];
    if (!validRoles.includes(role)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Invalid role. Must be tank, healer, or dps',
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

    // Update member role
    const updatedMembers = [...party.members];
    updatedMembers[memberIndex] = {
      ...updatedMembers[memberIndex],
      role,
      isReady: false, // Reset readiness when role changes
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
        allReady: readyCount === updatedMembers.length && updatedMembers.length > 0,
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
      }),
    };
  } catch (error) {
    console.error('Error updating member role:', error);

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