/**
 * Lambda function for retrieving leaderboard data
 * Supports filtering by stat type and finding user position
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { LeaderboardStatType, Leaderboard, LeaderboardQuery, UserLeaderboardPosition } from '../../types/leaderboard';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const LEADERBOARDS_TABLE = process.env.LEADERBOARDS_TABLE!;

/**
 * Get leaderboard entries for a specific stat type
 */
async function getLeaderboardEntries(
  statType: LeaderboardStatType,
  limit: number = 100,
  offset: number = 0
): Promise<Leaderboard> {
  console.log(`Getting leaderboard for ${statType}, limit: ${limit}, offset: ${offset}`);

  const result = await docClient.send(new QueryCommand({
    TableName: LEADERBOARDS_TABLE,
    KeyConditionExpression: 'statType = :statType',
    ExpressionAttributeValues: {
      ':statType': statType,
    },
    ScanIndexForward: true, // Sort by rank ascending
    Limit: limit + offset, // Get extra to handle offset
  }));

  if (!result.Items || result.Items.length === 0) {
    return {
      statType,
      entries: [],
      totalEntries: 0,
      lastRefreshed: new Date(),
    };
  }

  // Apply offset
  const items = result.Items.slice(offset);

  const entries = items.map(item => ({
    rank: item.rank,
    userId: item.userId,
    characterName: item.characterName,
    guildName: item.guildName,
    statValue: item.statValue,
    lastUpdated: new Date(item.lastUpdated),
  }));

  // Get total count
  const countResult = await docClient.send(new QueryCommand({
    TableName: LEADERBOARDS_TABLE,
    KeyConditionExpression: 'statType = :statType',
    ExpressionAttributeValues: {
      ':statType': statType,
    },
    Select: 'COUNT',
  }));

  return {
    statType,
    entries,
    totalEntries: countResult.Count || 0,
    lastRefreshed: entries.length > 0 ? entries[0].lastUpdated : new Date(),
  };
}

/**
 * Find a user's position in a specific leaderboard
 */
async function getUserPosition(
  statType: LeaderboardStatType,
  userId: string
): Promise<UserLeaderboardPosition | null> {
  console.log(`Finding position for user ${userId} in ${statType} leaderboard`);

  const result = await docClient.send(new QueryCommand({
    TableName: LEADERBOARDS_TABLE,
    KeyConditionExpression: 'statType = :statType',
    FilterExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':statType': statType,
      ':userId': userId,
    },
    Limit: 1,
  }));

  if (!result.Items || result.Items.length === 0) {
    return null;
  }

  const item = result.Items[0];

  // Get total count to calculate percentile
  const countResult = await docClient.send(new QueryCommand({
    TableName: LEADERBOARDS_TABLE,
    KeyConditionExpression: 'statType = :statType',
    ExpressionAttributeValues: {
      ':statType': statType,
    },
    Select: 'COUNT',
  }));

  const totalEntries = countResult.Count || 0;
  const percentile = totalEntries > 0 ? ((totalEntries - item.rank + 1) / totalEntries) * 100 : 0;

  return {
    statType,
    rank: item.rank,
    statValue: item.statValue,
    percentile: Math.round(percentile * 100) / 100, // Round to 2 decimal places
  };
}

/**
 * Lambda handler for getting leaderboard data
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Getting leaderboard data', JSON.stringify(event, null, 2));

  try {
    const queryParams = event.queryStringParameters || {};
    const pathParams = event.pathParameters || {};

    // Parse query parameters
    const statType = (pathParams.statType || queryParams.statType) as LeaderboardStatType;
    const limit = parseInt(queryParams.limit || '100');
    const offset = parseInt(queryParams.offset || '0');
    const userId = queryParams.userId;

    if (!statType) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Missing required parameter: statType',
        }),
      };
    }

    // Validate stat type
    const validStatTypes: LeaderboardStatType[] = [
      'level',
      'totalExperience',
      'craftingLevel',
      'harvestingLevel',
      'combatLevel',
      'currency',
      'itemsCreated',
      'zonesCompleted',
      'dungeonsCompleted',
      'guildLevel',
    ];

    if (!validStatTypes.includes(statType)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Invalid stat type',
          validStatTypes,
        }),
      };
    }

    // Validate limit and offset
    if (limit < 1 || limit > 100) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Limit must be between 1 and 100',
        }),
      };
    }

    if (offset < 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Offset must be non-negative',
        }),
      };
    }

    // Get leaderboard data
    const leaderboard = await getLeaderboardEntries(statType, limit, offset);

    // If userId is provided, also get user's position
    let userPosition: UserLeaderboardPosition | null = null;
    if (userId) {
      userPosition = await getUserPosition(statType, userId);
    }

    const response = {
      leaderboard,
      userPosition,
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error getting leaderboard data:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};