/**
 * Lambda function for completing a crafting session
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DatabaseService, TABLE_NAMES } from '../../services/databaseService';
import { Character } from '../../types/character';
import { CraftingSession, CompleteCraftingRequest, CraftingOutput } from '../../types/crafting';
import { CraftingService } from '../../services/craftingService';

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

    const request: CompleteCraftingRequest = JSON.parse(event.body);

    if (!request.userId || !request.sessionId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'userId and sessionId are required',
        }),
      };
    }

    // Get crafting session
    const craftingSession = await DatabaseService.getItem<CraftingSession>({
      TableName: TABLE_NAMES.CRAFTING_SESSIONS,
      Key: { sessionId: request.sessionId },
    });

    if (!craftingSession) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Crafting session not found',
        }),
      };
    }

    if (craftingSession.userId !== request.userId) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Unauthorized access to crafting session',
        }),
      };
    }

    if (craftingSession.status !== 'in_progress') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Crafting session is not in progress',
        }),
      };
    }

    // Get character
    const character = await DatabaseService.getItem<Character>({
      TableName: TABLE_NAMES.CHARACTERS,
      Key: { userId: request.userId },
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

    // Get recipe
    const recipe = CraftingService.getRecipeById(craftingSession.recipeId);
    if (!recipe) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Recipe not found',
        }),
      };
    }

    // Check if enough time has passed
    const currentTime = new Date();
    const craftingTime = CraftingService.calculateCraftingTime(
      recipe.craftingTime,
      character.stats.craftingSkills[recipe.requiredSkill]
    );
    const requiredCompletionTime = new Date(craftingSession.startedAt.getTime() + craftingTime * 1000);

    if (currentTime < requiredCompletionTime) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Crafting is not yet complete',
          remainingTime: Math.ceil((requiredCompletionTime.getTime() - currentTime.getTime()) / 1000),
        }),
      };
    }

    // Calculate items created with quality modifier
    const itemsCreated: CraftingOutput[] = recipe.outputs.map(output => ({
      ...output,
      qualityModifier: craftingSession.qualityBonus,
      baseStats: output.baseStats ? {
        ...output.baseStats,
        attack: output.baseStats.attack ? Math.floor(output.baseStats.attack * craftingSession.qualityBonus) : undefined,
        defense: output.baseStats.defense ? Math.floor(output.baseStats.defense * craftingSession.qualityBonus) : undefined,
        intelligence: output.baseStats.intelligence ? Math.floor(output.baseStats.intelligence * craftingSession.qualityBonus) : undefined,
        dexterity: output.baseStats.dexterity ? Math.floor(output.baseStats.dexterity * craftingSession.qualityBonus) : undefined,
        strength: output.baseStats.strength ? Math.floor(output.baseStats.strength * craftingSession.qualityBonus) : undefined,
        vitality: output.baseStats.vitality ? Math.floor(output.baseStats.vitality * craftingSession.qualityBonus) : undefined,
        durability: Math.floor(output.baseStats.durability * craftingSession.qualityBonus),
      } : undefined,
    }));

    // Calculate experience gained
    const baseExperience = recipe.experienceGain;
    const qualityBonus = Math.max(0, (craftingSession.qualityBonus - 1) * 0.5); // Bonus XP for high quality
    const experienceGained = Math.floor(baseExperience * (1 + qualityBonus));

    // Update character's crafting skills
    const currentSkillSet = character.stats.craftingSkills;
    const updatedSkillSet = {
      ...currentSkillSet,
      [recipe.requiredSkill]: currentSkillSet[recipe.requiredSkill] + experienceGained,
      experience: currentSkillSet.experience + experienceGained,
    };

    // Recalculate skill level
    updatedSkillSet.level = CraftingService.calculateSkillLevel(updatedSkillSet.experience);

    // Check for level up
    let skillLevelUp = undefined;
    const oldSkillLevel = CraftingService.calculateSkillLevel(currentSkillSet[recipe.requiredSkill]);
    const newSkillLevel = CraftingService.calculateSkillLevel(updatedSkillSet[recipe.requiredSkill]);
    
    if (newSkillLevel > oldSkillLevel) {
      const newRecipes = CraftingService.getAvailableRecipes({
        ...character,
        stats: {
          ...character.stats,
          craftingSkills: updatedSkillSet,
        },
      }).filter(r => r.requiredSkill === recipe.requiredSkill && r.requiredLevel <= newSkillLevel);

      skillLevelUp = {
        skill: recipe.requiredSkill,
        newLevel: newSkillLevel,
        unlockedRecipes: newRecipes.map(r => r.recipeId),
      };
    }

    // Update character
    await DatabaseService.updateItem({
      TableName: TABLE_NAMES.CHARACTERS,
      Key: { userId: request.userId },
      UpdateExpression: 'SET #craftingSkills = :craftingSkills, #lastActiveAt = :lastActiveAt',
      ExpressionAttributeNames: {
        '#craftingSkills': 'craftingSkills',
        '#lastActiveAt': 'lastActiveAt',
      },
      ExpressionAttributeValues: {
        ':craftingSkills': updatedSkillSet,
        ':lastActiveAt': currentTime,
      },
    });

    // Update crafting session
    const completedSession: CraftingSession = {
      ...craftingSession,
      completedAt: currentTime,
      status: 'completed',
      experienceEarned: experienceGained,
    };

    await DatabaseService.updateItem({
      TableName: TABLE_NAMES.CRAFTING_SESSIONS,
      Key: { sessionId: request.sessionId },
      UpdateExpression: 'SET #completedAt = :completedAt, #status = :status, #experienceEarned = :experienceEarned',
      ExpressionAttributeNames: {
        '#completedAt': 'completedAt',
        '#status': 'status',
        '#experienceEarned': 'experienceEarned',
      },
      ExpressionAttributeValues: {
        ':completedAt': currentTime,
        ':status': 'completed',
        ':experienceEarned': experienceGained,
      },
    });

    // Add items to inventory (simulated - in real implementation would update inventory table)

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        session: completedSession,
        itemsCreated,
        experienceGained,
        skillLevelUp,
      }),
    };
  } catch (error) {
    console.error('Error completing crafting:', error);

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