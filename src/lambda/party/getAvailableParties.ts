/**
 * Lambda function for getting available parties to join
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DatabaseService, TABLE_NAMES } from '../../services/databaseService';
import { Party, ZoneType, PartyVisibility } from '../../types/zone';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const queryParams = event.queryStringParameters || {};
    const type = queryParams.type as ZoneType;
    const visibility = queryParams.visibility as PartyVisibility;

    // Build filter expression
    let filterExpression = '#status = :status';
    const expressionAttributeNames: Record<string, string> = {
      '#status': 'status',
    };
    const expressionAttributeValues: Record<string, any> = {
      ':status': 'forming',
    };

    // Add type filter if specified
    if (type) {
      filterExpression += ' AND #type = :type';
      expressionAttributeNames['#type'] = 'type';
      expressionAttributeValues[':type'] = type;
    }

    // Add visibility filter if specified
    if (visibility) {
      filterExpression += ' AND visibility = :visibility';
      expressionAttributeValues[':visibility'] = visibility;
    } else {
      // Only show public parties by default (exclude private and guild-only)
      filterExpression += ' AND visibility = :publicVisibility';
      expressionAttributeValues[':publicVisibility'] = 'public';
    }

    // Get available parties
    const result = await DatabaseService.scan({
      TableName: TABLE_NAMES.PARTIES,
      FilterExpression: filterExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    });

    const parties = result.items as Party[];

    // Filter out full parties and add composition info
    const availableParties = parties
      .filter(party => party.members.length < party.maxMembers)
      .map(party => {
        const roleCount = { tank: 0, healer: 0, dps: 0 };
        party.members.forEach(member => {
          roleCount[member.role]++;
        });

        return {
          ...party,
          composition: {
            totalMembers: party.members.length,
            maxMembers: party.maxMembers,
            roleDistribution: roleCount,
            spotsRemaining: party.maxMembers - party.members.length,
          },
        };
      })
      .sort((a, b) => {
        // Sort by creation date (newest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        parties: availableParties,
        total: availableParties.length,
      }),
    };
  } catch (error) {
    console.error('Error getting available parties:', error);

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