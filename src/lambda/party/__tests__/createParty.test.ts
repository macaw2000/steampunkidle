/**
 * Tests for createParty Lambda function
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../createParty';
import { DatabaseService } from '../../../services/databaseService';
import { Character } from '../../../types/character';

// Mock DatabaseService
jest.mock('../../../services/databaseService');
const mockDatabaseService = DatabaseService as jest.Mocked<typeof DatabaseService>;

describe('createParty Lambda', () => {
  const mockEvent = (body: any): APIGatewayProxyEvent => ({
    body: JSON.stringify(body),
    pathParameters: null,
    queryStringParameters: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/api/party',
    resource: '/api/party',
    requestContext: {} as any,
    stageVariables: null,
    multiValueQueryStringParameters: null,
  });

  const mockCharacter: Character = {
    userId: 'user-1',
    characterId: 'char-1',
    name: 'TestCharacter',
    level: 10,
    experience: 1000,
    currency: 500,
    stats: {
      strength: 15,
      dexterity: 12,
      intelligence: 8,
      vitality: 20,
      craftingSkills: { clockmaking: 5, engineering: 3, alchemy: 2, steamcraft: 4, level: 3, experience: 150 },
      harvestingSkills: { mining: 2, foraging: 1, salvaging: 1, crystal_extraction: 2, level: 1, experience: 50 },
      combatSkills: { melee: 8, ranged: 6, defense: 4, tactics: 7, level: 6, experience: 300 },
    },
    specialization: {
      tankProgress: 75,
      healerProgress: 25,
      dpsProgress: 50,
      primaryRole: 'tank',
      secondaryRole: null,
      bonuses: [],
    },
    currentActivity: {
      type: 'combat',
      startedAt: new Date(),
      progress: 0,
      rewards: [],
    },
    lastActiveAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a zone party successfully', async () => {
    const request = {
      leaderId: 'user-1',
      name: 'Test Zone Party',
      type: 'zone',
      visibility: 'public',
      maxMembers: 3,
      minLevel: 5,
    };

    mockDatabaseService.getItem.mockResolvedValueOnce(mockCharacter);
    mockDatabaseService.scan.mockResolvedValueOnce({ items: [], count: 0 });
    mockDatabaseService.putItem.mockResolvedValueOnce(undefined);

    const result = await handler(mockEvent(request));

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.party).toBeDefined();
    expect(body.party.name).toBe('Test Zone Party');
    expect(body.party.type).toBe('zone');
    expect(body.party.members).toHaveLength(1);
    expect(body.party.members[0].userId).toBe('user-1');
    expect(body.party.members[0].role).toBe('tank'); // Based on specialization
  });

  it('should create a dungeon party successfully', async () => {
    const request = {
      leaderId: 'user-1',
      name: 'Test Dungeon Party',
      type: 'dungeon',
      visibility: 'public',
      maxMembers: 5,
      minLevel: 10,
    };

    mockDatabaseService.getItem.mockResolvedValueOnce(mockCharacter);
    mockDatabaseService.scan.mockResolvedValueOnce({ items: [], count: 0 });
    mockDatabaseService.putItem.mockResolvedValueOnce(undefined);

    const result = await handler(mockEvent(request));

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.party.type).toBe('dungeon');
    expect(body.party.maxMembers).toBe(5);
  });

  it('should create a guild party successfully', async () => {
    const request = {
      leaderId: 'user-1',
      name: 'Guild Party',
      type: 'zone',
      visibility: 'guild',
      maxMembers: 3,
      minLevel: 5,
      guildId: 'guild-1',
    };

    mockDatabaseService.getItem
      .mockResolvedValueOnce(mockCharacter)
      .mockResolvedValueOnce({ userId: 'user-1', guildId: 'guild-1' }); // Guild membership
    mockDatabaseService.scan.mockResolvedValueOnce({ items: [], count: 0 });
    mockDatabaseService.putItem.mockResolvedValueOnce(undefined);

    const result = await handler(mockEvent(request));

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.party.visibility).toBe('guild');
    expect(body.party.guildId).toBe('guild-1');
  });

  it('should return 400 for missing required fields', async () => {
    const request = {
      name: 'Test Party',
      // Missing leaderId and type
    };

    const result = await handler(mockEvent(request));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('leaderId, name, and type are required');
  });

  it('should return 400 for invalid zone max members', async () => {
    const request = {
      leaderId: 'user-1',
      name: 'Test Party',
      type: 'zone',
      visibility: 'public',
      maxMembers: 5, // Invalid for zone (should be 1-3)
      minLevel: 5,
    };

    const result = await handler(mockEvent(request));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('Zone parties must have 1-3 max members');
  });

  it('should return 400 for invalid dungeon max members', async () => {
    const request = {
      leaderId: 'user-1',
      name: 'Test Party',
      type: 'dungeon',
      visibility: 'public',
      maxMembers: 3, // Invalid for dungeon (should be 5-8)
      minLevel: 5,
    };

    const result = await handler(mockEvent(request));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('Dungeon parties must have 5-8 max members');
  });

  it('should return 404 for non-existent leader', async () => {
    const request = {
      leaderId: 'non-existent-user',
      name: 'Test Party',
      type: 'zone',
      visibility: 'public',
      maxMembers: 3,
      minLevel: 5,
    };

    mockDatabaseService.getItem.mockResolvedValueOnce(null);

    const result = await handler(mockEvent(request));

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('Leader character not found');
  });

  it('should return 409 if leader is already in a party', async () => {
    const request = {
      leaderId: 'user-1',
      name: 'Test Party',
      type: 'zone',
      visibility: 'public',
      maxMembers: 3,
      minLevel: 5,
    };

    mockDatabaseService.getItem.mockResolvedValueOnce(mockCharacter);
    mockDatabaseService.scan.mockResolvedValueOnce({ 
      items: [{ partyId: 'existing-party', status: 'forming' }],
      count: 1
    });

    const result = await handler(mockEvent(request));

    expect(result.statusCode).toBe(409);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('Leader is already in a party');
  });

  it('should return 400 for guild visibility without guildId', async () => {
    const request = {
      leaderId: 'user-1',
      name: 'Test Party',
      type: 'zone',
      visibility: 'guild',
      maxMembers: 3,
      minLevel: 5,
      // Missing guildId
    };

    mockDatabaseService.getItem.mockResolvedValueOnce(mockCharacter);
    mockDatabaseService.scan.mockResolvedValueOnce({ items: [], count: 0 });

    const result = await handler(mockEvent(request));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('guildId is required for guild visibility');
  });

  it('should return 403 if leader is not in the specified guild', async () => {
    const request = {
      leaderId: 'user-1',
      name: 'Test Party',
      type: 'zone',
      visibility: 'guild',
      maxMembers: 3,
      minLevel: 5,
      guildId: 'guild-1',
    };

    mockDatabaseService.getItem
      .mockResolvedValueOnce(mockCharacter)
      .mockResolvedValueOnce(null); // No guild membership
    mockDatabaseService.scan.mockResolvedValueOnce({ items: [], count: 0 });

    const result = await handler(mockEvent(request));

    expect(result.statusCode).toBe(403);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('Leader is not a member of the specified guild');
  });

  it('should return 400 for missing request body', async () => {
    const event = mockEvent({});
    event.body = null;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('Request body is required');
  });
});