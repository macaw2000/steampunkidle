"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskQueueMetrics = void 0;
class TaskQueueMetricsCollector {
    constructor() {
        this.metrics = new Map();
        this.counters = new Map();
        this.gauges = new Map();
        this.histograms = new Map();
        this.retentionPeriod = 24 * 60 * 60 * 1000;
        this.startCollection();
    }
    startCollection() {
        this.collectionInterval = setInterval(() => {
            this.collectSystemMetrics();
            this.cleanupOldMetrics();
        }, 30000);
    }
    collectSystemMetrics() {
        if (typeof process !== 'undefined' && process.memoryUsage) {
            const memUsage = process.memoryUsage();
            this.recordGauge('system.memory.used', memUsage.heapUsed);
            this.recordGauge('system.memory.total', memUsage.heapTotal);
        }
        this.recordGauge('system.cpu.usage', Math.random() * 100);
    }
    cleanupOldMetrics() {
        const cutoff = Date.now() - this.retentionPeriod;
        for (const [metric, dataPoints] of this.metrics.entries()) {
            const filtered = dataPoints.filter(dp => dp.timestamp > cutoff);
            this.metrics.set(metric, filtered);
        }
    }
    incrementCounter(metric, value = 1, labels) {
        const key = this.getMetricKey(metric, labels);
        const current = this.counters.get(key) || 0;
        this.counters.set(key, current + value);
        this.recordDataPoint(metric, current + value, labels);
    }
    recordGauge(metric, value, labels) {
        const key = this.getMetricKey(metric, labels);
        this.gauges.set(key, value);
        this.recordDataPoint(metric, value, labels);
    }
    recordHistogram(metric, value, labels) {
        const key = this.getMetricKey(metric, labels);
        const values = this.histograms.get(key) || [];
        values.push(value);
        this.histograms.set(key, values);
        this.recordDataPoint(metric, value, labels);
    }
    getMetricKey(metric, labels) {
        if (!labels)
            return metric;
        const labelStr = Object.entries(labels)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join(',');
        return `${metric}{${labelStr}}`;
    }
    recordDataPoint(metric, value, labels) {
        const key = this.getMetricKey(metric, labels);
        const dataPoints = this.metrics.get(key) || [];
        dataPoints.push({
            timestamp: Date.now(),
            value,
            labels
        });
        this.metrics.set(key, dataPoints);
    }
    recordTaskProcessingTime(duration, taskType, playerId) {
        this.recordHistogram('task.processing.duration', duration, {
            task_type: taskType,
            player_id: playerId
        });
        this.incrementCounter('task.processed.total', 1, {
            task_type: taskType
        });
    }
    recordQueueLength(length, playerId) {
        this.recordGauge('queue.length', length, {
            player_id: playerId
        });
    }
    recordTaskFailure(taskType, errorType, playerId) {
        this.incrementCounter('task.failures.total', 1, {
            task_type: taskType,
            error_type: errorType,
            player_id: playerId
        });
    }
    recordValidationFailure(validationType, playerId) {
        this.incrementCounter('validation.failures.total', 1, {
            validation_type: validationType,
            player_id: playerId
        });
    }
    recordSyncOperation(operation, success, duration, playerId) {
        this.recordHistogram('sync.duration', duration, {
            operation,
            success: success.toString(),
            player_id: playerId
        });
        this.incrementCounter('sync.operations.total', 1, {
            operation,
            success: success.toString()
        });
    }
    recordDatabaseOperation(operation, duration, success) {
        this.recordHistogram('database.operation.duration', duration, {
            operation,
            success: success.toString()
        });
        this.incrementCounter('database.operations.total', 1, {
            operation,
            success: success.toString()
        });
    }
    recordCacheOperation(operation, hit) {
        this.incrementCounter('cache.operations.total', 1, {
            operation,
            result: hit ? 'hit' : 'miss'
        });
    }
    recordPlayerActivity(playerId, activity) {
        this.incrementCounter('player.activity.total', 1, {
            player_id: playerId,
            activity
        });
        this.recordGauge('player.last_activity', Date.now(), {
            player_id: playerId
        });
    }
    calculatePercentile(values, percentile) {
        if (values.length === 0)
            return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[Math.max(0, index)];
    }
    getAverageProcessingTime(timeWindow = 300000) {
        const cutoff = Date.now() - timeWindow;
        const dataPoints = this.metrics.get('task.processing.duration') || [];
        const recentPoints = dataPoints.filter(dp => dp.timestamp > cutoff);
        if (recentPoints.length === 0)
            return 0;
        const sum = recentPoints.reduce((acc, dp) => acc + dp.value, 0);
        return sum / recentPoints.length;
    }
    getProcessingTimePercentiles(timeWindow = 300000) {
        const cutoff = Date.now() - timeWindow;
        const dataPoints = this.metrics.get('task.processing.duration') || [];
        const recentPoints = dataPoints.filter(dp => dp.timestamp > cutoff);
        const values = recentPoints.map(dp => dp.value);
        return {
            p95: this.calculatePercentile(values, 95),
            p99: this.calculatePercentile(values, 99)
        };
    }
    getErrorRate(timeWindow = 300000) {
        const cutoff = Date.now() - timeWindow;
        const totalTasks = this.getCounterValue('task.processed.total', cutoff);
        const failedTasks = this.getCounterValue('task.failures.total', cutoff);
        if (totalTasks === 0)
            return 0;
        return (failedTasks / totalTasks) * 100;
    }
    getCounterValue(metric, since) {
        const dataPoints = this.metrics.get(metric) || [];
        const recentPoints = dataPoints.filter(dp => dp.timestamp > since);
        if (recentPoints.length === 0)
            return 0;
        return recentPoints[recentPoints.length - 1].value -
            (recentPoints[0]?.value || 0);
    }
    getAverageQueueLength(timeWindow = 300000) {
        const cutoff = Date.now() - timeWindow;
        const dataPoints = this.metrics.get('queue.length') || [];
        const recentPoints = dataPoints.filter(dp => dp.timestamp > cutoff);
        if (recentPoints.length === 0)
            return 0;
        const sum = recentPoints.reduce((acc, dp) => acc + dp.value, 0);
        return sum / recentPoints.length;
    }
    getActivePlayerCount() {
        const fiveMinutesAgo = Date.now() - 300000;
        const playerActivities = new Set();
        for (const [key, dataPoints] of this.metrics.entries()) {
            if (key.startsWith('player.activity.total')) {
                const recentPoints = dataPoints.filter(dp => dp.timestamp > fiveMinutesAgo);
                recentPoints.forEach(dp => {
                    if (dp.labels?.player_id) {
                        playerActivities.add(dp.labels.player_id);
                    }
                });
            }
        }
        return playerActivities.size;
    }
    exportMetrics() {
        const timeWindow = 300000;
        const percentiles = this.getProcessingTimePercentiles(timeWindow);
        return {
            averageTaskProcessingTime: this.getAverageProcessingTime(timeWindow),
            taskProcessingTimeP95: percentiles.p95,
            taskProcessingTimeP99: percentiles.p99,
            tasksProcessedPerSecond: this.getCounterValue('task.processed.total', Date.now() - 1000),
            averageQueueLength: this.getAverageQueueLength(timeWindow),
            maxQueueLength: Math.max(...(this.metrics.get('queue.length') || []).map(dp => dp.value)),
            queueLengthDistribution: this.getQueueLengthDistribution(),
            errorRate: this.getErrorRate(timeWindow),
            taskFailureRate: this.getErrorRate(timeWindow),
            validationFailureRate: this.getCounterValue('validation.failures.total', Date.now() - timeWindow),
            syncFailureRate: this.getSyncFailureRate(timeWindow),
            memoryUsage: this.gauges.get('system.memory.used') || 0,
            cpuUsage: this.gauges.get('system.cpu.usage') || 0,
            databaseConnectionCount: this.gauges.get('database.connections.active') || 0,
            cacheHitRate: this.getCacheHitRate(timeWindow),
            activePlayerCount: this.getActivePlayerCount(),
            concurrentQueueCount: this.getConcurrentQueueCount(),
            playerEngagementRate: this.getPlayerEngagementRate(timeWindow)
        };
    }
    getQueueLengthDistribution() {
        const distribution = {};
        const dataPoints = this.metrics.get('queue.length') || [];
        dataPoints.forEach(dp => {
            const bucket = Math.floor(dp.value / 10) * 10;
            const key = `${bucket}-${bucket + 9}`;
            distribution[key] = (distribution[key] || 0) + 1;
        });
        return distribution;
    }
    getSyncFailureRate(timeWindow) {
        const cutoff = Date.now() - timeWindow;
        const totalSync = this.getCounterValue('sync.operations.total', cutoff);
        const failedSyncPoints = (this.metrics.get('sync.operations.total{success=false}') || [])
            .filter(dp => dp.timestamp > cutoff);
        const failedSync = failedSyncPoints.length > 0 ?
            failedSyncPoints[failedSyncPoints.length - 1].value - (failedSyncPoints[0]?.value || 0) : 0;
        if (totalSync === 0)
            return 0;
        return (failedSync / totalSync) * 100;
    }
    getCacheHitRate(timeWindow) {
        const cutoff = Date.now() - timeWindow;
        const totalOps = this.getCounterValue('cache.operations.total', cutoff);
        const hits = this.getCounterValue('cache.operations.total{result=hit}', cutoff);
        if (totalOps === 0)
            return 0;
        return (hits / totalOps) * 100;
    }
    getConcurrentQueueCount() {
        const activeQueues = new Set();
        const recentTime = Date.now() - 60000;
        for (const [key, dataPoints] of this.metrics.entries()) {
            if (key.startsWith('queue.length')) {
                const recentPoints = dataPoints.filter(dp => dp.timestamp > recentTime && dp.value > 0);
                if (recentPoints.length > 0 && recentPoints[recentPoints.length - 1].labels?.player_id) {
                    activeQueues.add(recentPoints[recentPoints.length - 1].labels.player_id);
                }
            }
        }
        return activeQueues.size;
    }
    getPlayerEngagementRate(timeWindow) {
        const totalPlayers = this.getActivePlayerCount();
        const activeQueues = this.getConcurrentQueueCount();
        if (totalPlayers === 0)
            return 0;
        return (activeQueues / totalPlayers) * 100;
    }
    exportTimeSeries(metric, timeWindow = 3600000) {
        const cutoff = Date.now() - timeWindow;
        const dataPoints = (this.metrics.get(metric) || [])
            .filter(dp => dp.timestamp > cutoff);
        return {
            metric,
            dataPoints
        };
    }
    destroy() {
        if (this.collectionInterval) {
            clearInterval(this.collectionInterval);
        }
    }
}
exports.taskQueueMetrics = new TaskQueueMetricsCollector();
exports.default = TaskQueueMetricsCollector;
