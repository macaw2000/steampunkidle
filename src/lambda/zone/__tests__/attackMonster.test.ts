/**
 * Tests for attackMonster Lambda function
 */

import { handler } from '../attackMonster';
import { DatabaseService } from '../../../services/databaseService';
import { ZoneService } from '../../../services/zoneService';
import { APIGatewayProxyEvent } from 'aws-lambda';

// Mock DatabaseService
jest.mock('../../../services/databaseService');
const mockDatabaseService = DatabaseService as jest.Mocked<typeof DatabaseService>;

// Mock ZoneService
jest.mock('../../../services/zoneService');
const mockZoneService = ZoneService as jest.Mocked<typeof ZoneService>;

describe('attackMonster Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockEvent = (body: any, instanceId: string = 'test-instance'): APIGatewayProxyEvent => ({
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: `/api/zone/instance/${instanceId}/attack`,
    pathParameters: { instanceId },
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: '',
  });

  const mockZoneInstance = {
    instanceId: 'test-instance',
    partyId: 'test-party',
    zoneType: 'steam-caverns',
    difficulty: 3,
    monsters: [
      {
        monsterId: 'monster-1',
        name: 'Steam Wraith',
        level: 10,
        health: 100,
        maxHealth: 100,
        stats: { attack: 15, defense: 10, speed: 12 },
        lootTable: [
          { itemId: 'steam-coins', dropChance: 1.0, quantity: 50 }
        ],
        steampunkTheme: { type: 'steam', description: 'A ghostly steam creature' }
      }
    ],
    rewards: [],
    startedAt: new Date(),
    status: 'active'
  };

  const mockCharacter = {
    userId: 'user-1',
    characterId: 'char-1',
    name: 'Test Character',
    level: 15,
    stats: { strength: 20 },
    specialization: { tankProgress: 50, healerProgress: 30, dpsProgress: 20 }
  };

  it('should attack monster successfully', async () => {
    mockDatabaseService.getItem
      .mockResolvedValueOnce(mockZoneInstance) // Get zone instance
      .mockResolvedValueOnce(mockCharacter);   // Get character

    mockZoneService.calculateDamage.mockReturnValue(25);
    mockDatabaseService.updateItem.mockResolvedValueOnce(undefined);

    const event = createMockEvent({
      monsterId: 'monster-1',
      userId: 'user-1'
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    
    const response = JSON.parse(result.body);
    expect(response).toHaveProperty('instance');
    expect(response).toHaveProperty('damage', 25);
    expect(response).toHaveProperty('monsterDefeated');
    expect(response.instance.monsters[0].health).toBe(75); // 100 - 25
  });

  it('should defeat monster and generate loot', async () => {
    const damagedInstance = {
      ...mockZoneInstance,
      monsters: [{
        ...mockZoneInstance.monsters[0],
        health: 20 // Low health, will be defeated
      }]
    };

    mockDatabaseService.getItem
      .mockResolvedValueOnce(damagedInstance)
      .mockResolvedValueOnce(mockCharacter);

    mockZoneService.calculateDamage.mockReturnValue(25); // More than remaining health
    mockDatabaseService.updateItem.mockResolvedValueOnce(undefined);

    const event = createMockEvent({
      monsterId: 'monster-1',
      userId: 'user-1'
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    
    const response = JSON.parse(result.body);
    expect(response.monsterDefeated).toBe(true);
    expect(response.rewards.length).toBeGreaterThan(0);
    expect(response.instance.monsters[0].health).toBe(0);
  });

  it('should complete instance when all monsters defeated', async () => {
    const singleMonsterInstance = {
      ...mockZoneInstance,
      monsters: [{
        ...mockZoneInstance.monsters[0],
        health: 10 // Will be defeated
      }]
    };

    const mockParty = {
      partyId: 'test-party',
      members: [{ userId: 'user-1' }, { userId: 'user-2' }]
    };

    mockDatabaseService.getItem
      .mockResolvedValueOnce(singleMonsterInstance) // Get zone instance
      .mockResolvedValueOnce(mockCharacter)         // Get character
      .mockResolvedValueOnce(mockParty);            // Get party for completion rewards

    mockZoneService.calculateDamage.mockReturnValue(15);
    mockZoneService.generateCompletionRewards.mockReturnValue([
      { type: 'experience', amount: 100, recipientId: 'user-1' },
      { type: 'currency', amount: 200, recipientId: 'user-1' }
    ]);

    mockDatabaseService.updateItem.mockResolvedValue(undefined);

    const event = createMockEvent({
      monsterId: 'monster-1',
      userId: 'user-1'
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    
    const response = JSON.parse(result.body);
    expect(response.allMonstersDefeated).toBe(true);
    expect(response.instance.status).toBe('completed');
    expect(mockZoneService.generateCompletionRewards).toHaveBeenCalled();
  });

  it('should return 400 if instanceId is missing', async () => {
    const event = createMockEvent({}, '');
    event.pathParameters = null;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'instanceId is required'
    });
  });

  it('should return 400 if request body is missing', async () => {
    const event = createMockEvent({});
    event.body = null;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Request body is required'
    });
  });

  it('should return 400 if monsterId or userId is missing', async () => {
    const event = createMockEvent({ monsterId: 'monster-1' }); // Missing userId

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'monsterId and userId are required'
    });
  });

  it('should return 404 if zone instance not found', async () => {
    mockDatabaseService.getItem.mockResolvedValueOnce(null);

    const event = createMockEvent({
      monsterId: 'monster-1',
      userId: 'user-1'
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Zone instance not found'
    });
  });

  it('should return 400 if zone instance is not active', async () => {
    const inactiveInstance = {
      ...mockZoneInstance,
      status: 'completed'
    };

    mockDatabaseService.getItem.mockResolvedValueOnce(inactiveInstance);

    const event = createMockEvent({
      monsterId: 'monster-1',
      userId: 'user-1'
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Zone instance is not active'
    });
  });

  it('should return 404 if character not found', async () => {
    mockDatabaseService.getItem
      .mockResolvedValueOnce(mockZoneInstance)
      .mockResolvedValueOnce(null); // Character not found

    const event = createMockEvent({
      monsterId: 'monster-1',
      userId: 'user-1'
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Character not found'
    });
  });

  it('should return 404 if monster not found', async () => {
    mockDatabaseService.getItem
      .mockResolvedValueOnce(mockZoneInstance)
      .mockResolvedValueOnce(mockCharacter);

    const event = createMockEvent({
      monsterId: 'non-existent-monster',
      userId: 'user-1'
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Monster not found in this instance'
    });
  });

  it('should return 400 if monster is already defeated', async () => {
    const defeatedMonsterInstance = {
      ...mockZoneInstance,
      monsters: [{
        ...mockZoneInstance.monsters[0],
        health: 0 // Already defeated
      }]
    };

    mockDatabaseService.getItem
      .mockResolvedValueOnce(defeatedMonsterInstance)
      .mockResolvedValueOnce(mockCharacter);

    const event = createMockEvent({
      monsterId: 'monster-1',
      userId: 'user-1'
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Monster is already defeated'
    });
  });

  it('should handle database errors', async () => {
    mockDatabaseService.getItem.mockRejectedValueOnce(new Error('Database error'));

    const event = createMockEvent({
      monsterId: 'monster-1',
      userId: 'user-1'
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Internal server error'
    });
  });
});