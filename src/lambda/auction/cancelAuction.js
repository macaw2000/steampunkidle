"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
const AUCTION_LISTINGS_TABLE = process.env.AUCTION_LISTINGS_TABLE;
const CHARACTERS_TABLE = process.env.CHARACTERS_TABLE;
const INVENTORY_TABLE = process.env.INVENTORY_TABLE;
const handler = async (event) => {
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
        const auctionResult = await docClient.send(new lib_dynamodb_1.GetCommand({
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
            await docClient.send(new lib_dynamodb_1.UpdateCommand({
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
        }
        catch (transactionError) {
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
    }
    catch (error) {
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
exports.handler = handler;
