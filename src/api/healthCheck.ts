// Health Check API for Production Deployment System
// Provides comprehensive health status for blue-green deployment validation

import { Request, Response } from 'express';

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  checks: {
    database: HealthCheckResult;
    taskProcessor: HealthCheckResult;
    memory: HealthCheckResult;
    disk: HealthCheckResult;
    dependencies: HealthCheckResult;
  };
  metrics: {
    activeTasksCount: number;
    queueDepth: number;
    processingRate: number;
    errorRate: number;
  };
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  message: string;
  responseTime?: number;
  details?: any;
}

class HealthCheckService {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  async performHealthCheck(): Promise<HealthCheckResponse> {
    const startTime = Date.now();
    
    try {
      // Run all health checks in parallel
      const [
        databaseCheck,
        taskProcessorCheck,
        memoryCheck,
        diskCheck,
        dependenciesCheck,
        metrics
      ] = await Promise.all([
        this.checkDatabase(),
        this.checkTaskProcessor(),
        this.checkMemory(),
        this.checkDisk(),
        this.checkDependencies(),
        this.getMetrics()
      ]);

      const checks = {
        database: databaseCheck,
        taskProcessor: taskProcessorCheck,
        memory: memoryCheck,
        disk: diskCheck,
        dependencies: dependenciesCheck
      };

      // Determine overall status
      const overallStatus = this.determineOverallStatus(checks);

      return {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: process.env.VERSION || 'unknown',
        environment: process.env.NODE_ENV || 'development',
        uptime: Date.now() - this.startTime,
        checks,
        metrics
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: process.env.VERSION || 'unknown',
        environment: process.env.NODE_ENV || 'development',
        uptime: Date.now() - this.startTime,
        checks: {
          database: { status: 'unhealthy', message: 'Health check failed' },
          taskProcessor: { status: 'unhealthy', message: 'Health check failed' },
          memory: { status: 'unhealthy', message: 'Health check failed' },
          disk: { status: 'unhealthy', message: 'Health check failed' },
          dependencies: { status: 'unhealthy', message: 'Health check failed' }
        },
        metrics: {
          activeTasksCount: 0,
          queueDepth: 0,
          processingRate: 0,
          errorRate: 100
        }
      };
    }
  }

