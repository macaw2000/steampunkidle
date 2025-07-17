/**
 * Lambda function for getting currency transaction history
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DatabaseService, TABLE_NAMES } from '../../services/databaseService';
import { 
  CurrencyTransaction, 
  CurrencyHistory, 
  CURRENCY_CONFIG 
} from '../../types/currency';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Get userId from path parameters
    const userId = event.pathParameters?.userId;

    if (!userId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'userId is required',
        }),
      };
    }

    // Parse query parameters
    const page = parseInt(event.queryStringParameters?.page || '1');
    const limit = Math.min(
      parseInt(event.queryStringParameters?.limit || '20'),
      CURRENCY_CONFIG.TRANSACTION_HISTORY_LIMIT
    );
    const source = event.queryStringParameters?.source;

    // Build query parameters
    const queryParams: any = {
      TableName: TABLE_NAMES.CURRENCY_TRANSACTIONS,
      IndexName: 'userId-timestamp-index',
      KeyConditionExpression: '#userId = :userId',
      ExpressionAttributeNames: {
        '#userId': 'userId',
      },
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      ScanIndexForward: false, // Sort by timestamp descending (newest first)
      Limit: limit,
    };

    // Add source filter if provided
    if (source) {
      queryParams.FilterExpression = '#source = :source';
      queryParams.ExpressionAttributeNames['#source'] = 'source';
      queryParams.ExpressionAttributeValues[':source'] = source;
    }

    // Handle pagination
    if (page > 1) {
      // For simplicity, we'll use a basic offset approach
      // In production, you'd want to use LastEvaluatedKey for better performance
      const skipCount = (page - 1) * limit;
      
      // First, get all items up to the current page
      const allItemsQuery = {
        ...queryParams,
        Limit: skipCount + limit,
      };
      
      const allItemsResult = await DatabaseService.query(allItemsQuery);
      const transactions = allItemsResult.items?.slice(skipCount) || [];
      
      // Get total count for pagination info
      const countQuery = {
        ...queryParams,
        Select: 'COUNT',
        Limit: undefined,
      };
      const countResult = await DatabaseService.query(countQuery);
      const totalCount = countResult.count || 0;
      
      const history: CurrencyHistory = {
        userId,
        transactions: transactions as CurrencyTransaction[],
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
      };

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          history,
        }),
      };
    } else {
      // First page - simpler query
      const result = await DatabaseService.query(queryParams);
      
      // Get total count for pagination info
      const countQuery = {
        ...queryParams,
        Select: 'COUNT',
        Limit: undefined,
      };
      const countResult = await DatabaseService.query(countQuery);
      const totalCount = countResult.count || 0;
      
      const history: CurrencyHistory = {
        userId,
        transactions: (result.items || []) as CurrencyTransaction[],
        totalPages: Math.ceil(totalCount / limit),
        currentPage: 1,
      };

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          history,
        }),
      };
    }
  } catch (error) {
    console.error('Error getting currency history:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Internal server error',
      }),
    };
  }
};