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
        const request = JSON.parse(event.body);
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
        const auctionResult = await docClient.send(new lib_dynamodb_1.GetCommand({
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
        const buyerCharacter = await docClient.send(new lib_dynamodb_1.GetCommand({
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
        const successFee = Math.floor(auction.buyoutPrice * SUCCESS_FEE_PERCENTAGE);
        const sellerPayment = auction.buyoutPrice - successFee;
        try {
            const now = new Date();
            const transactionId = uuidv4();
            const transaction = {
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
            await docClient.send(new lib_dynamodb_1.UpdateCommand({
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
            if (auction.currentBidderId && auction.currentBid) {
                await docClient.send(new lib_dynamodb_1.UpdateCommand({
                    TableName: CHARACTERS_TABLE,
                    Key: { userId: auction.currentBidderId },
                    UpdateExpression: 'SET currency = currency + :refund',
                    ExpressionAttributeValues: {
                        ':refund': auction.currentBid,
                    },
                }));
            }
            await docClient.send(new lib_dynamodb_1.UpdateCommand({
                TableName: CHARACTERS_TABLE,
                Key: { userId: request.buyerId },
                UpdateExpression: 'SET currency = currency - :buyoutPrice',
                ConditionExpression: 'currency >= :buyoutPrice',
                ExpressionAttributeValues: {
                    ':buyoutPrice': auction.buyoutPrice,
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
            const buyerTransactionId = uuidv4();
            const sellerTransactionId = uuidv4();
            await Promise.all([
                docClient.send(new lib_dynamodb_1.PutCommand({
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
                docClient.send(new lib_dynamodb_1.PutCommand({
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
                        balanceAfter: sellerPayment,
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
        }
        catch (transactionError) {
            console.error('Buyout transaction failed:', transactionError);
            try {
                await docClient.send(new lib_dynamodb_1.UpdateCommand({
                    TableName: AUCTION_LISTINGS_TABLE,
                    Key: { listingId: request.listingId },
                    UpdateExpression: 'SET #status = :active REMOVE completedAt',
                    ExpressionAttributeNames: { '#status': 'status' },
                    ExpressionAttributeValues: { ':active': 'active' },
                }));
            }
            catch (revertError) {
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
    }
    catch (error) {
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
exports.handler = handler;
