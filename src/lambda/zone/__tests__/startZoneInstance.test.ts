/**
 * Tests for startZoneInstance Lambda function
 */

import { handler } from '../startZoneInstance';
import { DatabaseService } from '../../../services/databaseService';
import { APIGatewayProxyEvent } from 'aws-lambda';

// Mock DatabaseService
jest.mock('../../../services/databaseService');
const mockDatabaseService = DatabaseService as jest.Mocked<typeof DatabaseService>;

// Mock ZoneService
jest.mock('../../../services/zoneService');
import { ZoneService } from '../../../services/zoneService';
const mockZoneService = ZoneService as jest.Mocked<typeof ZoneService>;

describe('startZoneInstance Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockEvent = (body: any): APIGatewayProxyEvent => ({
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/api/zone/start',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: '',
  });

  it('should start a zone instance successfully', async () => {
    const mockParty = {
      partyId: 'test-party',
      leaderId: 'leader-1',
      name: 'Test Party',
      type: 'zone',
      visibility: 'public',
      members: [
        {
          userId: 'user-1',
          characterName: 'Char1',
          level: 10,
          role: 'tank',
          isReady: true,
          joinedAt: new Date()
        }
      ],
      maxMembers: 3,
      minLevel: 1,
      createdAt: new Date(),
      status: 'forming'
    };

    // Mock ZoneService methods
    mockZoneService.getAvailableZoneTypes.mockReturnValue(['steam-caverns']);
    mockZoneService.calculateDifficulty.mockReturnValue(3);
    mockZoneService.generateMonsters.mockReturnValue([
      {
        monsterId: 'monster-1',
        name: 'Steam Wraith',
        level: 10,
        health: 100,
        maxHealth: 100,
        stats: { attack: 15, defense: 10, speed: 12 },
        lootTable: [],
        steampunkTheme: { type: 'steam', description: 'A test monster' }
      }
    ]);

    mockDatabaseService.getItem.mockResolvedValueOnce(mockParty);
    mockDatabaseService.scan.mockResolvedValueOnce({ items: [], count: 0 });
    mockDatabaseService.putItem.mockResolvedValueOnce(undefined);
    mockDatabaseService.updateItem.mockResolvedValueOnce(undefined);

    const event = createMockEvent({ partyId: 'test-party' });
    const result = await handler(event);

    // Log the result for debugging
    if (result.statusCode !== 201) {
      console.log('Error result:', JSON.parse(result.body));
    }

    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body)).toHaveProperty('instance');
    expect(mockDatabaseService.putItem).toHaveBeenCalled();
    expect(mockDatabaseService.updateItem).toHaveBeenCalled();
  });

  it('should return 400 if partyId is missing', async () => {
    const event = createMockEvent({});
    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'partyId is required'
    });
  });

  it('should return 404 if party not found', async () => {
    mockDatabaseService.getItem.mockResolvedValueOnce(null);

    const event = createMockEvent({ partyId: 'non-existent' });
    const result = await handler(event);

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Party not found'
    });
  });

  it('should return 400 if party is not in forming state', async () => {
    const mockParty = {
      partyId: 'test-party',
      status: 'active',
      members: []
    };

    mockDatabaseService.getItem.mockResolvedValueOnce(mockParty);

    const event = createMockEvent({ partyId: 'test-party' });
    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Party is not in forming state'
    });
  });

  it('should return 400 if not all members are ready', async () => {
    const mockParty = {
      partyId: 'test-party',
      status: 'forming',
      members: [
        {
          userId: 'user-1',
          isReady: false
        }
      ]
    };

    mockDatabaseService.getItem.mockResolvedValueOnce(mockParty);

    const event = createMockEvent({ partyId: 'test-party' });
    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Not all party members are ready'
    });
  });

  it('should validate zone party size', async () => {
    const mockParty = {
      partyId: 'test-party',
      type: 'zone',
      status: 'forming',
      members: [
        { userId: 'user-1', isReady: true },
        { userId: 'user-2', isReady: true },
        { userId: 'user-3', isReady: true },
        { userId: 'user-4', isReady: true } // Too many for zone
      ]
    };

    mockDatabaseService.getItem.mockResolvedValueOnce(mockParty);

    const event = createMockEvent({ partyId: 'test-party' });
    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Zone parties must have 1-3 members'
    });
  });

  it('should validate dungeon party size', async () => {
    const mockParty = {
      partyId: 'test-party',
      type: 'dungeon',
      status: 'forming',
      members: [
        { userId: 'user-1', isReady: true },
        { userId: 'user-2', isReady: true },
        { userId: 'user-3', isReady: true } // Too few for dungeon
      ]
    };

    mockDatabaseService.getItem.mockResolvedValueOnce(mockParty);

    const event = createMockEvent({ partyId: 'test-party' });
    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Dungeon parties must have 5-8 members'
    });
  });

  it('should return 409 if party already has active instance', async () => {
    const mockParty = {
      partyId: 'test-party',
      type: 'zone',
      status: 'forming',
      members: [
        { userId: 'user-1', isReady: true }
      ]
    };

    mockDatabaseService.getItem.mockResolvedValueOnce(mockParty);
    mockDatabaseService.scan.mockResolvedValueOnce({ 
      items: [{ instanceId: 'existing-instance' }], 
      count: 1 
    });

    const event = createMockEvent({ partyId: 'test-party' });
    const result = await handler(event);

    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Party already has an active zone instance'
    });
  });

  it('should handle database errors', async () => {
    mockDatabaseService.getItem.mockRejectedValueOnce(new Error('Database error'));

    const event = createMockEvent({ partyId: 'test-party' });
    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Internal server error'
    });
  });

  it('should return 400 if request body is missing', async () => {
    const event = {
      ...createMockEvent({}),
      body: null
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Request body is required'
    });
  });
});