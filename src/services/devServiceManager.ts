/**
 * Development Service Manager
 * Manages service health checking and automatic fallback to mock services
 */

import { CharacterService } from './characterService';
import { MockCharacterService } from './mockCharacterService';
import { EnvironmentService } from './environmentService';

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  message: string;
  lastChecked: Date;
  responseTime?: number;
}

export interface ServiceManagerConfig {
  healthCheckInterval: number; // milliseconds
  healthCheckTimeout: number; // milliseconds
  autoFallbackEnabled: boolean;
  mockServicesEnabled: boolean;
  logHealthChecks: boolean;
}

export class DevServiceManager {
  private static config: ServiceManagerConfig = {
    healthCheckInterval: 30000, // 30 seconds
    healthCheckTimeout: 5000, // 5 seconds
    autoFallbackEnabled: true,
    mockServicesEnabled: true,
    logHealthChecks: true,
  };

  private static serviceHealth: Map<string, ServiceHealth> = new Map();
  private static healthCheckInterval: NodeJS.Timeout | null = null;
  private static isInitialized = false;

  /**
   * Initialize the service manager
   */
  static initialize(config?: Partial<ServiceManagerConfig>): void {
    if (this.isInitialized) {
      return;
    }

    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Initialize service health status
    this.serviceHealth.set('character', {
      name: 'Character Service',
      status: 'unknown',
      message: 'Not checked yet',
      lastChecked: new Date(),
    });

    this.serviceHealth.set('auth', {
      name: 'Authentication Service',
      status: 'unknown',
      message: 'Not checked yet',
      lastChecked: new Date(),
    });

    // Start periodic health checks
    this.startHealthChecks();
    
    // Perform initial health check
    this.checkAllServices();

    this.isInitialized = true;
    
    if (this.config.logHealthChecks) {
      console.log('[DevServiceManager] Initialized with config:', this.config);
    }
  }

  /**
   * Configure the service manager
   */
  static configure(config: Partial<ServiceManagerConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (this.config.logHealthChecks) {
      console.log('[DevServiceManager] Configuration updated:', this.config);
    }
  }

  /**
   * Get current configuration
   */
  static getConfig(): ServiceManagerConfig {
    return { ...this.config };
  }

