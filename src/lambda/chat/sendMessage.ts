import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

interface ChatMessage {
  messageId: string;
  channelId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  messageType: 'general' | 'guild' | 'private';
  recipientId?: string;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const connectionId = event.requestContext.connectionId!;
    const domainName = event.requestContext.domainName!;
    const stage = event.requestContext.stage!;
    
    const apiGatewayClient = new ApiGatewayManagementApiClient({
      endpoint: `https://${domainName}/${stage}`,
    });

    // Get user info from connection
    const connectionResult = await docClient.send(new GetCommand({
      TableName: process.env.CHAT_CONNECTIONS_TABLE!,
      Key: {
        connectionId: connectionId,
      },
    }));

    if (!connectionResult.Item) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Connection not found' }),
      };
    }

    const connection = connectionResult.Item;
    const senderId = connection.userId;

    // Get sender's character info for display name
    const characterResult = await docClient.send(new GetCommand({
      TableName: process.env.CHARACTERS_TABLE!,
      Key: { userId: senderId },
    }));

    if (!characterResult.Item) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Character not found' }),
      };
    }

    const senderName = characterResult.Item.name;
    const body = JSON.parse(event.body || '{}');
    const { content, messageType, channelId, recipientId } = body;

    if (!content || !messageType) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Content and messageType are required' }),
      };
    }

    // Validate message type and permissions
    if (messageType === 'guild') {
      // Check if user is in a guild
      const guildMemberResult = await docClient.send(new QueryCommand({
        TableName: process.env.GUILD_MEMBERS_TABLE!,
        IndexName: 'user-guild-index',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': senderId,
        },
      }));

      if (!guildMemberResult.Items || guildMemberResult.Items.length === 0) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'Not a guild member' }),
        };
      }
    }

    if (messageType === 'private' && !recipientId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'recipientId is required for private messages' }),
      };
    }

    const messageId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Determine channel ID based on message type
    let finalChannelId = channelId;
    if (messageType === 'general') {
      finalChannelId = 'general';
    } else if (messageType === 'guild') {
      // Use guild ID as channel ID
      const guildMemberResult = await docClient.send(new QueryCommand({
        TableName: process.env.GUILD_MEMBERS_TABLE!,
        IndexName: 'user-guild-index',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': senderId,
        },
      }));
      finalChannelId = guildMemberResult.Items![0].guildId;
    } else if (messageType === 'private') {
      // Create consistent channel ID for private messages
      const ids = [senderId, recipientId].sort();
      finalChannelId = `private_${ids[0]}_${ids[1]}`;
    }

    // Store message in database
    const message: ChatMessage = {
      messageId,
      channelId: finalChannelId,
      senderId,
      senderName,
      content,
      timestamp,
      messageType,
      recipientId,
    };

    await docClient.send(new PutCommand({
      TableName: process.env.CHAT_MESSAGES_TABLE!,
      Item: {
        ...message,
        ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days TTL
      },
    }));

    // Get all connections that should receive this message
    let targetConnections: any[] = [];

    if (messageType === 'general') {
      // Send to all connected users
      const allConnectionsResult = await docClient.send(new QueryCommand({
        TableName: process.env.CHAT_CONNECTIONS_TABLE!,
        IndexName: 'userId-index',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': senderId,
        },
      }));
      
      // For general chat, we need to scan all connections (this is not ideal for scale)
      // In production, consider using a separate table or caching mechanism
      const scanResult = await docClient.send(new QueryCommand({
        TableName: process.env.CHAT_CONNECTIONS_TABLE!,
        IndexName: 'connectionId-index',
      }));
      
      targetConnections = scanResult.Items || [];
    } else if (messageType === 'guild') {
      // Send to all guild members
      const guildMemberResult = await docClient.send(new QueryCommand({
        TableName: process.env.GUILD_MEMBERS_TABLE!,
        IndexName: 'user-guild-index',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': senderId,
        },
      }));

      if (guildMemberResult.Items && guildMemberResult.Items.length > 0) {
        const guildId = guildMemberResult.Items[0].guildId;
        
        // Get all guild members
        const allGuildMembersResult = await docClient.send(new QueryCommand({
          TableName: process.env.GUILD_MEMBERS_TABLE!,
          KeyConditionExpression: 'guildId = :guildId',
          ExpressionAttributeValues: {
            ':guildId': guildId,
          },
        }));

        // Get connections for all guild members
        const memberIds = allGuildMembersResult.Items?.map(member => member.userId) || [];
        const connectionPromises = memberIds.map(userId =>
          docClient.send(new QueryCommand({
            TableName: process.env.CHAT_CONNECTIONS_TABLE!,
            IndexName: 'userId-index',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
              ':userId': userId,
            },
          }))
        );

        const connectionResults = await Promise.all(connectionPromises);
        targetConnections = connectionResults.flatMap(result => result.Items || []);
      }
    } else if (messageType === 'private') {
      // Send to sender and recipient
      const senderConnectionsResult = await docClient.send(new QueryCommand({
        TableName: process.env.CHAT_CONNECTIONS_TABLE!,
        IndexName: 'userId-index',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': senderId,
        },
      }));

      const recipientConnectionsResult = await docClient.send(new QueryCommand({
        TableName: process.env.CHAT_CONNECTIONS_TABLE!,
        IndexName: 'userId-index',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': recipientId,
        },
      }));

      targetConnections = [
        ...(senderConnectionsResult.Items || []),
        ...(recipientConnectionsResult.Items || []),
      ];
    }

    // Send message to all target connections
    const sendPromises = targetConnections.map(async (connection) => {
      try {
        await apiGatewayClient.send(new PostToConnectionCommand({
          ConnectionId: connection.connectionId,
          Data: JSON.stringify({
            type: 'message',
            data: message,
          }),
        }));
      } catch (error) {
        console.error(`Failed to send message to connection ${connection.connectionId}:`, error);
        // Remove stale connection
        await docClient.send(new DeleteCommand({
          TableName: process.env.CHAT_CONNECTIONS_TABLE!,
          Key: {
            connectionId: connection.connectionId,
          },
        }));
      }
    });

    await Promise.all(sendPromises);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Message sent successfully',
        messageId,
      }),
    };
  } catch (error) {
    console.error('Send message error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send message' }),
    };
  }
};