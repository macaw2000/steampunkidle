/**
 * Tests for inviteToGuild Lambda function
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../inviteToGuild';
import { DatabaseService } from '../../../services/databaseService';
import { Guild, GuildMember } from '../../../types/guild';
import { Character } from '../../../types/character';

// Mock the DatabaseService
jest.mock('../../../services/databaseService');
const mockDatabaseService = DatabaseService as jest.Mocked<typeof DatabaseService>;

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-invitation-id'),
}));

describe('inviteToGuild Lambda function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockEvent = (guildId: string, body: any, userId?: string): APIGatewayProxyEvent => ({
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: `/guild/${guildId}/invite`,
    pathParameters: { guildId },
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      authorizer: userId ? { userId } : undefined,
    } as any,
    resource: '',
  });

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

  const mockInviterMembership: GuildMember = {
    userId: 'user-123',
    characterName: 'Inviter',
    role: 'leader',
    joinedAt: new Date(),
    permissions: ['invite', 'kick', 'promote', 'demote', 'edit_settings', 'manage_events'],
    lastActiveAt: new Date(),
  };

  const mockInviteeCharacter: Character = {
    userId: 'user-456',
    characterId: 'char-456',
    name: 'InviteeCharacter',
    level: 5,
    experience: 500,
    currency: 100,
    stats: {} as any,
    specialization: {} as any,
    currentActivity: {} as any,
    lastActiveAt: new Date(),
    createdAt: new Date(),
  };

  it('should send invitation successfully', async () => {
    const requestBody = { inviteeId: 'user-456' };

    mockDatabaseService.getItem
      .mockResolvedValueOnce(mockGuild) // Guild exists
      .mockResolvedValueOnce(mockInviterMembership) // Inviter membership
      .mockResolvedValueOnce(mockInviteeCharacter); // Invitee character

    mockDatabaseService.query
      .mockResolvedValueOnce({ items: [], count: 0, lastEvaluatedKey: undefined }) // No existing membership
      .mockResolvedValueOnce({ items: [], count: 0, lastEvaluatedKey: undefined }); // Current member count

    mockDatabaseService.scan.mockResolvedValueOnce({ items: [], count: 0, lastEvaluatedKey: undefined }); // No existing invitation

    mockDatabaseService.putItem.mockResolvedValueOnce(undefined);

    const result = await handler(mockEvent('guild-123', requestBody, 'user-123'));

    expect(result.statusCode).toBe(201);
    const responseBody = JSON.parse(result.body);
    expect(responseBody).toHaveProperty('invitation');
    expect(responseBody).toHaveProperty('inviteeCharacterName', 'InviteeCharacter');
    expect(responseBody).toHaveProperty('guildName', 'Test Guild');
  });

  it('should return 400 if guild ID is missing', async () => {
    const event = mockEvent('', { inviteeId: 'user-456' }, 'user-123');
    event.pathParameters = null;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Guild ID is required',
    });
  });

  it('should return 401 if user is not authenticated', async () => {
    const result = await handler(mockEvent('guild-123', { inviteeId: 'user-456' }));

    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body)).toEqual({
      error: 'User authentication required',
    });
  });

  it('should return 400 if request body is missing', async () => {
    const event = mockEvent('guild-123', { inviteeId: 'user-456' }, 'user-123');
    event.body = null;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Request body is required',
    });
  });

  it('should return 400 if invitee ID is missing', async () => {
    const result = await handler(mockEvent('guild-123', {}, 'user-123'));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Invitee ID is required',
    });
  });

  it('should return 404 if guild not found', async () => {
    mockDatabaseService.getItem.mockResolvedValueOnce(null);

    const result = await handler(mockEvent('guild-123', { inviteeId: 'user-456' }, 'user-123'));

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Guild not found',
    });
  });

  it('should return 403 if inviter is not a guild member', async () => {
    mockDatabaseService.getItem
      .mockResolvedValueOnce(mockGuild) // Guild exists
      .mockResolvedValueOnce(null); // Inviter not a member

    const result = await handler(mockEvent('guild-123', { inviteeId: 'user-456' }, 'user-123'));

    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body)).toEqual({
      error: 'User is not a member of this guild',
    });
  });

  it('should return 403 if inviter does not have invite permission', async () => {
    const memberWithoutPermission = {
      ...mockInviterMembership,
      permissions: [], // No invite permission
    };

    mockDatabaseService.getItem
      .mockResolvedValueOnce(mockGuild) // Guild exists
      .mockResolvedValueOnce(memberWithoutPermission); // Inviter without permission

    const result = await handler(mockEvent('guild-123', { inviteeId: 'user-456' }, 'user-123'));

    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body)).toEqual({
      error: 'User does not have permission to invite members',
    });
  });

  it('should return 404 if invitee character not found', async () => {
    mockDatabaseService.getItem
      .mockResolvedValueOnce(mockGuild) // Guild exists
      .mockResolvedValueOnce(mockInviterMembership) // Inviter membership
      .mockResolvedValueOnce(null); // Invitee character not found

    const result = await handler(mockEvent('guild-123', { inviteeId: 'user-456' }, 'user-123'));

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Invitee character not found',
    });
  });

  it('should return 409 if invitee is already in a guild', async () => {
    mockDatabaseService.getItem
      .mockResolvedValueOnce(mockGuild) // Guild exists
      .mockResolvedValueOnce(mockInviterMembership) // Inviter membership
      .mockResolvedValueOnce(mockInviteeCharacter); // Invitee character

    mockDatabaseService.query.mockResolvedValueOnce({
      items: [{ guildId: 'other-guild', userId: 'user-456' }],
      count: 1,
      lastEvaluatedKey: undefined,
    }); // Existing membership

    const result = await handler(mockEvent('guild-123', { inviteeId: 'user-456' }, 'user-123'));

    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body)).toEqual({
      error: 'User is already in a guild',
    });
  });

  it('should return 409 if there is already a pending invitation', async () => {
    mockDatabaseService.getItem
      .mockResolvedValueOnce(mockGuild) // Guild exists
      .mockResolvedValueOnce(mockInviterMembership) // Inviter membership
      .mockResolvedValueOnce(mockInviteeCharacter); // Invitee character

    mockDatabaseService.query.mockResolvedValueOnce({ items: [], count: 0, lastEvaluatedKey: undefined }); // No existing membership

    mockDatabaseService.scan.mockResolvedValueOnce({
      items: [{ invitationId: 'existing-invitation', status: 'pending' }],
      count: 1,
      lastEvaluatedKey: undefined,
    }); // Existing invitation

    const result = await handler(mockEvent('guild-123', { inviteeId: 'user-456' }, 'user-123'));

    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body)).toEqual({
      error: 'User already has a pending invitation to this guild',
    });
  });

  it('should return 409 if guild is at maximum capacity', async () => {
    const fullGuild = { ...mockGuild, settings: { ...mockGuild.settings, maxMembers: 2 } };

    mockDatabaseService.getItem
      .mockResolvedValueOnce(fullGuild) // Guild exists
      .mockResolvedValueOnce(mockInviterMembership) // Inviter membership
      .mockResolvedValueOnce(mockInviteeCharacter); // Invitee character

    mockDatabaseService.query
      .mockResolvedValueOnce({ items: [], count: 0, lastEvaluatedKey: undefined }) // No existing membership
      .mockResolvedValueOnce({ items: [], count: 2, lastEvaluatedKey: undefined }); // Guild at capacity

    mockDatabaseService.scan.mockResolvedValueOnce({ items: [], count: 0, lastEvaluatedKey: undefined }); // No existing invitation

    const result = await handler(mockEvent('guild-123', { inviteeId: 'user-456' }, 'user-123'));

    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Guild is at maximum capacity',
    });
  });

  it('should return 500 on database error', async () => {
    mockDatabaseService.getItem.mockRejectedValueOnce(new Error('Database error'));

    const result = await handler(mockEvent('guild-123', { inviteeId: 'user-456' }, 'user-123'));

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Internal server error',
    });
  });
});