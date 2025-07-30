"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultLogger = exports.putCustomMetric = exports.withTiming = exports.Logger = exports.LogLevel = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel = exports.LogLevel || (exports.LogLevel = {}));
class Logger {
    constructor(context = {}, logLevel = LogLevel.INFO) {
        this.context = {
            environment: process.env.ENVIRONMENT || 'production',
            ...context,
        };
        this.logLevel = logLevel;
    }
    static fromLambdaContext(lambdaContext, event) {
        const context = {
            requestId: lambdaContext.awsRequestId,
            functionName: lambdaContext.functionName,
            functionVersion: lambdaContext.functionVersion,
            environment: process.env.ENVIRONMENT || 'development',
        };
        if (event?.headers?.Authorization) {
            try {
                const token = event.headers.Authorization.replace('Bearer ', '');
                const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
                context.userId = payload.sub || payload.userId;
            }
            catch (error) {
            }
        }
        const traceHeader = process.env._X_AMZN_TRACE_ID;
        if (traceHeader) {
            const traceId = traceHeader.split(';')[0]?.replace('Root=', '');
            context.traceId = traceId;
        }
        return new Logger(context);
    }
    shouldLog(level) {
        return level >= this.logLevel;
    }
    createLogEntry(level, message, data, error) {
        const entry = {
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
    log(level, message, data, error) {
        if (!this.shouldLog(level)) {
            return;
        }
        const entry = this.createLogEntry(level, message, data, error);
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
    debug(message, data) {
        this.log(LogLevel.DEBUG, message, data);
    }
    info(message, data) {
        this.log(LogLevel.INFO, message, data);
    }
    warn(message, data) {
        this.log(LogLevel.WARN, message, data);
    }
    error(message, error, data) {
        this.log(LogLevel.ERROR, message, data, error);
    }
    logApiRequest(event) {
        this.info('API request received', {
            httpMethod: event.httpMethod,
            path: event.path,
            queryStringParameters: event.queryStringParameters,
            headers: this.sanitizeHeaders(event.headers),
            userAgent: event.headers?.['User-Agent'],
            sourceIp: event.requestContext?.identity?.sourceIp,
        });
    }
    logApiResponse(statusCode, duration, responseSize) {
        this.info('API response sent', {
            statusCode,
            duration,
            responseSize,
        });
    }
    logDatabaseOperation(operation, tableName, duration, itemCount) {
        this.info('Database operation completed', {
            operation,
            tableName,
            duration,
            itemCount,
        });
    }
    logBusinessEvent(eventType, data) {
        this.info('Business event occurred', {
            eventType,
            eventData: data,
        });
    }
    logPerformanceMetric(metricName, value, unit = 'ms') {
        this.info('Performance metric', {
            metricName,
            value,
            unit,
        });
    }
    child(additionalContext) {
        return new Logger({ ...this.context, ...additionalContext }, this.logLevel);
    }
    sanitizeHeaders(headers) {
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
exports.Logger = Logger;
function withTiming(logger, operation, fn) {
    return new Promise(async (resolve, reject) => {
        const startTime = Date.now();
        try {
            const result = await fn();
            const duration = Date.now() - startTime;
            logger.logPerformanceMetric(operation, duration);
            resolve(result);
        }
        catch (error) {
            const duration = Date.now() - startTime;
            logger.error(`${operation} failed`, error, { duration });
            reject(error);
        }
    });
}
exports.withTiming = withTiming;
function putCustomMetric(namespace, metricName, value, unit = 'Count', dimensions) {
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
exports.putCustomMetric = putCustomMetric;
exports.defaultLogger = new Logger();
