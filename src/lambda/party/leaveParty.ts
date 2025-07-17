/**
 * Lambda function for leaving a party
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

    const { userId } = JSON.parse(event.body);

    if (!userId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'userId is required',
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

    // Remove member from party
    const updatedMembers = party.members.filter(member => member.userId !== userId);

    // If the leader is leaving and there are other members, transfer leadership
    let newLeaderId = party.leaderId;
    if (party.leaderId === userId && updatedMembers.length > 0) {
      // Transfer leadership to the first remaining member
      newLeaderId = updatedMembers[0].userId;
    }

    // If no members left, disband the party
    if (updatedMembers.length === 0) {
      await DatabaseService.updateItem({
        TableName: TABLE_NAMES.PARTIES,
        Key: { partyId },
        UpdateExpression: 'SET #status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': 'disbanded',
        },
      });

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'Party disbanded - no members remaining',
        }),
      };
    }

    // Update party with remaining members
    await DatabaseService.updateItem({
      TableName: TABLE_NAMES.PARTIES,
      Key: { partyId },
      UpdateExpression: 'SET #members = :members, leaderId = :leaderId',
      ExpressionAttributeNames: {
        '#members': 'members',
      },
      ExpressionAttributeValues: {
        ':members': updatedMembers,
        ':leaderId': newLeaderId,
      },
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Successfully left party',
        newLeader: newLeaderId !== party.leaderId ? newLeaderId : undefined,
      }),
    };
  } catch (error) {
    console.error('Error leaving party:', error);

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