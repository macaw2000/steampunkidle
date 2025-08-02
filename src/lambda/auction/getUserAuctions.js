"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
const AUCTION_LISTINGS_TABLE = process.env.AUCTION_LISTINGS_TABLE;
const handler = async (event) => {
    try {
        const userId = event.pathParameters?.userId;
        const type = event.queryStringParameters?.type || 'all';
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
        let sellingAuctions = [];
        let biddingAuctions = [];
        if (type === 'selling' || type === 'all') {
            try {
                const sellingResult = await docClient.send(new lib_dynamodb_1.QueryCommand({
                    TableName: AUCTION_LISTINGS_TABLE,
                    IndexName: 'seller-index',
                    KeyConditionExpression: 'sellerId = :userId',
                    ExpressionAttributeValues: {
                        ':userId': userId,
                    },
                    ScanIndexForward: false,
                }));
                sellingAuctions = (sellingResult.Items || []).map(item => convertToAuctionListing(item));
            }
            catch (error) {
                console.error('Error getting selling auctions:', error);
            }
        }
        if (type === 'bidding' || type === 'all') {
            try {
                const biddingResult = await docClient.send(new lib_dynamodb_1.ScanCommand({
                    TableName: AUCTION_LISTINGS_TABLE,
                    FilterExpression: 'currentBidderId = :userId',
                    ExpressionAttributeValues: {
                        ':userId': userId,
                    },
                }));
                biddingAuctions = (biddingResult.Items || []).map(item => convertToAuctionListing(item));
            }
            catch (error) {
                console.error('Error getting bidding auctions:', error);
            }
        }
        const categorizeAuctions = (auctions) => {
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
    }
    catch (error) {
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
exports.handler = handler;
function convertToAuctionListing(item) {
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
        bidHistory: (item.bidHistory || []).map((bid) => ({
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
