/**
 * Tests for respondToInvitation Lambda function
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../respondToInvitation';
import { DatabaseService } from '../../../services/databaseService';
import { Guild, GuildInvitation } from '../../../types/guild';
import { Character } from '../../../types/character';

// Mock the DatabaseService
jest.mock('../../../services/databaseService');
const mockDatabaseService = DatabaseService as jest.Mocked<typeof DatabaseService>;

describe('respondToInvitation Lambda function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockEvent = (invitationId: string, body: any, userId?: string): APIGatewayProxyEvent => ({
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: `/invitation/${invitationId}`,
    pathParameters: { invitationId },
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      authorizer: userId ? { userId } : undefined,
    } as any,
    resource: '',
  });

  const mockInvitation: GuildInvitation = {
    invitationId: 'invitation-123',
    guildId: 'guild-123',
    inviterId: 'user-123',
    inviteeId: 'user-456',
    status: 'pending',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  };

  const mockGuild: Guild = {
    guildId: 'guild-123',
    name: 'Test Guild',
    description: 'A test guild',
    leaderId: 'user-123',
    members: [],
    settings: {
      isPublic: true,
      requireApproval: false,
      maxMembers: 50,
      description: '',
      allowedActivities: ['crafting', 'harvesting', 'combat'],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    memberCount: 2,
    level: 1,
    experience: 0,
  };

  const mockCharacter: Character = {
    userId: 'user-456',
    characterId: 'char-456',
    name: 'TestCharacter',
    level: 5,
    experience: 500,
    currency: 100,
    stats: {} as any,
    specialization: {} as any,
    currentActivity: {} as any,
    lastActiveAt: new Date(),
    createdAt: new Date(),
  };

  it('should accept invitation successfully', async () => {
    const requestBody = { response: 'accepted' };

    mockDatabaseService.getItem
      .mockResolvedValueOnce(mockInvitation) // Invitation exists
      .mockResolvedValueOnce(mockGuild) // Guild exists
      .mockResolvedValueOnce(mockCharacter); // Character exists

    mockDatabaseService.updateItem.mockResolvedValueOnce(undefined);

    mockDatabaseService.query
      .mockResolvedValueOnce({ items: [], count: 0, lastEvaluatedKey: undefined }) // No existing membership
      .mockResolvedValueOnce({ items: [], count: 2, lastEvaluatedKey: undefined }); // Current member count

    mockDatabaseService.transactWrite.mockResolvedValueOnce(undefined);

    const result = await handler(mockEvent('invitation-123', requestBody, 'user-456'));

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.message).toBe('Invitation accepted successfully');
    expect(responseBody).toHaveProperty('membership');
    expect(responseBody).toHaveProperty('guildName', 'Test Guild');
  });

  it('should decline invitation successfully', async () => {
    const requestBody = { response: 'declined' };

    mockDatabaseService.getItem.mockResolvedValueOnce(mockInvitation);
    mockDatabaseService.updateItem.mockResolvedValueOnce(undefined);

    const result = await handler(mockEvent('invitation-123', requestBody, 'user-456'));

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.message).toBe('Invitation declined successfully');
  });

  it('should return 400 if invitation ID is missing', async () => {
    const event = mockEvent('', { response: 'accepted' }, 'user-456');
    event.pathParameters = null;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Invitation ID is required',
    });
  });

  it('should return 401 if user is not authenticated', async () => {
    const result = await handler(mockEvent('invitation-123', { response: 'accepted' }));

    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body)).toEqual({
      error: 'User authentication required',
    });
  });

  it('should return 400 if request body is missing', async () => {
    const event = mockEvent('invitation-123', { response: 'accepted' }, 'user-456');
    event.body = null;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Request body is required',
    });
  });

  it('should return 400 if response is invalid', async () => {
    const result = await handler(mockEvent('invitation-123', { response: 'invalid' }, 'user-456'));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Response must be "accepted" or "declined"',
    });
  });

  it('should return 404 if invitation not found', async () => {
    mockDatabaseService.getItem.mockResolvedValueOnce(null);

    const result = await handler(mockEvent('invitation-123', { response: 'accepted' }, 'user-456'));

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Invitation not found',
    });
  });

  it('should return 403 if user is not the invitee', async () => {
    mockDatabaseService.getItem.mockResolvedValueOnce(mockInvitation);

    const result = await handler(mockEvent('invitation-123', { response: 'accepted' }, 'wrong-user'));

    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body)).toEqual({
      error: 'User is not the recipient of this invitation',
    });
  });

  it('should return 409 if invitation has already been responded to', async () => {
    const respondedInvitation = { ...mockInvitation, status: 'accepted' as const };
    mockDatabaseService.getItem.mockResolvedValueOnce(respondedInvitation);

    const result = await handler(mockEvent('invitation-123', { response: 'accepted' }, 'user-456'));

    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Invitation has already been responded to',
    });
  });

  it('should return 409 if invitation has expired', async () => {
    const expiredInvitation = {
      ...mockInvitation,
      expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
    };
    mockDatabaseService.getItem.mockResolvedValueOnce(expiredInvitation);

    const result = await handler(mockEvent('invitation-123', { response: 'accepted' }, 'user-456'));

    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Invitation has expired',
    });
  });

  it('should return 404 if guild no longer exists when accepting', async () => {
    const requestBody = { response: 'accepted' };

    mockDatabaseService.getItem
      .mockResolvedValueOnce(mockInvitation) // Invitation exists
      .mockResolvedValueOnce(null); // Guild doesn't exist

    mockDatabaseService.updateItem.mockResolvedValueOnce(undefined);

    const result = await handler(mockEvent('invitation-123', requestBody, 'user-456'));

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Guild no longer exists',
    });
  });

  it('should return 409 if user is already in a guild when accepting', async () => {
    const requestBody = { response: 'accepted' };

    mockDatabaseService.getItem
      .mockResolvedValueOnce(mockInvitation) // Invitation exists
      .mockResolvedValueOnce(mockGuild); // Guild exists

    mockDatabaseService.updateItem.mockResolvedValueOnce(undefined);

    mockDatabaseService.query.mockResolvedValueOnce({
      items: [{ guildId: 'other-guild', userId: 'user-456' }],
      count: 1,
      lastEvaluatedKey: undefined,
    }); // User already in guild

    const result = await handler(mockEvent('invitation-123', requestBody, 'user-456'));

    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body)).toEqual({
      error: 'User is already in a guild',
    });
  });

  it('should return 500 on database error', async () => {
    mockDatabaseService.getItem.mockRejectedValueOnce(new Error('Database error'));

    const result = await handler(mockEvent('invitation-123', { response: 'accepted' }, 'user-456'));

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Internal server error',
    });
  });
});