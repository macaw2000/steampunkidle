/**
 * Alerting system for task queue health monitoring and performance degradation
 * Monitors key metrics and triggers alerts when thresholds are exceeded
 */

import { taskQueueMetrics, QueueMetrics } from './taskQueueMetrics';
import { taskQueueLogger, LogLevel } from './taskQueueLogger';

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum AlertType {
  PERFORMANCE_DEGRADATION = 'performance_degradation',
  HIGH_ERROR_RATE = 'high_error_rate',
  QUEUE_BACKUP = 'queue_backup',
  DATABASE_ISSUES = 'database_issues',
  MEMORY_LEAK = 'memory_leak',
  SYSTEM_OVERLOAD = 'system_overload',
  SYNC_FAILURES = 'sync_failures',
  VALIDATION_FAILURES = 'validation_failures'
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: number;
  metrics: Partial<QueueMetrics>;
  acknowledged: boolean;
  resolved: boolean;
  resolvedAt?: number;
  acknowledgedBy?: string;
  metadata?: Record<string, any>;
}

export interface AlertRule {
  type: AlertType;
  severity: AlertSeverity;
  condition: (metrics: QueueMetrics) => boolean;
  title: string;
  messageTemplate: string;
  cooldownPeriod: number; // Minimum time between alerts of same type
  autoResolve: boolean;
  resolveCondition?: (metrics: QueueMetrics) => boolean;
}

export interface AlertingConfig {
  enabled: boolean;
  checkInterval: number;
  webhookUrl?: string;
  emailEndpoint?: string;
  slackWebhook?: string;
  maxActiveAlerts: number;
  alertRetention: number; // How long to keep resolved alerts
}

