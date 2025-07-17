/**
 * Tests for createGuild Lambda function
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../createGuild';
import { DatabaseService } from '../../../services/databaseService';
import { Character } from '../../../types/character';
import { Guild, GuildMember } from '../../../types/guild';

// Mock the DatabaseService
jest.mock('../../../services/databaseService');
const mockDatabaseService = DatabaseService as jest.Mocked<typeof DatabaseService>;

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-guild-id'),
}));

describe('createGuild Lambda function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockEvent = (body: any): APIGatewayProxyEvent => ({
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/guild',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: '',
  });

  const mockCharacter: Character = {
    userId: 'user-123',
    characterId: 'char-123',
    name: 'TestCharacter',
    level: 10,
    experience: 1000,
    currency: 500,
    stats: {} as any,
    specialization: {} as any,
    currentActivity: {} as any,
    lastActiveAt: new Date(),
    createdAt: new Date(),
  };

  it('should create a guild successfully', async () => {
    const requestBody = {
      leaderId: 'user-123',
      name: 'Test Guild',
      description: 'A test guild',
    };

    mockDatabaseService.getItem.mockResolvedValueOnce(mockCharacter); // Leader character exists
    mockDatabaseService.query.mockResolvedValueOnce({ items: [], count: 0, lastEvaluatedKey: undefined }); // No existing membership
    mockDatabaseService.scan.mockResolvedValueOnce({ items: [], count: 0, lastEvaluatedKey: undefined }); // Guild name not taken
    mockDatabaseService.transactWrite.mockResolvedValueOnce(undefined);

    const result = await handler(mockEvent(requestBody));

    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body)).toHaveProperty('guild');
    expect(JSON.parse(result.body)).toHaveProperty('membership');
    expect(mockDatabaseService.transactWrite).toHaveBeenCalledWith({
      TransactItems: expect.arrayContaining([
        expect.objectContaining({
          Put: expect.objectContaining({
            TableName: expect.any(String),
            Item: expect.objectContaining({
              name: 'Test Guild',
              leaderId: 'user-123',
            }),
          }),
        }),
      ]),
    });
  });

  it('should return 400 if request body is missing', async () => {
    const event = mockEvent(null);
    event.body = null;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Request body is required',
    });
  });

  it('should return 400 if required fields are missing', async () => {
    const requestBody = {
      name: 'Test Guild',
      // Missing leaderId
    };

    const result = await handler(mockEvent(requestBody));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'leaderId and name are required',
    });
  });

  it('should return 400 if guild name is too short', async () => {
    const requestBody = {
      leaderId: 'user-123',
      name: 'AB', // Too short
    };

    const result = await handler(mockEvent(requestBody));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Guild name must be between 3 and 30 characters',
    });
  });

  it('should return 400 if guild name is too long', async () => {
    const requestBody = {
      leaderId: 'user-123',
      name: 'A'.repeat(31), // Too long
    };

    const result = await handler(mockEvent(requestBody));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Guild name must be between 3 and 30 characters',
    });
  });

  it('should return 404 if leader character not found', async () => {
    const requestBody = {
      leaderId: 'user-123',
      name: 'Test Guild',
    };

    mockDatabaseService.getItem.mockResolvedValueOnce(null); // Character not found

    const result = await handler(mockEvent(requestBody));

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Leader character not found',
    });
  });

  it('should return 409 if leader is already in a guild', async () => {
    const requestBody = {
      leaderId: 'user-123',
      name: 'Test Guild',
    };

    mockDatabaseService.getItem.mockResolvedValueOnce(mockCharacter); // Leader character exists
    mockDatabaseService.query.mockResolvedValueOnce({ 
      items: [{ guildId: 'existing-guild', userId: 'user-123' }], 
      count: 1, 
      lastEvaluatedKey: undefined 
    }); // Existing membership

    const result = await handler(mockEvent(requestBody));

    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body)).toEqual({
      error: 'User is already in a guild',
    });
  });

  it('should return 409 if guild name is already taken', async () => {
    const requestBody = {
      leaderId: 'user-123',
      name: 'Test Guild',
    };

    mockDatabaseService.getItem.mockResolvedValueOnce(mockCharacter); // Leader character exists
    mockDatabaseService.query.mockResolvedValueOnce({ items: [], count: 0, lastEvaluatedKey: undefined }); // No existing membership
    mockDatabaseService.scan.mockResolvedValueOnce({ 
      items: [{ guildId: 'existing-guild', name: 'Test Guild' }], 
      count: 1, 
      lastEvaluatedKey: undefined 
    }); // Guild name taken

    const result = await handler(mockEvent(requestBody));

    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Guild name is already taken',
    });
  });

  it('should return 500 on database error', async () => {
    const requestBody = {
      leaderId: 'user-123',
      name: 'Test Guild',
    };

    mockDatabaseService.getItem.mockRejectedValueOnce(new Error('Database error'));

    const result = await handler(mockEvent(requestBody));

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Internal server error',
    });
  });
});