/**
 * Tests for getCharacter Lambda function
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../getCharacter';
import { DatabaseService } from '../../../services/databaseService';

// Mock the DatabaseService
jest.mock('../../../services/databaseService');
const mockDatabaseService = DatabaseService as jest.Mocked<typeof DatabaseService>;

describe('getCharacter Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockEvent = (userId?: string): APIGatewayProxyEvent => ({
    body: null,
    pathParameters: userId ? { userId } : null,
    queryStringParameters: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: `/character/${userId || ''}`,
    resource: '/character/{userId}',
    requestContext: {} as any,
    stageVariables: null,
    multiValueQueryStringParameters: null,
  });

  const mockCharacter = {
    userId: 'test-user-id',
    characterId: 'test-character-id',
    name: 'TestCharacter',
    level: 5,
    experience: 2500,
    currency: 500,
    stats: {
      strength: 15,
      dexterity: 12,
      intelligence: 18,
      vitality: 14,
      craftingSkills: {
        clockmaking: 10,
        engineering: 8,
        alchemy: 12,
        steamcraft: 6,
        level: 5,
        experience: 1200,
      },
      harvestingSkills: {
        clockmaking: 5,
        engineering: 7,
        alchemy: 4,
        steamcraft: 8,
        level: 3,
        experience: 450,
      },
      combatSkills: {
        clockmaking: 8,
        engineering: 6,
        alchemy: 9,
        steamcraft: 11,
        level: 4,
        experience: 850,
      },
    },
    specialization: {
      tankProgress: 30,
      healerProgress: 50,
      dpsProgress: 20,
      primaryRole: 'healer' as const,
      bonuses: [],
    },
    currentActivity: {
      type: 'crafting' as const,
      startedAt: new Date('2023-01-01T10:00:00Z'),
      progress: 75,
      rewards: [],
    },
    lastActiveAt: new Date('2023-01-01T12:00:00Z'),
    createdAt: new Date('2023-01-01T08:00:00Z'),
  };

  it('should return character successfully', async () => {
    mockDatabaseService.getItem.mockResolvedValue(mockCharacter);

    const event = createMockEvent('test-user-id');
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toHaveProperty('character');
    
    const character = JSON.parse(result.body).character;
    expect(character.userId).toBe('test-user-id');
    expect(character.name).toBe('TestCharacter');
    expect(character.level).toBe(5);
    expect(character.experience).toBe(2500);
  });

  it('should return 400 if userId is missing', async () => {
    const event = createMockEvent();
    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toHaveProperty('error', 'userId is required');
  });

  it('should return 404 if character not found', async () => {
    mockDatabaseService.getItem.mockResolvedValue(null);

    const event = createMockEvent('non-existent-user-id');
    const result = await handler(event);

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toHaveProperty('error', 'Character not found');
  });

  it('should return 500 if database operation fails', async () => {
    mockDatabaseService.getItem.mockRejectedValue(new Error('Database error'));

    const event = createMockEvent('test-user-id');
    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toHaveProperty('error', 'Internal server error');
  });

  it('should call DatabaseService with correct parameters', async () => {
    mockDatabaseService.getItem.mockResolvedValue(mockCharacter);

    const event = createMockEvent('test-user-id');
    await handler(event);

    expect(mockDatabaseService.getItem).toHaveBeenCalledWith({
      TableName: expect.any(String),
      Key: { userId: 'test-user-id' },
    });
  });

  it('should return character with all required fields', async () => {
    mockDatabaseService.getItem.mockResolvedValue(mockCharacter);

    const event = createMockEvent('test-user-id');
    const result = await handler(event);

    const character = JSON.parse(result.body).character;
    
    // Check all required character fields
    expect(character).toHaveProperty('userId');
    expect(character).toHaveProperty('characterId');
    expect(character).toHaveProperty('name');
    expect(character).toHaveProperty('level');
    expect(character).toHaveProperty('experience');
    expect(character).toHaveProperty('currency');
    expect(character).toHaveProperty('stats');
    expect(character).toHaveProperty('specialization');
    expect(character).toHaveProperty('currentActivity');
    expect(character).toHaveProperty('lastActiveAt');
    expect(character).toHaveProperty('createdAt');
    
    // Check stats structure
    expect(character.stats).toHaveProperty('strength');
    expect(character.stats).toHaveProperty('dexterity');
    expect(character.stats).toHaveProperty('intelligence');
    expect(character.stats).toHaveProperty('vitality');
    expect(character.stats).toHaveProperty('craftingSkills');
    expect(character.stats).toHaveProperty('harvestingSkills');
    expect(character.stats).toHaveProperty('combatSkills');
    
    // Check specialization structure
    expect(character.specialization).toHaveProperty('tankProgress');
    expect(character.specialization).toHaveProperty('healerProgress');
    expect(character.specialization).toHaveProperty('dpsProgress');
    expect(character.specialization).toHaveProperty('primaryRole');
    expect(character.specialization).toHaveProperty('bonuses');
    
    // Check current activity structure
    expect(character.currentActivity).toHaveProperty('type');
    expect(character.currentActivity).toHaveProperty('startedAt');
    expect(character.currentActivity).toHaveProperty('progress');
    expect(character.currentActivity).toHaveProperty('rewards');
  });
});