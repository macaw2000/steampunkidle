# Configuration Reference

## Overview

This document provides a comprehensive reference for all configuration options available in the Task Queue System, including environment variables, database settings, and service configurations.

## Environment Variables

### Core Application Settings

| Variable | Description | Default | Required | Example |
|----------|-------------|---------|----------|---------|
| `ENVIRONMENT` | Deployment environment | `development` | Yes | `production` |
| `AWS_REGION` | AWS region for resources | `us-east-1` | Yes | `us-west-2` |
| `LOG_LEVEL` | Logging verbosity level | `info` | No | `debug` |
| `NODE_ENV` | Node.js environment | `development` | No | `production` |
| `PORT` | Server port number | `3000` | No | `8080` |

### Database Configuration

| Variable | Description | Default | Required | Example |
|----------|-------------|---------|----------|---------|
| `DYNAMODB_TABLE` | Main task queue table name | `TaskQueues` | Yes | `TaskQueues-production` |
| `DYNAMODB_HISTORY_TABLE` | Task history table name | `TaskHistory` | Yes | `TaskHistory-production` |
| `DYNAMODB_ENDPOINT` | Custom DynamoDB endpoint | - | No | `http://localhost:8000` |
| `DYNAMODB_REGION` | DynamoDB region override | `AWS_REGION` | No | `us-east-1` |

### Redis Configuration

| Variable | Description | Default | Required | Example |
|----------|-------------|---------|----------|---------|
| `REDIS_ENDPOINT` | Redis cluster endpoint | - | Yes | `cache.abc123.cache.amazonaws.com:6379` |
| `REDIS_AUTH_TOKEN` | Redis authentication token | - | No | `your-secure-token` |
| `REDIS_TLS_ENABLED` | Enable TLS for Redis | `true` | No | `false` |
| `REDIS_DB` | Redis database number | `0` | No | `1` |
| `REDIS_TIMEOUT` | Connection timeout (ms) | `5000` | No | `10000` |

### API Gateway Configuration

| Variable | Description | Default | Required | Example |
|----------|-------------|---------|----------|---------|
| `API_GATEWAY_ENDPOINT` | API Gateway base URL | - | Yes | `https://api.steampunk-idle.com/v1` |
| `WEBSOCKET_API_ENDPOINT` | WebSocket API endpoint | - | Yes | `wss://websocket.steampunk-idle.com` |
| `API_RATE_LIMIT` | Requests per minute | `1000` | No | `2000` |
| `API_BURST_LIMIT` | Burst request limit | `2000` | No | `5000` |

### Authentication Configuration

| Variable | Description | Default | Required | Example |
|----------|-------------|---------|----------|---------|
| `JWT_SECRET` | JWT signing secret | - | Yes | `your-jwt-secret-key` |
| `JWT_EXPIRATION` | JWT token expiration | `24h` | No | `1h` |
| `AUTH_ISSUER` | JWT token issuer | `steampunk-idle` | No | `your-app-name` |
| `AUTH_AUDIENCE` | JWT token audience | `task-queue-api` | No | `your-api-name` |

### Monitoring Configuration

| Variable | Description | Default | Required | Example |
|----------|-------------|---------|----------|---------|
| `METRICS_NAMESPACE` | CloudWatch metrics namespace | `TaskQueue` | No | `TaskQueue/Production` |
| `LOG_GROUP_NAME` | CloudWatch log group | `/aws/lambda/task-queue` | No | `/aws/ecs/task-processor` |
| `ALERT_SNS_TOPIC` | SNS topic for alerts | - | No | `arn:aws:sns:us-east-1:123:alerts` |
| `METRICS_ENABLED` | Enable metrics collection | `true` | No | `false` |

### Task Processing Configuration

| Variable | Description | Default | Required | Example |
|----------|-------------|---------|----------|---------|
| `MAX_QUEUE_SIZE` | Maximum tasks per queue | `50` | No | `100` |
| `MAX_TASK_DURATION` | Maximum task duration (ms) | `86400000` | No | `3600000` |
| `TASK_RETRY_ATTEMPTS` | Maximum retry attempts | `3` | No | `5` |
| `TASK_RETRY_DELAY` | Base retry delay (ms) | `1000` | No | `2000` |
| `PROCESSING_INTERVAL` | Queue processing interval (ms) | `5000` | No | `1000` |

## Configuration Files

### Application Configuration

