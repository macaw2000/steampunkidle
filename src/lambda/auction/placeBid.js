"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const databaseService_1 = require("../../services/databaseService");
const { v4: uuidv4 } = require('uuid');
const BID_CONFIG = {
    MIN_BID_INCREMENT: 1,
    MAX_BID_HISTORY: 50,
};
const handler = async (event) => {
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
        const request = JSON.parse(event.body);
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
        const auction = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.AUCTION_LISTINGS,
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
        const bidderCharacter = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.CHARACTERS,
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
        const bid = {
            bidId: uuidv4(),
            bidderId: request.bidderId,
            bidderName: bidderCharacter.name,
            amount: request.bidAmount,
            timestamp: new Date(),
        };
        try {
            let refundUpdates = [];
            if (auction.currentBidderId && auction.currentBid) {
                refundUpdates.push(databaseService_1.DatabaseService.updateItem({
                    TableName: databaseService_1.TABLE_NAMES.CHARACTERS,
                    Key: { userId: auction.currentBidderId },
                    UpdateExpression: 'SET currency = currency + :refund',
                    ExpressionAttributeValues: {
                        ':refund': auction.currentBid,
                    },
                }));
            }
            const reservePromise = databaseService_1.DatabaseService.updateItem({
                TableName: databaseService_1.TABLE_NAMES.CHARACTERS,
                Key: { userId: request.bidderId },
                UpdateExpression: 'SET currency = currency - :bid',
                ConditionExpression: 'currency >= :bid',
                ExpressionAttributeValues: {
                    ':bid': request.bidAmount,
                },
            });
            const bidHistory = [...(auction.bidHistory || []), bid];
            if (bidHistory.length > BID_CONFIG.MAX_BID_HISTORY) {
                bidHistory.splice(0, bidHistory.length - BID_CONFIG.MAX_BID_HISTORY);
            }
            const updateAuctionPromise = databaseService_1.DatabaseService.updateItem({
                TableName: databaseService_1.TABLE_NAMES.AUCTION_LISTINGS,
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
        }
        catch (transactionError) {
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
    }
    catch (error) {
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
exports.handler = handler;
function validatePlaceBidRequest(request) {
    if (!request.listingId || !request.bidderId) {
        return { isValid: false, error: 'Listing ID and Bidder ID are required' };
    }
    if (!request.bidAmount || request.bidAmount < 1) {
        return { isValid: false, error: 'Bid amount must be at least 1' };
    }
    return { isValid: true };
}
