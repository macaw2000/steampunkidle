/**
 * Lambda function for deleting a character
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DatabaseService, TABLE_NAMES } from '../../services/databaseService';
import { Character } from '../../types/character';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Get userId from path parameters
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

    // Check if character exists
    const existingCharacter = await DatabaseService.getItem<Character>({
      TableName: TABLE_NAMES.CHARACTERS,
      Key: { userId },
    });

    if (!existingCharacter) {
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

    // Delete character from database
    await DatabaseService.deleteItem({
      TableName: TABLE_NAMES.CHARACTERS,
      Key: { userId },
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Character deleted successfully',
      }),
    };
  } catch (error) {
    console.error('Error deleting character:', error);

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