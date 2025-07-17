/**
 * Lambda function for leaving a zone instance
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DatabaseService, TABLE_NAMES } from '../../services/databaseService';
import { ZoneInstance } from '../../types/zone';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const instanceId = event.pathParameters?.instanceId;
    
    if (!instanceId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'instanceId is required',
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

    // Get zone instance
    const instance = await DatabaseService.getItem<ZoneInstance>({
      TableName: TABLE_NAMES.ZONE_INSTANCES,
      Key: { instanceId },
    });

    if (!instance) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Zone instance not found',
        }),
      };
    }

    // Get the party to check if user is a member
    const party = await DatabaseService.getItem({
      TableName: TABLE_NAMES.PARTIES,
      Key: { partyId: instance.partyId },
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
    const isMember = party.members.some((member: any) => member.userId === userId);
    if (!isMember) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'User is not a member of this party',
        }),
      };
    }

    // If instance is still active, mark it as failed
    if (instance.status === 'active') {
      await DatabaseService.updateItem({
        TableName: TABLE_NAMES.ZONE_INSTANCES,
        Key: { instanceId },
        UpdateExpression: 'SET #status = :status, completedAt = :completedAt',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': 'failed',
          ':completedAt': new Date().toISOString(),
        },
      });

      // Update party status back to forming
      await DatabaseService.updateItem({
        TableName: TABLE_NAMES.PARTIES,
        Key: { partyId: instance.partyId },
        UpdateExpression: 'SET #status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': 'forming',
        },
      });
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Successfully left zone instance',
      }),
    };
  } catch (error) {
    console.error('Error leaving zone instance:', error);

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