```typescript
// src/config/appConfig.ts
export interface AppConfig {
  environment: string;
  region: string;
  logLevel: string;
  port: number;
  
  database: DatabaseConfig;
  redis: RedisConfig;
  auth: AuthConfig;
  taskProcessing: TaskProcessingConfig;
  monitoring: MonitoringConfig;
}

export const appConfig: AppConfig = {
  environment: process.env.ENVIRONMENT || 'development',
  region: process.env.AWS_REGION || 'us-east-1',
  logLevel: process.env.LOG_LEVEL || 'info',
  port: parseInt(process.env.PORT || '3000'),
  
  database: {
    tableName: process.env.DYNAMODB_TABLE || 'TaskQueues',
    historyTableName: process.env.DYNAMODB_HISTORY_TABLE || 'TaskHistory',
    endpoint: process.env.DYNAMODB_ENDPOINT,
    region: process.env.DYNAMODB_REGION || process.env.AWS_REGION || 'us-east-1'
  },
  
  redis: {
    endpoint: process.env.REDIS_ENDPOINT!,
    authToken: process.env.REDIS_AUTH_TOKEN,
    tlsEnabled: process.env.REDIS_TLS_ENABLED === 'true',
    database: parseInt(process.env.REDIS_DB || '0'),
    timeout: parseInt(process.env.REDIS_TIMEOUT || '5000')
  },
  
  auth: {
    jwtSecret: process.env.JWT_SECRET!,
    jwtExpiration: process.env.JWT_EXPIRATION || '24h',
    issuer: process.env.AUTH_ISSUER || 'steampunk-idle',
    audience: process.env.AUTH_AUDIENCE || 'task-queue-api'
  },
  
  taskProcessing: {
    maxQueueSize: parseInt(process.env.MAX_QUEUE_SIZE || '50'),
    maxTaskDuration: parseInt(process.env.MAX_TASK_DURATION || '86400000'),
    retryAttempts: parseInt(process.env.TASK_RETRY_ATTEMPTS || '3'),
    retryDelay: parseInt(process.env.TASK_RETRY_DELAY || '1000'),
    processingInterval: parseInt(process.env.PROCESSING_INTERVAL || '5000')
  },
  
  monitoring: {
    metricsNamespace: process.env.METRICS_NAMESPACE || 'TaskQueue',
    logGroupName: process.env.LOG_GROUP_NAME || '/aws/lambda/task-queue',
    alertSnsTopicArn: process.env.ALERT_SNS_TOPIC,
    metricsEnabled: process.env.METRICS_ENABLED !== 'false'
  }
};
```

### Database Configuration

```typescript
// src/config/databaseConfig.ts
export interface DatabaseConfig {
  tableName: string;
  historyTableName: string;
  endpoint?: string;
  region: string;
  
  // Connection settings
  maxRetries: number;
  retryDelayOptions: {
    customBackoff: (retryCount: number) => number;
  };
  httpOptions: {
    connectTimeout: number;
    timeout: number;
  };
  
  // Capacity settings
  readCapacity: number;
  writeCapacity: number;
  
  // Backup settings
  pointInTimeRecovery: boolean;
  backupRetention: number;
}

export const databaseConfig: DatabaseConfig = {
  tableName: process.env.DYNAMODB_TABLE || 'TaskQueues',
  historyTableName: process.env.DYNAMODB_HISTORY_TABLE || 'TaskHistory',
  endpoint: process.env.DYNAMODB_ENDPOINT,
  region: process.env.DYNAMODB_REGION || process.env.AWS_REGION || 'us-east-1',
  
  maxRetries: parseInt(process.env.DYNAMODB_MAX_RETRIES || '3'),
  retryDelayOptions: {
    customBackoff: (retryCount: number) => {
      const baseDelay = parseInt(process.env.DYNAMODB_RETRY_BASE_DELAY || '100');
      return Math.min(baseDelay * Math.pow(2, retryCount), 10000);
    }
  },
  httpOptions: {
    connectTimeout: parseInt(process.env.DYNAMODB_CONNECT_TIMEOUT || '1000'),
    timeout: parseInt(process.env.DYNAMODB_TIMEOUT || '5000')
  },
  
  readCapacity: parseInt(process.env.DYNAMODB_READ_CAPACITY || '25'),
  writeCapacity: parseInt(process.env.DYNAMODB_WRITE_CAPACITY || '15'),
  
  pointInTimeRecovery: process.env.DYNAMODB_PITR_ENABLED === 'true',
  backupRetention: parseInt(process.env.DYNAMODB_BACKUP_RETENTION || '7')
};
```

