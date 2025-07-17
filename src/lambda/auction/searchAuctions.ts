/**
 * Lambda function to search and filter auction listings
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { AuctionSearchFilters, AuctionSearchResult, AuctionListing } from '../../types/auction';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const AUCTION_LISTINGS_TABLE = process.env.AUCTION_LISTINGS_TABLE!;

const SEARCH_CONFIG = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  DEFAULT_SORT: 'timeLeft',
  DEFAULT_ORDER: 'asc',
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Search auctions request:', event.queryStringParameters);

    // Parse query parameters
    const filters = parseSearchFilters(event.queryStringParameters || {});
    
    console.log('Parsed filters:', filters);

    // Build query parameters
    const queryParams = buildQueryParams(filters);
    
    // Execute search
    const searchResult = await executeSearch(queryParams, filters);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        result: searchResult,
        filters: filters,
      }),
    };

  } catch (error) {
    console.error('Error searching auctions:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

function parseSearchFilters(queryParams: { [key: string]: string | undefined }): AuctionSearchFilters {
  const filters: AuctionSearchFilters = {
    limit: Math.min(
      parseInt(queryParams.limit || SEARCH_CONFIG.DEFAULT_LIMIT.toString()),
      SEARCH_CONFIG.MAX_LIMIT
    ),
    offset: parseInt(queryParams.offset || '0'),
    sortBy: (queryParams.sortBy as any) || SEARCH_CONFIG.DEFAULT_SORT,
    sortOrder: (queryParams.sortOrder as any) || SEARCH_CONFIG.DEFAULT_ORDER,
  };

  if (queryParams.itemType) {
    filters.itemType = queryParams.itemType;
  }

  if (queryParams.rarity) {
    filters.rarity = queryParams.rarity;
  }

  if (queryParams.minPrice) {
    filters.minPrice = parseInt(queryParams.minPrice);
  }

  if (queryParams.maxPrice) {
    filters.maxPrice = parseInt(queryParams.maxPrice);
  }

  if (queryParams.sellerName) {
    filters.sellerName = queryParams.sellerName;
  }

  return filters;
}

function buildQueryParams(filters: AuctionSearchFilters) {
  const now = new Date().toISOString();
  
  // Base query for active auctions
  let filterExpression = '#status = :active AND expiresAt > :now';
  let expressionAttributeNames: { [key: string]: string } = {
    '#status': 'status',
  };
  let expressionAttributeValues: { [key: string]: any } = {
    ':active': 'active',
    ':now': now,
  };

  // Add filters
  if (filters.itemType) {
    filterExpression += ' AND contains(itemName, :itemType)';
    expressionAttributeValues[':itemType'] = filters.itemType;
  }

  if (filters.rarity) {
    filterExpression += ' AND itemRarity = :rarity';
    expressionAttributeValues[':rarity'] = filters.rarity;
  }

  if (filters.minPrice) {
    filterExpression += ' AND (currentBid >= :minPrice OR (currentBid = :null AND startingPrice >= :minPrice))';
    expressionAttributeValues[':minPrice'] = filters.minPrice;
    expressionAttributeValues[':null'] = null;
  }

  if (filters.maxPrice) {
    filterExpression += ' AND (currentBid <= :maxPrice OR (currentBid = :null AND startingPrice <= :maxPrice))';
    expressionAttributeValues[':maxPrice'] = filters.maxPrice;
    if (!expressionAttributeValues[':null']) {
      expressionAttributeValues[':null'] = null;
    }
  }

  if (filters.sellerName) {
    filterExpression += ' AND contains(sellerName, :sellerName)';
    expressionAttributeValues[':sellerName'] = filters.sellerName;
  }

  return {
    filterExpression,
    expressionAttributeNames,
    expressionAttributeValues,
  };
}

async function executeSearch(queryParams: any, filters: AuctionSearchFilters): Promise<AuctionSearchResult> {
  try {
    // Use GSI for active auctions sorted by expiration time
    const command = new QueryCommand({
      TableName: AUCTION_LISTINGS_TABLE,
      IndexName: 'status-expires-index',
      KeyConditionExpression: '#status = :active',
      FilterExpression: queryParams.filterExpression.replace('#status = :active AND ', ''),
      ExpressionAttributeNames: queryParams.expressionAttributeNames,
      ExpressionAttributeValues: queryParams.expressionAttributeValues,
      Limit: filters.limit! + (filters.offset || 0) + 10, // Get extra items for pagination
      ScanIndexForward: filters.sortBy === 'timeLeft' ? filters.sortOrder === 'asc' : undefined,
    });

    const result = await docClient.send(command);
    let items = result.Items || [];

    // Convert DynamoDB items to AuctionListing objects
    let listings: AuctionListing[] = items.map(item => ({
      listingId: item.listingId,
      sellerId: item.sellerId,
      sellerName: item.sellerName,
      itemId: item.itemId,
      itemName: item.itemName,
      itemRarity: item.itemRarity,
      quantity: item.quantity,
      startingPrice: item.startingPrice,
      buyoutPrice: item.buyoutPrice,
      currentBid: item.currentBid,
      currentBidderId: item.currentBidderId,
      currentBidderName: item.currentBidderName,
      bidHistory: (item.bidHistory || []).map((bid: any) => ({
        ...bid,
        timestamp: new Date(bid.timestamp),
      })),
      auctionType: item.auctionType,
      status: item.status,
      createdAt: new Date(item.createdAt),
      expiresAt: new Date(item.expiresAt),
      completedAt: item.completedAt ? new Date(item.completedAt) : undefined,
      fees: item.fees,
    }));

    // Apply additional sorting if needed
    if (filters.sortBy !== 'timeLeft') {
      listings = sortListings(listings, filters.sortBy!, filters.sortOrder!);
    }

    // Apply pagination
    const totalCount = listings.length;
    const startIndex = filters.offset || 0;
    const endIndex = startIndex + filters.limit!;
    const paginatedListings = listings.slice(startIndex, endIndex);

    return {
      listings: paginatedListings,
      totalCount,
      hasMore: endIndex < totalCount,
    };

  } catch (error) {
    console.error('Error executing search:', error);
    
    // Fallback to scan if query fails
    console.log('Falling back to scan operation');
    
    const scanCommand = new ScanCommand({
      TableName: AUCTION_LISTINGS_TABLE,
      FilterExpression: queryParams.filterExpression,
      ExpressionAttributeNames: queryParams.expressionAttributeNames,
      ExpressionAttributeValues: queryParams.expressionAttributeValues,
      Limit: filters.limit! + (filters.offset || 0) + 10,
    });

    const scanResult = await docClient.send(scanCommand);
    let items = scanResult.Items || [];

    let listings: AuctionListing[] = items.map(item => ({
      listingId: item.listingId,
      sellerId: item.sellerId,
      sellerName: item.sellerName,
      itemId: item.itemId,
      itemName: item.itemName,
      itemRarity: item.itemRarity,
      quantity: item.quantity,
      startingPrice: item.startingPrice,
      buyoutPrice: item.buyoutPrice,
      currentBid: item.currentBid,
      currentBidderId: item.currentBidderId,
      currentBidderName: item.currentBidderName,
      bidHistory: (item.bidHistory || []).map((bid: any) => ({
        ...bid,
        timestamp: new Date(bid.timestamp),
      })),
      auctionType: item.auctionType,
      status: item.status,
      createdAt: new Date(item.createdAt),
      expiresAt: new Date(item.expiresAt),
      completedAt: item.completedAt ? new Date(item.completedAt) : undefined,
      fees: item.fees,
    }));

    // Sort listings
    listings = sortListings(listings, filters.sortBy!, filters.sortOrder!);

    // Apply pagination
    const totalCount = listings.length;
    const startIndex = filters.offset || 0;
    const endIndex = startIndex + filters.limit!;
    const paginatedListings = listings.slice(startIndex, endIndex);

    return {
      listings: paginatedListings,
      totalCount,
      hasMore: endIndex < totalCount,
    };
  }
}

function sortListings(listings: AuctionListing[], sortBy: string, sortOrder: string): AuctionListing[] {
  return listings.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'price':
        const priceA = a.currentBid || a.startingPrice;
        const priceB = b.currentBid || b.startingPrice;
        comparison = priceA - priceB;
        break;
      case 'timeLeft':
        comparison = a.expiresAt.getTime() - b.expiresAt.getTime();
        break;
      case 'rarity':
        const rarityOrder = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };
        comparison = (rarityOrder[a.itemRarity as keyof typeof rarityOrder] || 0) - 
                    (rarityOrder[b.itemRarity as keyof typeof rarityOrder] || 0);
        break;
      case 'name':
        comparison = a.itemName.localeCompare(b.itemName);
        break;
      default:
        comparison = a.createdAt.getTime() - b.createdAt.getTime();
    }

    return sortOrder === 'desc' ? -comparison : comparison;
  });
}