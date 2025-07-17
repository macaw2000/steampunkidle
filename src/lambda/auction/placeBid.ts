/**
 * Lambda function to place a bid on an auction
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DatabaseService, TABLE_NAMES } from '../../services/databaseService';
const { v4: uuidv4 } = require('uuid');
import { PlaceBidRequest, AuctionBid } from '../../types/auction';

const BID_CONFIG = {
  MIN_BID_INCREMENT: 1,
  MAX_BID_HISTORY: 50,
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Place bid request:', event.body);

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

    const request: PlaceBidRequest = JSON.parse(event.body);

    // Validate request
    const validation = validatePlaceBidRequest(request);
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

    // Get auction listing
    const auction = await DatabaseService.getItem({
      TableName: TABLE_NAMES.AUCTION_LISTINGS,
      Key: { listingId: request.listingId },
    });

    if (!auction) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Auction not found' }),
      };
    }

    // Validate auction state
    if (auction.status !== 'active') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Auction is not active' }),
      };
    }

    if (new Date(auction.expiresAt) <= new Date()) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Auction has expired' }),
      };
    }

    if (auction.sellerId === request.bidderId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Cannot bid on your own auction' }),
      };
    }

    // Check if auction allows bidding
    if (auction.auctionType === 'buyout') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'This auction is buyout only' }),
      };
    }

    // Validate bid amount
    const minBidAmount = auction.currentBid 
      ? auction.currentBid + BID_CONFIG.MIN_BID_INCREMENT
      : auction.startingPrice;

    if (request.bidAmount < minBidAmount) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ 
          error: `Bid must be at least ${minBidAmount}`,
          minBidAmount,
        }),
      };
    }

    // Get bidder character info
    const bidderCharacter = await DatabaseService.getItem({
      TableName: TABLE_NAMES.CHARACTERS,
      Key: { userId: request.bidderId },
    });

    if (!bidderCharacter) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Bidder character not found' }),
      };
    }

    // Check if bidder has enough currency
    if (bidderCharacter.currency < request.bidAmount) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Insufficient currency for bid' }),
      };
    }

    // Create bid record
    const bid: AuctionBid = {
      bidId: uuidv4(),
      bidderId: request.bidderId,
      bidderName: bidderCharacter.name,
      amount: request.bidAmount,
      timestamp: new Date(),
    };

    // Update auction with new bid
    try {
      // If there was a previous bidder, refund their currency
      let refundUpdates = [];
      if (auction.currentBidderId && auction.currentBid) {
        refundUpdates.push(
          DatabaseService.updateItem({
            TableName: TABLE_NAMES.CHARACTERS,
            Key: { userId: auction.currentBidderId },
            UpdateExpression: 'SET currency = currency + :refund',
            ExpressionAttributeValues: {
              ':refund': auction.currentBid,
            },
          })
        );
      }

      // Reserve currency from new bidder
      const reservePromise = DatabaseService.updateItem({
        TableName: TABLE_NAMES.CHARACTERS,
        Key: { userId: request.bidderId },
        UpdateExpression: 'SET currency = currency - :bid',
        ConditionExpression: 'currency >= :bid',
        ExpressionAttributeValues: {
          ':bid': request.bidAmount,
        },
      });

      // Update auction listing
      const bidHistory = [...(auction.bidHistory || []), bid];
      // Keep only the last MAX_BID_HISTORY bids
      if (bidHistory.length > BID_CONFIG.MAX_BID_HISTORY) {
        bidHistory.splice(0, bidHistory.length - BID_CONFIG.MAX_BID_HISTORY);
      }

      const updateAuctionPromise = DatabaseService.updateItem({
        TableName: TABLE_NAMES.AUCTION_LISTINGS,
        Key: { listingId: request.listingId },
        UpdateExpression: `
          SET currentBid = :bid,
              currentBidderId = :bidderId,
              currentBidderName = :bidderName,
              bidHistory = :bidHistory
        `,
        ConditionExpression: '#status = :active AND expiresAt > :now',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':bid': request.bidAmount,
          ':bidderId': request.bidderId,
          ':bidderName': bidderCharacter.name,
          ':bidHistory': bidHistory.map(b => ({
            ...b,
            timestamp: b.timestamp.toISOString(),
          })),
          ':active': 'active',
          ':now': new Date().toISOString(),
        },
      });

      // Execute all updates
      await Promise.all([...refundUpdates, reservePromise, updateAuctionPromise]);

      console.log('Bid placed successfully:', request.listingId, request.bidAmount);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'Bid placed successfully',
          bid,
          currentBid: request.bidAmount,
        }),
      };

    } catch (transactionError) {
      console.error('Bid transaction failed:', transactionError);
      
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Failed to place bid' }),
      };
    }

  } catch (error) {
    console.error('Error placing bid:', error);
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

function validatePlaceBidRequest(request: PlaceBidRequest): { isValid: boolean; error?: string } {
  if (!request.listingId || !request.bidderId) {
    return { isValid: false, error: 'Listing ID and Bidder ID are required' };
  }

  if (!request.bidAmount || request.bidAmount < 1) {
    return { isValid: false, error: 'Bid amount must be at least 1' };
  }

  return { isValid: true };
}