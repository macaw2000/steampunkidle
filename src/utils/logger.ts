import { APIGatewayProxyEvent, Context } from 'aws-lambda';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogContext {
  requestId?: string;
  userId?: string;
  functionName?: string;
  functionVersion?: string;
  environment?: string;
  traceId?: string;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context: LogContext;
  data?: any;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metrics?: {
    duration?: number;
    memoryUsed?: number;
    billedDuration?: number;
  };
}

export class Logger {
  private context: LogContext;
  private logLevel: LogLevel;

  constructor(context: LogContext = {}, logLevel: LogLevel = LogLevel.INFO) {
    this.context = {
      environment: process.env.ENVIRONMENT || 'production',
      ...context,
    };
    this.logLevel = logLevel;
  }

  static fromLambdaContext(lambdaContext: Context, event?: APIGatewayProxyEvent): Logger {
    const context: LogContext = {
      requestId: lambdaContext.awsRequestId,
      functionName: lambdaContext.functionName,
      functionVersion: lambdaContext.functionVersion,
      environment: process.env.ENVIRONMENT || 'development',
    };

    // Extract user ID from JWT token if available
    if (event?.headers?.Authorization) {
      try {
        const token = event.headers.Authorization.replace('Bearer ', '');
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        context.userId = payload.sub || payload.userId;
      } catch (error) {
        // Ignore JWT parsing errors for logging
      }
    }

    // Extract X-Ray trace ID if available
    const traceHeader = process.env._X_AMZN_TRACE_ID;
    if (traceHeader) {
      const traceId = traceHeader.split(';')[0]?.replace('Root=', '');
      context.traceId = traceId;
    }

    return new Logger(context);
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private createLogEntry(level: LogLevel, message: string, data?: any, error?: Error): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      context: this.context,
    };

    if (data) {
      entry.data = data;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  }

  private log(level: LogLevel, message: string, data?: any, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry = this.createLogEntry(level, message, data, error);
    
    // Use console methods for proper CloudWatch integration
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(JSON.stringify(entry));
        break;
      case LogLevel.INFO:
        console.info(JSON.stringify(entry));
        break;
      case LogLevel.WARN:
        console.warn(JSON.stringify(entry));
        break;
      case LogLevel.ERROR:
        console.error(JSON.stringify(entry));
        break;
    }
  }

  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, error?: Error, data?: any): void {
    this.log(LogLevel.ERROR, message, data, error);
  }

  // Specialized logging methods for common patterns
  logApiRequest(event: APIGatewayProxyEvent): void {
    this.info('API request received', {
      httpMethod: event.httpMethod,
      path: event.path,
      queryStringParameters: event.queryStringParameters,
      headers: this.sanitizeHeaders(event.headers),
      userAgent: event.headers?.['User-Agent'],
      sourceIp: event.requestContext?.identity?.sourceIp,
    });
  }

  logApiResponse(statusCode: number, duration: number, responseSize?: number): void {
    this.info('API response sent', {
      statusCode,
      duration,
      responseSize,
    });
  }

  logDatabaseOperation(operation: string, tableName: string, duration: number, itemCount?: number): void {
    this.info('Database operation completed', {
      operation,
      tableName,
      duration,
      itemCount,
    });
  }

  logBusinessEvent(eventType: string, data: any): void {
    this.info('Business event occurred', {
      eventType,
      eventData: data,
    });
  }

  logPerformanceMetric(metricName: string, value: number, unit: string = 'ms'): void {
    this.info('Performance metric', {
      metricName,
      value,
      unit,
    });
  }

  // Create a child logger with additional context
  child(additionalContext: Partial<LogContext>): Logger {
    return new Logger({ ...this.context, ...additionalContext }, this.logLevel);
  }

  // Sanitize sensitive headers
  private sanitizeHeaders(headers: { [key: string]: string | undefined }): { [key: string]: string | undefined } {
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    const sanitized = { ...headers };
    
    Object.keys(sanitized).forEach(key => {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }
}

// Utility function to measure execution time
export function withTiming<T>(
  logger: Logger,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const startTime = Date.now();
    
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      logger.logPerformanceMetric(operation, duration);
      resolve(result);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`${operation} failed`, error as Error, { duration });
      reject(error);
    }
  });
}

// Utility function to create CloudWatch custom metrics
export function putCustomMetric(
  namespace: string,
  metricName: string,
  value: number,
  unit: string = 'Count',
  dimensions?: { [key: string]: string }
): void {
  // In a real implementation, this would use the CloudWatch SDK
  // For now, we'll log it in a format that can be parsed by CloudWatch Logs Insights
  const metricData = {
    namespace,
    metricName,
    value,
    unit,
    dimensions,
    timestamp: new Date().toISOString(),
  };
  
  console.log(`CUSTOM_METRIC: ${JSON.stringify(metricData)}`);
}

// Default logger instance
export const defaultLogger = new Logger();