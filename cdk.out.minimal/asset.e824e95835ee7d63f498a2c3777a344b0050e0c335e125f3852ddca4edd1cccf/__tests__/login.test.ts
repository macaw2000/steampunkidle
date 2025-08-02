import { handler } from '../login';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient, GetUserCommand } from '@aws-sdk/client-cognito-identity-provider';

const ddbMock = mockClient(DynamoDBDocumentClient);
const cognitoMock = mockClient(CognitoIdentityProviderClient);

// Mock environment variables
process.env.USERS_TABLE = 'test-users-table';

describe('Login Lambda Function', () => {
  beforeEach(() => {
    ddbMock.reset();
    cognitoMock.reset();
  });

  const createMockEvent = (body: any): APIGatewayProxyEvent => ({
    httpMethod: 'POST',
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    isBase64Encoded: false,
    path: '/auth/login',
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
      accessToken: 'test-token',
      // missing userPoolId
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('accessToken and userPoolId are required');
  });

  it('should create new user on first login', async () => {
    const mockCognitoUser = {
      Username: 'test-user-id',
      UserAttributes: [
        { Name: 'email', Value: 'test@example.com' },
      ],
    };

    cognitoMock.on(GetUserCommand).resolves(mockCognitoUser);
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    ddbMock.on(PutCommand).resolves({});

    const event = createMockEvent({
      accessToken: 'test-access-token',
      userPoolId: 'test-user-pool-id',
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    
    const responseBody = JSON.parse(result.body);
    expect(responseBody.message).toBe('Login successful');
    expect(responseBody.user.userId).toBe('test-user-id');
    expect(responseBody.user.email).toBe('test@example.com');
    expect(responseBody.user.socialProviders).toEqual(['cognito']);

    // Verify DynamoDB calls
    expect(ddbMock.commandCalls(GetCommand)).toHaveLength(1);
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(1);
  });

  it('should update existing user on subsequent login', async () => {
    const mockCognitoUser = {
      Username: 'existing-user-id',
      UserAttributes: [
        { Name: 'email', Value: 'existing@example.com' },
        { Name: 'identities', Value: '[{"providerName":"Google"}]' },
      ],
    };

    const existingUser = {
      userId: 'existing-user-id',
      email: 'existing@example.com',
      socialProviders: ['cognito'],
      createdAt: '2023-01-01T00:00:00.000Z',
      lastLogin: '2023-01-01T00:00:00.000Z',
    };

    cognitoMock.on(GetUserCommand).resolves(mockCognitoUser);
    ddbMock.on(GetCommand).resolves({ Item: existingUser });
    ddbMock.on(PutCommand).resolves({});

    const event = createMockEvent({
      accessToken: 'test-access-token',
      userPoolId: 'test-user-pool-id',
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    
    const responseBody = JSON.parse(result.body);
    expect(responseBody.user.socialProviders).toContain('Google');
    expect(responseBody.user.socialProviders).toContain('cognito');
  });

  it('should return 401 for invalid access token', async () => {
    cognitoMock.on(GetUserCommand).resolves({ Username: undefined });

    const event = createMockEvent({
      accessToken: 'invalid-token',
      userPoolId: 'test-user-pool-id',
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).error).toBe('Invalid access token');
  });

  it('should handle Cognito errors', async () => {
    cognitoMock.on(GetUserCommand).rejects(new Error('Cognito error'));

    const event = createMockEvent({
      accessToken: 'test-token',
      userPoolId: 'test-user-pool-id',
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).error).toBe('Internal server error');
  });
});