### Redis Configuration

```typescript
// src/config/redisConfig.ts
export interface RedisConfig {
  endpoint: string;
  authToken?: string;
  tlsEnabled: boolean;
  database: number;
  timeout: number;
  
  // Connection pool settings
  maxConnections: number;
  minConnections: number;
  acquireTimeout: number;
  
  // Cache settings
  defaultTtl: number;
  keyPrefix: string;
  
  // Retry settings
  retryAttempts: number;
  retryDelay: number;
}

export const redisConfig: RedisConfig = {
  endpoint: process.env.REDIS_ENDPOINT!,
  authToken: process.env.REDIS_AUTH_TOKEN,
  tlsEnabled: process.env.REDIS_TLS_ENABLED === 'true',
  database: parseInt(process.env.REDIS_DB || '0'),
  timeout: parseInt(process.env.REDIS_TIMEOUT || '5000'),
  
  maxConnections: parseInt(process.env.REDIS_MAX_CONNECTIONS || '10'),
  minConnections: parseInt(process.env.REDIS_MIN_CONNECTIONS || '2'),
  acquireTimeout: parseInt(process.env.REDIS_ACQUIRE_TIMEOUT || '3000'),
  
  defaultTtl: parseInt(process.env.REDIS_DEFAULT_TTL || '300'),
  keyPrefix: process.env.REDIS_KEY_PREFIX || 'taskqueue:',
  
  retryAttempts: parseInt(process.env.REDIS_RETRY_ATTEMPTS || '3'),
  retryDelay: parseInt(process.env.REDIS_RETRY_DELAY || '1000')
};
```

## Infrastructure Configuration

### CDK Configuration

```typescript
// infrastructure/config/stackConfig.ts
export interface StackConfig {
  environment: string;
  region: string;
  
  dynamodb: DynamoDBStackConfig;
  fargate: FargateStackConfig;
  redis: RedisStackConfig;
  apiGateway: ApiGatewayStackConfig;
  monitoring: MonitoringStackConfig;
}

export interface DynamoDBStackConfig {
  taskQueuesTable: {
    readCapacity: number;
    writeCapacity: number;
    pointInTimeRecovery: boolean;
    backupRetention: number;
    gsiReadCapacity: number;
    gsiWriteCapacity: number;
  };
  taskHistoryTable: {
    readCapacity: number;
    writeCapacity: number;
    ttl: number;
  };
}

export interface FargateStackConfig {
  cpu: number;
  memory: number;
  desiredCount: number;
  maxCapacity: number;
  minCapacity: number;
  
  autoScaling: {
    targetCpuUtilization: number;
    targetMemoryUtilization: number;
    scaleInCooldown: number;
    scaleOutCooldown: number;
  };
}

export interface RedisStackConfig {
  nodeType: string;
  numCacheNodes: number;
  engineVersion: string;
  
  security: {
    atRestEncryption: boolean;
    transitEncryption: boolean;
    authTokenEnabled: boolean;
  };
  
  backup: {
    snapshotRetentionLimit: number;
    snapshotWindow: string;
  };
}

// Environment-specific configurations
export const stackConfigs: Record<string, StackConfig> = {
  development: {
    environment: 'development',
    region: 'us-east-1',
    
    dynamodb: {
      taskQueuesTable: {
        readCapacity: 5,
        writeCapacity: 5,
        pointInTimeRecovery: false,
        backupRetention: 1,
        gsiReadCapacity: 5,
        gsiWriteCapacity: 5
      },
      taskHistoryTable: {
        readCapacity: 5,
        writeCapacity: 5,
        ttl: 604800 // 7 days
      }
    },
    
    fargate: {
      cpu: 512,
      memory: 1024,
      desiredCount: 1,
      maxCapacity: 2,
      minCapacity: 1,
      autoScaling: {
        targetCpuUtilization: 70,
        targetMemoryUtilization: 80,
        scaleInCooldown: 300,
        scaleOutCooldown: 300
      }
    },
    
    redis: {
      nodeType: 'cache.t3.micro',
      numCacheNodes: 1,
      engineVersion: '7.0',
      security: {
        atRestEncryption: false,
        transitEncryption: false,
        authTokenEnabled: false
      },
      backup: {
        snapshotRetentionLimit: 1,
        snapshotWindow: '03:00-05:00'
      }
    }
  },
  
  staging: {
    environment: 'staging',
    region: 'us-east-1',
    
    dynamodb: {
      taskQueuesTable: {
        readCapacity: 25,
        writeCapacity: 15,
        pointInTimeRecovery: true,
        backupRetention: 7,
        gsiReadCapacity: 15,
        gsiWriteCapacity: 10
      },
      taskHistoryTable: {
        readCapacity: 15,
        writeCapacity: 10,
        ttl: 2592000 // 30 days
      }
    },
    
    fargate: {
      cpu: 1024,
      memory: 2048,
      desiredCount: 2,
      maxCapacity: 5,
      minCapacity: 1,
      autoScaling: {
        targetCpuUtilization: 70,
        targetMemoryUtilization: 80,
        scaleInCooldown: 300,
        scaleOutCooldown: 300
      }
    },
    
    redis: {
      nodeType: 'cache.r6g.large',
      numCacheNodes: 1,
      engineVersion: '7.0',
      security: {
        atRestEncryption: true,
        transitEncryption: true,
        authTokenEnabled: true
      },
      backup: {
        snapshotRetentionLimit: 7,
        snapshotWindow: '03:00-05:00'
      }
    }
  },
  
  production: {
    environment: 'production',
    region: 'us-east-1',
    
    dynamodb: {
      taskQueuesTable: {
        readCapacity: 100,
        writeCapacity: 50,
        pointInTimeRecovery: true,
        backupRetention: 30,
        gsiReadCapacity: 50,
        gsiWriteCapacity: 25
      },
      taskHistoryTable: {
        readCapacity: 50,
        writeCapacity: 25,
        ttl: 2592000 // 30 days
      }
    },
    
    fargate: {
      cpu: 2048,
      memory: 4096,
      desiredCount: 3,
      maxCapacity: 10,
      minCapacity: 2,
      autoScaling: {
        targetCpuUtilization: 70,
        targetMemoryUtilization: 80,
        scaleInCooldown: 300,
        scaleOutCooldown: 300
      }
    },
    
    redis: {
      nodeType: 'cache.r6g.large',
      numCacheNodes: 2,
      engineVersion: '7.0',
      security: {
        atRestEncryption: true,
        transitEncryption: true,
        authTokenEnabled: true
      },
      backup: {
        snapshotRetentionLimit: 30,
        snapshotWindow: '03:00-05:00'
      }
    }
  }
};
```

