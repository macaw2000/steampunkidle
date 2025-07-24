// Deployment Configuration for Task Queue System Production Deployment

export interface DeploymentConfig {
  environment: string;
  region: string;
  account: string;
  version: string;
  activeEnvironment: 'blue' | 'green';
  domain?: {
    name: string;
    hostedZoneId: string;
    certificateArn: string;
  };
  monitoring: {
    alertEmail?: string;
    slackWebhookUrl?: string;
    retentionDays: number;
  };
  scaling: {
    minCapacity: number;
    maxCapacity: number;
    targetCpuUtilization: number;
    targetMemoryUtilization: number;
  };
  resources: {
    taskCpu: number;
    taskMemory: number;
    desiredCount: number;
  };
  security: {
    enableWaf: boolean;
    enableVpcFlowLogs: boolean;
    enableGuardDuty: boolean;
  };
}

export const productionConfig: DeploymentConfig = {
  environment: 'production',
  region: process.env.AWS_REGION || 'us-east-1',
  account: process.env.AWS_ACCOUNT_ID || '',
  version: process.env.VERSION || 'latest',
  activeEnvironment: (process.env.ACTIVE_ENVIRONMENT as 'blue' | 'green') || 'blue',
  domain: {
    name: process.env.DOMAIN_NAME || '',
    hostedZoneId: process.env.HOSTED_ZONE_ID || '',
    certificateArn: process.env.CERTIFICATE_ARN || '',
  },
  monitoring: {
    alertEmail: process.env.ALERT_EMAIL,
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
    retentionDays: 30,
  },
  scaling: {
    minCapacity: 2,
    maxCapacity: 20,
    targetCpuUtilization: 70,
    targetMemoryUtilization: 80,
  },
  resources: {
    taskCpu: 1024,
    taskMemory: 2048,
    desiredCount: 3,
  },
  security: {
    enableWaf: true,
    enableVpcFlowLogs: true,
    enableGuardDuty: true,
  },
};

export const stagingConfig: DeploymentConfig = {
  ...productionConfig,
  environment: 'staging',
  scaling: {
    minCapacity: 1,
    maxCapacity: 5,
    targetCpuUtilization: 70,
    targetMemoryUtilization: 80,
  },
  resources: {
    taskCpu: 512,
    taskMemory: 1024,
    desiredCount: 1,
  },
  security: {
    enableWaf: false,
    enableVpcFlowLogs: false,
    enableGuardDuty: false,
  },
};

export const developmentConfig: DeploymentConfig = {
  ...stagingConfig,
  environment: 'development',
  monitoring: {
    ...stagingConfig.monitoring,
    retentionDays: 7,
  },
};

export function getConfig(environment: string): DeploymentConfig {
  switch (environment.toLowerCase()) {
    case 'production':
    case 'prod':
      return productionConfig;
    case 'staging':
    case 'stage':
      return stagingConfig;
    case 'development':
    case 'dev':
      return developmentConfig;
    default:
      throw new Error(`Unknown environment: ${environment}`);
  }
}

export function validateConfig(config: DeploymentConfig): void {
  const errors: string[] = [];

  if (!config.account) {
    errors.push('AWS Account ID is required');
  }

  if (!config.region) {
    errors.push('AWS Region is required');
  }

  if (!config.version) {
    errors.push('Version is required');
  }

  if (config.environment === 'production') {
    if (!config.monitoring.alertEmail && !config.monitoring.slackWebhookUrl) {
      errors.push('Production environment requires at least one alerting method (email or Slack)');
    }

    if (config.resources.desiredCount < 2) {
      errors.push('Production environment requires at least 2 instances for high availability');
    }

    if (config.scaling.minCapacity < 2) {
      errors.push('Production environment requires minimum capacity of at least 2');
    }
  }

  if (config.resources.taskCpu < 256) {
    errors.push('Task CPU must be at least 256');
  }

  if (config.resources.taskMemory < 512) {
    errors.push('Task memory must be at least 512 MB');
  }

  if (config.scaling.maxCapacity <= config.scaling.minCapacity) {
    errors.push('Max capacity must be greater than min capacity');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

// Environment-specific overrides
export const environmentOverrides = {
  production: {
    // Production-specific settings
    enableDetailedMonitoring: true,
    enableXRayTracing: true,
    backupRetentionDays: 30,
    multiAzDeployment: true,
  },
  staging: {
    // Staging-specific settings
    enableDetailedMonitoring: true,
    enableXRayTracing: false,
    backupRetentionDays: 7,
    multiAzDeployment: false,
  },
  development: {
    // Development-specific settings
    enableDetailedMonitoring: false,
    enableXRayTracing: false,
    backupRetentionDays: 3,
    multiAzDeployment: false,
  },
};

export function getEnvironmentOverrides(environment: string) {
  return environmentOverrides[environment.toLowerCase() as keyof typeof environmentOverrides] || {};
}