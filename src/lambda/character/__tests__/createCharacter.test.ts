/**
 * Tests for createCharacter Lambda function
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../createCharacter';
import { DatabaseService } from '../../../services/databaseService';

// Mock the DatabaseService
jest.mock('../../../services/databaseService');
const mockDatabaseService = DatabaseService as jest.Mocked<typeof DatabaseService>;

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-character-id'),
}));

describe('createCharacter Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockEvent = (body: any): APIGatewayProxyEvent => ({
    body: JSON.stringify(body),
    pathParameters: null,
    queryStringParameters: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/character',
    resource: '/character',
    requestContext: {} as any,
    stageVariables: null,
    multiValueQueryStringParameters: null,
  });

  it('should create a character successfully', async () => {
    const requestBody = {
      userId: 'test-user-id',
      name: 'TestCharacter',
    };

    mockDatabaseService.getItem.mockResolvedValue(null); // No existing character
    mockDatabaseService.putItem.mockResolvedValue(undefined);

    const event = createMockEvent(requestBody);
    const result = await handler(event);

    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body)).toHaveProperty('character');
    
    const character = JSON.parse(result.body).character;
    expect(character.name).toBe('TestCharacter');
    expect(character.userId).toBe('test-user-id');
    expect(character.level).toBe(1);
    expect(character.experience).toBe(0);
    expect(character.currency).toBe(100);
    expect(character.stats).toBeDefined();
    expect(character.specialization).toBeDefined();
    expect(character.currentActivity).toBeDefined();
  });

  it('should return 400 if request body is missing', async () => {
    const event = {
      ...createMockEvent({}),
      body: null,
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toHaveProperty('error', 'Request body is required');
  });

  it('should return 400 if userId is missing', async () => {
    const requestBody = {
      name: 'TestCharacter',
    };

    const event = createMockEvent(requestBody);
    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toHaveProperty('error', 'userId and name are required');
  });

  it('should return 400 if name is missing', async () => {
    const requestBody = {
      userId: 'test-user-id',
    };

    const event = createMockEvent(requestBody);
    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toHaveProperty('error', 'userId and name are required');
  });

  it('should return 400 if name is too short', async () => {
    const requestBody = {
      userId: 'test-user-id',
      name: 'ab',
    };

    const event = createMockEvent(requestBody);
    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toHaveProperty('error', 'Character name must be between 3 and 20 characters');
  });

  it('should return 400 if name is too long', async () => {
    const requestBody = {
      userId: 'test-user-id',
      name: 'a'.repeat(21),
    };

    const event = createMockEvent(requestBody);
    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toHaveProperty('error', 'Character name must be between 3 and 20 characters');
  });

  it('should return 409 if user already has a character', async () => {
    const requestBody = {
      userId: 'test-user-id',
      name: 'TestCharacter',
    };

    const existingCharacter = {
      userId: 'test-user-id',
      characterId: 'existing-character-id',
      name: 'ExistingCharacter',
    };

    mockDatabaseService.getItem.mockResolvedValue(existingCharacter);

    const event = createMockEvent(requestBody);
    const result = await handler(event);

    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body)).toHaveProperty('error', 'User already has a character');
  });

  it('should return 500 if database operation fails', async () => {
    const requestBody = {
      userId: 'test-user-id',
      name: 'TestCharacter',
    };

    mockDatabaseService.getItem.mockResolvedValue(null);
    mockDatabaseService.putItem.mockRejectedValue(new Error('Database error'));

    const event = createMockEvent(requestBody);
    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toHaveProperty('error', 'Internal server error');
  });

  it('should create character with correct default values', async () => {
    const requestBody = {
      userId: 'test-user-id',
      name: 'TestCharacter',
    };

    mockDatabaseService.getItem.mockResolvedValue(null);
    mockDatabaseService.putItem.mockResolvedValue(undefined);

    const event = createMockEvent(requestBody);
    const result = await handler(event);

    const character = JSON.parse(result.body).character;
    
    // Check default stats
    expect(character.stats.strength).toBe(10);
    expect(character.stats.dexterity).toBe(10);
    expect(character.stats.intelligence).toBe(10);
    expect(character.stats.vitality).toBe(10);
    
    // Check default skills
    expect(character.stats.craftingSkills.clockmaking).toBe(1);
    expect(character.stats.craftingSkills.engineering).toBe(1);
    expect(character.stats.craftingSkills.alchemy).toBe(1);
    expect(character.stats.craftingSkills.steamcraft).toBe(1);
    expect(character.stats.craftingSkills.level).toBe(1);
    expect(character.stats.craftingSkills.experience).toBe(0);
    
    // Check default specialization
    expect(character.specialization.tankProgress).toBe(0);
    expect(character.specialization.healerProgress).toBe(0);
    expect(character.specialization.dpsProgress).toBe(0);
    expect(character.specialization.primaryRole).toBeNull();
    expect(character.specialization.bonuses).toEqual([]);
    
    // Check default activity
    expect(character.currentActivity.type).toBe('crafting');
    expect(character.currentActivity.progress).toBe(0);
    expect(character.currentActivity.rewards).toEqual([]);
  });
});