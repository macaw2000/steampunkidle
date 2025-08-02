/**
 * Tests for switchActivity Lambda function
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../switchActivity';
import { DatabaseService } from '../../../services/databaseService';
import { Character } from '../../../types/character';

// Mock DatabaseService
jest.mock('../../../services/databaseService');
const mockDatabaseService = DatabaseService as jest.Mocked<typeof DatabaseService>;

describe('switchActivity Lambda', () => {
  const mockCharacter: Character = {
    userId: 'test-user-123',
    characterId: 'char-123',
    name: 'Test Character',
    level: 5,
    experience: 2500,
    currency: 100,
    stats: {
      strength: 10,
      dexterity: 12,
      intelligence: 8,
      vitality: 15,
      craftingSkills: {
        clockmaking: 5,
        engineering: 3,
        alchemy: 2,
        steamcraft: 4,
        level: 3,
        experience: 450,
      },
      harvestingSkills: {
        clockmaking: 2,
        engineering: 1,
        alchemy: 0,
        steamcraft: 1,
        level: 1,
        experience: 50,
      },
      combatSkills: {
        clockmaking: 1,
        engineering: 0,
        alchemy: 0,
        steamcraft: 2,
        level: 1,
        experience: 100,
      },
    },
    specialization: {
      tankProgress: 25,
      healerProgress: 10,
      dpsProgress: 15,
      primaryRole: 'tank',
      bonuses: [],
    },
    currentActivity: {
      type: 'crafting',
      startedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      progress: 50,
      rewards: [],
    },
    lastActiveAt: new Date(),
    createdAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully switch activity', async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      pathParameters: { userId: 'test-user-123' },
      body: JSON.stringify({ activityType: 'combat' }),
    };

    mockDatabaseService.getItem.mockResolvedValue(mockCharacter);
    mockDatabaseService.updateItem.mockResolvedValue({
      ...mockCharacter,
      currentActivity: {
        type: 'combat',
        startedAt: new Date(),
        progress: 0,
        rewards: [],
      },
    });

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.character.currentActivity.type).toBe('combat');
    expect(body.message).toBe('Successfully switched to combat');
  });

  it('should return 400 for missing request body', async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      pathParameters: { userId: 'test-user-123' },
      body: null,
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('Request body is required');
  });

  it('should return 400 for missing userId', async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      pathParameters: null,
      body: JSON.stringify({ activityType: 'combat' }),
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('userId is required');
  });

  it('should return 400 for invalid activity type', async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      pathParameters: { userId: 'test-user-123' },
      body: JSON.stringify({ activityType: 'invalid-activity' }),
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('Invalid activity type. Must be one of: crafting, harvesting, combat');
  });

  it('should return 404 for non-existent character', async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      pathParameters: { userId: 'non-existent-user' },
      body: JSON.stringify({ activityType: 'combat' }),
    };

    mockDatabaseService.getItem.mockResolvedValue(null);

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('Character not found');
  });

  it('should calculate rewards from previous activity', async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      pathParameters: { userId: 'test-user-123' },
      body: JSON.stringify({ activityType: 'harvesting' }),
    };

    mockDatabaseService.getItem.mockResolvedValue(mockCharacter);
    mockDatabaseService.updateItem.mockResolvedValue({
      ...mockCharacter,
      currentActivity: {
        type: 'harvesting',
        startedAt: new Date(),
        progress: 0,
        rewards: [],
      },
    });

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.previousActivityRewards).toBeDefined();
    expect(body.previousActivityRewards.length).toBeGreaterThan(0);
    expect(body.previousActivityRewards[0].type).toBe('experience');
  });

  it('should handle database errors gracefully', async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      pathParameters: { userId: 'test-user-123' },
      body: JSON.stringify({ activityType: 'combat' }),
    };

    mockDatabaseService.getItem.mockRejectedValue(new Error('Database error'));

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('Internal server error');
  });

  it('should include CORS headers in response', async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      pathParameters: { userId: 'test-user-123' },
      body: JSON.stringify({ activityType: 'combat' }),
    };

    mockDatabaseService.getItem.mockResolvedValue(mockCharacter);
    mockDatabaseService.updateItem.mockResolvedValue(mockCharacter);

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
    expect(result.headers).toHaveProperty('Content-Type', 'application/json');
  });
});