/**
 * Lambda function for earning currency
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DatabaseService, TABLE_NAMES } from '../../services/databaseService';
import { Character } from '../../types/character';
import { 
  CurrencyTransaction, 
  EarnCurrencyRequest, 
  CURRENCY_CONFIG 
} from '../../types/currency';
import { v4 as uuidv4 } from 'uuid';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Request body is required',
        }),
      };
    }

    const request: EarnCurrencyRequest = JSON.parse(event.body);

    // Validate request
    if (!request.userId || request.amount === undefined || request.amount === null || !request.source || !request.description) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'userId, amount, source, and description are required',
        }),
      };
    }

    if (request.amount < CURRENCY_CONFIG.MIN_TRANSACTION) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: `Minimum transaction amount is ${CURRENCY_CONFIG.MIN_TRANSACTION}`,
        }),
      };
    }

    // Get character to check current balance
    const character = await DatabaseService.getItem<Character>({
      TableName: TABLE_NAMES.CHARACTERS,
      Key: { userId: request.userId },
    });

    if (!character) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Character not found',
        }),
      };
    }

    const currentBalance = character.currency || 0;
    const newBalance = currentBalance + request.amount;

    // Check maximum balance
    if (newBalance > CURRENCY_CONFIG.MAX_BALANCE) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Maximum balance exceeded',
          maxBalance: CURRENCY_CONFIG.MAX_BALANCE,
          currentBalance,
        }),
      };
    }

    // Create transaction record
    const transaction: CurrencyTransaction = {
      transactionId: uuidv4(),
      userId: request.userId,
      type: 'earned',
      amount: request.amount,
      source: request.source,
      description: request.description,
      metadata: request.metadata,
      timestamp: new Date(),
      balanceAfter: newBalance,
    };

    // Update character currency and save transaction in a transaction
    try {
      // Update character balance
      await DatabaseService.updateItem({
        TableName: TABLE_NAMES.CHARACTERS,
        Key: { userId: request.userId },
        UpdateExpression: 'SET #currency = :currency, #lastActiveAt = :lastActiveAt',
        ExpressionAttributeNames: {
          '#currency': 'currency',
          '#lastActiveAt': 'lastActiveAt',
        },
        ExpressionAttributeValues: {
          ':currency': newBalance,
          ':lastActiveAt': new Date(),
        },
      });

      // Save transaction record
      await DatabaseService.putItem({
        TableName: TABLE_NAMES.CURRENCY_TRANSACTIONS,
        Item: transaction,
      });

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          transaction,
          newBalance,
          message: `Earned ${request.amount} steam coins`,
        }),
      };
    } catch (dbError) {
      console.error('Database error:', dbError);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Failed to process currency transaction',
        }),
      };
    }
  } catch (error) {
    console.error('Error earning currency:', error);

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