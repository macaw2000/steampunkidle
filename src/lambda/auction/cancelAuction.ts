/**
 * Lambda function to cancel an auction listing
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const AUCTION_LISTINGS_TABLE = process.env.AUCTION_LISTINGS_TABLE!;
const CHARACTERS_TABLE = process.env.CHARACTERS_TABLE!;
const INVENTORY_TABLE = process.env.INVENTORY_TABLE!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const listingId = event.pathParameters?.listingId;
    const userId = event.queryStringParameters?.userId;

    if (!listingId || !userId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Listing ID and User ID are required' }),
      };
    }

    console.log('Cancel auction request:', listingId, userId);

    // Get auction listing
    const auctionResult = await docClient.send(new GetCommand({
      TableName: AUCTION_LISTINGS_TABLE,
      Key: { listingId },
    }));

    if (!auctionResult.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Auction not found' }),
      };
    }

    const auction = auctionResult.Item;

    // Validate user can cancel this auction
    if (auction.sellerId !== userId) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'You can only cancel your own auctions' }),
      };
    }

    // Check if auction can be cancelled
    if (auction.status !== 'active') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Only active auctions can be cancelled' }),
      };
    }

    // Check if there are bids (some systems don't allow cancellation with bids)
    if (auction.currentBidderId && auction.currentBid) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Cannot cancel auction with active bids' }),
      };
    }

    try {
      const now = new Date();

      // 1. Update auction status to cancelled
      await docClient.send(new UpdateCommand({
        TableName: AUCTION_LISTINGS_TABLE,
        Key: { listingId },
        UpdateExpression: 'SET #status = :cancelled, completedAt = :completedAt',
        ConditionExpression: '#status = :active',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':cancelled': 'cancelled',
          ':active': 'active',
          ':completedAt': now.toISOString(),
        },
      }));

      // 2. Return items to seller's available inventory
      await docClient.send(new UpdateCommand({
        TableName: INVENTORY_TABLE,
        Key: {
          userId: auction.sellerId,
          itemId: auction.itemId,
        },
        UpdateExpression: 'SET quantity = quantity + :qty, #listed = #listed - :qty',
        ExpressionAttributeNames: {
          '#listed': 'listedQuantity',
        },
        ExpressionAttributeValues: {
          ':qty': auction.quantity,
        },
      }));

      // Note: Listing fee is not refunded when cancelling (this is typical for auction systems)

      console.log('Auction cancelled successfully:', listingId);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'Auction cancelled successfully',
          listingId,
          itemsReturned: auction.quantity,
        }),
      };

    } catch (transactionError) {
      console.error('Cancel auction transaction failed:', transactionError);
      
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Failed to cancel auction' }),
      };
    }

  } catch (error) {
    console.error('Error cancelling auction:', error);
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