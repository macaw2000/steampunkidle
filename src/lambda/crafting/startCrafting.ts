/**
 * Lambda function for starting a crafting session
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DatabaseService, TABLE_NAMES } from '../../services/databaseService';
import { Character } from '../../types/character';
import { CraftingSession, StartCraftingRequest } from '../../types/crafting';
import { CraftingService } from '../../services/craftingService';
import { Logger, withTiming, putCustomMetric } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const logger = Logger.fromLambdaContext(context, event);
  const startTime = Date.now();
  
  logger.logApiRequest(event);
  logger.info('Starting crafting session request');

  try {
    // Parse request body
    if (!event.body) {
      logger.warn('Request body missing');
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

    const request: StartCraftingRequest = JSON.parse(event.body);
    logger.info('Parsed crafting request', { recipeId: request.recipeId, userId: request.userId });

    if (!request.userId || !request.recipeId) {
      logger.warn('Missing required parameters', { userId: !!request.userId, recipeId: !!request.recipeId });
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'userId and recipeId are required',
        }),
      };
    }

    // Get character
    const character = await withTiming(logger, 'Get character from database', async () => {
      return await DatabaseService.getItem<Character>({
        TableName: TABLE_NAMES.CHARACTERS,
        Key: { userId: request.userId },
      });
    });

    if (!character) {
      logger.warn('Character not found', { userId: request.userId });
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

    logger.info('Character retrieved', { characterLevel: character.level, characterName: character.name });

    // Get recipe
    const recipe = CraftingService.getRecipeById(request.recipeId);
    if (!recipe) {
      logger.warn('Recipe not found', { recipeId: request.recipeId });
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

    logger.info('Recipe retrieved', { 
      recipeName: recipe.name, 
      requiredSkill: recipe.requiredSkill, 
      requiredLevel: recipe.requiredLevel 
    });

    // Check skill requirements
    const skillLevel = character.stats.craftingSkills[recipe.requiredSkill];
    if (skillLevel < recipe.requiredLevel) {
      logger.warn('Insufficient skill level', { 
        skill: recipe.requiredSkill, 
        required: recipe.requiredLevel, 
        current: skillLevel 
      });
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: `Insufficient ${recipe.requiredSkill} level. Required: ${recipe.requiredLevel}, Current: ${skillLevel}`,
        }),
      };
    }

    // Get player materials (this would normally come from inventory)
    // For now, we'll simulate having materials
    const playerMaterials: { [materialId: string]: number } = {};
    recipe.materials.forEach(material => {
      playerMaterials[material.materialId] = material.quantity + 5; // Simulate having enough materials
    });

    // Check material requirements
    const materialCheck = CraftingService.checkMaterialRequirements(recipe, playerMaterials);
    if (!materialCheck.hasAllMaterials) {
      logger.warn('Insufficient materials', { missingMaterials: materialCheck.missingMaterials });
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Insufficient materials',
          missingMaterials: materialCheck.missingMaterials,
        }),
      };
    }

    // Get workstation bonuses if specified
    let workstationSpeedBonus = 0;
    let workstationQualityBonus = 0;
    
    if (request.workstationId) {
      const workstation = CraftingService.getWorkstationById(request.workstationId);
      if (workstation) {
        workstation.bonuses.forEach(bonus => {
          if (bonus.type === 'speed') workstationSpeedBonus += bonus.value;
          if (bonus.type === 'quality') workstationQualityBonus += bonus.value;
        });
        logger.info('Workstation bonuses applied', { 
          workstationId: request.workstationId, 
          speedBonus: workstationSpeedBonus, 
          qualityBonus: workstationQualityBonus 
        });
      }
    }

    // Calculate crafting time and quality
    const craftingTime = CraftingService.calculateCraftingTime(
      recipe.craftingTime,
      skillLevel,
      workstationSpeedBonus
    );
    
    const qualityModifier = CraftingService.calculateQualityModifier(
      skillLevel,
      recipe.requiredLevel,
      workstationQualityBonus
    );

    logger.info('Crafting calculations completed', { 
      craftingTime, 
      qualityModifier, 
      skillLevel 
    });

    // Create crafting session
    const sessionId = uuidv4();
    const startedAt = new Date();
    const estimatedCompletion = new Date(startedAt.getTime() + craftingTime * 1000);

    const craftingSession: CraftingSession = {
      sessionId,
      userId: request.userId,
      recipeId: request.recipeId,
      startedAt,
      status: 'in_progress',
      qualityBonus: qualityModifier,
      experienceEarned: 0,
    };

    // Store crafting session
    await withTiming(logger, 'Store crafting session', async () => {
      await DatabaseService.putItem({
        TableName: TABLE_NAMES.CRAFTING_SESSIONS,
        Item: craftingSession,
      });
    });

    // Log business event
    logger.logBusinessEvent('crafting_started', {
      sessionId,
      recipeId: request.recipeId,
      userId: request.userId,
      craftingTime,
      qualityModifier,
    });

    // Log custom metrics
    putCustomMetric('SteampunkIdleGame/Crafting', 'CraftingSessionsStarted', 1, 'Count');
    putCustomMetric('SteampunkIdleGame/Crafting', 'CraftingTime', craftingTime, 'Seconds');

    const totalDuration = Date.now() - startTime;
    const response = {
      session: craftingSession,
      estimatedCompletion,
      materialsCost: recipe.materials,
      craftingTime,
      qualityModifier,
    };

    logger.logApiResponse(200, totalDuration, JSON.stringify(response).length);
    logger.info('Crafting session started successfully', { sessionId, estimatedCompletion });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    logger.error('Error starting crafting session', error as Error, { duration: totalDuration });
    logger.logApiResponse(500, totalDuration);

    // Log error metric
    putCustomMetric('SteampunkIdleGame/Crafting', 'CraftingErrors', 1, 'Count');

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