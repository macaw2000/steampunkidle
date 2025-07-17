import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { channelId, messageType, limit = '50', lastEvaluatedKey } = event.queryStringParameters || {};
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    if (!channelId || !messageType) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'channelId and messageType are required' }),
      };
    }

    // Validate user has access to the channel
    if (messageType === 'guild') {
      // Check if user is in the guild
      const guildMemberResult = await docClient.send(new QueryCommand({
        TableName: process.env.GUILD_MEMBERS_TABLE!,
        KeyConditionExpression: 'guildId = :guildId AND userId = :userId',
        ExpressionAttributeValues: {
          ':guildId': channelId,
          ':userId': userId,
        },
      }));

      if (!guildMemberResult.Items || guildMemberResult.Items.length === 0) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'Access denied to guild channel' }),
        };
      }
    } else if (messageType === 'private') {
      // Check if user is part of the private conversation
      if (!channelId.includes(userId)) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'Access denied to private conversation' }),
        };
      }
    }

    // Query message history
    const queryParams: any = {
      TableName: process.env.CHAT_MESSAGES_TABLE!,
      KeyConditionExpression: 'channelId = :channelId',
      ExpressionAttributeValues: {
        ':channelId': channelId,
      },
      ScanIndexForward: false, // Get newest messages first
      Limit: parseInt(limit),
    };

    if (lastEvaluatedKey) {
      queryParams.ExclusiveStartKey = JSON.parse(decodeURIComponent(lastEvaluatedKey));
    }

    const result = await docClient.send(new QueryCommand(queryParams));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        messages: result.Items || [],
        lastEvaluatedKey: result.LastEvaluatedKey ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey)) : null,
      }),
    };
  } catch (error) {
    console.error('Get message history error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to get message history' }),
    };
  }
};