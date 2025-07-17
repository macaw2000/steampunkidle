/**
 * Unit tests for startCrafting Lambda function
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handler } from './startCrafting';
import { DatabaseService } from '../../services/databaseService';
import { CraftingService } from '../../services/craftingService';
import { createMockLambdaContext } from '../../utils/testHelpers';

// Mock dependencies
jest.mock('../../services/databaseService');
jest.mock('../../services/craftingService');

const mockDatabaseService = DatabaseService as jest.Mocked<typeof DatabaseService>;
const mockCraftingService = CraftingService as jest.Mocked<typeof CraftingService>;

describe('startCrafting Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockEvent = (body: any): APIGatewayProxyEvent => ({
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/crafting/start',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: '',
  });

  const mockCharacter = {
    userId: 'user123',
    characterId: 'char123',
    name: 'Test Character',
    level: 10,
    experience: 1000,
    stats: {
      craftingSkills: {
        clockmaking: 5,
        engineering: 3,
        alchemy: 2,
        steamcraft: 1,
        level: 5,
        experience: 500,
      },
    },
    specialization: {
      tankProgress: 0,
      healerProgress: 0,
      dpsProgress: 0,
    },
    currentActivity: 'crafting',
    lastActiveAt: new Date(),
  };

  const mockRecipe = {
    recipeId: 'pocket-chronometer',
    name: 'Pocket Chronometer',
    description: 'An elegant timepiece',
    category: 'trinkets' as const,
    requiredSkill: 'clockmaking' as const,
    requiredLevel: 5,
    craftingTime: 300,
    materials: [
      { materialId: 'clockwork-gear-basic', name: 'Basic Clockwork Gear', quantity: 4, type: 'basic' as const },
      { materialId: 'silver-ingot', name: 'Silver Ingot', quantity: 1, type: 'refined' as const },
    ],
    outputs: [
      {
        itemId: 'pocket-chronometer',
        name: 'Pocket Chronometer',
        quantity: 1,
        qualityModifier: 1.0,
      },
    ],
    experienceGain: 150,
    steampunkTheme: {
      flavorText: 'Time itself bends to the will of the master clockmaker.',
      visualDescription: 'An intricate silver timepiece with exposed gears.',
    },
  };

  it('should successfully start crafting session', async () => {
    const requestBody = {
      userId: 'user123',
      recipeId: 'pocket-chronometer',
    };

    mockDatabaseService.getItem.mockResolvedValue(mockCharacter);
    mockCraftingService.getRecipeById.mockReturnValue(mockRecipe);
    mockCraftingService.checkMaterialRequirements.mockReturnValue({
      hasAllMaterials: true,
      missingMaterials: [],
    });
    mockCraftingService.calculateCraftingTime.mockReturnValue(240);
    mockCraftingService.calculateQualityModifier.mockReturnValue(1.1);
    mockDatabaseService.putItem.mockResolvedValue(undefined);

    const result: APIGatewayProxyResult = await handler(mockEvent(requestBody), createMockLambdaContext());

    expect(result.statusCode).toBe(200);
    expect(mockDatabaseService.getItem).toHaveBeenCalledWith({
      TableName: 'steampunk-idle-game-characters',
      Key: { userId: 'user123' },
    });
    expect(mockCraftingService.getRecipeById).toHaveBeenCalledWith('pocket-chronometer');
    expect(mockDatabaseService.putItem).toHaveBeenCalled();

    const responseBody = JSON.parse(result.body);
    expect(responseBody.session).toBeDefined();
    expect(responseBody.craftingTime).toBe(240);
    expect(responseBody.qualityModifier).toBe(1.1);
  });

  it('should return 400 when request body is missing', async () => {
    const event = mockEvent(null);
    event.body = null;

    const result: APIGatewayProxyResult = await handler(event, createMockLambdaContext());

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('Request body is required');
  });

  it('should return 400 when userId is missing', async () => {
    const requestBody = {
      recipeId: 'pocket-chronometer',
    };

    const result: APIGatewayProxyResult = await handler(mockEvent(requestBody), createMockLambdaContext());

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('userId and recipeId are required');
  });

  it('should return 404 when character not found', async () => {
    const requestBody = {
      userId: 'user123',
      recipeId: 'pocket-chronometer',
    };

    mockDatabaseService.getItem.mockResolvedValue(null);

    const result: APIGatewayProxyResult = await handler(mockEvent(requestBody), createMockLambdaContext());

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).error).toBe('Character not found');
  });

  it('should return 404 when recipe not found', async () => {
    const requestBody = {
      userId: 'user123',
      recipeId: 'invalid-recipe',
    };

    mockDatabaseService.getItem.mockResolvedValue(mockCharacter);
    mockCraftingService.getRecipeById.mockReturnValue(null);

    const result: APIGatewayProxyResult = await handler(mockEvent(requestBody), createMockLambdaContext());

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).error).toBe('Recipe not found');
  });

  it('should return 400 when skill level is insufficient', async () => {
    const requestBody = {
      userId: 'user123',
      recipeId: 'pocket-chronometer',
    };

    const lowSkillCharacter = {
      ...mockCharacter,
      stats: {
        ...mockCharacter.stats,
        craftingSkills: {
          ...mockCharacter.stats.craftingSkills,
          clockmaking: 2, // Below required level of 5
        },
      },
    };

    mockDatabaseService.getItem.mockResolvedValue(lowSkillCharacter);
    mockCraftingService.getRecipeById.mockReturnValue(mockRecipe);

    const result: APIGatewayProxyResult = await handler(mockEvent(requestBody), createMockLambdaContext());

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toContain('Insufficient clockmaking level');
  });

  it('should return 400 when materials are insufficient', async () => {
    const requestBody = {
      userId: 'user123',
      recipeId: 'pocket-chronometer',
    };

    mockDatabaseService.getItem.mockResolvedValue(mockCharacter);
    mockCraftingService.getRecipeById.mockReturnValue(mockRecipe);
    mockCraftingService.checkMaterialRequirements.mockReturnValue({
      hasAllMaterials: false,
      missingMaterials: ['Silver Ingot (need 1, have 0)'],
    });

    const result: APIGatewayProxyResult = await handler(mockEvent(requestBody), createMockLambdaContext());

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('Insufficient materials');
    expect(JSON.parse(result.body).missingMaterials).toEqual(['Silver Ingot (need 1, have 0)']);
  });

  it('should handle workstation bonuses', async () => {
    const requestBody = {
      userId: 'user123',
      recipeId: 'pocket-chronometer',
      workstationId: 'precision-workbench',
    };

    const mockWorkstation = {
      workstationId: 'precision-workbench',
      name: 'Precision Clockwork Bench',
      type: 'advanced' as const,
      requiredSkills: [],
      bonuses: [
        { type: 'speed' as const, value: 20, description: '+20% speed' },
        { type: 'quality' as const, value: 15, description: '+15% quality' },
      ],
      unlockCost: 500,
      maintenanceCost: 15,
      steampunkDescription: 'A specialized workbench',
    };

    mockDatabaseService.getItem.mockResolvedValue(mockCharacter);
    mockCraftingService.getRecipeById.mockReturnValue(mockRecipe);
    mockCraftingService.getWorkstationById.mockReturnValue(mockWorkstation);
    mockCraftingService.checkMaterialRequirements.mockReturnValue({
      hasAllMaterials: true,
      missingMaterials: [],
    });
    mockCraftingService.calculateCraftingTime.mockReturnValue(200); // Faster with workstation
    mockCraftingService.calculateQualityModifier.mockReturnValue(1.25); // Higher quality with workstation
    mockDatabaseService.putItem.mockResolvedValue(undefined);

    const result: APIGatewayProxyResult = await handler(mockEvent(requestBody), createMockLambdaContext());

    expect(result.statusCode).toBe(200);
    expect(mockCraftingService.getWorkstationById).toHaveBeenCalledWith('precision-workbench');
    expect(mockCraftingService.calculateCraftingTime).toHaveBeenCalledWith(300, 5, 20);
    expect(mockCraftingService.calculateQualityModifier).toHaveBeenCalledWith(5, 5, 15);
  });

  it('should handle database errors', async () => {
    const requestBody = {
      userId: 'user123',
      recipeId: 'pocket-chronometer',
    };

    mockDatabaseService.getItem.mockRejectedValue(new Error('Database error'));

    const result: APIGatewayProxyResult = await handler(mockEvent(requestBody), createMockLambdaContext());

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).error).toBe('Internal server error');
  });
});