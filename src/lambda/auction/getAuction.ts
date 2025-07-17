/**
 * Lambda function to get a specific auction listing
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { AuctionListing } from '../../types/auction';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const AUCTION_LISTINGS_TABLE = process.env.AUCTION_LISTINGS_TABLE!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const listingId = event.pathParameters?.listingId;

    if (!listingId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Listing ID is required' }),
      };
    }

    console.log('Get auction request:', listingId);

    // Get auction listing
    const result = await docClient.send(new GetCommand({
      TableName: AUCTION_LISTINGS_TABLE,
      Key: { listingId },
    }));

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Auction not found' }),
      };
    }

    // Convert DynamoDB item to AuctionListing
    const listing: AuctionListing = {
      listingId: result.Item.listingId,
      sellerId: result.Item.sellerId,
      sellerName: result.Item.sellerName,
      itemId: result.Item.itemId,
      itemName: result.Item.itemName,
      itemRarity: result.Item.itemRarity,
      quantity: result.Item.quantity,
      startingPrice: result.Item.startingPrice,
      buyoutPrice: result.Item.buyoutPrice,
      currentBid: result.Item.currentBid,
      currentBidderId: result.Item.currentBidderId,
      currentBidderName: result.Item.currentBidderName,
      bidHistory: (result.Item.bidHistory || []).map((bid: any) => ({
        ...bid,
        timestamp: new Date(bid.timestamp),
      })),
      auctionType: result.Item.auctionType,
      status: result.Item.status,
      createdAt: new Date(result.Item.createdAt),
      expiresAt: new Date(result.Item.expiresAt),
      completedAt: result.Item.completedAt ? new Date(result.Item.completedAt) : undefined,
      fees: result.Item.fees,
    };

    // Calculate time remaining
    const now = new Date();
    const timeRemaining = Math.max(0, listing.expiresAt.getTime() - now.getTime());
    const isExpired = timeRemaining === 0;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        listing,
        timeRemaining,
        isExpired,
        currentPrice: listing.currentBid || listing.startingPrice,
        canBid: listing.status === 'active' && !isExpired && ['auction', 'both'].includes(listing.auctionType),
        canBuyout: listing.status === 'active' && !isExpired && listing.buyoutPrice && ['buyout', 'both'].includes(listing.auctionType),
      }),
    };

  } catch (error) {
    console.error('Error getting auction:', error);
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