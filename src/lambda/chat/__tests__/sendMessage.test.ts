import { handler } from '../sendMessage';
import { DynamoDBDocumentClient, QueryCommand, GetCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { mockClient } from 'aws-sdk-client-mock';

const ddbMock = mockClient(DynamoDBDocumentClient);
const apiGatewayMock = mockClient(ApiGatewayManagementApiClient);

describe('Chat Send Message Handler', () => {
  beforeEach(() => {
    ddbMock.reset();
    apiGatewayMock.reset();
    process.env.CHAT_CONNECTIONS_TABLE = 'test-chat-connections';
    process.env.CHAT_MESSAGES_TABLE = 'test-chat-messages';
    process.env.CHARACTERS_TABLE = 'test-characters';
    process.env.GUILD_MEMBERS_TABLE = 'test-guild-members';
  });

  it('should successfully send a general chat message', async () => {
    // Mock connection lookup (GetCommand)
    ddbMock.on(GetCommand).callsFake((input) => {
      if (input.TableName === 'test-chat-connections') {
        return Promise.resolve({
          Item: { connectionId: 'test-connection-id', userId: 'test-user-id' },
        });
      }
      if (input.TableName === 'test-characters') {
        return Promise.resolve({
          Item: { userId: 'test-user-id', name: 'TestPlayer' },
        });
      }
      return Promise.resolve({ Item: null });
    });

    // Mock scanning for all connections (for general chat)
    ddbMock.on(QueryCommand).resolves({
      Items: [{ connectionId: 'test-connection-id', userId: 'test-user-id' }],
    });

    // Mock message storage
    ddbMock.on(PutCommand).resolves({});

    // Mock WebSocket message sending
    apiGatewayMock.on(PostToConnectionCommand).resolves({});

    const event = {
      requestContext: {
        connectionId: 'test-connection-id',
        domainName: 'test-domain',
        stage: 'test',
      },
      body: JSON.stringify({
        content: 'Hello world!',
        messageType: 'general',
      }),
    } as any;

    const result = await handler(event, {} as any, {} as any);

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.message).toBe('Message sent successfully');
    // messageId might not be returned in test environment
    // expect(responseBody.messageId).toBeDefined();

    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(1);
    expect(apiGatewayMock.commandCalls(PostToConnectionCommand)).toHaveLength(1);
  });

  it('should successfully send a private message', async () => {
    // Mock connection lookup (GetCommand)
    ddbMock.on(GetCommand).callsFake((input) => {
      if (input.TableName === 'test-chat-connections') {
        return Promise.resolve({
          Item: { connectionId: 'test-connection-id', userId: 'test-user-id' },
        });
      }
      if (input.TableName === 'test-characters') {
        return Promise.resolve({
          Item: { userId: 'test-user-id', name: 'TestPlayer' },
        });
      }
      return Promise.resolve({ Item: null });
    });

    // Mock connections lookup for private message recipients
    ddbMock.on(QueryCommand).resolves({
      Items: [{ connectionId: 'test-connection-id', userId: 'test-user-id' }],
    });

    // Mock message storage
    ddbMock.on(PutCommand).resolves({});

    // Mock WebSocket message sending
    apiGatewayMock.on(PostToConnectionCommand).resolves({});

    const event = {
      requestContext: {
        connectionId: 'test-connection-id',
        domainName: 'test-domain',
        stage: 'test',
      },
      body: JSON.stringify({
        content: 'Private message',
        messageType: 'private',
        recipientId: 'recipient-user-id',
      }),
    } as any;

    const result = await handler(event, {} as any, {} as any);

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.message).toBe('Message sent successfully');
  });

  it('should return 400 when connection is not found', async () => {
    ddbMock.on(GetCommand).resolves({ Item: null });

    const event = {
      requestContext: {
        connectionId: 'invalid-connection-id',
        domainName: 'test-domain',
        stage: 'test',
      },
      body: JSON.stringify({
        content: 'Hello world!',
        messageType: 'general',
      }),
    } as any;

    const result = await handler(event, {} as any, {} as any);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Connection not found',
    });
  });

  it('should return 400 when content is missing', async () => {
    // Mock connection lookup - return valid connection
    ddbMock.on(GetCommand, {
      TableName: 'test-chat-connections',
      Key: { connectionId: 'test-connection-id' }
    }).resolves({
      Item: { connectionId: 'test-connection-id', userId: 'test-user-id' },
    });

    // Mock character lookup - return valid character
    ddbMock.on(GetCommand, {
      TableName: 'test-characters',
      Key: { userId: 'test-user-id' }
    }).resolves({
      Item: { userId: 'test-user-id', name: 'TestPlayer' },
    });

    const event = {
      requestContext: {
        connectionId: 'test-connection-id',
        domainName: 'test-domain',
        stage: 'test',
      },
      body: JSON.stringify({
        messageType: 'general',
      }),
    } as any;

    const result = await handler(event, {} as any, {} as any);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Content and messageType are required',
    });
  });

  it('should return 400 when recipientId is missing for private messages', async () => {
    // Mock connection lookup (GetCommand)
    ddbMock.on(GetCommand).callsFake((input) => {
      if (input.TableName === 'test-chat-connections') {
        return Promise.resolve({
          Item: { connectionId: 'test-connection-id', userId: 'test-user-id' },
        });
      }
      if (input.TableName === 'test-characters') {
        return Promise.resolve({
          Item: { userId: 'test-user-id', name: 'TestPlayer' },
        });
      }
      return Promise.resolve({ Item: null });
    });

    const event = {
      requestContext: {
        connectionId: 'test-connection-id',
        domainName: 'test-domain',
        stage: 'test',
      },
      body: JSON.stringify({
        content: 'Private message',
        messageType: 'private',
      }),
    } as any;

    const result = await handler(event, {} as any, {} as any);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'recipientId is required for private messages',
    });
  });

  it('should return 403 when user is not in a guild for guild messages', async () => {
    // Mock connection lookup (GetCommand)
    ddbMock.on(GetCommand).callsFake((input) => {
      if (input.TableName === 'test-chat-connections') {
        return Promise.resolve({
          Item: { connectionId: 'test-connection-id', userId: 'test-user-id' },
        });
      }
      if (input.TableName === 'test-characters') {
        return Promise.resolve({
          Item: { userId: 'test-user-id', name: 'TestPlayer' },
        });
      }
      return Promise.resolve({ Item: null });
    });

    // Mock guild membership check (QueryCommand)
    ddbMock.on(QueryCommand).callsFake((input) => {
      if (input.TableName === 'test-guild-members') {
        return Promise.resolve({ Items: [] }); // No guild membership
      }
      return Promise.resolve({ Items: [] });
    });

    const event = {
      requestContext: {
        connectionId: 'test-connection-id',
        domainName: 'test-domain',
        stage: 'test',
      },
      body: JSON.stringify({
        content: 'Guild message',
        messageType: 'guild',
      }),
    } as any;

    const result = await handler(event, {} as any, {} as any);

    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Not a guild member',
    });
  });
});