import { Context } from 'aws-lambda';

/**
 * Creates a mock Lambda context for testing
 */
export function createMockLambdaContext(overrides: Partial<Context> = {}): Context {
  return {
    callbackWaitsForEmptyEventLoop: true,
    functionName: 'test-function',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/test-function',
    logStreamName: '2024/01/01/[$LATEST]test-stream',
    identity: undefined,
    clientContext: undefined,
    getRemainingTimeInMillis: () => 30000,
    done: () => {},
    fail: () => {},
    succeed: () => {},
    ...overrides,
  };
}

/**
 * Creates a mock transaction object for testing
 */
export function createMockTransaction(data: {
  userId: string;
  amount: number;
  type: 'earned' | 'spent';
  source: string;
  description: string;
  transactionId?: string;
  timestamp?: Date;
  metadata?: any;
}) {
  return {
    transactionId: data.transactionId || 'test-transaction-id',
    userId: data.userId,
    amount: data.amount,
    type: data.type,
    source: data.source,
    description: data.description,
    timestamp: data.timestamp || new Date(),
    metadata: data.metadata,
  };
}