"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthCheck = exports.handler = void 0;
const taskQueueMetrics_1 = require("../../services/taskQueueMetrics");
const taskQueueAlerting_1 = require("../../services/taskQueueAlerting");
const taskQueueLogger_1 = require("../../services/taskQueueLogger");
const handler = async (event) => {
    const startTime = Date.now();
    try {
        const request = JSON.parse(event.body || '{}');
        const { action } = request;
        taskQueueLogger_1.taskQueueLogger.logQueueOperation(`monitoring.${action}`, request.playerId || 'system', true, undefined, { action, requestId: event.requestContext.requestId });
        let response;
        switch (action) {
            case 'getMetrics':
                response = await handleGetMetrics(request);
                break;
            case 'getAlerts':
                response = await handleGetAlerts(request);
                break;
            case 'acknowledgeAlert':
                response = await handleAcknowledgeAlert(request);
                break;
            case 'resolveAlert':
                response = await handleResolveAlert(request);
                break;
            case 'getTimeSeries':
                response = await handleGetTimeSeries(request);
                break;
            case 'submitLogs':
                response = await handleSubmitLogs(request);
                break;
            default:
                throw new Error(`Unknown monitoring action: ${action}`);
        }
        const duration = Date.now() - startTime;
        taskQueueLogger_1.taskQueueLogger.logQueueOperation(`monitoring.${action}`, request.playerId || 'system', true, duration, { success: true });
        taskQueueMetrics_1.taskQueueMetrics.recordHistogram('lambda.monitoring.duration', duration, { action, success: 'true' });
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            body: JSON.stringify({
                success: true,
                data: response,
                timestamp: Date.now(),
                duration
            })
        };
    }
    catch (error) {
        const duration = Date.now() - startTime;
        taskQueueLogger_1.taskQueueLogger.logError('Monitoring handler error', error, undefined, undefined, {
            requestId: event.requestContext.requestId,
            duration,
            body: event.body
        });
        taskQueueMetrics_1.taskQueueMetrics.recordHistogram('lambda.monitoring.duration', duration, { success: 'false', error_type: error.name || 'unknown' });
        taskQueueMetrics_1.taskQueueMetrics.incrementCounter('lambda.monitoring.errors', 1, { error_type: error.name || 'unknown' });
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: error.message,
                timestamp: Date.now(),
                duration
            })
        };
    }
};
exports.handler = handler;
async function handleGetMetrics(request) {
    const timer = (() => { });
    try {
        const metrics = taskQueueMetrics_1.taskQueueMetrics.exportMetrics();
        taskQueueMetrics_1.taskQueueMetrics.incrementCounter('monitoring.metrics.requests', 1);
        return metrics;
    }
    finally {
        timer();
    }
}
async function handleGetAlerts(request) {
    const timer = (() => { });
    try {
        const activeAlerts = taskQueueAlerting_1.taskQueueAlerting.getActiveAlerts();
        const alertHistory = taskQueueAlerting_1.taskQueueAlerting.getAlertHistory(50);
        taskQueueMetrics_1.taskQueueMetrics.incrementCounter('monitoring.alerts.requests', 1);
        return {
            activeAlerts,
            alertHistory
        };
    }
    finally {
        timer();
    }
}
async function handleAcknowledgeAlert(request) {
    if (!request.alertId || !request.acknowledgedBy) {
        throw new Error('alertId and acknowledgedBy are required');
    }
    const timer = (() => { });
    try {
        const success = await taskQueueAlerting_1.taskQueueAlerting.acknowledgeAlert(request.alertId, request.acknowledgedBy);
        if (success) {
            taskQueueMetrics_1.taskQueueMetrics.incrementCounter('monitoring.alerts.acknowledged', 1, {
                acknowledged_by: request.acknowledgedBy
            });
        }
        return { success };
    }
    finally {
        timer();
    }
}
async function handleResolveAlert(request) {
    if (!request.alertId || !request.resolvedBy) {
        throw new Error('alertId and resolvedBy are required');
    }
    const timer = (() => { });
    try {
        const success = await taskQueueAlerting_1.taskQueueAlerting.resolveAlert(request.alertId, request.resolvedBy);
        if (success) {
            taskQueueMetrics_1.taskQueueMetrics.incrementCounter('monitoring.alerts.resolved', 1, {
                resolved_by: request.resolvedBy
            });
        }
        return { success };
    }
    finally {
        timer();
    }
}
async function handleGetTimeSeries(request) {
    if (!request.metric) {
        throw new Error('metric is required');
    }
    const timer = (() => { });
    try {
        const timeWindow = request.timeWindow || 3600000;
        const timeSeries = taskQueueMetrics_1.taskQueueMetrics.exportTimeSeries(request.metric, timeWindow);
        taskQueueMetrics_1.taskQueueMetrics.incrementCounter('monitoring.timeseries.requests', 1, {
            metric: request.metric
        });
        return timeSeries;
    }
    finally {
        timer();
    }
}
async function handleSubmitLogs(request) {
    if (!request.logs || !Array.isArray(request.logs)) {
        throw new Error('logs array is required');
    }
    const timer = (() => { });
    try {
        let processed = 0;
        for (const logEntry of request.logs) {
            try {
                if (logEntry.timestamp && logEntry.level && logEntry.message) {
                    console.log('Received log entry:', JSON.stringify(logEntry));
                    processed++;
                }
            }
            catch (error) {
                console.error('Failed to process log entry:', error);
            }
        }
        taskQueueMetrics_1.taskQueueMetrics.incrementCounter('monitoring.logs.submitted', processed);
        return { success: true, processed };
    }
    finally {
        timer();
    }
}
const healthCheck = async (event) => {
    try {
        const metrics = taskQueueMetrics_1.taskQueueMetrics.exportMetrics();
        const activeAlerts = taskQueueAlerting_1.taskQueueAlerting.getActiveAlerts();
        const health = {
            status: 'healthy',
            timestamp: Date.now(),
            metrics: {
                activePlayerCount: metrics.activePlayerCount,
                averageProcessingTime: metrics.averageTaskProcessingTime,
                errorRate: metrics.errorRate,
                memoryUsage: metrics.memoryUsage
            },
            alerts: {
                total: activeAlerts.length,
                critical: activeAlerts.filter(a => a.severity === 'critical').length,
                high: activeAlerts.filter(a => a.severity === 'high').length
            }
        };
        if (metrics.errorRate > 10 || activeAlerts.some(a => a.severity === 'critical')) {
            health.status = 'unhealthy';
        }
        else if (metrics.errorRate > 5 || activeAlerts.some(a => a.severity === 'high')) {
            health.status = 'degraded';
        }
        return {
            statusCode: health.status === 'healthy' ? 200 : 503,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify(health)
        };
    }
    catch (error) {
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                status: 'error',
                error: error.message,
                timestamp: Date.now()
            })
        };
    }
};
exports.healthCheck = healthCheck;
