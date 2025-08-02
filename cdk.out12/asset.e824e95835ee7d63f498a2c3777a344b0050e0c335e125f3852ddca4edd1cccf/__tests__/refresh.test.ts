import { handler } from '../refresh';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';

const cognitoMock = mockClient(CognitoIdentityProviderClient);

describe('Refresh Token Lambda Function', () => {
  beforeEach(() => {
    cognitoMock.reset();
  });

  const createMockEvent = (body: any): APIGatewayProxyEvent => ({
    httpMethod: 'POST',
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    isBase64Encoded: false,
    path: '/auth/refresh',
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

  it('should return 400 when required fields are missing', async () => {
    const event = createMockEvent({
      refreshToken: 'test-refresh-token',
      // missing clientId
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('refreshToken and clientId are required');
  });

  it('should successfully refresh tokens', async () => {
    const mockAuthResult = {
      AuthenticationResult: {
        AccessToken: 'new-access-token',
        IdToken: 'new-id-token',
        ExpiresIn: 3600,
      },
    };

    cognitoMock.on(InitiateAuthCommand).resolves(mockAuthResult);

    const event = createMockEvent({
      refreshToken: 'valid-refresh-token',
      clientId: 'test-client-id',
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    
    const responseBody = JSON.parse(result.body);
    expect(responseBody.accessToken).toBe('new-access-token');
    expect(responseBody.idToken).toBe('new-id-token');
    expect(responseBody.expiresIn).toBe(3600);

    // Verify Cognito call
    expect(cognitoMock.commandCalls(InitiateAuthCommand)).toHaveLength(1);
    const call = cognitoMock.commandCalls(InitiateAuthCommand)[0];
    expect(call.args[0].input).toEqual({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: 'test-client-id',
      AuthParameters: {
        REFRESH_TOKEN: 'valid-refresh-token',
      },
    });
  });

  it('should return 401 for invalid refresh token', async () => {
    cognitoMock.on(InitiateAuthCommand).resolves({
      AuthenticationResult: undefined,
    });

    const event = createMockEvent({
      refreshToken: 'invalid-refresh-token',
      clientId: 'test-client-id',
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).error).toBe('Invalid refresh token');
  });

  it('should handle Cognito errors', async () => {
    cognitoMock.on(InitiateAuthCommand).rejects(new Error('Token expired'));

    const event = createMockEvent({
      refreshToken: 'expired-refresh-token',
      clientId: 'test-client-id',
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).error).toBe('Internal server error');
    expect(JSON.parse(result.body).message).toBe('Token expired');
  });
});