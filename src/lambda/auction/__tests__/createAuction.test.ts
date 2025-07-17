/**
 * Tests for createAuction Lambda function
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../createAuction';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

const mockDocClient = {
  send: jest.fn(),
};

(DynamoDBDocumentClient.from as jest.Mock) = jest.fn().mockReturnValue(mockDocClient);

// Mock environment variables
process.env.AUCTION_LISTINGS_TABLE = 'test-auction-listings';
process.env.INVENTORY_TABLE = 'test-inventory';
process.env.CHARACTERS_TABLE = 'test-characters';

describe.skip('createAuction Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockEvent = (body: any): APIGatewayProxyEvent => ({
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/auction',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: '',
  });

  const validCreateRequest = {
    sellerId: 'user123',
    itemId: 'item456',
    quantity: 1,
    startingPrice: 100,
    buyoutPrice: 200,
    duration: 24,
    auctionType: 'both' as const,
  };

  const mockInventoryItem = {
    Item: {
      userId: 'user123',
      itemId: 'item456',
      quantity: 5,
      itemName: 'Steam Gear',
      itemRarity: 'rare',
    },
  };

  const mockCharacter = {
    Item: {
      userId: 'user123',
      name: 'TestPlayer',
      currency: 1000,
    },
  };

  it('should create auction successfully', async () => {
    mockDocClient.send
      .mockResolvedValueOnce(mockInventoryItem) // GetCommand for inventory
      .mockResolvedValueOnce(mockCharacter) // GetCommand for character
      .mockResolvedValueOnce({}) // PutCommand for auction
      .mockResolvedValueOnce({}) // UpdateCommand for character currency
      .mockResolvedValueOnce({}); // UpdateCommand for inventory

    const result = await handler(mockEvent(validCreateRequest));

    console.log('Test result:', result);
    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body)).toMatchObject({
      message: 'Auction created successfully',
      listing: expect.objectContaining({
        sellerId: 'user123',
        itemId: 'item456',
        quantity: 1,
        startingPrice: 100,
        buyoutPrice: 200,
        status: 'active',
      }),
    });
  });

  it('should reject request with missing body', async () => {
    const event = mockEvent(null);
    event.body = null;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Request body is required',
    });
  });

  it('should reject request with invalid data', async () => {
    const invalidRequest = {
      sellerId: 'user123',
      itemId: 'item456',
      quantity: 0, // Invalid quantity
      startingPrice: 100,
      duration: 24,
      auctionType: 'both' as const,
    };

    const result = await handler(mockEvent(invalidRequest));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toMatchObject({
      error: expect.stringContaining('Quantity must be at least 1'),
    });
  });

  it('should reject when seller has insufficient items', async () => {
    const insufficientInventory = {
      Item: {
        userId: 'user123',
        itemId: 'item456',
        quantity: 0, // Not enough items
        itemName: 'Steam Gear',
        itemRarity: 'rare',
      },
    };

    mockDocClient.send.mockResolvedValueOnce(insufficientInventory);

    const result = await handler(mockEvent(validCreateRequest));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Insufficient items in inventory',
    });
  });

  it('should reject when seller has insufficient currency for listing fee', async () => {
    const poorCharacter = {
      Item: {
        userId: 'user123',
        name: 'TestPlayer',
        currency: 1, // Not enough for listing fee
      },
    };

    mockDocClient.send
      .mockResolvedValueOnce(mockInventoryItem)
      .mockResolvedValueOnce(poorCharacter);

    const result = await handler(mockEvent(validCreateRequest));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Insufficient currency for listing fee',
    });
  });

  it('should validate starting price limits', async () => {
    const invalidPriceRequest = {
      ...validCreateRequest,
      startingPrice: 0, // Below minimum
    };

    const result = await handler(mockEvent(invalidPriceRequest));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toMatchObject({
      error: expect.stringContaining('Starting price must be at least'),
    });
  });

  it('should validate buyout price is higher than starting price', async () => {
    const invalidBuyoutRequest = {
      ...validCreateRequest,
      startingPrice: 200,
      buyoutPrice: 100, // Lower than starting price
    };

    const result = await handler(mockEvent(invalidBuyoutRequest));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Buyout price must be higher than starting price',
    });
  });

  it('should validate duration limits', async () => {
    const invalidDurationRequest = {
      ...validCreateRequest,
      duration: 0, // Below minimum
    };

    const result = await handler(mockEvent(invalidDurationRequest));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toMatchObject({
      error: expect.stringContaining('Duration must be between'),
    });
  });

  it('should handle database errors gracefully', async () => {
    mockDocClient.send.mockRejectedValueOnce(new Error('Database error'));

    const result = await handler(mockEvent(validCreateRequest));

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Internal server error',
    });
  });

  it('should handle transaction failures with cleanup', async () => {
    mockDocClient.send
      .mockResolvedValueOnce(mockInventoryItem) // GetCommand for inventory
      .mockResolvedValueOnce(mockCharacter) // GetCommand for character
      .mockRejectedValueOnce(new Error('Transaction failed')); // PutCommand fails

    const result = await handler(mockEvent(validCreateRequest));

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Failed to create auction listing',
    });
  });
});