  /**
   * Start periodic health checks
   */
  private static startHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(() => {
      this.checkAllServices();
    }, this.config.healthCheckInterval);
  }

  /**
   * Stop periodic health checks
   */
  static stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Check health of all services
   */
  static async checkAllServices(): Promise<void> {
    const envInfo = EnvironmentService.getEnvironmentInfo();
    
    // Skip health checks if we're using localStorage/mock mode
    if (envInfo.useLocalStorage) {
      this.setMockServiceHealth();
      return;
    }

    const promises = [
      this.checkCharacterService(),
      this.checkAuthService(),
    ];

    await Promise.allSettled(promises);
  }

  /**
   * Set all services to healthy status when using mock mode
   */
  private static setMockServiceHealth(): void {
    this.serviceHealth.set('character', {
      name: 'Character Service',
      status: 'healthy',
      message: 'Using mock service',
      lastChecked: new Date(),
      responseTime: 1,
    });

    this.serviceHealth.set('auth', {
      name: 'Authentication Service',
      status: 'healthy',
      message: 'Using mock service',
      lastChecked: new Date(),
      responseTime: 1,
    });
  }

  /**
   * Check character service health
   */
  private static async checkCharacterService(): Promise<void> {
    const startTime = Date.now();
    let health: ServiceHealth;

    try {
      // Try to perform a simple operation with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), this.config.healthCheckTimeout);
      });

      const envInfo = EnvironmentService.getEnvironmentInfo();
      
      if (envInfo.useLocalStorage) {
        // In local storage mode, service is considered healthy
        health = {
          name: 'Character Service',
          status: 'healthy',
          message: 'Running in local storage mode',
          lastChecked: new Date(),
          responseTime: Date.now() - startTime,
        };
      } else {
        // Try to make a simple API call
        const healthCheckPromise = fetch('/api/health/character', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }).then(response => {
          if (response.ok) {
            return response.json();
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        });

        await Promise.race([healthCheckPromise, timeoutPromise]);

        health = {
          name: 'Character Service',
          status: 'healthy',
          message: 'API responding normally',
          lastChecked: new Date(),
          responseTime: Date.now() - startTime,
        };
      }
    } catch (error: any) {
      health = {
        name: 'Character Service',
        status: 'unhealthy',
        message: error.message || 'Service check failed',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
      };

      if (this.config.logHealthChecks) {
        console.warn('[DevServiceManager] Character service health check failed:', error.message);
      }
    }

    this.serviceHealth.set('character', health);
  }

  /**
   * Check auth service health
   */
  private static async checkAuthService(): Promise<void> {
    const startTime = Date.now();
    let health: ServiceHealth;

    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), this.config.healthCheckTimeout);
      });

      const healthCheckPromise = fetch('/api/health/auth', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }).then(response => {
        if (response.ok) {
          return response.json();
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      });

      await Promise.race([healthCheckPromise, timeoutPromise]);

      health = {
        name: 'Authentication Service',
        status: 'healthy',
        message: 'API responding normally',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
      };
    } catch (error: any) {
      health = {
        name: 'Authentication Service',
        status: 'unhealthy',
        message: error.message || 'Service check failed',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
      };

      if (this.config.logHealthChecks) {
        console.warn('[DevServiceManager] Auth service health check failed:', error.message);
      }
    }

    this.serviceHealth.set('auth', health);
  }

  /**
   * Get health status for a specific service
   */
  static getServiceHealth(serviceName: string): ServiceHealth | null {
    return this.serviceHealth.get(serviceName) || null;
  }

  /**
   * Get health status for all services
   */
  static getAllServiceHealth(): ServiceHealth[] {
    return Array.from(this.serviceHealth.values());
  }

  /**
   * Check if a service is healthy
   */
  static isServiceHealthy(serviceName: string): boolean {
    const health = this.serviceHealth.get(serviceName);
    return health?.status === 'healthy';
  }

  /**
   * Check if mock services should be used
   */
  static shouldUseMockServices(): boolean {
    if (!this.config.mockServicesEnabled) {
      return false;
    }

    if (!this.config.autoFallbackEnabled) {
      return false;
    }

    // Use mock services if character service is unhealthy
    const characterHealth = this.serviceHealth.get('character');
    return characterHealth?.status === 'unhealthy';
  }

  /**
   * Get the appropriate character service (real or mock)
   */
  static getCharacterService(): typeof CharacterService | typeof MockCharacterService {
    if (this.shouldUseMockServices()) {
      if (this.config.logHealthChecks) {
        console.log('[DevServiceManager] Using MockCharacterService due to service health');
      }
      return MockCharacterService;
    }

    return CharacterService;
  }

  /**
   * Force enable mock mode
   */
  static enableMockMode(): void {
    this.config.autoFallbackEnabled = true;
    this.config.mockServicesEnabled = true;
    
    // Mark all services as unhealthy to force mock mode
    this.serviceHealth.forEach((health, serviceName) => {
      this.serviceHealth.set(serviceName, {
        ...health,
        status: 'unhealthy',
        message: 'Forced mock mode enabled',
        lastChecked: new Date(),
      });
    });

    if (this.config.logHealthChecks) {
      console.log('[DevServiceManager] Mock mode enabled');
    }
  }

  /**
   * Disable mock mode and re-check services
   */
  static disableMockMode(): void {
    this.config.autoFallbackEnabled = false;
    
    // Re-check all services
    this.checkAllServices();

    if (this.config.logHealthChecks) {
      console.log('[DevServiceManager] Mock mode disabled, re-checking services');
    }
  }

  /**
   * Get service status summary for display
   */
  static getStatusSummary(): {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    services: ServiceHealth[];
    mockModeActive: boolean;
  } {
    const services = this.getAllServiceHealth();
    const healthyCount = services.filter(s => s.status === 'healthy').length;
    const degradedCount = services.filter(s => s.status === 'degraded').length;
    const unhealthyCount = services.filter(s => s.status === 'unhealthy').length;

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyCount > 0) {
      overall = 'unhealthy';
    } else if (degradedCount > 0) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    return {
      overall,
      services,
      mockModeActive: this.shouldUseMockServices(),
    };
  }

  /**
   * Reset all service health status
   */
  static resetHealthStatus(): void {
    this.serviceHealth.forEach((health, serviceName) => {
      this.serviceHealth.set(serviceName, {
        ...health,
        status: 'unknown',
        message: 'Status reset',
        lastChecked: new Date(),
      });
    });

    // Trigger immediate health check
    this.checkAllServices();

    if (this.config.logHealthChecks) {
      console.log('[DevServiceManager] Health status reset');
    }
  }

  /**
   * Cleanup resources
   */
  static cleanup(): void {
    this.stopHealthChecks();
    this.serviceHealth.clear();
    this.isInitialized = false;

    if (this.config.logHealthChecks) {
      console.log('[DevServiceManager] Cleaned up');
    }
  }
}

export default DevServiceManager;