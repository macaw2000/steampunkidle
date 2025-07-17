/**
 * Lambda function to handle auction expiration (scheduled event)
 */

import { EventBridgeEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
const { v4: uuidv4 } = require('uuid');
import { AuctionTransaction } from '../../types/auction';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const AUCTION_LISTINGS_TABLE = process.env.AUCTION_LISTINGS_TABLE!;
const CHARACTERS_TABLE = process.env.CHARACTERS_TABLE!;
const INVENTORY_TABLE = process.env.INVENTORY_TABLE!;
const CURRENCY_TRANSACTIONS_TABLE = process.env.CURRENCY_TRANSACTIONS_TABLE!;

const SUCCESS_FEE_PERCENTAGE = 0.10; // 10% success fee

export const handler = async (event: EventBridgeEvent<string, any>) => {
  try {
    console.log('Processing auction expirations:', event);

    const now = new Date();
    const nowIso = now.toISOString();

    // Find expired active auctions
    const expiredAuctions = await docClient.send(new QueryCommand({
      TableName: AUCTION_LISTINGS_TABLE,
      IndexName: 'status-expires-index',
      KeyConditionExpression: '#status = :active AND expiresAt <= :now',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':active': 'active',
        ':now': nowIso,
      },
    }));

    const auctions = expiredAuctions.Items || [];
    console.log(`Found ${auctions.length} expired auctions to process`);

    let processedCount = 0;
    let errorCount = 0;

    // Process each expired auction
    for (const auction of auctions) {
      try {
        await processExpiredAuction(auction, now);
        processedCount++;
      } catch (error) {
        console.error(`Error processing auction ${auction.listingId}:`, error);
        errorCount++;
      }
    }

    console.log(`Processed ${processedCount} auctions, ${errorCount} errors`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Auction expiration processing completed',
        processed: processedCount,
        errors: errorCount,
        total: auctions.length,
      }),
    };

  } catch (error) {
    console.error('Error in auction expiration handler:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

async function processExpiredAuction(auction: any, now: Date) {
  console.log(`Processing expired auction: ${auction.listingId}`);

  // If there's a winning bid, complete the sale
  if (auction.currentBidderId && auction.currentBid) {
    await completeAuctionSale(auction, now);
  } else {
    // No bids, return items to seller
    await returnAuctionItems(auction, now);
  }
}

async function completeAuctionSale(auction: any, now: Date) {
  console.log(`Completing sale for auction: ${auction.listingId}`);

  const finalPrice = auction.currentBid;
  const successFee = Math.floor(finalPrice * SUCCESS_FEE_PERCENTAGE);
  const sellerPayment = finalPrice - successFee;

  try {
    const transactionId = uuidv4();

    // Create transaction record
    const transaction: AuctionTransaction = {
      transactionId,
      listingId: auction.listingId,
      sellerId: auction.sellerId,
      buyerId: auction.currentBidderId,
      itemId: auction.itemId,
      quantity: auction.quantity,
      finalPrice,
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
      Key: { listingId: auction.listingId },
      UpdateExpression: 'SET #status = :sold, completedAt = :completedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':sold': 'sold',
        ':completedAt': now.toISOString(),
      },
    }));

    // 2. Pay seller (buyer's currency was already reserved when they bid)
    await docClient.send(new UpdateCommand({
      TableName: CHARACTERS_TABLE,
      Key: { userId: auction.sellerId },
      UpdateExpression: 'SET currency = currency + :payment',
      ExpressionAttributeValues: {
        ':payment': sellerPayment,
      },
    }));

    // 3. Transfer item from seller to buyer
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
        userId: auction.currentBidderId,
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

    // 4. Record currency transactions
    const buyerTransactionId = uuidv4();
    const sellerTransactionId = uuidv4();

    await Promise.all([
      // Buyer transaction (they already paid when bidding, this is just for record)
      docClient.send(new PutCommand({
        TableName: CURRENCY_TRANSACTIONS_TABLE,
        Item: {
          transactionId: buyerTransactionId,
          userId: auction.currentBidderId,
          type: 'spent',
          amount: finalPrice,
          source: 'auction',
          description: `Won auction: ${auction.quantity}x ${auction.itemName}`,
          metadata: {
            auctionId: auction.listingId,
            itemId: auction.itemId,
          },
          timestamp: now.toISOString(),
          balanceAfter: 0, // We don't track exact balance here
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
          description: `Auction completed: ${auction.quantity}x ${auction.itemName}`,
          metadata: {
            auctionId: auction.listingId,
            itemId: auction.itemId,
          },
          timestamp: now.toISOString(),
          balanceAfter: 0, // We don't track exact balance here
        },
      })),
    ]);

    console.log(`Auction sale completed: ${auction.listingId} for ${finalPrice} coins`);

  } catch (error) {
    console.error(`Error completing auction sale ${auction.listingId}:`, error);
    throw error;
  }
}

async function returnAuctionItems(auction: any, now: Date) {
  console.log(`Returning items for expired auction: ${auction.listingId}`);

  try {
    // 1. Update auction status to expired
    await docClient.send(new UpdateCommand({
      TableName: AUCTION_LISTINGS_TABLE,
      Key: { listingId: auction.listingId },
      UpdateExpression: 'SET #status = :expired, completedAt = :completedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':expired': 'expired',
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

    console.log(`Items returned for expired auction: ${auction.listingId}`);

  } catch (error) {
    console.error(`Error returning items for auction ${auction.listingId}:`, error);
    throw error;
  }
}