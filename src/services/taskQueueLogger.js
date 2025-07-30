"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskQueueLogger = exports.LogCategory = exports.LogLevel = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "debug";
    LogLevel["INFO"] = "info";
    LogLevel["WARN"] = "warn";
    LogLevel["ERROR"] = "error";
    LogLevel["CRITICAL"] = "critical";
})(LogLevel = exports.LogLevel || (exports.LogLevel = {}));
var LogCategory;
(function (LogCategory) {
    LogCategory["QUEUE_OPERATION"] = "queue_operation";
    LogCategory["TASK_PROCESSING"] = "task_processing";
    LogCategory["PERFORMANCE"] = "performance";
    LogCategory["ERROR"] = "error";
    LogCategory["SECURITY"] = "security";
    LogCategory["SYNC"] = "sync";
    LogCategory["VALIDATION"] = "validation";
})(LogCategory = exports.LogCategory || (exports.LogCategory = {}));
class TaskQueueLogger {
    constructor(config = {}) {
        this.logBuffer = [];
        this.config = {
            minLevel: LogLevel.INFO,
            enableConsole: true,
            enableRemote: false,
            bufferSize: 100,
            flushInterval: 5000,
            ...config
        };
        if (this.config.enableRemote) {
            this.startFlushTimer();
        }
    }
    shouldLog(level) {
        const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.CRITICAL];
        return levels.indexOf(level) >= levels.indexOf(this.config.minLevel);
    }
    createLogEntry(level, category, message, context = {}) {
        return {
            timestamp: Date.now(),
            level,
            category,
            message,
            ...context
        };
    }
    formatLogEntry(entry) {
        const timestamp = new Date(entry.timestamp).toISOString();
        const context = entry.playerId ? `[${entry.playerId}]` : '';
        const task = entry.taskId ? `[${entry.taskId}]` : '';
        const duration = entry.duration ? `(${entry.duration}ms)` : '';
        return `${timestamp} [${entry.level.toUpperCase()}] [${entry.category}] ${context}${task} ${entry.message} ${duration}`;
    }
    async writeLog(entry) {
        if (this.config.enableConsole) {
            const formatted = this.formatLogEntry(entry);
            switch (entry.level) {
                case LogLevel.DEBUG:
                    console.debug(formatted);
                    break;
                case LogLevel.INFO:
                    console.info(formatted);
                    break;
                case LogLevel.WARN:
                    console.warn(formatted);
                    break;
                case LogLevel.ERROR:
                case LogLevel.CRITICAL:
                    console.error(formatted);
                    if (entry.error) {
                        console.error(entry.error);
                    }
                    break;
            }
        }
        if (this.config.enableRemote) {
            this.logBuffer.push(entry);
            if (this.logBuffer.length >= this.config.bufferSize) {
                await this.flushLogs();
            }
        }
    }
    startFlushTimer() {
        this.flushTimer = setInterval(() => {
            this.flushLogs().catch(console.error);
        }, this.config.flushInterval);
    }
    async flushLogs() {
        if (this.logBuffer.length === 0)
            return;
        const logsToFlush = [...this.logBuffer];
        this.logBuffer = [];
        try {
            if (this.config.remoteEndpoint) {
                await fetch(this.config.remoteEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ logs: logsToFlush })
                });
            }
        }
        catch (error) {
            console.error('Failed to flush logs to remote endpoint:', error);
            this.logBuffer.unshift(...logsToFlush);
        }
    }
    logQueueOperation(operation, playerId, success, duration, metadata) {
        const level = success ? LogLevel.INFO : LogLevel.ERROR;
        const message = `Queue operation ${operation} ${success ? 'completed' : 'failed'}`;
        const entry = this.createLogEntry(level, LogCategory.QUEUE_OPERATION, message, {
            playerId,
            operation,
            duration,
            metadata
        });
        if (this.shouldLog(level)) {
            this.writeLog(entry);
        }
    }
    logTaskProcessing(taskId, playerId, operation, success, duration, metadata) {
        const level = success ? LogLevel.INFO : LogLevel.ERROR;
        const message = `Task ${operation} ${success ? 'completed' : 'failed'}`;
        const entry = this.createLogEntry(level, LogCategory.TASK_PROCESSING, message, {
            playerId,
            taskId,
            operation,
            duration,
            metadata
        });
        if (this.shouldLog(level)) {
            this.writeLog(entry);
        }
    }
    logPerformance(operation, duration, playerId, metadata) {
        const level = duration > 1000 ? LogLevel.WARN : LogLevel.DEBUG;
        const message = `Performance: ${operation} took ${duration}ms`;
        const entry = this.createLogEntry(level, LogCategory.PERFORMANCE, message, {
            playerId,
            operation,
            duration,
            metadata
        });
        if (this.shouldLog(level)) {
            this.writeLog(entry);
        }
    }
    logError(message, error, playerId, taskId, metadata) {
        const entry = this.createLogEntry(LogLevel.ERROR, LogCategory.ERROR, message, {
            playerId,
            taskId,
            error,
            stackTrace: error.stack,
            metadata
        });
        if (this.shouldLog(LogLevel.ERROR)) {
            this.writeLog(entry);
        }
    }
    logSecurity(event, playerId, severity = 'medium', metadata) {
        const level = severity === 'high' ? LogLevel.CRITICAL :
            severity === 'medium' ? LogLevel.WARN : LogLevel.INFO;
        const entry = this.createLogEntry(level, LogCategory.SECURITY, `Security event: ${event}`, {
            playerId,
            metadata: { ...metadata, severity }
        });
        if (this.shouldLog(level)) {
            this.writeLog(entry);
        }
    }
    logSync(operation, playerId, success, conflictsResolved, metadata) {
        const level = success ? LogLevel.INFO : LogLevel.WARN;
        const message = `Sync ${operation} ${success ? 'completed' : 'failed'}`;
        const entry = this.createLogEntry(level, LogCategory.SYNC, message, {
            playerId,
            operation,
            metadata: { ...metadata, conflictsResolved }
        });
        if (this.shouldLog(level)) {
            this.writeLog(entry);
        }
    }
    logValidation(operation, playerId, taskId, success, errors, metadata) {
        const level = success ? LogLevel.DEBUG : LogLevel.WARN;
        const message = `Validation ${operation} ${success ? 'passed' : 'failed'}`;
        const entry = this.createLogEntry(level, LogCategory.VALIDATION, message, {
            playerId,
            taskId,
            operation,
            metadata: { ...metadata, errors }
        });
        if (this.shouldLog(level)) {
            this.writeLog(entry);
        }
    }
    destroy() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        if (this.logBuffer.length > 0) {
            this.flushLogs().catch(console.error);
        }
    }
}
exports.taskQueueLogger = new TaskQueueLogger({
    minLevel: LogLevel.INFO,
    enableConsole: true,
    enableRemote: true,
    remoteEndpoint: process.env.REACT_APP_LOGGING_ENDPOINT
});
exports.default = TaskQueueLogger;