  private async checkDatabase(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // This would check your actual database connection
      // For now, simulate a database check
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const responseTime = Date.now() - startTime;
      
      if (responseTime > 1000) {
        return {
          status: 'degraded',
          message: 'Database response time is slow',
          responseTime,
          details: { threshold: 1000, actual: responseTime }
        };
      }
      
      return {
        status: 'healthy',
        message: 'Database connection is healthy',
        responseTime
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Database check failed: ${error instanceof Error ? error.message : String(error)}`,
        responseTime: Date.now() - startTime
      };
    }
  }

  private async checkTaskProcessor(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Check if task processor is running and responsive
      // This would integrate with your actual task queue service
      const isProcessorRunning = true; // Simulate check
      const lastProcessedTime = Date.now() - 30000; // 30 seconds ago
      const timeSinceLastProcess = Date.now() - lastProcessedTime;
      
      if (!isProcessorRunning) {
        return {
          status: 'unhealthy',
          message: 'Task processor is not running',
          responseTime: Date.now() - startTime
        };
      }
      
      if (timeSinceLastProcess > 300000) { // 5 minutes
        return {
          status: 'degraded',
          message: 'Task processor has not processed tasks recently',
          responseTime: Date.now() - startTime,
          details: { lastProcessedTime, timeSinceLastProcess }
        };
      }
      
      return {
        status: 'healthy',
        message: 'Task processor is healthy',
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Task processor check failed: ${error instanceof Error ? error.message : String(error)}`,
        responseTime: Date.now() - startTime
      };
    }
  }

  private async checkMemory(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
      const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024;
      const memoryUtilization = (heapUsedMB / heapTotalMB) * 100;
      
      if (memoryUtilization > 90) {
        return {
          status: 'unhealthy',
          message: 'Memory utilization is critically high',
          responseTime: Date.now() - startTime,
          details: { utilization: memoryUtilization, heapUsedMB, heapTotalMB }
        };
      }
      
      if (memoryUtilization > 75) {
        return {
          status: 'degraded',
          message: 'Memory utilization is high',
          responseTime: Date.now() - startTime,
          details: { utilization: memoryUtilization, heapUsedMB, heapTotalMB }
        };
      }
      
      return {
        status: 'healthy',
        message: 'Memory utilization is normal',
        responseTime: Date.now() - startTime,
        details: { utilization: memoryUtilization, heapUsedMB, heapTotalMB }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Memory check failed: ${error instanceof Error ? error.message : String(error)}`,
        responseTime: Date.now() - startTime
      };
    }
  }

  private async checkDisk(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // In a real implementation, you would check disk space
      // For now, simulate a disk check
      const diskUtilization = Math.random() * 50; // 0-50% utilization
      
      if (diskUtilization > 90) {
        return {
          status: 'unhealthy',
          message: 'Disk utilization is critically high',
          responseTime: Date.now() - startTime,
          details: { utilization: diskUtilization }
        };
      }
      
      if (diskUtilization > 80) {
        return {
          status: 'degraded',
          message: 'Disk utilization is high',
          responseTime: Date.now() - startTime,
          details: { utilization: diskUtilization }
        };
      }
      
      return {
        status: 'healthy',
        message: 'Disk utilization is normal',
        responseTime: Date.now() - startTime,
        details: { utilization: diskUtilization }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Disk check failed: ${error instanceof Error ? error.message : String(error)}`,
        responseTime: Date.now() - startTime
      };
    }
  }

  private async checkDependencies(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Check external dependencies (APIs, services, etc.)
      const dependencies = [
        { name: 'External API', url: 'https://api.example.com/health' },
        // Add more dependencies as needed
      ];
      
      const dependencyChecks = await Promise.allSettled(
        dependencies.map(async (dep) => {
          // Simulate dependency check
          await new Promise(resolve => setTimeout(resolve, 50));
          return { name: dep.name, status: 'healthy' };
        })
      );
      
      const failedDependencies = dependencyChecks
        .filter(result => result.status === 'rejected')
        .map((result, index) => dependencies[index].name);
      
      if (failedDependencies.length > 0) {
        return {
          status: 'degraded',
          message: `Some dependencies are unhealthy: ${failedDependencies.join(', ')}`,
          responseTime: Date.now() - startTime,
          details: { failedDependencies }
        };
      }
      
      return {
        status: 'healthy',
        message: 'All dependencies are healthy',
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Dependencies check failed: ${error instanceof Error ? error.message : String(error)}`,
        responseTime: Date.now() - startTime
      };
    }
  }

  private async getMetrics() {
    // This would integrate with your actual task queue metrics
    // For now, return simulated metrics
    return {
      activeTasksCount: Math.floor(Math.random() * 50),
      queueDepth: Math.floor(Math.random() * 20),
      processingRate: Math.floor(Math.random() * 10) + 5,
      errorRate: Math.random() * 2 // 0-2% error rate
    };
  }

  private determineOverallStatus(checks: Record<string, HealthCheckResult>): 'healthy' | 'unhealthy' | 'degraded' {
    const statuses = Object.values(checks).map(check => check.status);
    
    if (statuses.includes('unhealthy')) {
      return 'unhealthy';
    }
    
    if (statuses.includes('degraded')) {
      return 'degraded';
    }
    
    return 'healthy';
  }
}

const healthCheckService = new HealthCheckService();

// Express route handlers
export const healthCheck = async (req: Request, res: Response) => {
  try {
    const healthStatus = await healthCheckService.performHealthCheck();
    
    // Set appropriate HTTP status code
    let statusCode = 200;
    if (healthStatus.status === 'degraded') {
      statusCode = 200; // Still operational but with warnings
    } else if (healthStatus.status === 'unhealthy') {
      statusCode = 503; // Service unavailable
    }
    
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// Simple health check for load balancer
export const simpleHealthCheck = async (req: Request, res: Response) => {
  try {
    const healthStatus = await healthCheckService.performHealthCheck();
    
    if (healthStatus.status === 'unhealthy') {
      res.status(503).json({ status: 'unhealthy' });
    } else {
      res.status(200).json({ status: 'healthy' });
    }
  } catch (error) {
    res.status(503).json({ status: 'unhealthy' });
  }
};

// Task queue specific health check
export const taskQueueHealthCheck = async (req: Request, res: Response) => {
  try {
    const healthStatus = await healthCheckService.performHealthCheck();
    
    const taskQueueStatus = {
      taskProcessor: healthStatus.checks.taskProcessor.status,
      database: healthStatus.checks.database.status,
      metrics: healthStatus.metrics,
      timestamp: healthStatus.timestamp
    };
    
    const isHealthy = taskQueueStatus.taskProcessor === 'healthy' && 
                     taskQueueStatus.database === 'healthy';
    
    res.status(isHealthy ? 200 : 503).json(taskQueueStatus);
  } catch (error) {
    res.status(503).json({
      taskProcessor: 'unhealthy',
      database: 'unhealthy',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};