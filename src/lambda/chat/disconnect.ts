import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const connectionId = event.requestContext.connectionId!;

    // Remove connection information
    await docClient.send(new DeleteCommand({
      TableName: process.env.CHAT_CONNECTIONS_TABLE!,
      Key: {
        connectionId,
      },
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Disconnected successfully' }),
    };
  } catch (error) {
    console.error('Disconnection error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to disconnect' }),
    };
  }
};