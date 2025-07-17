/**
 * Tests for searchAuctions Lambda function
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../searchAuctions';
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

describe.skip('searchAuctions Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockEvent = (queryParams: any = {}): APIGatewayProxyEvent => ({
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/auction/search',
    pathParameters: null,
    queryStringParameters: queryParams,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: '',
  });

  const mockAuctionItems = [
    {
      listingId: 'auction1',
      sellerId: 'user1',
      sellerName: 'Seller1',
      itemId: 'item1',
      itemName: 'Steam Gear',
      itemRarity: 'rare',
      quantity: 1,
      startingPrice: 100,
      buyoutPrice: 200,
      currentBid: 120,
      currentBidderId: 'user2',
      currentBidderName: 'Bidder1',
      bidHistory: [],
      auctionType: 'both',
      status: 'active',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      fees: { listingFee: 5, successFee: 0.1, totalFees: 5 },
    },
    {
      listingId: 'auction2',
      sellerId: 'user3',
      sellerName: 'Seller2',
      itemId: 'item2',
      itemName: 'Brass Widget',
      itemRarity: 'common',
      quantity: 2,
      startingPrice: 50,
      buyoutPrice: 100,
      currentBid: undefined,
      currentBidderId: undefined,
      currentBidderName: undefined,
      bidHistory: [],
      auctionType: 'both',
      status: 'active',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      fees: { listingFee: 3, successFee: 0.1, totalFees: 3 },
    },
  ];

  it('should search auctions with default parameters', async () => {
    mockDocClient.send.mockResolvedValueOnce({
      Items: mockAuctionItems,
    });

    const result = await handler(mockEvent());

    expect(result.statusCode).toBe(200);
    const response = JSON.parse(result.body);
    
    expect(response.result.listings).toHaveLength(2);
    expect(response.result.totalCount).toBe(2);
    expect(response.result.hasMore).toBe(false);
    expect(response.filters).toMatchObject({
      limit: 20,
      offset: 0,
      sortBy: 'timeLeft',
      sortOrder: 'asc',
    });
  });

  it('should filter by item type', async () => {
    const filteredItems = [mockAuctionItems[0]]; // Only Steam Gear
    mockDocClient.send.mockResolvedValueOnce({
      Items: filteredItems,
    });

    const result = await handler(mockEvent({ itemType: 'Steam' }));

    expect(result.statusCode).toBe(200);
    const response = JSON.parse(result.body);
    
    expect(response.result.listings).toHaveLength(1);
    expect(response.result.listings[0].itemName).toContain('Steam');
    expect(response.filters.itemType).toBe('Steam');
  });

  it('should filter by rarity', async () => {
    const filteredItems = [mockAuctionItems[1]]; // Only common items
    mockDocClient.send.mockResolvedValueOnce({
      Items: filteredItems,
    });

    const result = await handler(mockEvent({ rarity: 'common' }));

    expect(result.statusCode).toBe(200);
    const response = JSON.parse(result.body);
    
    expect(response.result.listings).toHaveLength(1);
    expect(response.result.listings[0].itemRarity).toBe('common');
    expect(response.filters.rarity).toBe('common');
  });

  it('should filter by price range', async () => {
    const filteredItems = [mockAuctionItems[0]]; // Only items >= 100
    mockDocClient.send.mockResolvedValueOnce({
      Items: filteredItems,
    });

    const result = await handler(mockEvent({ 
      minPrice: '100',
      maxPrice: '200',
    }));

    expect(result.statusCode).toBe(200);
    const response = JSON.parse(result.body);
    
    expect(response.result.listings).toHaveLength(1);
    expect(response.filters.minPrice).toBe(100);
    expect(response.filters.maxPrice).toBe(200);
  });

  it('should filter by seller name', async () => {
    const filteredItems = [mockAuctionItems[0]]; // Only Seller1
    mockDocClient.send.mockResolvedValueOnce({
      Items: filteredItems,
    });

    const result = await handler(mockEvent({ sellerName: 'Seller1' }));

    expect(result.statusCode).toBe(200);
    const response = JSON.parse(result.body);
    
    expect(response.result.listings).toHaveLength(1);
    expect(response.result.listings[0].sellerName).toBe('Seller1');
    expect(response.filters.sellerName).toBe('Seller1');
  });

  it('should apply pagination', async () => {
    mockDocClient.send.mockResolvedValueOnce({
      Items: mockAuctionItems,
    });

    const result = await handler(mockEvent({ 
      limit: '1',
      offset: '1',
    }));

    expect(result.statusCode).toBe(200);
    const response = JSON.parse(result.body);
    
    expect(response.result.listings).toHaveLength(1);
    expect(response.result.totalCount).toBe(2);
    expect(response.result.hasMore).toBe(false);
    expect(response.filters.limit).toBe(1);
    expect(response.filters.offset).toBe(1);
  });

  it('should sort by price', async () => {
    mockDocClient.send.mockResolvedValueOnce({
      Items: mockAuctionItems,
    });

    const result = await handler(mockEvent({ 
      sortBy: 'price',
      sortOrder: 'desc',
    }));

    expect(result.statusCode).toBe(200);
    const response = JSON.parse(result.body);
    
    expect(response.filters.sortBy).toBe('price');
    expect(response.filters.sortOrder).toBe('desc');
    // First item should have higher price (120 vs 50)
    expect(response.result.listings[0].currentBid || response.result.listings[0].startingPrice)
      .toBeGreaterThan(response.result.listings[1].currentBid || response.result.listings[1].startingPrice);
  });

  it('should sort by rarity', async () => {
    mockDocClient.send.mockResolvedValueOnce({
      Items: mockAuctionItems,
    });

    const result = await handler(mockEvent({ 
      sortBy: 'rarity',
      sortOrder: 'desc',
    }));

    expect(result.statusCode).toBe(200);
    const response = JSON.parse(result.body);
    
    // Rare items should come first when sorting by rarity desc
    expect(response.result.listings[0].itemRarity).toBe('rare');
    expect(response.result.listings[1].itemRarity).toBe('common');
  });

  it('should sort by name', async () => {
    mockDocClient.send.mockResolvedValueOnce({
      Items: mockAuctionItems,
    });

    const result = await handler(mockEvent({ 
      sortBy: 'name',
      sortOrder: 'asc',
    }));

    expect(result.statusCode).toBe(200);
    const response = JSON.parse(result.body);
    
    // Brass Widget should come before Steam Gear alphabetically
    expect(response.result.listings[0].itemName).toBe('Brass Widget');
    expect(response.result.listings[1].itemName).toBe('Steam Gear');
  });

  it('should enforce maximum limit', async () => {
    mockDocClient.send.mockResolvedValueOnce({
      Items: mockAuctionItems,
    });

    const result = await handler(mockEvent({ limit: '200' })); // Above max

    expect(result.statusCode).toBe(200);
    const response = JSON.parse(result.body);
    
    expect(response.filters.limit).toBe(100); // Should be capped at max
  });

  it('should fallback to scan on query failure', async () => {
    mockDocClient.send
      .mockRejectedValueOnce(new Error('Query failed'))
      .mockResolvedValueOnce({
        Items: mockAuctionItems,
      });

    const result = await handler(mockEvent());

    expect(result.statusCode).toBe(200);
    expect(mockDocClient.send).toHaveBeenCalledTimes(2); // Query then scan
  });

  it('should handle empty results', async () => {
    mockDocClient.send.mockResolvedValueOnce({
      Items: [],
    });

    const result = await handler(mockEvent());

    expect(result.statusCode).toBe(200);
    const response = JSON.parse(result.body);
    
    expect(response.result.listings).toHaveLength(0);
    expect(response.result.totalCount).toBe(0);
    expect(response.result.hasMore).toBe(false);
  });

  it('should handle database errors gracefully', async () => {
    mockDocClient.send.mockRejectedValueOnce(new Error('Database error'));
    mockDocClient.send.mockRejectedValueOnce(new Error('Scan also failed'));

    const result = await handler(mockEvent());

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Internal server error',
    });
  });
});