## Task Processing Configuration

### Task Type Definitions

```typescript
// src/config/taskTypeConfig.ts
export interface TaskTypeConfig {
  type: string;
  name: string;
  description: string;
  
  // Duration settings
  minDuration: number;
  maxDuration: number;
  baseDuration: number;
  
  // Prerequisites
  requiredLevel?: number;
  requiredSkills?: string[];
  requiredItems?: string[];
  
  // Resource requirements
  resourceCosts?: ResourceCost[];
  
  // Rewards
  baseRewards: TaskReward[];
  bonusRewards?: TaskReward[];
  
  // Validation rules
  validationRules: ValidationRule[];
}

export const taskTypeConfigs: Record<string, TaskTypeConfig> = {
  harvesting: {
    type: 'harvesting',
    name: 'Harvesting',
    description: 'Gather resources from the environment',
    
    minDuration: 30000,  // 30 seconds
    maxDuration: 3600000, // 1 hour
    baseDuration: 300000, // 5 minutes
    
    requiredLevel: 1,
    requiredSkills: ['woodcutting', 'mining', 'fishing'],
    requiredItems: ['tool'],
    
    resourceCosts: [],
    
    baseRewards: [
      { type: 'experience', skill: 'harvesting', amount: 10 },
      { type: 'item', category: 'resource', amount: 1 }
    ],
    
    validationRules: [
      { type: 'level_requirement', minLevel: 1 },
      { type: 'tool_requirement', category: 'harvesting' },
      { type: 'location_access', required: true }
    ]
  },
  
  crafting: {
    type: 'crafting',
    name: 'Crafting',
    description: 'Create items from materials',
    
    minDuration: 60000,   // 1 minute
    maxDuration: 7200000, // 2 hours
    baseDuration: 600000, // 10 minutes
    
    requiredLevel: 5,
    requiredSkills: ['crafting'],
    requiredItems: ['crafting_station'],
    
    resourceCosts: [
      { type: 'materials', required: true },
      { type: 'gold', amount: 10 }
    ],
    
    baseRewards: [
      { type: 'experience', skill: 'crafting', amount: 25 },
      { type: 'item', category: 'crafted', amount: 1 }
    ],
    
    validationRules: [
      { type: 'level_requirement', minLevel: 5 },
      { type: 'material_requirement', required: true },
      { type: 'station_access', required: true },
      { type: 'recipe_known', required: true }
    ]
  },
  
  combat: {
    type: 'combat',
    name: 'Combat',
    description: 'Fight enemies for rewards',
    
    minDuration: 120000,  // 2 minutes
    maxDuration: 1800000, // 30 minutes
    baseDuration: 300000, // 5 minutes
    
    requiredLevel: 10,
    requiredSkills: ['combat'],
    requiredItems: ['weapon'],
    
    resourceCosts: [
      { type: 'health_potion', amount: 1 }
    ],
    
    baseRewards: [
      { type: 'experience', skill: 'combat', amount: 50 },
      { type: 'gold', amount: 25 },
      { type: 'item', category: 'loot', amount: 1 }
    ],
    
    bonusRewards: [
      { type: 'rare_item', chance: 0.1, amount: 1 }
    ],
    
    validationRules: [
      { type: 'level_requirement', minLevel: 10 },
      { type: 'equipment_requirement', category: 'weapon' },
      { type: 'health_requirement', minHealth: 50 }
    ]
  }
};
```

