/**
 * Lambda function for calculating and updating leaderboards
 * Aggregates stats from characters and updates leaderboard rankings
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { LeaderboardStatType, LeaderboardEntry } from '../../types/leaderboard';
import { Character } from '../../types/character';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const CHARACTERS_TABLE = process.env.CHARACTERS_TABLE!;
const LEADERBOARDS_TABLE = process.env.LEADERBOARDS_TABLE!;
const GUILD_MEMBERS_TABLE = process.env.GUILD_MEMBERS_TABLE!;
const GUILDS_TABLE = process.env.GUILDS_TABLE!;

interface CharacterWithGuild extends Character {
  guildName?: string;
}

/**
 * Extract stat value from character based on stat type
 */
function extractStatValue(character: Character, statType: LeaderboardStatType): number {
  switch (statType) {
    case 'level':
      return character.level;
    case 'totalExperience':
      return character.experience;
    case 'craftingLevel':
      return character.stats.craftingSkills.level;
    case 'harvestingLevel':
      return character.stats.harvestingSkills.level;
    case 'combatLevel':
      return character.stats.combatSkills.level;
    case 'currency':
      return character.currency;
    case 'itemsCreated':
      // This would need to be tracked separately in a real implementation
      // For now, using crafting experience as a proxy
      return character.stats.craftingSkills.experience;
    case 'zonesCompleted':
      // This would need to be tracked separately in a real implementation
      // For now, using combat experience as a proxy
      return Math.floor(character.stats.combatSkills.experience / 1000);
    case 'dungeonsCompleted':
      // This would need to be tracked separately in a real implementation
      // For now, using combat level as a proxy
      return Math.floor(character.stats.combatSkills.level / 5);
    case 'guildLevel':
      // This would be based on guild progression, for now using character level
      return character.level;
    default:
      return 0;
  }
}

/**
 * Get guild name for a character
 */
async function getGuildName(userId: string): Promise<string | undefined> {
  try {
    // First, find the user's guild membership
    const membershipResult = await docClient.send(new QueryCommand({
      TableName: GUILD_MEMBERS_TABLE,
      IndexName: 'user-guild-index',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      Limit: 1,
    }));

    if (!membershipResult.Items || membershipResult.Items.length === 0) {
      return undefined;
    }

    const guildId = membershipResult.Items[0].guildId;

    // Then get the guild details
    const guildResult = await docClient.send(new QueryCommand({
      TableName: GUILDS_TABLE,
      KeyConditionExpression: 'guildId = :guildId',
      ExpressionAttributeValues: {
        ':guildId': guildId,
      },
      ProjectionExpression: '#name',
      ExpressionAttributeNames: {
        '#name': 'name',
      },
    }));

    return guildResult.Items?.[0]?.name;
  } catch (error) {
    console.error(`Error getting guild name for user ${userId}:`, error);
    return undefined;
  }
}

/**
 * Calculate leaderboard for a specific stat type
 */
async function calculateLeaderboard(statType: LeaderboardStatType): Promise<LeaderboardEntry[]> {
  console.log(`Calculating leaderboard for ${statType}`);

  // Scan all characters
  const scanResult = await docClient.send(new ScanCommand({
    TableName: CHARACTERS_TABLE,
  }));

  if (!scanResult.Items || scanResult.Items.length === 0) {
    console.log('No characters found');
    return [];
  }

  const characters = scanResult.Items as Character[];
  console.log(`Found ${characters.length} characters`);

  // Extract stat values and create entries
  const entries: Array<{ userId: string; characterName: string; statValue: number }> = [];

  for (const character of characters) {
    const statValue = extractStatValue(character, statType);
    if (statValue > 0) { // Only include characters with positive stat values
      entries.push({
        userId: character.userId,
        characterName: character.name,
        statValue,
      });
    }
  }

  // Sort by stat value (descending)
  entries.sort((a, b) => b.statValue - a.statValue);

  // Take top 100 and add guild names
  const top100 = entries.slice(0, 100);
  const leaderboardEntries: LeaderboardEntry[] = [];

  for (let i = 0; i < top100.length; i++) {
    const entry = top100[i];
    const guildName = await getGuildName(entry.userId);

    leaderboardEntries.push({
      rank: i + 1,
      userId: entry.userId,
      characterName: entry.characterName,
      guildName,
      statValue: entry.statValue,
      lastUpdated: new Date(),
    });
  }

  console.log(`Created ${leaderboardEntries.length} leaderboard entries for ${statType}`);
  return leaderboardEntries;
}

/**
 * Update leaderboard in DynamoDB
 */
async function updateLeaderboard(statType: LeaderboardStatType, entries: LeaderboardEntry[]): Promise<void> {
  console.log(`Updating leaderboard for ${statType} with ${entries.length} entries`);

  // First, clear existing entries for this stat type
  const existingEntries = await docClient.send(new QueryCommand({
    TableName: LEADERBOARDS_TABLE,
    KeyConditionExpression: 'statType = :statType',
    ExpressionAttributeValues: {
      ':statType': statType,
    },
    ProjectionExpression: 'statType, #rank',
    ExpressionAttributeNames: {
      '#rank': 'rank',
    },
  }));

  // Delete existing entries in batches
  if (existingEntries.Items && existingEntries.Items.length > 0) {
    const deleteRequests = existingEntries.Items.map(item => ({
      DeleteRequest: {
        Key: {
          statType: item.statType,
          rank: item.rank,
        },
      },
    }));

    // Process in batches of 25 (DynamoDB limit)
    for (let i = 0; i < deleteRequests.length; i += 25) {
      const batch = deleteRequests.slice(i, i + 25);
      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [LEADERBOARDS_TABLE]: batch,
        },
      }));
    }
  }

  // Insert new entries in batches
  if (entries.length > 0) {
    const putRequests = entries.map(entry => ({
      PutRequest: {
        Item: {
          statType,
          rank: entry.rank,
          userId: entry.userId,
          characterName: entry.characterName,
          guildName: entry.guildName,
          statValue: entry.statValue,
          lastUpdated: entry.lastUpdated.toISOString(),
        },
      },
    }));

    // Process in batches of 25
    for (let i = 0; i < putRequests.length; i += 25) {
      const batch = putRequests.slice(i, i + 25);
      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [LEADERBOARDS_TABLE]: batch,
        },
      }));
    }
  }

  console.log(`Successfully updated leaderboard for ${statType}`);
}

/**
 * Lambda handler for calculating leaderboards
 * Can be triggered by EventBridge or API Gateway
 */
export const handler = async (event: APIGatewayProxyEvent | any): Promise<APIGatewayProxyResult> => {
  console.log('Starting leaderboard calculation', JSON.stringify(event, null, 2));

  try {
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

    const results: { [key: string]: number } = {};

    // Calculate and update each leaderboard
    for (const statType of statTypes) {
      try {
        const entries = await calculateLeaderboard(statType);
        await updateLeaderboard(statType, entries);
        results[statType] = entries.length;
      } catch (error) {
        console.error(`Error calculating leaderboard for ${statType}:`, error);
        results[statType] = -1; // Indicate error
      }
    }

    console.log('Leaderboard calculation completed', results);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Leaderboards updated successfully',
        results,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Error in leaderboard calculation:', error);

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