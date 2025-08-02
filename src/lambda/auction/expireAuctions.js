"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require('uuid');
const client = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
const AUCTION_LISTINGS_TABLE = process.env.AUCTION_LISTINGS_TABLE;
const CHARACTERS_TABLE = process.env.CHARACTERS_TABLE;
const INVENTORY_TABLE = process.env.INVENTORY_TABLE;
const CURRENCY_TRANSACTIONS_TABLE = process.env.CURRENCY_TRANSACTIONS_TABLE;
const SUCCESS_FEE_PERCENTAGE = 0.10;
const handler = async (event) => {
    try {
        console.log('Processing auction expirations:', event);
        const now = new Date();
        const nowIso = now.toISOString();
        const expiredAuctions = await docClient.send(new lib_dynamodb_1.QueryCommand({
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
        for (const auction of auctions) {
            try {
                await processExpiredAuction(auction, now);
                processedCount++;
            }
            catch (error) {
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
    }
    catch (error) {
        console.error('Error in auction expiration handler:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' }),
        };
    }
};
exports.handler = handler;
async function processExpiredAuction(auction, now) {
    console.log(`Processing expired auction: ${auction.listingId}`);
    if (auction.currentBidderId && auction.currentBid) {
        await completeAuctionSale(auction, now);
    }
    else {
        await returnAuctionItems(auction, now);
    }
}
async function completeAuctionSale(auction, now) {
    console.log(`Completing sale for auction: ${auction.listingId}`);
    const finalPrice = auction.currentBid;
    const successFee = Math.floor(finalPrice * SUCCESS_FEE_PERCENTAGE);
    const sellerPayment = finalPrice - successFee;
    try {
        const transactionId = uuidv4();
        const transaction = {
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
        await docClient.send(new lib_dynamodb_1.UpdateCommand({
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
        await docClient.send(new lib_dynamodb_1.UpdateCommand({
            TableName: CHARACTERS_TABLE,
            Key: { userId: auction.sellerId },
            UpdateExpression: 'SET currency = currency + :payment',
            ExpressionAttributeValues: {
                ':payment': sellerPayment,
            },
        }));
        await docClient.send(new lib_dynamodb_1.UpdateCommand({
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
        await docClient.send(new lib_dynamodb_1.UpdateCommand({
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
        const buyerTransactionId = uuidv4();
        const sellerTransactionId = uuidv4();
        await Promise.all([
            docClient.send(new lib_dynamodb_1.PutCommand({
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
                    balanceAfter: 0,
                },
            })),
            docClient.send(new lib_dynamodb_1.PutCommand({
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
                    balanceAfter: 0,
                },
            })),
        ]);
        console.log(`Auction sale completed: ${auction.listingId} for ${finalPrice} coins`);
    }
    catch (error) {
        console.error(`Error completing auction sale ${auction.listingId}:`, error);
        throw error;
    }
}
async function returnAuctionItems(auction, now) {
    console.log(`Returning items for expired auction: ${auction.listingId}`);
    try {
        await docClient.send(new lib_dynamodb_1.UpdateCommand({
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
        await docClient.send(new lib_dynamodb_1.UpdateCommand({
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
    }
    catch (error) {
        console.error(`Error returning items for auction ${auction.listingId}:`, error);
        throw error;
    }
}
