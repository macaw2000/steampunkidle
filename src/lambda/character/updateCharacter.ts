/**
 * Lambda function for updating a character
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DatabaseService, TABLE_NAMES } from '../../services/databaseService';
import { Character, UpdateCharacterRequest } from '../../types/character';

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

    const request: UpdateCharacterRequest = JSON.parse(event.body);

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

    // Build update expression
    const updateExpressions: string[] = [];
    const expressionAttributeNames: { [key: string]: string } = {};
    const expressionAttributeValues: { [key: string]: any } = {};

    // Update stats if provided
    if (request.stats) {
      updateExpressions.push('#stats = :stats');
      expressionAttributeNames['#stats'] = 'stats';
      expressionAttributeValues[':stats'] = {
        ...existingCharacter.stats,
        ...request.stats,
      };
    }

    // Update specialization if provided
    if (request.specialization) {
      updateExpressions.push('#specialization = :specialization');
      expressionAttributeNames['#specialization'] = 'specialization';
      expressionAttributeValues[':specialization'] = {
        ...existingCharacter.specialization,
        ...request.specialization,
      };
    }

    // Update current activity if provided
    if (request.currentActivity) {
      updateExpressions.push('#currentActivity = :currentActivity');
      expressionAttributeNames['#currentActivity'] = 'currentActivity';
      expressionAttributeValues[':currentActivity'] = request.currentActivity;
    }

    // Update experience if provided
    if (request.experience !== undefined) {
      updateExpressions.push('#experience = :experience');
      expressionAttributeNames['#experience'] = 'experience';
      expressionAttributeValues[':experience'] = request.experience;
    }

    // Update level if provided
    if (request.level !== undefined) {
      updateExpressions.push('#level = :level');
      expressionAttributeNames['#level'] = 'level';
      expressionAttributeValues[':level'] = request.level;
    }

    // Update currency if provided
    if (request.currency !== undefined) {
      updateExpressions.push('#currency = :currency');
      expressionAttributeNames['#currency'] = 'currency';
      expressionAttributeValues[':currency'] = request.currency;
    }

    // Always update lastActiveAt
    updateExpressions.push('#lastActiveAt = :lastActiveAt');
    expressionAttributeNames['#lastActiveAt'] = 'lastActiveAt';
    expressionAttributeValues[':lastActiveAt'] = request.lastActiveAt || new Date();

    if (updateExpressions.length === 1) { // Only lastActiveAt
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'No valid fields to update',
        }),
      };
    }

    // Update character in database
    const updatedCharacter = await DatabaseService.updateItem({
      TableName: TABLE_NAMES.CHARACTERS,
      Key: { userId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        character: updatedCharacter,
      }),
    };
  } catch (error) {
    console.error('Error updating character:', error);

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