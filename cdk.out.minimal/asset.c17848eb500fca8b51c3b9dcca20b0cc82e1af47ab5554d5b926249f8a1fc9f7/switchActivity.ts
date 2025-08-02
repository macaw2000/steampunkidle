/**
 * Lambda function for switching character activity
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DatabaseService, TABLE_NAMES } from '../../services/databaseService';
import { Character, ActivityType, Activity } from '../../types/character';

interface SwitchActivityRequest {
  activityType: ActivityType;
}

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

    const request: SwitchActivityRequest = JSON.parse(event.body);

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

    // Validate activity type
    const validActivities: ActivityType[] = ['crafting', 'harvesting', 'combat'];
    if (!validActivities.includes(request.activityType)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Invalid activity type. Must be one of: crafting, harvesting, combat',
        }),
      };
    }

    // Get existing character
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

    // Calculate progress from previous activity if it exists
    let previousActivityRewards = [];
    if (existingCharacter.currentActivity) {
      const timeDiff = Date.now() - new Date(existingCharacter.currentActivity.startedAt).getTime();
      const progressMinutes = Math.floor(timeDiff / (1000 * 60)); // Progress in minutes
      
      if (progressMinutes > 0) {
        // Calculate rewards based on activity type and time spent
        previousActivityRewards = calculateActivityRewards(
          existingCharacter.currentActivity.type,
          progressMinutes,
          existingCharacter
        );
      }
    }

    // Create new activity
    const newActivity: Activity = {
      type: request.activityType,
      startedAt: new Date(),
      progress: 0,
      rewards: [],
    };

    // Update character with new activity and apply previous rewards
    const updatedCharacter = await DatabaseService.updateItem({
      TableName: TABLE_NAMES.CHARACTERS,
      Key: { userId },
      UpdateExpression: 'SET #currentActivity = :currentActivity, #lastActiveAt = :lastActiveAt',
      ExpressionAttributeNames: {
        '#currentActivity': 'currentActivity',
        '#lastActiveAt': 'lastActiveAt',
      },
      ExpressionAttributeValues: {
        ':currentActivity': newActivity,
        ':lastActiveAt': new Date(),
      },
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
        previousActivityRewards,
        message: `Successfully switched to ${request.activityType}`,
      }),
    };
  } catch (error) {
    console.error('Error switching activity:', error);

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

/**
 * Calculate rewards based on activity type and time spent
 */
function calculateActivityRewards(
  activityType: ActivityType,
  minutes: number,
  character: Character
): any[] {
  const rewards = [];
  const baseRewardRate = 10; // Base experience per minute

  // Currency reward rates
  const currencyRates = {
    crafting: { baseRate: 5, skillMultiplier: 0.1 },
    harvesting: { baseRate: 3, skillMultiplier: 0.08 },
    combat: { baseRate: 8, skillMultiplier: 0.12 },
  };

  switch (activityType) {
    case 'crafting':
      rewards.push({
        type: 'experience',
        amount: Math.floor(minutes * baseRewardRate * (1 + character.stats.craftingSkills.level * 0.1)),
        skillType: 'crafting',
      });
      // Add currency reward
      const craftingCurrency = Math.floor(
        minutes * currencyRates.crafting.baseRate * 
        (1 + character.stats.craftingSkills.level * currencyRates.crafting.skillMultiplier)
      );
      rewards.push({
        type: 'currency',
        amount: Math.max(1, craftingCurrency),
      });
      break;
    case 'harvesting':
      rewards.push({
        type: 'experience',
        amount: Math.floor(minutes * baseRewardRate * (1 + character.stats.harvestingSkills.level * 0.1)),
        skillType: 'harvesting',
      });
      // Add currency reward
      const harvestingCurrency = Math.floor(
        minutes * currencyRates.harvesting.baseRate * 
        (1 + character.stats.harvestingSkills.level * currencyRates.harvesting.skillMultiplier)
      );
      rewards.push({
        type: 'currency',
        amount: Math.max(1, harvestingCurrency),
      });
      break;
    case 'combat':
      rewards.push({
        type: 'experience',
        amount: Math.floor(minutes * baseRewardRate * (1 + character.stats.combatSkills.level * 0.1)),
        skillType: 'combat',
      });
      // Add currency reward
      const combatCurrency = Math.floor(
        minutes * currencyRates.combat.baseRate * 
        (1 + character.stats.combatSkills.level * currencyRates.combat.skillMultiplier)
      );
      rewards.push({
        type: 'currency',
        amount: Math.max(1, combatCurrency),
      });
      break;
  }

  return rewards;
}