/**
 * Lambda function to buyout an auction immediately
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
const { v4: uuidv4 } = require('uuid');
import { BuyoutRequest, AuctionTransaction } from '../../types/auction';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const AUCTION_LISTINGS_TABLE = process.env.AUCTION_LISTINGS_TABLE!;
const CHARACTERS_TABLE = process.env.CHARACTERS_TABLE!;
const INVENTORY_TABLE = process.env.INVENTORY_TABLE!;
const CURRENCY_TRANSACTIONS_TABLE = process.env.CURRENCY_TRANSACTIONS_TABLE!;

const SUCCESS_FEE_PERCENTAGE = 0.10; // 10% success fee

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Buyout auction request:', event.body);

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

    const request: BuyoutRequest = JSON.parse(event.body);

    // Validate request
    if (!request.listingId || !request.buyerId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Listing ID and Buyer ID are required' }),
      };
    }

    // Get auction listing
    const auctionResult = await docClient.send(new GetCommand({
      TableName: AUCTION_LISTINGS_TABLE,
      Key: { listingId: request.listingId },
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

    if (auction.sellerId === request.buyerId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Cannot buy your own auction' }),
      };
    }

    // Check if auction has buyout price
    if (!auction.buyoutPrice) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'This auction does not have a buyout price' }),
      };
    }

    // Check if auction allows buyout
    if (auction.auctionType === 'auction') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'This auction is bidding only' }),
      };
    }

    // Get buyer character info
    const buyerCharacter = await docClient.send(new GetCommand({
      TableName: CHARACTERS_TABLE,
      Key: { userId: request.buyerId },
    }));

    if (!buyerCharacter.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Buyer character not found' }),
      };
    }

    // Check if buyer has enough currency
    if (buyerCharacter.Item.currency < auction.buyoutPrice) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Insufficient currency for buyout' }),
      };
    }

    // Calculate fees and payments
    const successFee = Math.floor(auction.buyoutPrice * SUCCESS_FEE_PERCENTAGE);
    const sellerPayment = auction.buyoutPrice - successFee;

    // Execute buyout transaction
    try {
      const now = new Date();
      const transactionId = uuidv4();

      // Create transaction record
      const transaction: AuctionTransaction = {
        transactionId,
        listingId: request.listingId,
        sellerId: auction.sellerId,
        buyerId: request.buyerId,
        itemId: auction.itemId,
        quantity: auction.quantity,
        finalPrice: auction.buyoutPrice,
        fees: {
          listingFee: auction.fees.listingFee,
          successFee: SUCCESS_FEE_PERCENTAGE,
          totalFees: auction.fees.listingFee + successFee,
        },
        completedAt: now,
        status: 'completed',
      };

      // 1. Update auction status to sold
      await docClient.send(new UpdateCommand({
        TableName: AUCTION_LISTINGS_TABLE,
        Key: { listingId: request.listingId },
        UpdateExpression: `
          SET #status = :sold,
              completedAt = :completedAt,
              currentBid = :buyoutPrice,
              currentBidderId = :buyerId,
              currentBidderName = :buyerName
        `,
        ConditionExpression: '#status = :active AND expiresAt > :now',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':sold': 'sold',
          ':completedAt': now.toISOString(),
          ':buyoutPrice': auction.buyoutPrice,
          ':buyerId': request.buyerId,
          ':buyerName': buyerCharacter.Item.name,
          ':active': 'active',
          ':now': now.toISOString(),
        },
      }));

      // 2. Refund previous bidder if exists
      if (auction.currentBidderId && auction.currentBid) {
        await docClient.send(new UpdateCommand({
          TableName: CHARACTERS_TABLE,
          Key: { userId: auction.currentBidderId },
          UpdateExpression: 'SET currency = currency + :refund',
          ExpressionAttributeValues: {
            ':refund': auction.currentBid,
          },
        }));
      }

      // 3. Deduct currency from buyer
      await docClient.send(new UpdateCommand({
        TableName: CHARACTERS_TABLE,
        Key: { userId: request.buyerId },
        UpdateExpression: 'SET currency = currency - :buyoutPrice',
        ConditionExpression: 'currency >= :buyoutPrice',
        ExpressionAttributeValues: {
          ':buyoutPrice': auction.buyoutPrice,
        },
      }));

      // 4. Pay seller (minus success fee)
      await docClient.send(new UpdateCommand({
        TableName: CHARACTERS_TABLE,
        Key: { userId: auction.sellerId },
        UpdateExpression: 'SET currency = currency + :payment',
        ExpressionAttributeValues: {
          ':payment': sellerPayment,
        },
      }));

      // 5. Transfer item from seller to buyer
      // Remove from seller's reserved items
      await docClient.send(new UpdateCommand({
        TableName: INVENTORY_TABLE,
        Key: {
          userId: auction.sellerId,
          itemId: auction.itemId,
        },
        UpdateExpression: 'SET #listed = #listed - :qty',
        ExpressionAttributeNames: {
          '#listed': 'listedQuantity',
        },
        ExpressionAttributeValues: {
          ':qty': auction.quantity,
        },
      }));

      // Add to buyer's inventory
      await docClient.send(new UpdateCommand({
        TableName: INVENTORY_TABLE,
        Key: {
          userId: request.buyerId,
          itemId: auction.itemId,
        },
        UpdateExpression: `
          SET quantity = if_not_exists(quantity, :zero) + :qty,
              itemName = if_not_exists(itemName, :itemName),
              itemRarity = if_not_exists(itemRarity, :itemRarity),
              acquiredAt = :now
        `,
        ExpressionAttributeValues: {
          ':qty': auction.quantity,
          ':zero': 0,
          ':itemName': auction.itemName,
          ':itemRarity': auction.itemRarity,
          ':now': now.toISOString(),
        },
      }));

      // 6. Record currency transactions
      const buyerTransactionId = uuidv4();
      const sellerTransactionId = uuidv4();

      await Promise.all([
        // Buyer transaction
        docClient.send(new PutCommand({
          TableName: CURRENCY_TRANSACTIONS_TABLE,
          Item: {
            transactionId: buyerTransactionId,
            userId: request.buyerId,
            type: 'spent',
            amount: auction.buyoutPrice,
            source: 'auction',
            description: `Bought ${auction.quantity}x ${auction.itemName}`,
            metadata: {
              auctionId: request.listingId,
              itemId: auction.itemId,
            },
            timestamp: now.toISOString(),
            balanceAfter: buyerCharacter.Item.currency - auction.buyoutPrice,
          },
        })),
        // Seller transaction
        docClient.send(new PutCommand({
          TableName: CURRENCY_TRANSACTIONS_TABLE,
          Item: {
            transactionId: sellerTransactionId,
            userId: auction.sellerId,
            type: 'earned',
            amount: sellerPayment,
            source: 'auction',
            description: `Sold ${auction.quantity}x ${auction.itemName}`,
            metadata: {
              auctionId: request.listingId,
              itemId: auction.itemId,
            },
            timestamp: now.toISOString(),
            balanceAfter: sellerPayment, // We don't have seller's current balance, this is approximate
          },
        })),
      ]);

      console.log('Buyout completed successfully:', request.listingId);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'Buyout completed successfully',
          transaction,
          finalPrice: auction.buyoutPrice,
          fees: transaction.fees,
        }),
      };

    } catch (transactionError) {
      console.error('Buyout transaction failed:', transactionError);
      
      // Attempt to revert auction status if possible
      try {
        await docClient.send(new UpdateCommand({
          TableName: AUCTION_LISTINGS_TABLE,
          Key: { listingId: request.listingId },
          UpdateExpression: 'SET #status = :active REMOVE completedAt',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: { ':active': 'active' },
        }));
      } catch (revertError) {
        console.error('Failed to revert auction status:', revertError);
      }

      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Failed to complete buyout' }),
      };
    }

  } catch (error) {
    console.error('Error processing buyout:', error);
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