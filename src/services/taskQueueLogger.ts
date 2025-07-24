/**
 * Comprehensive logging system for task queue operations
 * Provides structured logging with different levels and contexts
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export enum LogCategory {
  QUEUE_OPERATION = 'queue_operation',
  TASK_PROCESSING = 'task_processing',
  PERFORMANCE = 'performance',
  ERROR = 'error',
  SECURITY = 'security',
  SYNC = 'sync',
  VALIDATION = 'validation'
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  category: LogCategory;
  message: string;
  playerId?: string;
  taskId?: string;
  operation?: string;
  duration?: number;
  metadata?: Record<string, any>;
  error?: Error;
  stackTrace?: string;
}

export interface LoggerConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  enableRemote: boolean;
  bufferSize: number;
  flushInterval: number;
  remoteEndpoint?: string;
}

class TaskQueueLogger {
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(config: Partial<LoggerConfig> = {}) {
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

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.CRITICAL];
    return levels.indexOf(level) >= levels.indexOf(this.config.minLevel);
  }

  private createLogEntry(
    level: LogLevel,
    category: LogCategory,
    message: string,
    context: Partial<LogEntry> = {}
  ): LogEntry {
    return {
      timestamp: Date.now(),
      level,
      category,
      message,
      ...context
    };
  }

  private formatLogEntry(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const context = entry.playerId ? `[${entry.playerId}]` : '';
    const task = entry.taskId ? `[${entry.taskId}]` : '';
    const duration = entry.duration ? `(${entry.duration}ms)` : '';
    
    return `${timestamp} [${entry.level.toUpperCase()}] [${entry.category}] ${context}${task} ${entry.message} ${duration}`;
  }

  private async writeLog(entry: LogEntry): Promise<void> {
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

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flushLogs().catch(console.error);
    }, this.config.flushInterval);
  }

  private async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0) return;

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
    } catch (error) {
      console.error('Failed to flush logs to remote endpoint:', error);
      // Re-add logs to buffer for retry
      this.logBuffer.unshift(...logsToFlush);
    }
  }

  // Queue Operation Logging
  logQueueOperation(
    operation: string,
    playerId: string,
    success: boolean,
    duration?: number,
    metadata?: Record<string, any>
  ): void {
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

  // Task Processing Logging
  logTaskProcessing(
    taskId: string,
    playerId: string,
    operation: string,
    success: boolean,
    duration?: number,
    metadata?: Record<string, any>
  ): void {
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

  // Performance Logging
  logPerformance(
    operation: string,
    duration: number,
    playerId?: string,
    metadata?: Record<string, any>
  ): void {
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

  // Error Logging
  logError(
    message: string,
    error: Error,
    playerId?: string,
    taskId?: string,
    metadata?: Record<string, any>
  ): void {
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

  // Security Logging
  logSecurity(
    event: string,
    playerId?: string,
    severity: 'low' | 'medium' | 'high' = 'medium',
    metadata?: Record<string, any>
  ): void {
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

  // Sync Logging
  logSync(
    operation: string,
    playerId: string,
    success: boolean,
    conflictsResolved?: number,
    metadata?: Record<string, any>
  ): void {
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

  // Validation Logging
  logValidation(
    operation: string,
    playerId: string,
    taskId: string,
    success: boolean,
    errors?: string[],
    metadata?: Record<string, any>
  ): void {
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

  // Cleanup
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    if (this.logBuffer.length > 0) {
      this.flushLogs().catch(console.error);
    }
  }
}

// Singleton instance
export const taskQueueLogger = new TaskQueueLogger({
  minLevel: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
  enableConsole: true,
  enableRemote: process.env.NODE_ENV === 'production',
  remoteEndpoint: process.env.REACT_APP_LOGGING_ENDPOINT
});

export default TaskQueueLogger;