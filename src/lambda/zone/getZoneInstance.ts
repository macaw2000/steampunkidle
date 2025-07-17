/**
 * Lambda function for getting a zone instance
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

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        instance,
      }),
    };
  } catch (error) {
    console.error('Error getting zone instance:', error);

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