import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { limit = '50', lastEvaluatedKey } = event.queryStringParameters || {};
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    // Query private messages for the user using GSI
    const queryParams: any = {
      TableName: process.env.CHAT_MESSAGES_TABLE!,
      IndexName: 'recipient-index',
      KeyConditionExpression: 'recipientId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      ScanIndexForward: false, // Get newest messages first
      Limit: parseInt(limit),
    };

    if (lastEvaluatedKey) {
      queryParams.ExclusiveStartKey = JSON.parse(decodeURIComponent(lastEvaluatedKey));
    }

    const result = await docClient.send(new QueryCommand(queryParams));

    // Also get messages sent by the user (for complete conversation history)
    const sentMessagesParams: any = {
      TableName: process.env.CHAT_MESSAGES_TABLE!,
      FilterExpression: 'senderId = :userId AND messageType = :messageType',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':messageType': 'private',
      },
      ScanIndexForward: false,
      Limit: parseInt(limit),
    };

    // Note: This is a scan operation which is not ideal for production
    // Consider creating a GSI for senderId for better performance
    const sentResult = await docClient.send(new QueryCommand(sentMessagesParams));

    // Combine and sort messages
    const allMessages = [
      ...(result.Items || []),
      ...(sentResult.Items || []),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Remove duplicates and limit results
    const uniqueMessages = allMessages
      .filter((message, index, self) => 
        index === self.findIndex(m => m.messageId === message.messageId)
      )
      .slice(0, parseInt(limit));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        messages: uniqueMessages,
        lastEvaluatedKey: result.LastEvaluatedKey ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey)) : null,
      }),
    };
  } catch (error) {
    console.error('Get private messages error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to get private messages' }),
    };
  }
};