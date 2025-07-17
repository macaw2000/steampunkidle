/**
 * Lambda function for getting user's current party
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DatabaseService, TABLE_NAMES } from '../../services/databaseService';
import { Party } from '../../types/zone';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.pathParameters?.userId;
    
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

    // Find user's current party
    const result = await DatabaseService.scan({
      TableName: TABLE_NAMES.PARTIES,
      FilterExpression: 'contains(#members, :userId) AND (#status = :forming OR #status = :active)',
      ExpressionAttributeNames: {
        '#members': 'members',
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':forming': 'forming',
        ':active': 'active',
      },
    });

    if (result.items.length === 0) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'User is not in any party',
        }),
      };
    }

    // User should only be in one party at a time
    const party = result.items[0] as Party;

    // Verify user is actually in the members list (double-check due to DynamoDB limitations)
    const userMember = party.members.find(member => member.userId === userId);
    if (!userMember) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'User is not in any party',
        }),
      };
    }

    // Add composition info
    const roleCount = { tank: 0, healer: 0, dps: 0 };
    const readyCount = party.members.filter(m => m.isReady).length;
    
    party.members.forEach(member => {
      roleCount[member.role]++;
    });

    const partyWithComposition = {
      ...party,
      composition: {
        totalMembers: party.members.length,
        maxMembers: party.maxMembers,
        readyMembers: readyCount,
        roleDistribution: roleCount,
        allReady: readyCount === party.members.length && party.members.length > 0,
      },
      userMember,
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        party: partyWithComposition,
      }),
    };
  } catch (error) {
    console.error('Error getting user party:', error);

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