### Validation Configuration

```typescript
// src/config/validationConfig.ts
export interface ValidationConfig {
  queue: QueueValidationConfig;
  task: TaskValidationConfig;
  player: PlayerValidationConfig;
}

export interface QueueValidationConfig {
  maxSize: number;
  maxTotalDuration: number;
  allowDuplicates: boolean;
  requirePrerequisites: boolean;
}

export interface TaskValidationConfig {
  maxDuration: number;
  minDuration: number;
  requiredFields: string[];
  allowedTypes: string[];
}

export interface PlayerValidationConfig {
  minLevel: number;
  maxLevel: number;
  requiredVerification: boolean;
  allowGuests: boolean;
}

export const validationConfig: ValidationConfig = {
  queue: {
    maxSize: parseInt(process.env.MAX_QUEUE_SIZE || '50'),
    maxTotalDuration: parseInt(process.env.MAX_TOTAL_QUEUE_DURATION || '604800000'), // 7 days
    allowDuplicates: process.env.ALLOW_DUPLICATE_TASKS === 'true',
    requirePrerequisites: process.env.REQUIRE_PREREQUISITES !== 'false'
  },
  
  task: {
    maxDuration: parseInt(process.env.MAX_TASK_DURATION || '86400000'), // 24 hours
    minDuration: parseInt(process.env.MIN_TASK_DURATION || '30000'), // 30 seconds
    requiredFields: ['type', 'activityData', 'playerId'],
    allowedTypes: ['harvesting', 'crafting', 'combat']
  },
  
  player: {
    minLevel: parseInt(process.env.MIN_PLAYER_LEVEL || '1'),
    maxLevel: parseInt(process.env.MAX_PLAYER_LEVEL || '100'),
    requiredVerification: process.env.REQUIRE_PLAYER_VERIFICATION === 'true',
    allowGuests: process.env.ALLOW_GUEST_PLAYERS === 'true'
  }
};
```

## Security Configuration

### Authentication Configuration

```typescript
// src/config/authConfig.ts
export interface AuthConfig {
  jwt: JwtConfig;
  rateLimit: RateLimitConfig;
  cors: CorsConfig;
  encryption: EncryptionConfig;
}

export interface JwtConfig {
  secret: string;
  expiration: string;
  issuer: string;
  audience: string;
  algorithm: string;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
}

export interface CorsConfig {
  origin: string[];
  methods: string[];
  allowedHeaders: string[];
  credentials: boolean;
}

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
}

export const authConfig: AuthConfig = {
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiration: process.env.JWT_EXPIRATION || '24h',
    issuer: process.env.AUTH_ISSUER || 'steampunk-idle',
    audience: process.env.AUTH_AUDIENCE || 'task-queue-api',
    algorithm: process.env.JWT_ALGORITHM || 'HS256'
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000'), // 1 minute
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESS === 'true',
    skipFailedRequests: process.env.RATE_LIMIT_SKIP_FAILED === 'true'
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    methods: process.env.CORS_METHODS?.split(',') || ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: process.env.CORS_HEADERS?.split(',') || ['Content-Type', 'Authorization'],
    credentials: process.env.CORS_CREDENTIALS === 'true'
  },
  
  encryption: {
    algorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
    keyLength: parseInt(process.env.ENCRYPTION_KEY_LENGTH || '32'),
    ivLength: parseInt(process.env.ENCRYPTION_IV_LENGTH || '16')
  }
};
```

