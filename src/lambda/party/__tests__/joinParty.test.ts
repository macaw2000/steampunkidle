/**
 * Tests for joinParty Lambda function
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../joinParty';
import { DatabaseService } from '../../../services/databaseService';
import { Party } from '../../../types/zone';
import { Character } from '../../../types/character';

// Mock DatabaseService
jest.mock('../../../services/databaseService');
const mockDatabaseService = DatabaseService as jest.Mocked<typeof DatabaseService>;

describe('joinParty Lambda', () => {
  const mockEvent = (partyId: string, body: any): APIGatewayProxyEvent => ({
    body: JSON.stringify(body),
    pathParameters: { partyId },
    queryStringParameters: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: `/api/party/${partyId}/join`,
    resource: '/api/party/{partyId}/join',
    requestContext: {} as any,
    stageVariables: null,
    multiValueQueryStringParameters: null,
  });

  const mockParty: Party = {
    partyId: 'party-1',
    leaderId: 'user-1',
    name: 'Test Party',
    type: 'zone',
    visibility: 'public',
    members: [
      {
        userId: 'user-1',
        characterName: 'Leader',
        level: 10,
        role: 'tank',
        isReady: false,
        joinedAt: new Date(),
      },
    ],
    maxMembers: 3,
    minLevel: 5,
    createdAt: new Date(),
    status: 'forming',
  };

  const mockCharacter: Character = {
    userId: 'user-2',
    characterId: 'char-2',
    name: 'TestCharacter',
    level: 8,
    experience: 800,
    currency: 300,
    stats: {
      strength: 10,
      dexterity: 15,
      intelligence: 12,
      vitality: 13,
      craftingSkills: { clockmaking: 3, engineering: 4, alchemy: 2, steamcraft: 3, level: 3, experience: 120 },
      harvestingSkills: { clockmaking: 2, engineering: 1, alchemy: 1, steamcraft: 2, level: 1, experience: 40 },
      combatSkills: { clockmaking: 6, engineering: 7, alchemy: 5, steamcraft: 6, level: 5, experience: 250 },
    },
    specialization: {
      tankProgress: 30,
      healerProgress: 20,
      dpsProgress: 80,
      primaryRole: 'dps',
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
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should join party successfully', async () => {
    const request = {
      userId: 'user-2',
      preferredRole: 'dps',
    };

    mockDatabaseService.getItem
      .mockResolvedValueOnce(mockParty)
      .mockResolvedValueOnce(mockCharacter);
    mockDatabaseService.scan.mockResolvedValueOnce({ items: [] });
    mockDatabaseService.updateItem.mockResolvedValueOnce(undefined);

    const result = await handler(mockEvent('party-1', request));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.party).toBeDefined();
    expect(body.party.members).toHaveLength(2);
    expect(body.party.members[1].userId).toBe('user-2');
    expect(body.party.members[1].role).toBe('dps');
  });

  it('should return 400 for missing partyId', async () => {
    const request = {
      userId: 'user-2',
      preferredRole: 'dps',
    };

    const event = mockEvent('party-1', request);
    event.pathParameters = null;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('partyId is required');
  });

  it('should return 400 for missing required fields', async () => {
    const request = {
      userId: 'user-2',
      // Missing preferredRole
    };

    const result = await handler(mockEvent('party-1', request));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('userId and preferredRole are required');
  });

  it('should return 404 for non-existent party', async () => {
    const request = {
      userId: 'user-2',
      preferredRole: 'dps',
    };

    mockDatabaseService.getItem.mockResolvedValueOnce(null);

    const result = await handler(mockEvent('non-existent-party', request));

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('Party not found');
  });

  it('should return 404 for non-existent character', async () => {
    const request = {
      userId: 'non-existent-user',
      preferredRole: 'dps',
    };

    mockDatabaseService.getItem
      .mockResolvedValueOnce(mockParty)
      .mockResolvedValueOnce(null);

    const result = await handler(mockEvent('party-1', request));

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('Character not found');
  });

  it('should return 409 if user is already in the party', async () => {
    const request = {
      userId: 'user-1', // Same as leader
      preferredRole: 'dps',
    };

    mockDatabaseService.getItem
      .mockResolvedValueOnce(mockParty)
      .mockResolvedValueOnce(mockCharacter);

    const result = await handler(mockEvent('party-1', request));

    expect(result.statusCode).toBe(409);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('User is already in this party');
  });

  it('should return 409 if user is in another party', async () => {
    const request = {
      userId: 'user-2',
      preferredRole: 'dps',
    };

    mockDatabaseService.getItem
      .mockResolvedValueOnce(mockParty)
      .mockResolvedValueOnce(mockCharacter);
    mockDatabaseService.scan.mockResolvedValueOnce({ 
      items: [{ partyId: 'other-party', status: 'forming' }] 
    });

    const result = await handler(mockEvent('party-1', request));

    expect(result.statusCode).toBe(409);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('User is already in another party');
  });

  it('should return 400 if party is not accepting members', async () => {
    const request = {
      userId: 'user-2',
      preferredRole: 'dps',
    };

    const activeParty = { ...mockParty, status: 'active' as const };
    mockDatabaseService.getItem
      .mockResolvedValueOnce(activeParty)
      .mockResolvedValueOnce(mockCharacter);
    mockDatabaseService.scan.mockResolvedValueOnce({ items: [] });

    const result = await handler(mockEvent('party-1', request));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('Party is no longer accepting members');
  });

  it('should return 400 if party is full', async () => {
    const request = {
      userId: 'user-2',
      preferredRole: 'dps',
    };

    const fullParty = {
      ...mockParty,
      members: [
        mockParty.members[0],
        { userId: 'user-3', characterName: 'Member2', level: 8, role: 'healer' as const, isReady: false, joinedAt: new Date() },
        { userId: 'user-4', characterName: 'Member3', level: 9, role: 'dps' as const, isReady: false, joinedAt: new Date() },
      ],
    };

    mockDatabaseService.getItem
      .mockResolvedValueOnce(fullParty)
      .mockResolvedValueOnce(mockCharacter);
    mockDatabaseService.scan.mockResolvedValueOnce({ items: [] });

    const result = await handler(mockEvent('party-1', request));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('Party is full');
  });

  it('should return 400 if character level is too low', async () => {
    const request = {
      userId: 'user-2',
      preferredRole: 'dps',
    };

    const lowLevelCharacter = { ...mockCharacter, level: 3 };
    mockDatabaseService.getItem
      .mockResolvedValueOnce(mockParty)
      .mockResolvedValueOnce(lowLevelCharacter);
    mockDatabaseService.scan.mockResolvedValueOnce({ items: [] });

    const result = await handler(mockEvent('party-1', request));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('Minimum level required: 5');
  });

  it('should return 400 if character level is too high', async () => {
    const request = {
      userId: 'user-2',
      preferredRole: 'dps',
    };

    const highLevelParty = { ...mockParty, maxLevel: 10 };
    const highLevelCharacter = { ...mockCharacter, level: 15 };
    
    mockDatabaseService.getItem
      .mockResolvedValueOnce(highLevelParty)
      .mockResolvedValueOnce(highLevelCharacter);
    mockDatabaseService.scan.mockResolvedValueOnce({ items: [] });

    const result = await handler(mockEvent('party-1', request));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('Maximum level allowed: 10');
  });

  it('should return 403 for guild party without membership', async () => {
    const request = {
      userId: 'user-2',
      preferredRole: 'dps',
    };

    const guildParty = { ...mockParty, visibility: 'guild' as const, guildId: 'guild-1' };
    mockDatabaseService.getItem
      .mockResolvedValueOnce(guildParty)
      .mockResolvedValueOnce(mockCharacter)
      .mockResolvedValueOnce(null); // No guild membership
    mockDatabaseService.scan.mockResolvedValueOnce({ items: [] });

    const result = await handler(mockEvent('party-1', request));

    expect(result.statusCode).toBe(403);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('This party is restricted to guild members');
  });

  it('should return 403 for private party', async () => {
    const request = {
      userId: 'user-2',
      preferredRole: 'dps',
    };

    const privateParty = { ...mockParty, visibility: 'private' as const };
    mockDatabaseService.getItem
      .mockResolvedValueOnce(privateParty)
      .mockResolvedValueOnce(mockCharacter);
    mockDatabaseService.scan.mockResolvedValueOnce({ items: [] });

    const result = await handler(mockEvent('party-1', request));

    expect(result.statusCode).toBe(403);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('This party is private');
  });
});