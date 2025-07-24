#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { BlueGreenDeploymentStack } from './blue-green-deployment-stack';
import { ProductionMonitoringStack } from './production-monitoring-stack';
import { getConfig, validateConfig } from './deployment-config';

// Get environment from context or environment variable
const environment = process.env.ENVIRONMENT || 'production';
const config = getConfig(environment);

// Validate configuration
try {
  validateConfig(config);
} catch (error) {
  console.error('Configuration validation failed:', error.message);
  process.exit(1);
}

const app = new cdk.App();

// Get context values
const version = app.node.tryGetContext('version') || config.version;
const activeEnvironment = app.node.tryGetContext('activeEnvironment') || config.activeEnvironment;

// Create blue-green deployment stack
const blueGreenStack = new BlueGreenDeploymentStack(app, `TaskQueue-BlueGreen-${config.environment}`, {
  env: {
    account: config.account,
    region: config.region,
  },
  environment: config.environment,
  version: version,
  activeEnvironment: activeEnvironment,
  domainName: config.domain?.name,
  hostedZoneId: config.domain?.hostedZoneId,
  stackName: `task-queue-blue-green-${config.environment}`,
  description: `Blue-Green deployment infrastructure for Task Queue System - ${config.environment}`,
  tags: {
    Environment: config.environment,
    Service: 'TaskQueue',
    Version: version,
    DeploymentStrategy: 'BlueGreen',
    ManagedBy: 'CDK',
  },
});

// Create monitoring stack
const monitoringStack = new ProductionMonitoringStack(app, `TaskQueue-Monitoring-${config.environment}`, {
  env: {
    account: config.account,
    region: config.region,
  },
  environment: config.environment,
  alertEmail: config.monitoring.alertEmail,
  slackWebhookUrl: config.monitoring.slackWebhookUrl,
  taskQueueStackName: blueGreenStack.stackName,
  stackName: `task-queue-monitoring-${config.environment}`,
  description: `Monitoring and alerting infrastructure for Task Queue System - ${config.environment}`,
  tags: {
    Environment: config.environment,
    Service: 'TaskQueue',
    Component: 'Monitoring',
    ManagedBy: 'CDK',
  },
});

// Add dependency - monitoring stack depends on blue-green stack
monitoringStack.addDependency(blueGreenStack);

// Add stack outputs for cross-stack references
new cdk.CfnOutput(blueGreenStack, 'BlueGreenStackName', {
  value: blueGreenStack.stackName,
  description: 'Blue-Green Deployment Stack Name',
  exportName: `TaskQueue-BlueGreen-StackName-${config.environment}`,
});

new cdk.CfnOutput(monitoringStack, 'MonitoringStackName', {
  value: monitoringStack.stackName,
  description: 'Monitoring Stack Name',
  exportName: `TaskQueue-Monitoring-StackName-${config.environment}`,
});

// Add metadata
blueGreenStack.templateOptions.metadata = {
  'AWS::CloudFormation::Designer': {
    'Description': 'Blue-Green deployment infrastructure for zero-downtime deployments',
  },
};

monitoringStack.templateOptions.metadata = {
  'AWS::CloudFormation::Designer': {
    'Description': 'Comprehensive monitoring and alerting for production environment',
  },
};

// Synthesize the app
app.synth();