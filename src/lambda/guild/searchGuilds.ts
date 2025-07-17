/**
 * Lambda function for searching and listing guilds
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DatabaseService, TABLE_NAMES } from '../../services/databaseService';
import { Guild } from '../../types/guild';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const queryParams = event.queryStringParameters || {};
    const {
      search,
      isPublic,
      minLevel,
      maxLevel,
      hasOpenSlots,
      limit = '20',
      lastEvaluatedKey,
    } = queryParams;

    // Build filter expression
    const filterExpressions: string[] = [];
    const expressionAttributeNames: { [key: string]: string } = {};
    const expressionAttributeValues: { [key: string]: any } = {};

    // Filter by public guilds only if specified
    if (isPublic === 'true') {
      filterExpressions.push('#settings.#isPublic = :isPublic');
      expressionAttributeNames['#settings'] = 'settings';
      expressionAttributeNames['#isPublic'] = 'isPublic';
      expressionAttributeValues[':isPublic'] = true;
    }

    // Filter by guild name search
    if (search) {
      filterExpressions.push('contains(#name, :search)');
      expressionAttributeNames['#name'] = 'name';
      expressionAttributeValues[':search'] = search;
    }

    // Filter by level range
    if (minLevel) {
      filterExpressions.push('#level >= :minLevel');
      expressionAttributeNames['#level'] = 'level';
      expressionAttributeValues[':minLevel'] = parseInt(minLevel);
    }

    if (maxLevel) {
      filterExpressions.push('#level <= :maxLevel');
      expressionAttributeNames['#level'] = 'level';
      expressionAttributeValues[':maxLevel'] = parseInt(maxLevel);
    }

    // Filter by guilds with open slots
    if (hasOpenSlots === 'true') {
      filterExpressions.push('memberCount < #settings.#maxMembers');
      expressionAttributeNames['#settings'] = 'settings';
      expressionAttributeNames['#maxMembers'] = 'maxMembers';
    }

    // Prepare scan parameters
    const scanParams: any = {
      TableName: TABLE_NAMES.GUILDS,
      Limit: Math.min(parseInt(limit), 100), // Cap at 100
    };

    if (filterExpressions.length > 0) {
      scanParams.FilterExpression = filterExpressions.join(' AND ');
    }

    if (Object.keys(expressionAttributeNames).length > 0) {
      scanParams.ExpressionAttributeNames = expressionAttributeNames;
    }

    if (Object.keys(expressionAttributeValues).length > 0) {
      scanParams.ExpressionAttributeValues = expressionAttributeValues;
    }

    if (lastEvaluatedKey) {
      try {
        scanParams.ExclusiveStartKey = JSON.parse(decodeURIComponent(lastEvaluatedKey));
      } catch (error) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: 'Invalid lastEvaluatedKey format',
          }),
        };
      }
    }

    // Execute scan
    const result = await DatabaseService.scan<Guild>(scanParams);

    // Filter out sensitive information and add computed fields
    const guilds = result.items.map(guild => ({
      guildId: guild.guildId,
      name: guild.name,
      description: guild.description,
      memberCount: guild.memberCount,
      level: guild.level,
      experience: guild.experience,
      settings: {
        isPublic: guild.settings.isPublic,
        requireApproval: guild.settings.requireApproval,
        maxMembers: guild.settings.maxMembers,
        description: guild.settings.description,
        allowedActivities: guild.settings.allowedActivities,
      },
      createdAt: guild.createdAt,
      hasOpenSlots: guild.memberCount < guild.settings.maxMembers,
    }));

    // Prepare response
    const response: any = {
      guilds,
      count: result.count,
      totalScanned: result.count,
    };

    if (result.lastEvaluatedKey) {
      response.lastEvaluatedKey = encodeURIComponent(JSON.stringify(result.lastEvaluatedKey));
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error searching guilds:', error);

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