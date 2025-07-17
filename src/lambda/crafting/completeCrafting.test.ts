/**
 * Unit tests for completeCrafting Lambda function
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handler } from './completeCrafting';
import { DatabaseService } from '../../services/databaseService';
import { CraftingService } from '../../services/craftingService';

// Mock dependencies
jest.mock('../../services/databaseService');
jest.mock('../../services/craftingService');

const mockDatabaseService = DatabaseService as jest.Mocked<typeof DatabaseService>;
const mockCraftingService = CraftingService as jest.Mocked<typeof CraftingService>;

describe('completeCrafting Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockEvent = (body: any): APIGatewayProxyEvent => ({
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/crafting/complete',
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
    ],
    outputs: [
      {
        itemId: 'pocket-chronometer',
        name: 'Pocket Chronometer',
        quantity: 1,
        baseStats: { dexterity: 5, intelligence: 3, durability: 100 },
        qualityModifier: 1.0,
      },
    ],
    experienceGain: 150,
    steampunkTheme: {
      flavorText: 'Time itself bends to the will of the master clockmaker.',
      visualDescription: 'An intricate silver timepiece with exposed gears.',
    },
  };

  const mockCraftingSession = {
    sessionId: 'session123',
    userId: 'user123',
    recipeId: 'pocket-chronometer',
    startedAt: new Date(Date.now() - 400000), // Started 400 seconds ago
    status: 'in_progress' as const,
    qualityBonus: 1.1,
    experienceEarned: 0,
  };

  it('should successfully complete crafting session', async () => {
    const requestBody = {
      userId: 'user123',
      sessionId: 'session123',
    };

    mockDatabaseService.getItem
      .mockResolvedValueOnce(mockCraftingSession) // First call for crafting session
      .mockResolvedValueOnce(mockCharacter); // Second call for character
    mockCraftingService.getRecipeById.mockReturnValue(mockRecipe);
    mockCraftingService.calculateCraftingTime.mockReturnValue(300);
    mockCraftingService.calculateSkillLevel.mockReturnValue(5);
    mockDatabaseService.updateItem.mockResolvedValue(undefined);

    const result: APIGatewayProxyResult = await handler(mockEvent(requestBody));

    expect(result.statusCode).toBe(200);
    expect(mockDatabaseService.getItem).toHaveBeenCalledTimes(2);
    expect(mockDatabaseService.updateItem).toHaveBeenCalledTimes(2); // Character and session updates

    const responseBody = JSON.parse(result.body);
    expect(responseBody.session).toBeDefined();
    expect(responseBody.itemsCreated).toBeDefined();
    expect(responseBody.experienceGained).toBeGreaterThan(0);
    expect(responseBody.session.status).toBe('completed');
  });

  it('should return 400 when request body is missing', async () => {
    const event = mockEvent(null);
    event.body = null;

    const result: APIGatewayProxyResult = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('Request body is required');
  });

  it('should return 400 when sessionId is missing', async () => {
    const requestBody = {
      userId: 'user123',
    };

    const result: APIGatewayProxyResult = await handler(mockEvent(requestBody));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('userId and sessionId are required');
  });

  it('should return 404 when crafting session not found', async () => {
    const requestBody = {
      userId: 'user123',
      sessionId: 'invalid-session',
    };

    mockDatabaseService.getItem.mockResolvedValue(null);

    const result: APIGatewayProxyResult = await handler(mockEvent(requestBody));

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).error).toBe('Crafting session not found');
  });

  it('should return 403 when user does not own the session', async () => {
    const requestBody = {
      userId: 'user123',
      sessionId: 'session123',
    };

    const otherUserSession = {
      ...mockCraftingSession,
      userId: 'other-user',
    };

    mockDatabaseService.getItem.mockResolvedValue(otherUserSession);

    const result: APIGatewayProxyResult = await handler(mockEvent(requestBody));

    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body).error).toBe('Unauthorized access to crafting session');
  });

  it('should return 400 when session is not in progress', async () => {
    const requestBody = {
      userId: 'user123',
      sessionId: 'session123',
    };

    const completedSession = {
      ...mockCraftingSession,
      status: 'completed' as const,
    };

    mockDatabaseService.getItem.mockResolvedValue(completedSession);

    const result: APIGatewayProxyResult = await handler(mockEvent(requestBody));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('Crafting session is not in progress');
  });

  it('should return 404 when character not found', async () => {
    const requestBody = {
      userId: 'user123',
      sessionId: 'session123',
    };

    mockDatabaseService.getItem
      .mockResolvedValueOnce(mockCraftingSession)
      .mockResolvedValueOnce(null); // Character not found

    const result: APIGatewayProxyResult = await handler(mockEvent(requestBody));

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).error).toBe('Character not found');
  });

  it('should return 404 when recipe not found', async () => {
    const requestBody = {
      userId: 'user123',
      sessionId: 'session123',
    };

    mockDatabaseService.getItem
      .mockResolvedValueOnce(mockCraftingSession)
      .mockResolvedValueOnce(mockCharacter);
    mockCraftingService.getRecipeById.mockReturnValue(null);

    const result: APIGatewayProxyResult = await handler(mockEvent(requestBody));

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).error).toBe('Recipe not found');
  });

  it('should return 400 when crafting is not yet complete', async () => {
    const requestBody = {
      userId: 'user123',
      sessionId: 'session123',
    };

    const recentSession = {
      ...mockCraftingSession,
      startedAt: new Date(Date.now() - 100000), // Started only 100 seconds ago
    };

    mockDatabaseService.getItem
      .mockResolvedValueOnce(recentSession)
      .mockResolvedValueOnce(mockCharacter);
    mockCraftingService.getRecipeById.mockReturnValue(mockRecipe);
    mockCraftingService.calculateCraftingTime.mockReturnValue(300); // Needs 300 seconds

    const result: APIGatewayProxyResult = await handler(mockEvent(requestBody));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('Crafting is not yet complete');
    expect(JSON.parse(result.body).remainingTime).toBeGreaterThan(0);
  });

  it('should handle skill level up', async () => {
    const requestBody = {
      userId: 'user123',
      sessionId: 'session123',
    };

    // Character with lower skill experience that will level up
    const lowExpCharacter = {
      ...mockCharacter,
      stats: {
        ...mockCharacter.stats,
        craftingSkills: {
          ...mockCharacter.stats.craftingSkills,
          clockmaking: 100, // Low experience that will level up
        },
      },
    };

    mockDatabaseService.getItem
      .mockResolvedValueOnce(mockCraftingSession)
      .mockResolvedValueOnce(lowExpCharacter);
    mockCraftingService.getRecipeById.mockReturnValue(mockRecipe);
    mockCraftingService.calculateCraftingTime.mockReturnValue(300);
    mockCraftingService.calculateSkillLevel
      .mockReturnValueOnce(5) // Overall skill level (not used for level up check)
      .mockReturnValueOnce(2) // Old individual skill level (100 exp)
      .mockReturnValueOnce(3); // New individual skill level (250 exp)
    mockCraftingService.getAvailableRecipes.mockReturnValue([
      { ...mockRecipe, recipeId: 'new-recipe', requiredLevel: 3 },
    ]);
    mockDatabaseService.updateItem.mockResolvedValue(undefined);

    const result: APIGatewayProxyResult = await handler(mockEvent(requestBody));

    expect(result.statusCode).toBe(200);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.skillLevelUp).toBeDefined();
    expect(responseBody.skillLevelUp.skill).toBe('clockmaking');
    expect(responseBody.skillLevelUp.newLevel).toBe(3);
    expect(responseBody.skillLevelUp.unlockedRecipes).toContain('new-recipe');
  });

  it('should apply quality modifiers to item stats', async () => {
    const requestBody = {
      userId: 'user123',
      sessionId: 'session123',
    };

    const highQualitySession = {
      ...mockCraftingSession,
      qualityBonus: 1.5, // 50% quality bonus
    };

    mockDatabaseService.getItem
      .mockResolvedValueOnce(highQualitySession)
      .mockResolvedValueOnce(mockCharacter);
    mockCraftingService.getRecipeById.mockReturnValue(mockRecipe);
    mockCraftingService.calculateCraftingTime.mockReturnValue(300);
    mockCraftingService.calculateSkillLevel.mockReturnValue(5);
    mockDatabaseService.updateItem.mockResolvedValue(undefined);

    const result: APIGatewayProxyResult = await handler(mockEvent(requestBody));

    expect(result.statusCode).toBe(200);

    const responseBody = JSON.parse(result.body);
    const createdItem = responseBody.itemsCreated[0];
    expect(createdItem.baseStats.dexterity).toBe(7); // 5 * 1.5 = 7.5, floored to 7
    expect(createdItem.baseStats.intelligence).toBe(4); // 3 * 1.5 = 4.5, floored to 4
    expect(createdItem.baseStats.durability).toBe(150); // 100 * 1.5 = 150
  });

  it('should handle database errors', async () => {
    const requestBody = {
      userId: 'user123',
      sessionId: 'session123',
    };

    mockDatabaseService.getItem.mockRejectedValue(new Error('Database error'));

    const result: APIGatewayProxyResult = await handler(mockEvent(requestBody));

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).error).toBe('Internal server error');
  });
});