import { handler } from '../getPrivateMessages';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('Chat Get Private Messages Handler', () => {
  beforeEach(() => {
    ddbMock.reset();
    process.env.CHAT_MESSAGES_TABLE = 'test-chat-messages';
  });

  it('should successfully get private messages for a user', async () => {
    const mockReceivedMessages = [
      {
        messageId: 'msg-1',
        channelId: 'private_user1_user2',
        senderId: 'user1',
        senderName: 'Player1',
        content: 'Hey there!',
        timestamp: '2023-01-01T12:00:00Z',
        messageType: 'private',
        recipientId: 'test-user-id',
      },
    ];

    const mockSentMessages = [
      {
        messageId: 'msg-2',
        channelId: 'private_user1_user2',
        senderId: 'test-user-id',
        senderName: 'TestPlayer',
        content: 'Hello!',
        timestamp: '2023-01-01T12:01:00Z',
        messageType: 'private',
        recipientId: 'user1',
      },
    ];

    ddbMock.on(QueryCommand).callsFake((input) => {
      if (input.IndexName === 'recipient-index') {
        return Promise.resolve({
          Items: mockReceivedMessages,
          LastEvaluatedKey: undefined,
        });
      }
      // For sent messages query
      return Promise.resolve({
        Items: mockSentMessages,
        LastEvaluatedKey: undefined,
      });
    });

    const event = {
      queryStringParameters: {
        limit: '50',
      },
      requestContext: {
        authorizer: {
          userId: 'test-user-id',
        },
      },
    } as any;

    const result = await handler(event, {} as any, {} as any);

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body);
    
    // Should contain both received and sent messages, sorted by timestamp
    expect(responseBody.messages).toHaveLength(2);
    expect(responseBody.messages[0].messageId).toBe('msg-2'); // Newer message first
    expect(responseBody.messages[1].messageId).toBe('msg-1');

    expect(ddbMock.commandCalls(QueryCommand)).toHaveLength(2);
  });

  it('should return 401 when user is not authorized', async () => {
    const event = {
      queryStringParameters: {
        limit: '50',
      },
      requestContext: {},
    } as any;

    const result = await handler(event, {} as any, {} as any);

    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Unauthorized',
    });
  });

  it('should handle empty results', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [],
      LastEvaluatedKey: undefined,
    });

    const event = {
      queryStringParameters: {
        limit: '50',
      },
      requestContext: {
        authorizer: {
          userId: 'test-user-id',
        },
      },
    } as any;

    const result = await handler(event, {} as any, {} as any);

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.messages).toEqual([]);
    expect(responseBody.lastEvaluatedKey).toBeNull();
  });

  it('should handle pagination with lastEvaluatedKey', async () => {
    const mockMessages = [
      {
        messageId: 'msg-1',
        channelId: 'private_user1_user2',
        senderId: 'user1',
        senderName: 'Player1',
        content: 'Hey there!',
        timestamp: '2023-01-01T12:00:00Z',
        messageType: 'private',
        recipientId: 'test-user-id',
      },
    ];

    const mockLastEvaluatedKey = { recipientId: 'test-user-id', timestamp: '2023-01-01T12:00:00Z' };

    ddbMock.on(QueryCommand).callsFake((input) => {
      if (input.IndexName === 'recipient-index') {
        return Promise.resolve({
          Items: mockMessages,
          LastEvaluatedKey: mockLastEvaluatedKey,
        });
      }
      return Promise.resolve({
        Items: [],
        LastEvaluatedKey: undefined,
      });
    });

    const event = {
      queryStringParameters: {
        limit: '10',
        lastEvaluatedKey: encodeURIComponent(JSON.stringify({ recipientId: 'test-user-id', timestamp: '2023-01-01T11:00:00Z' })),
      },
      requestContext: {
        authorizer: {
          userId: 'test-user-id',
        },
      },
    } as any;

    const result = await handler(event, {} as any, {} as any);

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.messages).toEqual(mockMessages);
    expect(responseBody.lastEvaluatedKey).toBe(encodeURIComponent(JSON.stringify(mockLastEvaluatedKey)));

    const queryCall = ddbMock.commandCalls(QueryCommand)[0];
    expect(queryCall.args[0].input.ExclusiveStartKey).toEqual({ recipientId: 'test-user-id', timestamp: '2023-01-01T11:00:00Z' });
  });

  it('should remove duplicate messages when user sends and receives from same conversation', async () => {
    const duplicateMessage = {
      messageId: 'msg-1',
      channelId: 'private_user1_user2',
      senderId: 'test-user-id',
      senderName: 'TestPlayer',
      content: 'Hello!',
      timestamp: '2023-01-01T12:00:00Z',
      messageType: 'private',
      recipientId: 'user1',
    };

    ddbMock.on(QueryCommand).resolves({
      Items: [duplicateMessage], // Same message returned from both queries
      LastEvaluatedKey: undefined,
    });

    const event = {
      queryStringParameters: {
        limit: '50',
      },
      requestContext: {
        authorizer: {
          userId: 'test-user-id',
        },
      },
    } as any;

    const result = await handler(event, {} as any, {} as any);

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.messages).toHaveLength(1); // Should deduplicate
    expect(responseBody.messages[0].messageId).toBe('msg-1');
  });

  it('should handle database errors', async () => {
    ddbMock.on(QueryCommand).rejects(new Error('Database error'));

    const event = {
      queryStringParameters: {
        limit: '50',
      },
      requestContext: {
        authorizer: {
          userId: 'test-user-id',
        },
      },
    } as any;

    const result = await handler(event, {} as any, {} as any);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Failed to get private messages',
    });
  });
});