## Monitoring Configuration

### Metrics Configuration

```typescript
// src/config/metricsConfig.ts
export interface MetricsConfig {
  namespace: string;
  enabled: boolean;
  
  customMetrics: CustomMetricConfig[];
  alarms: AlarmConfig[];
  dashboards: DashboardConfig[];
}

export interface CustomMetricConfig {
  name: string;
  unit: string;
  description: string;
  dimensions: string[];
}

export interface AlarmConfig {
  name: string;
  metricName: string;
  threshold: number;
  comparisonOperator: string;
  evaluationPeriods: number;
  period: number;
  statistic: string;
  treatMissingData: string;
  alarmActions: string[];
}

export const metricsConfig: MetricsConfig = {
  namespace: process.env.METRICS_NAMESPACE || 'TaskQueue',
  enabled: process.env.METRICS_ENABLED !== 'false',
  
  customMetrics: [
    {
      name: 'ActiveQueues',
      unit: 'Count',
      description: 'Number of active task queues',
      dimensions: ['Environment']
    },
    {
      name: 'TasksProcessed',
      unit: 'Count',
      description: 'Number of tasks processed',
      dimensions: ['Environment', 'TaskType']
    },
    {
      name: 'AverageTaskDuration',
      unit: 'Milliseconds',
      description: 'Average task processing duration',
      dimensions: ['Environment', 'TaskType']
    },
    {
      name: 'ErrorRate',
      unit: 'Percent',
      description: 'Task processing error rate',
      dimensions: ['Environment', 'ErrorType']
    }
  ],
  
  alarms: [
    {
      name: 'HighErrorRate',
      metricName: 'ErrorRate',
      threshold: 5.0,
      comparisonOperator: 'GreaterThanThreshold',
      evaluationPeriods: 2,
      period: 300,
      statistic: 'Average',
      treatMissingData: 'notBreaching',
      alarmActions: [process.env.ALERT_SNS_TOPIC || '']
    },
    {
      name: 'HighLatency',
      metricName: 'AverageTaskDuration',
      threshold: 30000,
      comparisonOperator: 'GreaterThanThreshold',
      evaluationPeriods: 3,
      period: 300,
      statistic: 'Average',
      treatMissingData: 'notBreaching',
      alarmActions: [process.env.ALERT_SNS_TOPIC || '']
    }
  ],
  
  dashboards: [
    {
      name: 'TaskQueueOverview',
      widgets: [
        'ActiveQueues',
        'TasksProcessed',
        'ErrorRate',
        'AverageTaskDuration'
      ]
    }
  ]
};
```

## Configuration Validation

### Configuration Validator

```typescript
// src/config/configValidator.ts
import Joi from 'joi';

const configSchema = Joi.object({
  environment: Joi.string().valid('development', 'staging', 'production').required(),
  region: Joi.string().required(),
  logLevel: Joi.string().valid('debug', 'info', 'warn', 'error').default('info'),
  
  database: Joi.object({
    tableName: Joi.string().required(),
    historyTableName: Joi.string().required(),
    endpoint: Joi.string().uri().optional(),
    region: Joi.string().required()
  }).required(),
  
  redis: Joi.object({
    endpoint: Joi.string().required(),
    authToken: Joi.string().optional(),
    tlsEnabled: Joi.boolean().default(true),
    database: Joi.number().min(0).max(15).default(0),
    timeout: Joi.number().positive().default(5000)
  }).required(),
  
  auth: Joi.object({
    jwtSecret: Joi.string().min(32).required(),
    jwtExpiration: Joi.string().required(),
    issuer: Joi.string().required(),
    audience: Joi.string().required()
  }).required(),
  
  taskProcessing: Joi.object({
    maxQueueSize: Joi.number().positive().max(1000).default(50),
    maxTaskDuration: Joi.number().positive().default(86400000),
    retryAttempts: Joi.number().min(0).max(10).default(3),
    retryDelay: Joi.number().positive().default(1000),
    processingInterval: Joi.number().positive().default(5000)
  }).required()
});

export function validateConfig(config: any): void {
  const { error } = configSchema.validate(config, { abortEarly: false });
  
  if (error) {
    const errorMessages = error.details.map(detail => detail.message);
    throw new Error(`Configuration validation failed:\n${errorMessages.join('\n')}`);
  }
}
```

This configuration reference provides comprehensive documentation for all configurable aspects of the Task Queue System, enabling proper setup and customization for different environments.