"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const logger_1 = require("../../utils/logger");
const client = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
const handler = async (event, context) => {
    const logger = logger_1.Logger.fromLambdaContext(context, event);
    const startTime = Date.now();
    logger.logApiRequest(event);
    logger.info('Health check started');
    const healthChecks = [];
    let overallStatus = 'healthy';
    try {
        const dbResult = await (0, logger_1.withTiming)(logger, 'DynamoDB health check', async () => {
            return await docClient.send(new lib_dynamodb_1.GetCommand({
                TableName: process.env.USERS_TABLE,
                Key: { userId: 'health-check-dummy' },
            }));
        });
        healthChecks.push({
            service: 'DynamoDB',
            status: 'healthy',
            responseTime: Date.now() - startTime,
        });
        logger.info('DynamoDB health check passed');
    }
    catch (error) {
        logger.error('DynamoDB health check failed', error);
        healthChecks.push({
            service: 'DynamoDB',
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        overallStatus = 'unhealthy';
    }
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
    }
    else {
        logger.info('Configuration check passed');
        healthChecks.push({
            service: 'Configuration',
            status: 'healthy',
        });
    }
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
    (0, logger_1.putCustomMetric)('SteampunkIdleGame/Health', 'HealthCheckDuration', totalDuration, 'Milliseconds');
    (0, logger_1.putCustomMetric)('SteampunkIdleGame/Health', 'HealthCheckStatus', overallStatus === 'healthy' ? 1 : 0, 'Count');
    const statusCode = overallStatus === 'healthy' ? 200 : 503;
    logger.logApiResponse(statusCode, totalDuration, JSON.stringify(response).length);
    if (overallStatus === 'unhealthy') {
        logger.warn('Health check failed', { healthChecks });
    }
    else {
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
exports.handler = handler;
