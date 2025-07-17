import { handler } from '../connect';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('Chat Connect Handler', () => {
  beforeEach(() => {
    ddbMock.reset();
    process.env.CHAT_CONNECTIONS_TABLE = 'test-chat-connections';
  });

  it('should successfully connect a user', async () => {
    ddbMock.on(PutCommand).resolves({});

    const event = {
      requestContext: {
        connectionId: 'test-connection-id',
      },
      queryStringParameters: {
        userId: 'test-user-id',
      },
    } as any;

    const result = await handler(event, {} as any, {} as any);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Connected successfully',
    });

    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(1);
    const putCall = ddbMock.commandCalls(PutCommand)[0];
    expect(putCall.args[0].input).toMatchObject({
      TableName: 'test-chat-connections',
      Item: {
        connectionId: 'test-connection-id',
        userId: 'test-user-id',
      },
    });
  });

  it('should return 400 when userId is missing', async () => {
    const event = {
      requestContext: {
        connectionId: 'test-connection-id',
      },
      queryStringParameters: {},
    } as any;

    const result = await handler(event, {} as any, {} as any);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: 'userId is required',
    });

    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
  });

  it('should handle database errors', async () => {
    ddbMock.on(PutCommand).rejects(new Error('Database error'));

    const event = {
      requestContext: {
        connectionId: 'test-connection-id',
      },
      queryStringParameters: {
        userId: 'test-user-id',
      },
    } as any;

    const result = await handler(event, {} as any, {} as any);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Failed to connect',
    });
  });
});