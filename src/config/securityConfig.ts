/**
 * Security configuration for task queue system
 */
export interface SecurityConfig {
  encryption: {
    algorithm: string;
    keyRotationInterval: number;
    enableDataEncryption: boolean;
  };
  rateLimit: {
    windowDuration: number;
    maxOperationsPerMinute: number;
    maxTasksPerMinute: number;
    suspiciousActivityThreshold: number;
  };
  tokens: {
    expiryDuration: number;
    maxTokensPerPlayer: number;
    refreshThreshold: number;
    enableAutoRefresh: boolean;
  };
  audit: {
    maxLogEntries: number;
    retentionDays: number;
    enableRealTimeLogging: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
  validation: {
    maxStringLength: number;
    maxQueueSize: number;
    maxTaskDuration: number;
    enableStrictValidation: boolean;
  };
  monitoring: {
    enableSecurityMetrics: boolean;
    alertThresholds: {
      failureRate: number;
      suspiciousActivityCount: number;
      rateLimitViolations: number;
    };
  };
}

/**
 * Default security configuration
 */
const defaultConfig: SecurityConfig = {
  encryption: {
    algorithm: 'aes-256-gcm',
    keyRotationInterval: 24 * 60 * 60 * 1000, // 24 hours
    enableDataEncryption: true
  },
  rateLimit: {
    windowDuration: 60 * 1000, // 1 minute
    maxOperationsPerMinute: 30,
    maxTasksPerMinute: 10,
    suspiciousActivityThreshold: 60 // operations per minute
  },
  tokens: {
    expiryDuration: 60 * 60 * 1000, // 1 hour
    maxTokensPerPlayer: 5,
    refreshThreshold: 15 * 60 * 1000, // 15 minutes before expiry
    enableAutoRefresh: true
  },
  audit: {
    maxLogEntries: 10000,
    retentionDays: 90,
    enableRealTimeLogging: true,
    logLevel: 'info'
  },
  validation: {
    maxStringLength: 1000,
    maxQueueSize: 50,
    maxTaskDuration: 24 * 60 * 60 * 1000, // 24 hours
    enableStrictValidation: true
  },
  monitoring: {
    enableSecurityMetrics: true,
    alertThresholds: {
      failureRate: 0.05, // 5%
      suspiciousActivityCount: 10,
      rateLimitViolations: 20
    }
  }
};

/**
 * Development security configuration (less restrictive)
 */
const developmentConfig: Partial<SecurityConfig> = {
  rateLimit: {
    windowDuration: 60 * 1000,
    maxOperationsPerMinute: 100, // More lenient for development
    maxTasksPerMinute: 50,
    suspiciousActivityThreshold: 200
  },
  tokens: {
    expiryDuration: 4 * 60 * 60 * 1000, // 4 hours for development
    maxTokensPerPlayer: 10,
    refreshThreshold: 30 * 60 * 1000,
    enableAutoRefresh: true
  },
  audit: {
    maxLogEntries: 5000,
    retentionDays: 30,
    enableRealTimeLogging: true,
    logLevel: 'debug'
  },
  validation: {
    maxStringLength: 2000,
    maxQueueSize: 100,
    maxTaskDuration: 48 * 60 * 60 * 1000, // 48 hours for testing
    enableStrictValidation: false
  }
};

/**
 * Production security configuration (more restrictive)
 */
const productionConfig: Partial<SecurityConfig> = {
  rateLimit: {
    windowDuration: 60 * 1000,
    maxOperationsPerMinute: 20, // More restrictive for production
    maxTasksPerMinute: 5,
    suspiciousActivityThreshold: 40
  },
  tokens: {
    expiryDuration: 30 * 60 * 1000, // 30 minutes for production
    maxTokensPerPlayer: 3,
    refreshThreshold: 5 * 60 * 1000,
    enableAutoRefresh: false
  },
  audit: {
    maxLogEntries: 50000,
    retentionDays: 180,
    enableRealTimeLogging: true,
    logLevel: 'warn'
  },
  validation: {
    maxStringLength: 500,
    maxQueueSize: 25,
    maxTaskDuration: 12 * 60 * 60 * 1000, // 12 hours max
    enableStrictValidation: true
  },
  monitoring: {
    enableSecurityMetrics: true,
    alertThresholds: {
      failureRate: 0.02, // 2%
      suspiciousActivityCount: 5,
      rateLimitViolations: 10
    }
  }
};

/**
 * Get security configuration based on environment
 */
export function getSecurityConfig(): SecurityConfig {
  const environment = process.env.NODE_ENV || 'development';
  
  let config = { ...defaultConfig };
  
  switch (environment) {
    case 'development':
      config = { ...config, ...developmentConfig };
      break;
    case 'production':
      config = { ...config, ...productionConfig };
      break;
    case 'test':
      // Use development config for tests but with shorter durations
      config = { 
        ...config, 
        ...developmentConfig,
        tokens: {
          ...developmentConfig.tokens!,
          expiryDuration: 5 * 60 * 1000 // 5 minutes for tests
        },
        audit: {
          ...developmentConfig.audit!,
          maxLogEntries: 1000,
          retentionDays: 1
        }
      };
      break;
    default:
      console.warn(`Unknown environment: ${environment}, using default config`);
  }

  // Override with environment variables if present
  if (process.env.TASK_QUEUE_MAX_OPERATIONS_PER_MINUTE) {
    config.rateLimit.maxOperationsPerMinute = parseInt(process.env.TASK_QUEUE_MAX_OPERATIONS_PER_MINUTE);
  }
  
  if (process.env.TASK_QUEUE_TOKEN_EXPIRY_MINUTES) {
    config.tokens.expiryDuration = parseInt(process.env.TASK_QUEUE_TOKEN_EXPIRY_MINUTES) * 60 * 1000;
  }
  
  if (process.env.TASK_QUEUE_MAX_QUEUE_SIZE) {
    config.validation.maxQueueSize = parseInt(process.env.TASK_QUEUE_MAX_QUEUE_SIZE);
  }
  
  if (process.env.TASK_QUEUE_AUDIT_LOG_LEVEL) {
    config.audit.logLevel = process.env.TASK_QUEUE_AUDIT_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error';
  }

  return config;
}

/**
 * Validate security configuration
 */
export function validateSecurityConfig(config: SecurityConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate rate limiting
  if (config.rateLimit.maxOperationsPerMinute <= 0) {
    errors.push('Rate limit max operations per minute must be positive');
  }
  
  if (config.rateLimit.maxTasksPerMinute <= 0) {
    errors.push('Rate limit max tasks per minute must be positive');
  }
  
  if (config.rateLimit.windowDuration <= 0) {
    errors.push('Rate limit window duration must be positive');
  }

  // Validate token settings
  if (config.tokens.expiryDuration <= 0) {
    errors.push('Token expiry duration must be positive');
  }
  
  if (config.tokens.maxTokensPerPlayer <= 0) {
    errors.push('Max tokens per player must be positive');
  }
  
  if (config.tokens.refreshThreshold >= config.tokens.expiryDuration) {
    errors.push('Token refresh threshold must be less than expiry duration');
  }

  // Validate audit settings
  if (config.audit.maxLogEntries <= 0) {
    errors.push('Max audit log entries must be positive');
  }
  
  if (config.audit.retentionDays <= 0) {
    errors.push('Audit log retention days must be positive');
  }

  // Validate validation settings
  if (config.validation.maxStringLength <= 0) {
    errors.push('Max string length must be positive');
  }
  
  if (config.validation.maxQueueSize <= 0) {
    errors.push('Max queue size must be positive');
  }
  
  if (config.validation.maxTaskDuration <= 0) {
    errors.push('Max task duration must be positive');
  }

  // Validate monitoring thresholds
  if (config.monitoring.alertThresholds.failureRate < 0 || config.monitoring.alertThresholds.failureRate > 1) {
    errors.push('Failure rate threshold must be between 0 and 1');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Security configuration singleton
 */
class SecurityConfigManager {
  private static instance: SecurityConfigManager;
  private config: SecurityConfig;

  private constructor() {
    this.config = getSecurityConfig();
    const validation = validateSecurityConfig(this.config);
    
    if (!validation.valid) {
      console.error('Invalid security configuration:', validation.errors);
      throw new Error(`Security configuration validation failed: ${validation.errors.join(', ')}`);
    }
  }

  public static getInstance(): SecurityConfigManager {
    if (!SecurityConfigManager.instance) {
      SecurityConfigManager.instance = new SecurityConfigManager();
    }
    return SecurityConfigManager.instance;
  }

  public getConfig(): SecurityConfig {
    return { ...this.config }; // Return copy to prevent modification
  }

  public updateConfig(updates: Partial<SecurityConfig>): void {
    const newConfig = { ...this.config, ...updates };
    const validation = validateSecurityConfig(newConfig);
    
    if (!validation.valid) {
      throw new Error(`Security configuration update failed: ${validation.errors.join(', ')}`);
    }
    
    this.config = newConfig;
  }
}

export const securityConfig = SecurityConfigManager.getInstance();