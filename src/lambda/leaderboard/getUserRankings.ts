/**
 * Lambda function for getting a user's rankings across all leaderboards
 * Provides a summary of user's position in different stat categories
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { LeaderboardStatType, UserLeaderboardPosition } from '../../types/leaderboard';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const LEADERBOARDS_TABLE = process.env.LEADERBOARDS_TABLE!;

/**
 * Get user's position in a specific leaderboard
 */
async function getUserPositionInLeaderboard(
  statType: LeaderboardStatType,
  userId: string
): Promise<UserLeaderboardPosition | null> {
  try {
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
      percentile: Math.round(percentile * 100) / 100,
    };
  } catch (error) {
    console.error(`Error getting user position for ${statType}:`, error);
    return null;
  }
}

/**
 * Get user's rankings across all leaderboards
 */
async function getUserRankings(userId: string): Promise<UserLeaderboardPosition[]> {
  const statTypes: LeaderboardStatType[] = [
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

  const rankings: UserLeaderboardPosition[] = [];

  // Get user's position in each leaderboard
  for (const statType of statTypes) {
    const position = await getUserPositionInLeaderboard(statType, userId);
    if (position) {
      rankings.push(position);
    }
  }

  // Sort by rank (best ranks first)
  rankings.sort((a, b) => a.rank - b.rank);

  return rankings;
}

/**
 * Lambda handler for getting user rankings
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Getting user rankings', JSON.stringify(event, null, 2));

  try {
    const pathParams = event.pathParameters || {};
    const userId = pathParams.userId;

    if (!userId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Missing required parameter: userId',
        }),
      };
    }

    // Get user's rankings across all leaderboards
    const rankings = await getUserRankings(userId);

    // Calculate summary statistics
    const totalRankings = rankings.length;
    const averagePercentile = totalRankings > 0 
      ? rankings.reduce((sum, r) => sum + r.percentile, 0) / totalRankings 
      : 0;
    
    const bestRank = totalRankings > 0 ? Math.min(...rankings.map(r => r.rank)) : null;
    const bestCategory = rankings.length > 0 ? rankings[0].statType : null;

    const response = {
      userId,
      rankings,
      summary: {
        totalCategories: totalRankings,
        averagePercentile: Math.round(averagePercentile * 100) / 100,
        bestRank,
        bestCategory,
      },
      lastUpdated: new Date().toISOString(),
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
    console.error('Error getting user rankings:', error);

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