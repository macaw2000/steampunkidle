/**
 * Lambda function to get user's auction listings (selling and bidding)
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { AuctionListing } from '../../types/auction';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const AUCTION_LISTINGS_TABLE = process.env.AUCTION_LISTINGS_TABLE!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.pathParameters?.userId;
    const type = event.queryStringParameters?.type || 'all'; // 'selling', 'bidding', 'all'

    if (!userId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'User ID is required' }),
      };
    }

    console.log('Get user auctions request:', userId, type);

    let sellingAuctions: AuctionListing[] = [];
    let biddingAuctions: AuctionListing[] = [];

    // Get auctions where user is selling
    if (type === 'selling' || type === 'all') {
      try {
        const sellingResult = await docClient.send(new QueryCommand({
          TableName: AUCTION_LISTINGS_TABLE,
          IndexName: 'seller-index',
          KeyConditionExpression: 'sellerId = :userId',
          ExpressionAttributeValues: {
            ':userId': userId,
          },
          ScanIndexForward: false, // Most recent first
        }));

        sellingAuctions = (sellingResult.Items || []).map(item => convertToAuctionListing(item));
      } catch (error) {
        console.error('Error getting selling auctions:', error);
      }
    }

    // Get auctions where user is bidding
    if (type === 'bidding' || type === 'all') {
      try {
        // Since we don't have a GSI for current bidder, we need to scan
        // In a production system, you might want to maintain a separate table for user bids
        const biddingResult = await docClient.send(new ScanCommand({
          TableName: AUCTION_LISTINGS_TABLE,
          FilterExpression: 'currentBidderId = :userId',
          ExpressionAttributeValues: {
            ':userId': userId,
          },
        }));

        biddingAuctions = (biddingResult.Items || []).map(item => convertToAuctionListing(item));
      } catch (error) {
        console.error('Error getting bidding auctions:', error);
      }
    }

    // Categorize auctions by status
    const categorizeAuctions = (auctions: AuctionListing[]) => {
      const now = new Date();
      return {
        active: auctions.filter(a => a.status === 'active' && a.expiresAt > now),
        expired: auctions.filter(a => a.status === 'active' && a.expiresAt <= now),
        sold: auctions.filter(a => a.status === 'sold'),
        cancelled: auctions.filter(a => a.status === 'cancelled'),
      };
    };

    const result = {
      userId,
      selling: categorizeAuctions(sellingAuctions),
      bidding: categorizeAuctions(biddingAuctions),
      summary: {
        totalSelling: sellingAuctions.length,
        totalBidding: biddingAuctions.length,
        activeSelling: sellingAuctions.filter(a => a.status === 'active' && a.expiresAt > new Date()).length,
        activeBidding: biddingAuctions.filter(a => a.status === 'active' && a.expiresAt > new Date()).length,
      },
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(result),
    };

  } catch (error) {
    console.error('Error getting user auctions:', error);
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

function convertToAuctionListing(item: any): AuctionListing {
  return {
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
  };
}