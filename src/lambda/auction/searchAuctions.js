"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
const AUCTION_LISTINGS_TABLE = process.env.AUCTION_LISTINGS_TABLE;
const SEARCH_CONFIG = {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
    DEFAULT_SORT: 'timeLeft',
    DEFAULT_ORDER: 'asc',
};
const handler = async (event) => {
    try {
        console.log('Search auctions request:', event.queryStringParameters);
        const filters = parseSearchFilters(event.queryStringParameters || {});
        console.log('Parsed filters:', filters);
        const queryParams = buildQueryParams(filters);
        const searchResult = await executeSearch(queryParams, filters);
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                result: searchResult,
                filters: filters,
            }),
        };
    }
    catch (error) {
        console.error('Error searching auctions:', error);
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
function parseSearchFilters(queryParams) {
    const filters = {
        limit: Math.min(parseInt(queryParams.limit || SEARCH_CONFIG.DEFAULT_LIMIT.toString()), SEARCH_CONFIG.MAX_LIMIT),
        offset: parseInt(queryParams.offset || '0'),
        sortBy: queryParams.sortBy || SEARCH_CONFIG.DEFAULT_SORT,
        sortOrder: queryParams.sortOrder || SEARCH_CONFIG.DEFAULT_ORDER,
    };
    if (queryParams.itemType) {
        filters.itemType = queryParams.itemType;
    }
    if (queryParams.rarity) {
        filters.rarity = queryParams.rarity;
    }
    if (queryParams.minPrice) {
        filters.minPrice = parseInt(queryParams.minPrice);
    }
    if (queryParams.maxPrice) {
        filters.maxPrice = parseInt(queryParams.maxPrice);
    }
    if (queryParams.sellerName) {
        filters.sellerName = queryParams.sellerName;
    }
    return filters;
}
function buildQueryParams(filters) {
    const now = new Date().toISOString();
    let filterExpression = '#status = :active AND expiresAt > :now';
    let expressionAttributeNames = {
        '#status': 'status',
    };
    let expressionAttributeValues = {
        ':active': 'active',
        ':now': now,
    };
    if (filters.itemType) {
        filterExpression += ' AND contains(itemName, :itemType)';
        expressionAttributeValues[':itemType'] = filters.itemType;
    }
    if (filters.rarity) {
        filterExpression += ' AND itemRarity = :rarity';
        expressionAttributeValues[':rarity'] = filters.rarity;
    }
    if (filters.minPrice) {
        filterExpression += ' AND (currentBid >= :minPrice OR (currentBid = :null AND startingPrice >= :minPrice))';
        expressionAttributeValues[':minPrice'] = filters.minPrice;
        expressionAttributeValues[':null'] = null;
    }
    if (filters.maxPrice) {
        filterExpression += ' AND (currentBid <= :maxPrice OR (currentBid = :null AND startingPrice <= :maxPrice))';
        expressionAttributeValues[':maxPrice'] = filters.maxPrice;
        if (!expressionAttributeValues[':null']) {
            expressionAttributeValues[':null'] = null;
        }
    }
    if (filters.sellerName) {
        filterExpression += ' AND contains(sellerName, :sellerName)';
        expressionAttributeValues[':sellerName'] = filters.sellerName;
    }
    return {
        filterExpression,
        expressionAttributeNames,
        expressionAttributeValues,
    };
}
async function executeSearch(queryParams, filters) {
    try {
        const command = new lib_dynamodb_1.QueryCommand({
            TableName: AUCTION_LISTINGS_TABLE,
            IndexName: 'status-expires-index',
            KeyConditionExpression: '#status = :active',
            FilterExpression: queryParams.filterExpression.replace('#status = :active AND ', ''),
            ExpressionAttributeNames: queryParams.expressionAttributeNames,
            ExpressionAttributeValues: queryParams.expressionAttributeValues,
            Limit: filters.limit + (filters.offset || 0) + 10,
            ScanIndexForward: filters.sortBy === 'timeLeft' ? filters.sortOrder === 'asc' : undefined,
        });
        const result = await docClient.send(command);
        let items = result.Items || [];
        let listings = items.map(item => ({
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
        }));
        if (filters.sortBy !== 'timeLeft') {
            listings = sortListings(listings, filters.sortBy, filters.sortOrder);
        }
        const totalCount = listings.length;
        const startIndex = filters.offset || 0;
        const endIndex = startIndex + filters.limit;
        const paginatedListings = listings.slice(startIndex, endIndex);
        return {
            listings: paginatedListings,
            totalCount,
            hasMore: endIndex < totalCount,
        };
    }
    catch (error) {
        console.error('Error executing search:', error);
        console.log('Falling back to scan operation');
        const scanCommand = new lib_dynamodb_1.ScanCommand({
            TableName: AUCTION_LISTINGS_TABLE,
            FilterExpression: queryParams.filterExpression,
            ExpressionAttributeNames: queryParams.expressionAttributeNames,
            ExpressionAttributeValues: queryParams.expressionAttributeValues,
            Limit: filters.limit + (filters.offset || 0) + 10,
        });
        const scanResult = await docClient.send(scanCommand);
        let items = scanResult.Items || [];
        let listings = items.map(item => ({
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
        }));
        listings = sortListings(listings, filters.sortBy, filters.sortOrder);
        const totalCount = listings.length;
        const startIndex = filters.offset || 0;
        const endIndex = startIndex + filters.limit;
        const paginatedListings = listings.slice(startIndex, endIndex);
        return {
            listings: paginatedListings,
            totalCount,
            hasMore: endIndex < totalCount,
        };
    }
}
function sortListings(listings, sortBy, sortOrder) {
    return listings.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
            case 'price':
                const priceA = a.currentBid || a.startingPrice;
                const priceB = b.currentBid || b.startingPrice;
                comparison = priceA - priceB;
                break;
            case 'timeLeft':
                comparison = a.expiresAt.getTime() - b.expiresAt.getTime();
                break;
            case 'rarity':
                const rarityOrder = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };
                comparison = (rarityOrder[a.itemRarity] || 0) -
                    (rarityOrder[b.itemRarity] || 0);
                break;
            case 'name':
                comparison = a.itemName.localeCompare(b.itemName);
                break;
            default:
                comparison = a.createdAt.getTime() - b.createdAt.getTime();
        }
        return sortOrder === 'desc' ? -comparison : comparison;
    });
}
