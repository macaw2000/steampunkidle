const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event, context) => {
  console.log('Health check started');
  const startTime = Date.now();
  
  const healthChecks = [];
  let overallStatus = 'healthy';

  // Check DynamoDB connectivity
  try {
    await docClient.send(new GetCommand({
      TableName: process.env.USERS_TABLE,
      Key: { userId: 'health-check-dummy' },
    }));
    
    healthChecks.push({
      service: 'DynamoDB',
      status: 'healthy',
      responseTime: Date.now() - startTime,
    });
    
    console.log('DynamoDB health check passed');
  } catch (error) {
    console.error('DynamoDB health check failed:', error.message);
    healthChecks.push({
      service: 'DynamoDB',
      status: 'unhealthy',
      error: error.message,
    });
    overallStatus = 'unhealthy';
  }

  // Check environment variables
  const requiredEnvVars = ['USERS_TABLE', 'CHARACTERS_TABLE'];
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missingEnvVars.length > 0) {
    console.warn('Missing environment variables:', missingEnvVars);
    healthChecks.push({
      service: 'Configuration',
      status: 'unhealthy',
      error: `Missing environment variables: ${missingEnvVars.join(', ')}`,
    });
    overallStatus = 'unhealthy';
  } else {
    console.log('Configuration check passed');
    healthChecks.push({
      service: 'Configuration',
      status: 'healthy',
    });
  }

  // Check Lambda runtime
  healthChecks.push({
    service: 'Lambda Runtime',
    status: 'healthy',
    responseTime: Date.now() - startTime,
  });

  const response = {
    timestamp: new Date().toISOString(),
    status: overallStatus,
    version: process.env.VERSION || '1.0.0',
    environment: process.env.ENVIRONMENT || 'development',
    checks: healthChecks,
  };

  const statusCode = overallStatus === 'healthy' ? 200 : 503;
  
  console.log('Health check completed:', { status: overallStatus, duration: Date.now() - startTime });
  
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
    },
    body: JSON.stringify(response),
  };
};