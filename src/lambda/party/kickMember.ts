/**
 * Lambda function for kicking a member from party (leader only)
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

    const { leaderId, memberUserId } = JSON.parse(event.body);

    if (!leaderId || !memberUserId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'leaderId and memberUserId are required',
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

    // Verify leader permissions
    if (party.leaderId !== leaderId) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Only the party leader can kick members',
        }),
      };
    }

    // Check if member exists in party
    const memberIndex = party.members.findIndex(member => member.userId === memberUserId);
    if (memberIndex === -1) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Member not found in party',
        }),
      };
    }

    // Prevent leader from kicking themselves
    if (memberUserId === leaderId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Leader cannot kick themselves. Use leave party instead.',
        }),
      };
    }

    // Remove member from party
    const updatedMembers = party.members.filter(member => member.userId !== memberUserId);

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
        kickedMember: party.members[memberIndex],
      }),
    };
  } catch (error) {
    console.error('Error kicking member:', error);

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