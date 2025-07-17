/**
 * Tests for earnCurrency Lambda function
 */

import { handler } from '../earnCurrency';
import { DatabaseService } from '../../../services/databaseService';
import { APIGatewayProxyEvent } from 'aws-lambda';

// Mock DatabaseService
jest.mock('../../../services/databaseService');
const mockDatabaseService = DatabaseService as jest.Mocked<typeof DatabaseService>;

// Mock uuid
const mockUuid = 'test-transaction-id';
jest.mock('uuid', () => ({
  v4: jest.fn(() => mockUuid),
}));

describe('earnCurrency Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockCharacter = {
    userId: 'test-user-id',
    characterId: 'test-character-id',
    name: 'Test Character',
    level: 10,
    experience: 5000,
    currency: 500,
    stats: {},
    specialization: {},
    currentActivity: {},
    lastActiveAt: new Date(),
    createdAt: new Date(),
  };

  const createMockEvent = (body: any): APIGatewayProxyEvent => ({
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/api/currency/earn',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: '',
  });

  it('should successfully earn currency', async () => {
    mockDatabaseService.getItem.mockResolvedValueOnce(mockCharacter);
    mockDatabaseService.updateItem.mockResolvedValueOnce(undefined);
    mockDatabaseService.putItem.mockResolvedValueOnce(undefined);

    const event = createMockEvent({
      userId: 'test-user-id',
      amount: 100,
      source: 'activity',
      description: 'Test earning',
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    
    const responseBody = JSON.parse(result.body);
    expect(responseBody.transaction).toBeDefined();
    expect(responseBody.transaction.amount).toBe(100);
    expect(responseBody.transaction.type).toBe('earned');
    expect(responseBody.newBalance).toBe(600);

    // Verify database calls
    expect(mockDatabaseService.getItem).toHaveBeenCalledWith({
      TableName: 'steampunk-idle-game-characters',
      Key: { userId: 'test-user-id' },
    });

    expect(mockDatabaseService.updateItem).toHaveBeenCalledWith({
      TableName: 'steampunk-idle-game-characters',
      Key: { userId: 'test-user-id' },
      UpdateExpression: 'SET #currency = :currency, #lastActiveAt = :lastActiveAt',
      ExpressionAttributeNames: {
        '#currency': 'currency',
        '#lastActiveAt': 'lastActiveAt',
      },
      ExpressionAttributeValues: {
        ':currency': 600,
        ':lastActiveAt': expect.any(Date),
      },
    });

    expect(mockDatabaseService.putItem).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'steampunk-idle-game-currency-transactions',
        Item: expect.objectContaining({
          userId: 'test-user-id',
          type: 'earned',
          amount: 100,
          source: 'activity',
          description: 'Test earning',
          balanceAfter: 600,
          // transactionId and timestamp are dynamic, so we don't check exact values
        }),
      })
    );
  });

  it('should reject request without body', async () => {
    const event = { ...createMockEvent({}), body: null };
    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('Request body is required');
  });

  it('should reject request with missing required fields', async () => {
    const event = createMockEvent({
      userId: 'test-user-id',
      // Missing amount, source, description
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('userId, amount, source, and description are required');
  });

  it('should reject amount below minimum', async () => {
    const event = createMockEvent({
      userId: 'test-user-id',
      amount: 0,
      source: 'activity',
      description: 'Test earning',
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('Minimum transaction amount is 1');
  });

  it('should reject when character not found', async () => {
    mockDatabaseService.getItem.mockResolvedValueOnce(null);

    const event = createMockEvent({
      userId: 'test-user-id',
      amount: 100,
      source: 'activity',
      description: 'Test earning',
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).error).toBe('Character not found');
  });

  it('should reject when exceeding maximum balance', async () => {
    const highBalanceCharacter = {
      ...mockCharacter,
      currency: 999999999, // At max balance
    };

    mockDatabaseService.getItem.mockResolvedValueOnce(highBalanceCharacter);

    const event = createMockEvent({
      userId: 'test-user-id',
      amount: 100,
      source: 'activity',
      description: 'Test earning',
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('Maximum balance exceeded');
  });

  it('should handle database errors', async () => {
    mockDatabaseService.getItem.mockResolvedValueOnce(mockCharacter);
    mockDatabaseService.updateItem.mockRejectedValueOnce(new Error('Database error'));

    const event = createMockEvent({
      userId: 'test-user-id',
      amount: 100,
      source: 'activity',
      description: 'Test earning',
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).error).toBe('Failed to process currency transaction');
  });

  it('should handle character with no existing currency', async () => {
    const characterWithoutCurrency = {
      ...mockCharacter,
      currency: undefined,
    };

    mockDatabaseService.getItem.mockResolvedValueOnce(characterWithoutCurrency);
    mockDatabaseService.updateItem.mockResolvedValueOnce(undefined);
    mockDatabaseService.putItem.mockResolvedValueOnce(undefined);

    const event = createMockEvent({
      userId: 'test-user-id',
      amount: 100,
      source: 'activity',
      description: 'Test earning',
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    
    const responseBody = JSON.parse(result.body);
    expect(responseBody.newBalance).toBe(100); // 0 + 100
  });

  it('should include metadata in transaction', async () => {
    mockDatabaseService.getItem.mockResolvedValueOnce(mockCharacter);
    mockDatabaseService.updateItem.mockResolvedValueOnce(undefined);
    mockDatabaseService.putItem.mockResolvedValueOnce(undefined);

    const event = createMockEvent({
      userId: 'test-user-id',
      amount: 100,
      source: 'activity',
      description: 'Test earning',
      metadata: {
        activityType: 'crafting',
        itemId: 'test-item-id',
      },
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(200);

    expect(mockDatabaseService.putItem).toHaveBeenCalledWith({
      TableName: 'steampunk-idle-game-currency-transactions',
      Item: expect.objectContaining({
        metadata: {
          activityType: 'crafting',
          itemId: 'test-item-id',
        },
      }),
    });
  });
});