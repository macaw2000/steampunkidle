import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Logger, withTiming, putCustomMetric } from '../../utils/logger';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  error?: string;
}

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const logger = Logger.fromLambdaContext(context, event);
  const startTime = Date.now();
  
  logger.logApiRequest(event);
  logger.info('Health check started');

  const healthChecks: HealthCheckResult[] = [];
  let overallStatus = 'healthy';

  // Check DynamoDB connectivity
  try {
    const dbResult = await withTiming(logger, 'DynamoDB health check', async () => {
      return await docClient.send(new GetCommand({
        TableName: process.env.USERS_TABLE!,
        Key: { userId: 'health-check-dummy' },
      }));
    });
    
    healthChecks.push({
      service: 'DynamoDB',
      status: 'healthy',
      responseTime: Date.now() - startTime,
    });
    
    logger.info('DynamoDB health check passed');
  } catch (error) {
    logger.error('DynamoDB health check failed', error as Error);
    healthChecks.push({
      service: 'DynamoDB',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    overallStatus = 'unhealthy';
  }

  // Check environment variables
  const requiredEnvVars = ['USERS_TABLE', 'CHARACTERS_TABLE'];
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missingEnvVars.length > 0) {
    logger.warn('Missing environment variables', { missingEnvVars });
    healthChecks.push({
      service: 'Configuration',
      status: 'unhealthy',
      error: `Missing environment variables: ${missingEnvVars.join(', ')}`,
    });
    overallStatus = 'unhealthy';
  } else {
    logger.info('Configuration check passed');
    healthChecks.push({
      service: 'Configuration',
      status: 'healthy',
    });
  }

  // Check Lambda runtime
  const runtimeResponseTime = Date.now() - (event.requestContext?.requestTimeEpoch || Date.now());
  healthChecks.push({
    service: 'Lambda Runtime',
    status: 'healthy',
    responseTime: runtimeResponseTime,
  });
  
  logger.logPerformanceMetric('Lambda runtime response time', runtimeResponseTime);

  const totalDuration = Date.now() - startTime;
  const response = {
    timestamp: new Date().toISOString(),
    status: overallStatus,
    version: process.env.VERSION || '1.0.0',
    environment: process.env.ENVIRONMENT || 'development',
    checks: healthChecks,
  };

  // Log custom metrics
  putCustomMetric('SteampunkIdleGame/Health', 'HealthCheckDuration', totalDuration, 'Milliseconds');
  putCustomMetric('SteampunkIdleGame/Health', 'HealthCheckStatus', overallStatus === 'healthy' ? 1 : 0, 'Count');

  const statusCode = overallStatus === 'healthy' ? 200 : 503;
  logger.logApiResponse(statusCode, totalDuration, JSON.stringify(response).length);
  
  if (overallStatus === 'unhealthy') {
    logger.warn('Health check failed', { healthChecks });
  } else {
    logger.info('Health check completed successfully');
  }

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
    body: JSON.stringify(response, null, 2),
  };
};