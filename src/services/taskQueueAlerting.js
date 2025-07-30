"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskQueueAlerting = exports.AlertType = exports.AlertSeverity = void 0;
const taskQueueMetrics_1 = require("./taskQueueMetrics");
const taskQueueLogger_1 = require("./taskQueueLogger");
var AlertSeverity;
(function (AlertSeverity) {
    AlertSeverity["LOW"] = "low";
    AlertSeverity["MEDIUM"] = "medium";
    AlertSeverity["HIGH"] = "high";
    AlertSeverity["CRITICAL"] = "critical";
})(AlertSeverity = exports.AlertSeverity || (exports.AlertSeverity = {}));
var AlertType;
(function (AlertType) {
    AlertType["PERFORMANCE_DEGRADATION"] = "performance_degradation";
    AlertType["HIGH_ERROR_RATE"] = "high_error_rate";
    AlertType["QUEUE_BACKUP"] = "queue_backup";
    AlertType["DATABASE_ISSUES"] = "database_issues";
    AlertType["MEMORY_LEAK"] = "memory_leak";
    AlertType["SYSTEM_OVERLOAD"] = "system_overload";
    AlertType["SYNC_FAILURES"] = "sync_failures";
    AlertType["VALIDATION_FAILURES"] = "validation_failures";
})(AlertType = exports.AlertType || (exports.AlertType = {}));
class TaskQueueAlertingSystem {
    constructor(config = {}) {
        this.alertRules = [];
        this.activeAlerts = new Map();
        this.alertHistory = [];
        this.lastAlertTime = new Map();
        this.config = {
            enabled: true,
            checkInterval: 30000,
            maxActiveAlerts: 50,
            alertRetention: 7 * 24 * 60 * 60 * 1000,
            ...config
        };
        this.initializeDefaultRules();
        if (this.config.enabled) {
            this.startMonitoring();
        }
    }
    initializeDefaultRules() {
        this.alertRules = [
            {
                type: AlertType.HIGH_ERROR_RATE,
                severity: AlertSeverity.HIGH,
                condition: (metrics) => metrics.errorRate > 5,
                title: 'High Task Error Rate Detected',
                messageTemplate: 'Task error rate is {errorRate}%, exceeding the 5% threshold',
                cooldownPeriod: 300000,
                autoResolve: true,
                resolveCondition: (metrics) => metrics.errorRate < 2
            },
            {
                type: AlertType.PERFORMANCE_DEGRADATION,
                severity: AlertSeverity.MEDIUM,
                condition: (metrics) => metrics.averageTaskProcessingTime > 30000,
                title: 'Task Processing Performance Degradation',
                messageTemplate: 'Average task processing time is {averageTaskProcessingTime}ms, exceeding 30s threshold',
                cooldownPeriod: 600000,
                autoResolve: true,
                resolveCondition: (metrics) => metrics.averageTaskProcessingTime < 20000
            },
            {
                type: AlertType.QUEUE_BACKUP,
                severity: AlertSeverity.HIGH,
                condition: (metrics) => metrics.maxQueueLength > 1000,
                title: 'Large Queue Backup Detected',
                messageTemplate: 'Maximum queue length is {maxQueueLength} tasks, exceeding 1000 task threshold',
                cooldownPeriod: 300000,
                autoResolve: true,
                resolveCondition: (metrics) => metrics.maxQueueLength < 500
            },
            {
                type: AlertType.MEMORY_LEAK,
                severity: AlertSeverity.CRITICAL,
                condition: (metrics) => metrics.memoryUsage > 1024 * 1024 * 1024,
                title: 'High Memory Usage Detected',
                messageTemplate: 'Memory usage is {memoryUsage} bytes, indicating potential memory leak',
                cooldownPeriod: 600000,
                autoResolve: true,
                resolveCondition: (metrics) => metrics.memoryUsage < 512 * 1024 * 1024
            },
            {
                type: AlertType.SYSTEM_OVERLOAD,
                severity: AlertSeverity.HIGH,
                condition: (metrics) => metrics.cpuUsage > 80,
                title: 'System CPU Overload',
                messageTemplate: 'CPU usage is {cpuUsage}%, exceeding 80% threshold',
                cooldownPeriod: 300000,
                autoResolve: true,
                resolveCondition: (metrics) => metrics.cpuUsage < 60
            },
            {
                type: AlertType.SYNC_FAILURES,
                severity: AlertSeverity.MEDIUM,
                condition: (metrics) => metrics.syncFailureRate > 10,
                title: 'High Sync Failure Rate',
                messageTemplate: 'Sync failure rate is {syncFailureRate}%, exceeding 10% threshold',
                cooldownPeriod: 300000,
                autoResolve: true,
                resolveCondition: (metrics) => metrics.syncFailureRate < 5
            },
            {
                type: AlertType.VALIDATION_FAILURES,
                severity: AlertSeverity.MEDIUM,
                condition: (metrics) => metrics.validationFailureRate > 15,
                title: 'High Validation Failure Rate',
                messageTemplate: 'Validation failure rate is {validationFailureRate}%, exceeding 15% threshold',
                cooldownPeriod: 300000,
                autoResolve: true,
                resolveCondition: (metrics) => metrics.validationFailureRate < 8
            },
            {
                type: AlertType.PERFORMANCE_DEGRADATION,
                severity: AlertSeverity.LOW,
                condition: (metrics) => metrics.cacheHitRate < 70,
                title: 'Low Cache Hit Rate',
                messageTemplate: 'Cache hit rate is {cacheHitRate}%, below 70% threshold',
                cooldownPeriod: 600000,
                autoResolve: true,
                resolveCondition: (metrics) => metrics.cacheHitRate > 80
            }
        ];
    }
    startMonitoring() {
        this.checkInterval = setInterval(() => {
            this.checkAlerts().catch(error => {
                taskQueueLogger_1.taskQueueLogger.logError('Failed to check alerts', error);
            });
        }, this.config.checkInterval);
    }
    async checkAlerts() {
        const metrics = taskQueueMetrics_1.taskQueueMetrics.exportMetrics();
        for (const rule of this.alertRules) {
            await this.evaluateRule(rule, metrics);
        }
        this.cleanupOldAlerts();
    }
    async evaluateRule(rule, metrics) {
        const alertKey = `${rule.type}_${rule.severity}`;
        const existingAlert = this.activeAlerts.get(alertKey);
        const lastAlertTime = this.lastAlertTime.get(rule.type) || 0;
        const now = Date.now();
        const conditionMet = rule.condition(metrics);
        if (conditionMet && !existingAlert) {
            if (now - lastAlertTime < rule.cooldownPeriod) {
                return;
            }
            const alert = this.createAlert(rule, metrics);
            this.activeAlerts.set(alertKey, alert);
            this.lastAlertTime.set(rule.type, now);
            await this.sendAlert(alert);
            taskQueueLogger_1.taskQueueLogger.logError(`Alert triggered: ${alert.title}`, new Error(alert.message), undefined, undefined, { alertId: alert.id, severity: alert.severity });
        }
        else if (!conditionMet && existingAlert && rule.autoResolve && rule.resolveCondition) {
            if (rule.resolveCondition(metrics)) {
                await this.resolveAlert(existingAlert.id, 'system');
            }
        }
    }
    createAlert(rule, metrics) {
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
    formatMessage(template, metrics) {
        let message = template;
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
    async sendAlert(alert) {
        const payload = {
            alert,
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'production'
        };
        if (this.config.webhookUrl) {
            try {
                await fetch(this.config.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }
            catch (error) {
                taskQueueLogger_1.taskQueueLogger.logError('Failed to send webhook alert', error);
            }
        }
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
            }
            catch (error) {
                taskQueueLogger_1.taskQueueLogger.logError('Failed to send Slack alert', error);
            }
        }
        if (this.config.emailEndpoint) {
            try {
                const emailPayload = {
                    to: 'admin@example.com',
                    subject: `Task Queue Alert: ${alert.title}`,
                    body: this.formatEmailBody(alert),
                    priority: alert.severity === AlertSeverity.CRITICAL ? 'high' : 'normal'
                };
                await fetch(this.config.emailEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(emailPayload)
                });
            }
            catch (error) {
                taskQueueLogger_1.taskQueueLogger.logError('Failed to send email alert', error);
            }
        }
    }
    getSeverityColor(severity) {
        switch (severity) {
            case AlertSeverity.CRITICAL: return 'danger';
            case AlertSeverity.HIGH: return 'warning';
            case AlertSeverity.MEDIUM: return '#ff9500';
            case AlertSeverity.LOW: return 'good';
            default: return '#cccccc';
        }
    }
    formatEmailBody(alert) {
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
    cleanupOldAlerts() {
        const cutoff = Date.now() - this.config.alertRetention;
        this.alertHistory = this.alertHistory.filter(alert => alert.timestamp > cutoff || !alert.resolved);
        for (const [key, alert] of this.activeAlerts.entries()) {
            if (alert.resolved && alert.resolvedAt && alert.resolvedAt < cutoff) {
                this.activeAlerts.delete(key);
            }
        }
    }
    async acknowledgeAlert(alertId, acknowledgedBy) {
        for (const [key, alert] of this.activeAlerts.entries()) {
            if (alert.id === alertId) {
                alert.acknowledged = true;
                alert.acknowledgedBy = acknowledgedBy;
                taskQueueLogger_1.taskQueueLogger.logSecurity(`Alert acknowledged: ${alert.title}`, acknowledgedBy, 'low', { alertId, alertType: alert.type });
                return true;
            }
        }
        return false;
    }
    async resolveAlert(alertId, resolvedBy) {
        for (const [key, alert] of this.activeAlerts.entries()) {
            if (alert.id === alertId) {
                alert.resolved = true;
                alert.resolvedAt = Date.now();
                this.alertHistory.push({ ...alert });
                taskQueueLogger_1.taskQueueLogger.logSecurity(`Alert resolved: ${alert.title}`, resolvedBy, 'low', { alertId, alertType: alert.type });
                return true;
            }
        }
        return false;
    }
    getActiveAlerts() {
        return Array.from(this.activeAlerts.values())
            .filter(alert => !alert.resolved)
            .sort((a, b) => {
            const severityOrder = {
                [AlertSeverity.CRITICAL]: 4,
                [AlertSeverity.HIGH]: 3,
                [AlertSeverity.MEDIUM]: 2,
                [AlertSeverity.LOW]: 1
            };
            const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
            if (severityDiff !== 0)
                return severityDiff;
            return b.timestamp - a.timestamp;
        });
    }
    getAlertHistory(limit = 100) {
        return this.alertHistory
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }
    addCustomRule(rule) {
        this.alertRules.push(rule);
    }
    removeRule(type) {
        this.alertRules = this.alertRules.filter(rule => rule.type !== type);
    }
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        if (config.enabled === false && this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = undefined;
        }
        else if (config.enabled === true && !this.checkInterval) {
            this.startMonitoring();
        }
    }
    destroy() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
    }
}
exports.taskQueueAlerting = new TaskQueueAlertingSystem({
    enabled: true,
    webhookUrl: process.env.REACT_APP_ALERT_WEBHOOK_URL,
    slackWebhook: process.env.REACT_APP_SLACK_WEBHOOK_URL,
    emailEndpoint: process.env.REACT_APP_EMAIL_ENDPOINT
});
exports.default = TaskQueueAlertingSystem;
