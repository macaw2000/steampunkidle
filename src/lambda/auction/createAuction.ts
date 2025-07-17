/**
 * Lambda function to create a new auction listing
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
const { v4: uuidv4 } = require('uuid');
import { CreateAuctionRequest, AuctionListing, AuctionFees } from '../../types/auction';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const AUCTION_LISTINGS_TABLE = process.env.AUCTION_LISTINGS_TABLE!;
const INVENTORY_TABLE = process.env.INVENTORY_TABLE!;
const CHARACTERS_TABLE = process.env.CHARACTERS_TABLE!;

// Auction configuration
const AUCTION_CONFIG = {
  LISTING_FEE_PERCENTAGE: 0.05, // 5% of starting price
  SUCCESS_FEE_PERCENTAGE: 0.10, // 10% of final sale price
  MIN_DURATION_HOURS: 1,
  MAX_DURATION_HOURS: 168, // 7 days
  MIN_STARTING_PRICE: 1,
  MAX_STARTING_PRICE: 999999,
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Create auction request:', event.body);

    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    const request: CreateAuctionRequest = JSON.parse(event.body);

    // Validate request
    const validation = validateCreateAuctionRequest(request);
    if (!validation.isValid) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: validation.error }),
      };
    }

    // Check if seller has the item in inventory
    const inventoryItem = await docClient.send(new GetCommand({
      TableName: INVENTORY_TABLE,
      Key: {
        userId: request.sellerId,
        itemId: request.itemId,
      },
    }));

    if (!inventoryItem.Item || inventoryItem.Item.quantity < request.quantity) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Insufficient items in inventory' }),
      };
    }

    // Get seller character info
    const sellerCharacter = await docClient.send(new GetCommand({
      TableName: CHARACTERS_TABLE,
      Key: { userId: request.sellerId },
    }));

    if (!sellerCharacter.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Seller character not found' }),
      };
    }

    // Calculate fees
    const fees = calculateAuctionFees(request.startingPrice, request.buyoutPrice);

    // Check if seller can afford listing fee
    if (sellerCharacter.Item.currency < fees.listingFee) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Insufficient currency for listing fee' }),
      };
    }

    // Create auction listing
    const listingId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + request.duration * 60 * 60 * 1000);

    const auctionListing: AuctionListing = {
      listingId,
      sellerId: request.sellerId,
      sellerName: sellerCharacter.Item.name,
      itemId: request.itemId,
      itemName: inventoryItem.Item.itemName || 'Unknown Item',
      itemRarity: inventoryItem.Item.itemRarity || 'common',
      quantity: request.quantity,
      startingPrice: request.startingPrice,
      buyoutPrice: request.buyoutPrice,
      currentBid: undefined,
      currentBidderId: undefined,
      currentBidderName: undefined,
      bidHistory: [],
      auctionType: request.auctionType,
      status: 'active',
      createdAt: now,
      expiresAt,
      fees,
    };

    // Start transaction: Create auction, deduct listing fee, reserve items
    try {
      // Create auction listing
      await docClient.send(new PutCommand({
        TableName: AUCTION_LISTINGS_TABLE,
        Item: {
          ...auctionListing,
          ttl: Math.floor(expiresAt.getTime() / 1000) + (24 * 60 * 60), // TTL 24 hours after expiry
          createdAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
        },
        ConditionExpression: 'attribute_not_exists(listingId)',
      }));

      // Deduct listing fee from seller
      await docClient.send(new UpdateCommand({
        TableName: CHARACTERS_TABLE,
        Key: { userId: request.sellerId },
        UpdateExpression: 'SET currency = currency - :fee',
        ConditionExpression: 'currency >= :fee',
        ExpressionAttributeValues: {
          ':fee': fees.listingFee,
        },
      }));

      // Reserve items in inventory (mark as listed)
      await docClient.send(new UpdateCommand({
        TableName: INVENTORY_TABLE,
        Key: {
          userId: request.sellerId,
          itemId: request.itemId,
        },
        UpdateExpression: 'SET quantity = quantity - :qty, #listed = if_not_exists(#listed, :zero) + :qty',
        ConditionExpression: 'quantity >= :qty',
        ExpressionAttributeNames: {
          '#listed': 'listedQuantity',
        },
        ExpressionAttributeValues: {
          ':qty': request.quantity,
          ':zero': 0,
        },
      }));

      console.log('Auction created successfully:', listingId);

      return {
        statusCode: 201,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'Auction created successfully',
          listing: auctionListing,
        }),
      };

    } catch (transactionError) {
      console.error('Transaction failed:', transactionError);
      
      // Attempt cleanup if possible
      try {
        await docClient.send(new UpdateCommand({
          TableName: AUCTION_LISTINGS_TABLE,
          Key: { listingId },
          UpdateExpression: 'SET #status = :cancelled',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: { ':cancelled': 'cancelled' },
        }));
      } catch (cleanupError) {
        console.error('Cleanup failed:', cleanupError);
      }

      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Failed to create auction listing' }),
      };
    }

  } catch (error) {
    console.error('Error creating auction:', error);
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

function validateCreateAuctionRequest(request: CreateAuctionRequest): { isValid: boolean; error?: string } {
  if (!request.sellerId || !request.itemId) {
    return { isValid: false, error: 'Seller ID and Item ID are required' };
  }

  if (!request.quantity || request.quantity < 1) {
    return { isValid: false, error: 'Quantity must be at least 1' };
  }

  if (!request.startingPrice || request.startingPrice < AUCTION_CONFIG.MIN_STARTING_PRICE) {
    return { isValid: false, error: `Starting price must be at least ${AUCTION_CONFIG.MIN_STARTING_PRICE}` };
  }

  if (request.startingPrice > AUCTION_CONFIG.MAX_STARTING_PRICE) {
    return { isValid: false, error: `Starting price cannot exceed ${AUCTION_CONFIG.MAX_STARTING_PRICE}` };
  }

  if (request.buyoutPrice && request.buyoutPrice <= request.startingPrice) {
    return { isValid: false, error: 'Buyout price must be higher than starting price' };
  }

  if (!request.duration || request.duration < AUCTION_CONFIG.MIN_DURATION_HOURS || request.duration > AUCTION_CONFIG.MAX_DURATION_HOURS) {
    return { isValid: false, error: `Duration must be between ${AUCTION_CONFIG.MIN_DURATION_HOURS} and ${AUCTION_CONFIG.MAX_DURATION_HOURS} hours` };
  }

  if (!['auction', 'buyout', 'both'].includes(request.auctionType)) {
    return { isValid: false, error: 'Invalid auction type' };
  }

  return { isValid: true };
}

function calculateAuctionFees(startingPrice: number, buyoutPrice?: number): AuctionFees {
  const listingFee = Math.max(1, Math.floor(startingPrice * AUCTION_CONFIG.LISTING_FEE_PERCENTAGE));
  const successFee = AUCTION_CONFIG.SUCCESS_FEE_PERCENTAGE;
  
  return {
    listingFee,
    successFee,
    totalFees: listingFee, // Success fee is calculated at completion
  };
}