/**
 * Lambda function for getting current activity progress
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DatabaseService, TABLE_NAMES } from '../../services/databaseService';
import { Character, ActivityReward } from '../../types/character';

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

    // Get character
    const character = await DatabaseService.getItem<Character>({
      TableName: TABLE_NAMES.CHARACTERS,
      Key: { userId },
    });

    if (!character) {
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

    if (!character.currentActivity) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          progress: null,
          message: 'No active activity',
        }),
      };
    }

    // Calculate current progress
    const startTime = new Date(character.currentActivity.startedAt).getTime();
    const currentTime = Date.now();
    const timeDiff = currentTime - startTime;
    const progressMinutes = Math.floor(timeDiff / (1000 * 60));
    
    // Calculate potential rewards
    const potentialRewards = calculatePotentialRewards(
      character.currentActivity.type,
      progressMinutes,
      character
    );

    // Calculate progress percentage (assuming 60 minutes = 100% for display purposes)
    const progressPercentage = Math.min((progressMinutes / 60) * 100, 100);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        progress: {
          activityType: character.currentActivity.type,
          startedAt: character.currentActivity.startedAt,
          minutesActive: progressMinutes,
          progressPercentage,
          potentialRewards,
        },
      }),
    };
  } catch (error) {
    console.error('Error getting activity progress:', error);

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
 * Calculate potential rewards based on current progress
 */
function calculatePotentialRewards(
  activityType: string,
  minutes: number,
  character: Character
): ActivityReward[] {
  const rewards: ActivityReward[] = [];
  const baseRewardRate = 10;

  if (minutes <= 0) {
    return rewards;
  }

  switch (activityType) {
    case 'crafting':
      rewards.push({
        type: 'experience',
        amount: Math.floor(minutes * baseRewardRate * (1 + character.stats.craftingSkills.level * 0.1)),
      });
      // Add currency reward
      rewards.push({
        type: 'currency',
        amount: Math.floor(minutes * 2 * (1 + character.stats.craftingSkills.level * 0.05)),
      });
      break;
    case 'harvesting':
      rewards.push({
        type: 'experience',
        amount: Math.floor(minutes * baseRewardRate * (1 + character.stats.harvestingSkills.level * 0.1)),
      });
      // Add resource rewards
      rewards.push({
        type: 'resource',
        amount: Math.floor(minutes * 1.5 * (1 + character.stats.harvestingSkills.level * 0.1)),
      });
      break;
    case 'combat':
      rewards.push({
        type: 'experience',
        amount: Math.floor(minutes * baseRewardRate * (1 + character.stats.combatSkills.level * 0.1)),
      });
      // Add currency and potential item rewards
      rewards.push({
        type: 'currency',
        amount: Math.floor(minutes * 3 * (1 + character.stats.combatSkills.level * 0.05)),
      });
      break;
  }

  return rewards;
}