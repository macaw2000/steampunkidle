import { handler } from '../logout';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { CognitoIdentityProviderClient, GlobalSignOutCommand } from '@aws-sdk/client-cognito-identity-provider';

const cognitoMock = mockClient(CognitoIdentityProviderClient);

describe('Logout Lambda Function', () => {
  beforeEach(() => {
    cognitoMock.reset();
  });

  const createMockEvent = (body: any): APIGatewayProxyEvent => ({
    httpMethod: 'POST',
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    isBase64Encoded: false,
    path: '/auth/logout',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: '',
  });

  it('should handle OPTIONS request', async () => {
    const event: APIGatewayProxyEvent = {
      ...createMockEvent({}),
      httpMethod: 'OPTIONS',
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
  });

  it('should return 400 when body is missing', async () => {
    const event: APIGatewayProxyEvent = {
      ...createMockEvent({}),
      body: null,
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('Request body is required');
  });

  it('should return 400 when accessToken is missing', async () => {
    const event = createMockEvent({
      // missing accessToken
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('accessToken is required');
  });

  it('should successfully logout user', async () => {
    cognitoMock.on(GlobalSignOutCommand).resolves({});

    const event = createMockEvent({
      accessToken: 'valid-access-token',
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    
    const responseBody = JSON.parse(result.body);
    expect(responseBody.message).toBe('Logout successful');

    // Verify Cognito call
    expect(cognitoMock.commandCalls(GlobalSignOutCommand)).toHaveLength(1);
    const call = cognitoMock.commandCalls(GlobalSignOutCommand)[0];
    expect(call.args[0].input).toEqual({
      AccessToken: 'valid-access-token',
    });
  });

  it('should handle Cognito errors', async () => {
    cognitoMock.on(GlobalSignOutCommand).rejects(new Error('Invalid access token'));

    const event = createMockEvent({
      accessToken: 'invalid-access-token',
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).error).toBe('Internal server error');
    expect(JSON.parse(result.body).message).toBe('Invalid access token');
  });
});