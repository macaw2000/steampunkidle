import { handler } from '../disconnect';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('Chat Disconnect Handler', () => {
  beforeEach(() => {
    ddbMock.reset();
    process.env.CHAT_CONNECTIONS_TABLE = 'test-chat-connections';
  });

  it('should successfully disconnect a user', async () => {
    ddbMock.on(DeleteCommand).resolves({});

    const event = {
      requestContext: {
        connectionId: 'test-connection-id',
      },
    } as any;

    const result = await handler(event, {} as any, {} as any);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Disconnected successfully',
    });

    expect(ddbMock.commandCalls(DeleteCommand)).toHaveLength(1);
    const deleteCall = ddbMock.commandCalls(DeleteCommand)[0];
    expect(deleteCall.args[0].input).toMatchObject({
      TableName: 'test-chat-connections',
      Key: {
        connectionId: 'test-connection-id',
      },
    });
  });

  it('should handle database errors gracefully', async () => {
    ddbMock.on(DeleteCommand).rejects(new Error('Database error'));

    const event = {
      requestContext: {
        connectionId: 'test-connection-id',
      },
    } as any;

    const result = await handler(event, {} as any, {} as any);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Failed to disconnect',
    });
  });
});