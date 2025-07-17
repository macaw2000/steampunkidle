import { handler } from '../getMessageHistory';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('Chat Get Message History Handler', () => {
  beforeEach(() => {
    ddbMock.reset();
    process.env.CHAT_MESSAGES_TABLE = 'test-chat-messages';
    process.env.GUILD_MEMBERS_TABLE = 'test-guild-members';
  });

  it('should successfully get general chat message history', async () => {
    const mockMessages = [
      {
        messageId: 'msg-1',
        channelId: 'general',
        senderId: 'user-1',
        senderName: 'Player1',
        content: 'Hello everyone!',
        timestamp: '2023-01-01T12:00:00Z',
        messageType: 'general',
      },
      {
        messageId: 'msg-2',
        channelId: 'general',
        senderId: 'user-2',
        senderName: 'Player2',
        content: 'Hi there!',
        timestamp: '2023-01-01T12:01:00Z',
        messageType: 'general',
      },
    ];

    ddbMock.on(QueryCommand).resolves({
      Items: mockMessages,
      LastEvaluatedKey: undefined,
    });

    const event = {
      queryStringParameters: {
        channelId: 'general',
        messageType: 'general',
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
    expect(responseBody.messages).toEqual(mockMessages);
    expect(responseBody.lastEvaluatedKey).toBeNull();

    expect(ddbMock.commandCalls(QueryCommand)).toHaveLength(1);
    const queryCall = ddbMock.commandCalls(QueryCommand)[0];
    expect(queryCall.args[0].input).toMatchObject({
      TableName: 'test-chat-messages',
      KeyConditionExpression: 'channelId = :channelId',
      ExpressionAttributeValues: {
        ':channelId': 'general',
      },
      ScanIndexForward: false,
      Limit: 50,
    });
  });

  it('should successfully get guild chat message history for guild member', async () => {
    const mockMessages = [
      {
        messageId: 'msg-1',
        channelId: 'guild-123',
        senderId: 'user-1',
        senderName: 'Player1',
        content: 'Guild meeting tonight!',
        timestamp: '2023-01-01T12:00:00Z',
        messageType: 'guild',
      },
    ];

    ddbMock.on(QueryCommand).callsFake((input) => {
      if (input.TableName === 'test-guild-members') {
        return Promise.resolve({
          Items: [{ guildId: 'guild-123', userId: 'test-user-id' }],
        });
      }
      if (input.TableName === 'test-chat-messages') {
        return Promise.resolve({
          Items: mockMessages,
          LastEvaluatedKey: undefined,
        });
      }
      return Promise.resolve({ Items: [] });
    });

    const event = {
      queryStringParameters: {
        channelId: 'guild-123',
        messageType: 'guild',
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
    expect(responseBody.messages).toEqual(mockMessages);
  });

  it('should return 401 when user is not authorized', async () => {
    const event = {
      queryStringParameters: {
        channelId: 'general',
        messageType: 'general',
      },
      requestContext: {},
    } as any;

    const result = await handler(event, {} as any, {} as any);

    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Unauthorized',
    });
  });

  it('should return 400 when channelId is missing', async () => {
    const event = {
      queryStringParameters: {
        messageType: 'general',
      },
      requestContext: {
        authorizer: {
          userId: 'test-user-id',
        },
      },
    } as any;

    const result = await handler(event, {} as any, {} as any);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'channelId and messageType are required',
    });
  });

  it('should return 403 when user is not a guild member for guild channel', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] }); // No guild membership

    const event = {
      queryStringParameters: {
        channelId: 'guild-123',
        messageType: 'guild',
      },
      requestContext: {
        authorizer: {
          userId: 'test-user-id',
        },
      },
    } as any;

    const result = await handler(event, {} as any, {} as any);

    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Access denied to guild channel',
    });
  });

  it('should return 403 when user tries to access private conversation they are not part of', async () => {
    const event = {
      queryStringParameters: {
        channelId: 'private_user1_user2',
        messageType: 'private',
      },
      requestContext: {
        authorizer: {
          userId: 'test-user-id', // Not part of the conversation
        },
      },
    } as any;

    const result = await handler(event, {} as any, {} as any);

    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Access denied to private conversation',
    });
  });

  it('should handle pagination with lastEvaluatedKey', async () => {
    const mockMessages = [
      {
        messageId: 'msg-1',
        channelId: 'general',
        senderId: 'user-1',
        senderName: 'Player1',
        content: 'Hello everyone!',
        timestamp: '2023-01-01T12:00:00Z',
        messageType: 'general',
      },
    ];

    const mockLastEvaluatedKey = { channelId: 'general', timestamp: '2023-01-01T12:00:00Z' };

    ddbMock.on(QueryCommand).resolves({
      Items: mockMessages,
      LastEvaluatedKey: mockLastEvaluatedKey,
    });

    const event = {
      queryStringParameters: {
        channelId: 'general',
        messageType: 'general',
        limit: '10',
        lastEvaluatedKey: encodeURIComponent(JSON.stringify({ channelId: 'general', timestamp: '2023-01-01T11:00:00Z' })),
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
    expect(queryCall.args[0].input.ExclusiveStartKey).toEqual({ channelId: 'general', timestamp: '2023-01-01T11:00:00Z' });
  });
});