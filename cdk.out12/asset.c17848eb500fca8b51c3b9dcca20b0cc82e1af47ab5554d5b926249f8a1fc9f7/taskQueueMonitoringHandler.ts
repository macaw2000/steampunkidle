/**
 * Lambda handler for task queue monitoring operations
 * Provides endpoints for metrics collection, alerting, and admin dashboard data
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { taskQueueMetrics, QueueMetrics } from '../../services/taskQueueMetrics';
import { taskQueueAlerting, Alert } from '../../services/taskQueueAlerting';
import { taskQueueLogger } from '../../services/taskQueueLogger';

interface MonitoringRequest {
  action: 'getMetrics' | 'getAlerts' | 'acknowledgeAlert' | 'resolveAlert' | 'getTimeSeries' | 'submitLogs';
  playerId?: string;
  alertId?: string;
  acknowledgedBy?: string;
  resolvedBy?: string;
  metric?: string;
  timeWindow?: number;
  logs?: any[];
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // Parse request body
    const request: MonitoringRequest = JSON.parse(event.body || '{}');
    const { action } = request;

    // Log the monitoring request
    taskQueueLogger.logQueueOperation(
      `monitoring.${action}`,
      request.playerId || 'system',
      true,
      undefined,
      { action, requestId: event.requestContext.requestId }
    );

    let response: any;

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
    
    // Log successful completion
    taskQueueLogger.logQueueOperation(
      `monitoring.${action}`,
      request.playerId || 'system',
      true,
      duration,
      { success: true }
    );

    // Record performance metrics
    taskQueueMetrics.recordHistogram(
      'lambda.monitoring.duration',
      duration,
      { action, success: 'true' }
    );

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

  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    // Log error
    taskQueueLogger.logError(
      'Monitoring handler error',
      error,
      undefined,
      undefined,
      { 
        requestId: event.requestContext.requestId,
        duration,
        body: event.body
      }
    );

    // Record error metrics
    taskQueueMetrics.recordHistogram(
      'lambda.monitoring.duration',
      duration,
      { success: 'false', error_type: error.name || 'unknown' }
    );

    taskQueueMetrics.incrementCounter(
      'lambda.monitoring.errors',
      1,
      { error_type: error.name || 'unknown' }
    );

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

async function handleGetMetrics(request: MonitoringRequest): Promise<QueueMetrics> {
  const timer = (() => {}); // Performance timer not available in metrics collector
  
  try {
    const metrics = taskQueueMetrics.exportMetrics();
    
    // Record metrics request
    taskQueueMetrics.incrementCounter('monitoring.metrics.requests', 1);
    
    return metrics;
  } finally {
    timer();
  }
}

async function handleGetAlerts(request: MonitoringRequest): Promise<{
  activeAlerts: Alert[];
  alertHistory: Alert[];
}> {
  const timer = (() => {}); // Performance timer not available in metrics collector
  
  try {
    const activeAlerts = taskQueueAlerting.getActiveAlerts();
    const alertHistory = taskQueueAlerting.getAlertHistory(50); // Last 50 alerts
    
    // Record alerts request
    taskQueueMetrics.incrementCounter('monitoring.alerts.requests', 1);
    
    return {
      activeAlerts,
      alertHistory
    };
  } finally {
    timer();
  }
}

async function handleAcknowledgeAlert(request: MonitoringRequest): Promise<{ success: boolean }> {
  if (!request.alertId || !request.acknowledgedBy) {
    throw new Error('alertId and acknowledgedBy are required');
  }

  const timer = (() => {}); // Performance timer not available in metrics collector
  
  try {
    const success = await taskQueueAlerting.acknowledgeAlert(
      request.alertId,
      request.acknowledgedBy
    );
    
    if (success) {
      taskQueueMetrics.incrementCounter('monitoring.alerts.acknowledged', 1, {
        acknowledged_by: request.acknowledgedBy
      });
    }
    
    return { success };
  } finally {
    timer();
  }
}

async function handleResolveAlert(request: MonitoringRequest): Promise<{ success: boolean }> {
  if (!request.alertId || !request.resolvedBy) {
    throw new Error('alertId and resolvedBy are required');
  }

  const timer = (() => {}); // Performance timer not available in metrics collector
  
  try {
    const success = await taskQueueAlerting.resolveAlert(
      request.alertId,
      request.resolvedBy
    );
    
    if (success) {
      taskQueueMetrics.incrementCounter('monitoring.alerts.resolved', 1, {
        resolved_by: request.resolvedBy
      });
    }
    
    return { success };
  } finally {
    timer();
  }
}

async function handleGetTimeSeries(request: MonitoringRequest): Promise<any> {
  if (!request.metric) {
    throw new Error('metric is required');
  }

  const timer = (() => {}); // Performance timer not available in metrics collector
  
  try {
    const timeWindow = request.timeWindow || 3600000; // Default 1 hour
    const timeSeries = taskQueueMetrics.exportTimeSeries(request.metric, timeWindow);
    
    // Record time series request
    taskQueueMetrics.incrementCounter('monitoring.timeseries.requests', 1, {
      metric: request.metric
    });
    
    return timeSeries;
  } finally {
    timer();
  }
}

async function handleSubmitLogs(request: MonitoringRequest): Promise<{ success: boolean; processed: number }> {
  if (!request.logs || !Array.isArray(request.logs)) {
    throw new Error('logs array is required');
  }

  const timer = (() => {}); // Performance timer not available in metrics collector
  
  try {
    // Process submitted logs (this would typically forward to a logging service)
    let processed = 0;
    
    for (const logEntry of request.logs) {
      try {
        // Validate log entry structure
        if (logEntry.timestamp && logEntry.level && logEntry.message) {
          // In a real implementation, you might forward these to CloudWatch, ELK, etc.
          console.log('Received log entry:', JSON.stringify(logEntry));
          processed++;
        }
      } catch (error) {
        console.error('Failed to process log entry:', error);
      }
    }
    
    // Record log submission metrics
    taskQueueMetrics.incrementCounter('monitoring.logs.submitted', processed);
    
    return { success: true, processed };
  } finally {
    timer();
  }
}

// Health check endpoint
export const healthCheck = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const metrics = taskQueueMetrics.exportMetrics();
    const activeAlerts = taskQueueAlerting.getActiveAlerts();
    
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

    // Determine overall health status
    if (metrics.errorRate > 10 || activeAlerts.some(a => a.severity === 'critical')) {
      health.status = 'unhealthy';
    } else if (metrics.errorRate > 5 || activeAlerts.some(a => a.severity === 'high')) {
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

  } catch (error: any) {
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