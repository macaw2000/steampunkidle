"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const databaseService_1 = require("../../services/databaseService");
const craftingService_1 = require("../../services/craftingService");
const logger_1 = require("../../utils/logger");
const uuid_1 = require("uuid");
const handler = async (event, context) => {
    const logger = logger_1.Logger.fromLambdaContext(context, event);
    const startTime = Date.now();
    logger.logApiRequest(event);
    logger.info('Starting crafting session request');
    try {
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
        const request = JSON.parse(event.body);
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
        const character = await (0, logger_1.withTiming)(logger, 'Get character from database', async () => {
            return await databaseService_1.DatabaseService.getItem({
                TableName: databaseService_1.TABLE_NAMES.CHARACTERS,
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
        const recipe = craftingService_1.CraftingService.getRecipeById(request.recipeId);
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
        const playerMaterials = {};
        recipe.materials.forEach(material => {
            playerMaterials[material.materialId] = material.quantity + 5;
        });
        const materialCheck = craftingService_1.CraftingService.checkMaterialRequirements(recipe, playerMaterials);
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
        let workstationSpeedBonus = 0;
        let workstationQualityBonus = 0;
        if (request.workstationId) {
            const workstation = craftingService_1.CraftingService.getWorkstationById(request.workstationId);
            if (workstation) {
                workstation.bonuses.forEach(bonus => {
                    if (bonus.type === 'speed')
                        workstationSpeedBonus += bonus.value;
                    if (bonus.type === 'quality')
                        workstationQualityBonus += bonus.value;
                });
                logger.info('Workstation bonuses applied', {
                    workstationId: request.workstationId,
                    speedBonus: workstationSpeedBonus,
                    qualityBonus: workstationQualityBonus
                });
            }
        }
        const craftingTime = craftingService_1.CraftingService.calculateCraftingTime(recipe.craftingTime, skillLevel, workstationSpeedBonus);
        const qualityModifier = craftingService_1.CraftingService.calculateQualityModifier(skillLevel, recipe.requiredLevel, workstationQualityBonus);
        logger.info('Crafting calculations completed', {
            craftingTime,
            qualityModifier,
            skillLevel
        });
        const sessionId = (0, uuid_1.v4)();
        const startedAt = new Date();
        const estimatedCompletion = new Date(startedAt.getTime() + craftingTime * 1000);
        const craftingSession = {
            sessionId,
            userId: request.userId,
            recipeId: request.recipeId,
            startedAt,
            status: 'in_progress',
            qualityBonus: qualityModifier,
            experienceEarned: 0,
        };
        await (0, logger_1.withTiming)(logger, 'Store crafting session', async () => {
            await databaseService_1.DatabaseService.putItem({
                TableName: databaseService_1.TABLE_NAMES.CRAFTING_SESSIONS,
                Item: craftingSession,
            });
        });
        logger.logBusinessEvent('crafting_started', {
            sessionId,
            recipeId: request.recipeId,
            userId: request.userId,
            craftingTime,
            qualityModifier,
        });
        (0, logger_1.putCustomMetric)('SteampunkIdleGame/Crafting', 'CraftingSessionsStarted', 1, 'Count');
        (0, logger_1.putCustomMetric)('SteampunkIdleGame/Crafting', 'CraftingTime', craftingTime, 'Seconds');
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
    }
    catch (error) {
        const totalDuration = Date.now() - startTime;
        logger.error('Error starting crafting session', error, { duration: totalDuration });
        logger.logApiResponse(500, totalDuration);
        (0, logger_1.putCustomMetric)('SteampunkIdleGame/Crafting', 'CraftingErrors', 1, 'Count');
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
exports.handler = handler;