class TaskQueueAlertingSystem {
  private config: AlertingConfig;
  private alertRules: AlertRule[] = [];
  private activeAlerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];
  private lastAlertTime: Map<AlertType, number> = new Map();
  private checkInterval?: NodeJS.Timeout;

  constructor(config: Partial<AlertingConfig> = {}) {
    this.config = {
      enabled: true,
      checkInterval: 30000, // Check every 30 seconds
      maxActiveAlerts: 50,
      alertRetention: 7 * 24 * 60 * 60 * 1000, // 7 days
      ...config
    };

    this.initializeDefaultRules();
    
    if (this.config.enabled) {
      this.startMonitoring();
    }
  }

  private initializeDefaultRules(): void {
    this.alertRules = [
      // High Error Rate Alert
      {
        type: AlertType.HIGH_ERROR_RATE,
        severity: AlertSeverity.HIGH,
        condition: (metrics) => metrics.errorRate > 5,
        title: 'High Task Error Rate Detected',
        messageTemplate: 'Task error rate is {errorRate}%, exceeding the 5% threshold',
        cooldownPeriod: 300000, // 5 minutes
        autoResolve: true,
        resolveCondition: (metrics) => metrics.errorRate < 2
      },

      // Long Processing Time Alert
      {
        type: AlertType.PERFORMANCE_DEGRADATION,
        severity: AlertSeverity.MEDIUM,
        condition: (metrics) => metrics.averageTaskProcessingTime > 30000,
        title: 'Task Processing Performance Degradation',
        messageTemplate: 'Average task processing time is {averageTaskProcessingTime}ms, exceeding 30s threshold',
        cooldownPeriod: 600000, // 10 minutes
        autoResolve: true,
        resolveCondition: (metrics) => metrics.averageTaskProcessingTime < 20000
      },

      // Queue Backup Alert
      {
        type: AlertType.QUEUE_BACKUP,
        severity: AlertSeverity.HIGH,
        condition: (metrics) => metrics.maxQueueLength > 1000,
        title: 'Large Queue Backup Detected',
        messageTemplate: 'Maximum queue length is {maxQueueLength} tasks, exceeding 1000 task threshold',
        cooldownPeriod: 300000, // 5 minutes
        autoResolve: true,
        resolveCondition: (metrics) => metrics.maxQueueLength < 500
      },

      // Memory Usage Alert
      {
        type: AlertType.MEMORY_LEAK,
        severity: AlertSeverity.CRITICAL,
        condition: (metrics) => metrics.memoryUsage > 1024 * 1024 * 1024, // 1GB
        title: 'High Memory Usage Detected',
        messageTemplate: 'Memory usage is {memoryUsage} bytes, indicating potential memory leak',
        cooldownPeriod: 600000, // 10 minutes
        autoResolve: true,
        resolveCondition: (metrics) => metrics.memoryUsage < 512 * 1024 * 1024 // 512MB
      },

      // System Overload Alert
      {
        type: AlertType.SYSTEM_OVERLOAD,
        severity: AlertSeverity.HIGH,
        condition: (metrics) => metrics.cpuUsage > 80,
        title: 'System CPU Overload',
        messageTemplate: 'CPU usage is {cpuUsage}%, exceeding 80% threshold',
        cooldownPeriod: 300000, // 5 minutes
        autoResolve: true,
        resolveCondition: (metrics) => metrics.cpuUsage < 60
      },

      // Sync Failure Alert
      {
        type: AlertType.SYNC_FAILURES,
        severity: AlertSeverity.MEDIUM,
        condition: (metrics) => metrics.syncFailureRate > 10,
        title: 'High Sync Failure Rate',
        messageTemplate: 'Sync failure rate is {syncFailureRate}%, exceeding 10% threshold',
        cooldownPeriod: 300000, // 5 minutes
        autoResolve: true,
        resolveCondition: (metrics) => metrics.syncFailureRate < 5
      },

      // Validation Failure Alert
      {
        type: AlertType.VALIDATION_FAILURES,
        severity: AlertSeverity.MEDIUM,
        condition: (metrics) => metrics.validationFailureRate > 15,
        title: 'High Validation Failure Rate',
        messageTemplate: 'Validation failure rate is {validationFailureRate}%, exceeding 15% threshold',
        cooldownPeriod: 300000, // 5 minutes
        autoResolve: true,
        resolveCondition: (metrics) => metrics.validationFailureRate < 8
      },

      // Cache Performance Alert
      {
        type: AlertType.PERFORMANCE_DEGRADATION,
        severity: AlertSeverity.LOW,
        condition: (metrics) => metrics.cacheHitRate < 70,
        title: 'Low Cache Hit Rate',
        messageTemplate: 'Cache hit rate is {cacheHitRate}%, below 70% threshold',
        cooldownPeriod: 600000, // 10 minutes
        autoResolve: true,
        resolveCondition: (metrics) => metrics.cacheHitRate > 80
      }
    ];
  }

  private startMonitoring(): void {
    this.checkInterval = setInterval(() => {
      this.checkAlerts().catch(error => {
        taskQueueLogger.logError('Failed to check alerts', error);
      });
    }, this.config.checkInterval);
  }

  private async checkAlerts(): Promise<void> {
    const metrics = taskQueueMetrics.exportMetrics();
    
    // Check each alert rule
    for (const rule of this.alertRules) {
      await this.evaluateRule(rule, metrics);
    }

    // Clean up old alerts
    this.cleanupOldAlerts();
  }

  private async evaluateRule(rule: AlertRule, metrics: QueueMetrics): Promise<void> {
    const alertKey = `${rule.type}_${rule.severity}`;
    const existingAlert = this.activeAlerts.get(alertKey);
    const lastAlertTime = this.lastAlertTime.get(rule.type) || 0;
    const now = Date.now();

    // Check if condition is met
    const conditionMet = rule.condition(metrics);

    if (conditionMet && !existingAlert) {
      // Check cooldown period
      if (now - lastAlertTime < rule.cooldownPeriod) {
        return;
      }

      // Create new alert
      const alert = this.createAlert(rule, metrics);
      this.activeAlerts.set(alertKey, alert);
      this.lastAlertTime.set(rule.type, now);
      
      await this.sendAlert(alert);
      
      taskQueueLogger.logError(
        `Alert triggered: ${alert.title}`,
        new Error(alert.message),
        undefined,
        undefined,
        { alertId: alert.id, severity: alert.severity }
      );
    } else if (!conditionMet && existingAlert && rule.autoResolve && rule.resolveCondition) {
      // Check if alert should be auto-resolved
      if (rule.resolveCondition(metrics)) {
        await this.resolveAlert(existingAlert.id, 'system');
      }
    }
  }

  private createAlert(rule: AlertRule, metrics: QueueMetrics): Alert {
    const id = `${rule.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const message = this.formatMessage(rule.messageTemplate, metrics);

    return {
      id,
      type: rule.type,
      severity: rule.severity,
      title: rule.title,
      message,
      timestamp: Date.now(),
      metrics,
      acknowledged: false,
      resolved: false,
      metadata: {
        rule: rule.type,
        autoResolve: rule.autoResolve
      }
    };
  }

  private formatMessage(template: string, metrics: QueueMetrics): string {
    let message = template;
    
    // Replace metric placeholders
    Object.entries(metrics).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      if (message.includes(placeholder)) {
        const formattedValue = typeof value === 'number' ? 
          (value > 1000 ? Math.round(value).toLocaleString() : value.toFixed(2)) : 
          String(value);
        message = message.replace(new RegExp(placeholder, 'g'), formattedValue);
      }
    });

    return message;
  }

  private async sendAlert(alert: Alert): Promise<void> {
    const payload = {
      alert,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    };

    // Send to webhook
    if (this.config.webhookUrl) {
      try {
        await fetch(this.config.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (error) {
        taskQueueLogger.logError('Failed to send webhook alert', error as Error);
      }
    }

    // Send to Slack
    if (this.config.slackWebhook) {
      try {
        const slackPayload = {
          text: `🚨 ${alert.title}`,
          attachments: [{
            color: this.getSeverityColor(alert.severity),
            fields: [
              { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
              { title: 'Type', value: alert.type, short: true },
              { title: 'Message', value: alert.message, short: false },
              { title: 'Timestamp', value: new Date(alert.timestamp).toISOString(), short: true }
            ]
          }]
        };

        await fetch(this.config.slackWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackPayload)
        });
      } catch (error) {
        taskQueueLogger.logError('Failed to send Slack alert', error as Error);
      }
    }

    // Send email notification
    if (this.config.emailEndpoint) {
      try {
        const emailPayload = {
          to: 'admin@example.com', // Configure as needed
          subject: `Task Queue Alert: ${alert.title}`,
          body: this.formatEmailBody(alert),
          priority: alert.severity === AlertSeverity.CRITICAL ? 'high' : 'normal'
        };

        await fetch(this.config.emailEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emailPayload)
        });
      } catch (error) {
        taskQueueLogger.logError('Failed to send email alert', error as Error);
      }
    }
  }

  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.CRITICAL: return 'danger';
      case AlertSeverity.HIGH: return 'warning';
      case AlertSeverity.MEDIUM: return '#ff9500';
      case AlertSeverity.LOW: return 'good';
      default: return '#cccccc';
    }
  }

  private formatEmailBody(alert: Alert): string {
    return `
Alert Details:
- Title: ${alert.title}
- Severity: ${alert.severity.toUpperCase()}
- Type: ${alert.type}
- Message: ${alert.message}
- Timestamp: ${new Date(alert.timestamp).toISOString()}

System Metrics:
- Average Processing Time: ${alert.metrics.averageTaskProcessingTime}ms
- Error Rate: ${alert.metrics.errorRate}%
- Queue Length: ${alert.metrics.averageQueueLength}
- Memory Usage: ${Math.round((alert.metrics.memoryUsage || 0) / 1024 / 1024)}MB
- CPU Usage: ${alert.metrics.cpuUsage}%
- Active Players: ${alert.metrics.activePlayerCount}

Please investigate and take appropriate action.
    `.trim();
  }

  private cleanupOldAlerts(): void {
    const cutoff = Date.now() - this.config.alertRetention;
    
    // Clean up alert history
    this.alertHistory = this.alertHistory.filter(alert => 
      alert.timestamp > cutoff || !alert.resolved
    );

    // Remove old resolved alerts from active alerts
    for (const [key, alert] of this.activeAlerts.entries()) {
      if (alert.resolved && alert.resolvedAt && alert.resolvedAt < cutoff) {
        this.activeAlerts.delete(key);
      }
    }
  }

  // Public API Methods
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<boolean> {
    for (const [key, alert] of this.activeAlerts.entries()) {
      if (alert.id === alertId) {
        alert.acknowledged = true;
        alert.acknowledgedBy = acknowledgedBy;
        
        taskQueueLogger.logSecurity(
          `Alert acknowledged: ${alert.title}`,
          acknowledgedBy,
          'low',
          { alertId, alertType: alert.type }
        );
        
        return true;
      }
    }
    return false;
  }

  async resolveAlert(alertId: string, resolvedBy: string): Promise<boolean> {
    for (const [key, alert] of this.activeAlerts.entries()) {
      if (alert.id === alertId) {
        alert.resolved = true;
        alert.resolvedAt = Date.now();
        
        // Move to history
        this.alertHistory.push({ ...alert });
        
        taskQueueLogger.logSecurity(
          `Alert resolved: ${alert.title}`,
          resolvedBy,
          'low',
          { alertId, alertType: alert.type }
        );
        
        return true;
      }
    }
    return false;
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values())
      .filter(alert => !alert.resolved)
      .sort((a, b) => {
        // Sort by severity, then by timestamp
        const severityOrder = {
          [AlertSeverity.CRITICAL]: 4,
          [AlertSeverity.HIGH]: 3,
          [AlertSeverity.MEDIUM]: 2,
          [AlertSeverity.LOW]: 1
        };
        
        const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
        if (severityDiff !== 0) return severityDiff;
        
        return b.timestamp - a.timestamp;
      });
  }

  getAlertHistory(limit: number = 100): Alert[] {
    return this.alertHistory
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  addCustomRule(rule: AlertRule): void {
    this.alertRules.push(rule);
  }

  removeRule(type: AlertType): void {
    this.alertRules = this.alertRules.filter(rule => rule.type !== type);
  }

  updateConfig(config: Partial<AlertingConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (config.enabled === false && this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    } else if (config.enabled === true && !this.checkInterval) {
      this.startMonitoring();
    }
  }

  // Cleanup
  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

// Singleton instance
export const taskQueueAlerting = new TaskQueueAlertingSystem({
  enabled: process.env.NODE_ENV === 'production',
  webhookUrl: process.env.REACT_APP_ALERT_WEBHOOK_URL,
  slackWebhook: process.env.REACT_APP_SLACK_WEBHOOK_URL,
  emailEndpoint: process.env.REACT_APP_EMAIL_ENDPOINT
});

export default TaskQueueAlertingSystem;