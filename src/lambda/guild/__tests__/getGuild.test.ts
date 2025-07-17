/**
 * Tests for getGuild Lambda function
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../getGuild';
import { DatabaseService } from '../../../services/databaseService';
import { Guild, GuildMember } from '../../../types/guild';

// Mock the DatabaseService
jest.mock('../../../services/databaseService');
const mockDatabaseService = DatabaseService as jest.Mocked<typeof DatabaseService>;

describe('getGuild Lambda function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockEvent = (guildId?: string): APIGatewayProxyEvent => ({
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: `/guild/${guildId}`,
    pathParameters: guildId ? { guildId } : null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as any,
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

  const mockMembers: GuildMember[] = [
    {
      userId: 'user-123',
      characterName: 'Leader',
      role: 'leader',
      joinedAt: new Date(),
      permissions: ['invite', 'kick', 'promote', 'demote', 'edit_settings', 'manage_events'],
      lastActiveAt: new Date(),
    },
    {
      userId: 'user-456',
      characterName: 'Member',
      role: 'member',
      joinedAt: new Date(),
      permissions: [],
      lastActiveAt: new Date(),
    },
  ];

  it('should get guild successfully', async () => {
    mockDatabaseService.getItem.mockResolvedValueOnce(mockGuild);
    mockDatabaseService.query.mockResolvedValueOnce({
      items: mockMembers,
      count: 2,
      lastEvaluatedKey: undefined,
    });

    const result = await handler(mockEvent('guild-123'));

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body);
    expect(responseBody).toHaveProperty('guild');
    expect(responseBody.guild.guildId).toBe('guild-123');
    expect(responseBody.guild.members).toHaveLength(2);
    expect(responseBody.guild.memberCount).toBe(2);
  });

  it('should return 400 if guild ID is missing', async () => {
    const result = await handler(mockEvent());

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Guild ID is required',
    });
  });

  it('should return 404 if guild not found', async () => {
    mockDatabaseService.getItem.mockResolvedValueOnce(null);

    const result = await handler(mockEvent('nonexistent-guild'));

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Guild not found',
    });
  });

  it('should return guild with empty members list if no members found', async () => {
    mockDatabaseService.getItem.mockResolvedValueOnce(mockGuild);
    mockDatabaseService.query.mockResolvedValueOnce({
      items: [],
      count: 0,
      lastEvaluatedKey: undefined,
    });

    const result = await handler(mockEvent('guild-123'));

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.guild.members).toHaveLength(0);
    expect(responseBody.guild.memberCount).toBe(0);
  });

  it('should return 500 on database error', async () => {
    mockDatabaseService.getItem.mockRejectedValueOnce(new Error('Database error'));

    const result = await handler(mockEvent('guild-123'));

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Internal server error',
    });
  });
});