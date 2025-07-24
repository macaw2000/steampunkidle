# Task Queue System Deployment Guide

## Overview

This guide covers the complete deployment process for the Task Queue System, including infrastructure setup, configuration, and production deployment procedures.

## Prerequisites

### Required Tools

```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Install CDK
npm install -g aws-cdk

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Node.js and npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### AWS Account Setup

```bash
# Configure AWS credentials
aws configure
# AWS Access Key ID: [Your Access Key]
# AWS Secret Access Key: [Your Secret Key]
# Default region name: us-east-1
# Default output format: json

# Verify credentials
aws sts get-caller-identity

# Bootstrap CDK (first time only)
cdk bootstrap aws://ACCOUNT-NUMBER/us-east-1
```

## Infrastructure Deployment

### 1. Environment Configuration

Create environment-specific configuration files:

```typescript
// infrastructure/config/production.ts
export const productionConfig = {
  environment: 'production',
  region: 'us-east-1',
  
  // Database configuration
  dynamodb: {
    taskQueuesTable: {
      readCapacity: 100,
      writeCapacity: 50,
      pointInTimeRecovery: true,
      backupRetention: 30
    },
    taskHistoryTable: {
      readCapacity: 50,
      writeCapacity: 25,
      ttl: 2592000 // 30 days
    }
  },
  
  // Fargate configuration
  fargate: {
    cpu: 2048,
    memory: 4096,
    desiredCount: 3,
    maxCapacity: 10,
    minCapacity: 2
  },
  
  // Redis configuration
  redis: {
    nodeType: 'cache.r6g.large',
    numCacheNodes: 2,
    engineVersion: '7.0'
  },
  
  // API Gateway configuration
  apiGateway: {
    throttling: {
      rateLimit: 1000,
      burstLimit: 2000
    },
    caching: {
      enabled: true,
      ttl: 300
    }
  },
  
  // WebSocket configuration
  websocket: {
    routeSelectionExpression: '$request.body.action',
    connectionTtl: 3600
  },
  
  // Monitoring configuration
  monitoring: {
    logRetention: 30,
    metricsRetention: 90,
    alerting: {
      email: 'alerts@steampunk-idle.com',
      slack: 'https://hooks.slack.com/services/...'
    }
  }
};
```

```typescript
// infrastructure/config/staging.ts
export const stagingConfig = {
  environment: 'staging',
  region: 'us-east-1',
  
  dynamodb: {
    taskQueuesTable: {
      readCapacity: 25,
      writeCapacity: 15,
      pointInTimeRecovery: false,
      backupRetention: 7
    }
  },
  
  fargate: {
    cpu: 1024,
    memory: 2048,
    desiredCount: 1,
    maxCapacity: 3,
    minCapacity: 1
  },
  
  redis: {
    nodeType: 'cache.t3.micro',
    numCacheNodes: 1,
    engineVersion: '7.0'
  }
  
  // ... other staging-specific settings
};
```

### 2. Infrastructure Stack Deployment

```bash
# Deploy infrastructure stack
cd infrastructure

# Install dependencies
npm install

# Deploy to staging
cdk deploy SteampunkIdleGameStack-staging \
  --context environment=staging \
  --require-approval never

# Deploy to production
cdk deploy SteampunkIdleGameStack-production \
  --context environment=production \
  --require-approval never
```

### 3. Database Schema Setup

```bash
# Create DynamoDB tables
aws dynamodb create-table \
  --table-name TaskQueues-production \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
    AttributeName=GSI1PK,AttributeType=S \
    AttributeName=GSI1SK,AttributeType=N \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --global-secondary-indexes \
    IndexName=GSI1,KeySchema=[{AttributeName=GSI1PK,KeyType=HASH},{AttributeName=GSI1SK,KeyType=RANGE}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=50,WriteCapacityUnits=25} \
  --provisioned-throughput ReadCapacityUnits=100,WriteCapacityUnits=50 \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true

# Enable auto-scaling
aws application-autoscaling register-scalable-target \
  --service-namespace dynamodb \
  --resource-id table/TaskQueues-production \
  --scalable-dimension dynamodb:table:ReadCapacityUnits \
  --min-capacity 25 \
  --max-capacity 200

aws application-autoscaling put-scaling-policy \
  --service-namespace dynamodb \
  --resource-id table/TaskQueues-production \
  --scalable-dimension dynamodb:table:ReadCapacityUnits \
  --policy-name TaskQueuesReadScalingPolicy \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration \
    TargetValue=70.0,ScaleInCooldown=60,ScaleOutCooldown=60,PredefinedMetricSpecification={PredefinedMetricType=DynamoDBReadCapacityUtilization}
```

### 4. Redis Cache Setup

```bash
# Create Redis cluster
aws elasticache create-replication-group \
  --replication-group-id task-queue-cache-prod \
  --description "Task Queue Redis Cache - Production" \
  --num-cache-clusters 2 \
  --cache-node-type cache.r6g.large \
  --engine redis \
  --engine-version 7.0 \
  --port 6379 \
  --parameter-group-name default.redis7 \
  --subnet-group-name task-queue-subnet-group \
  --security-group-ids sg-12345678 \
  --at-rest-encryption-enabled \
  --transit-encryption-enabled \
  --auth-token "your-secure-auth-token"
```

## Application Deployment

### 1. Build Process

```bash
# Build the application
npm run build

# Run tests
npm test

# Build Docker images
docker build -t task-queue-api:latest -f Dockerfile.api .
docker build -t task-processor:latest -f Dockerfile.processor .

# Tag for ECR
docker tag task-queue-api:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/task-queue-api:latest
docker tag task-processor:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/task-processor:latest

# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/task-queue-api:latest
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/task-processor:latest
```

### 2. Lambda Function Deployment

```bash
# Package Lambda functions
cd src/lambda
zip -r task-queue-handlers.zip .

# Deploy Lambda functions
aws lambda update-function-code \
  --function-name task-queue-api-handler \
  --zip-file fileb://task-queue-handlers.zip

aws lambda update-function-code \
  --function-name websocket-handler \
  --zip-file fileb://task-queue-handlers.zip

# Update function configuration
aws lambda update-function-configuration \
  --function-name task-queue-api-handler \
  --environment Variables='{
    "DYNAMODB_TABLE":"TaskQueues-production",
    "REDIS_ENDPOINT":"task-queue-cache-prod.abc123.cache.amazonaws.com:6379",
    "ENVIRONMENT":"production"
  }'
```

### 3. Fargate Service Deployment

```bash
# Update ECS service
aws ecs update-service \
  --cluster task-queue-cluster-production \
  --service task-processor \
  --task-definition task-processor:latest \
  --desired-count 3 \
  --force-new-deployment

# Wait for deployment to complete
aws ecs wait services-stable \
  --cluster task-queue-cluster-production \
  --services task-processor
```

### 4. API Gateway Deployment

```bash
# Deploy API Gateway
aws apigateway create-deployment \
  --rest-api-id abc123def456 \
  --stage-name production \
  --description "Task Queue API Production Deployment"

# Update stage configuration
aws apigateway update-stage \
  --rest-api-id abc123def456 \
  --stage-name production \
  --patch-ops \
    op=replace,path=/throttle/rateLimit,value=1000 \
    op=replace,path=/throttle/burstLimit,value=2000 \
    op=replace,path=/cacheClusterEnabled,value=true \
    op=replace,path=/cacheClusterSize,value=1.6
```

## Configuration Management

### 1. Environment Variables

```bash
# Production environment variables
export ENVIRONMENT=production
export AWS_REGION=us-east-1
export DYNAMODB_TABLE=TaskQueues-production
export REDIS_ENDPOINT=task-queue-cache-prod.abc123.cache.amazonaws.com:6379
export WEBSOCKET_API_ENDPOINT=wss://websocket.steampunk-idle.com/production
export API_GATEWAY_ENDPOINT=https://api.steampunk-idle.com/v1
export LOG_LEVEL=info
export METRICS_NAMESPACE=TaskQueue/Production
export ALERT_SNS_TOPIC=arn:aws:sns:us-east-1:123456789012:task-queue-alerts
```

### 2. Secrets Management

```bash
# Store sensitive configuration in AWS Secrets Manager
aws secretsmanager create-secret \
  --name task-queue/production/database \
  --description "Task Queue Database Configuration" \
  --secret-string '{
    "redis_auth_token": "your-secure-redis-token",
    "jwt_secret": "your-jwt-secret-key",
    "encryption_key": "your-encryption-key"
  }'

# Grant access to Lambda functions
aws secretsmanager put-resource-policy \
  --secret-id task-queue/production/database \
  --resource-policy '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:role/TaskQueueLambdaRole"
      },
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "*"
    }]
  }'
```

### 3. Parameter Store Configuration

```bash
# Store application parameters
aws ssm put-parameter \
  --name "/taskqueue/production/max_queue_size" \
  --value "50" \
  --type "String" \
  --description "Maximum number of tasks in a queue"

aws ssm put-parameter \
  --name "/taskqueue/production/task_timeout" \
  --value "86400000" \
  --type "String" \
  --description "Maximum task duration in milliseconds"

aws ssm put-parameter \
  --name "/taskqueue/production/retry_attempts" \
  --value "3" \
  --type "String" \
  --description "Maximum retry attempts for failed tasks"
```

## Monitoring and Logging Setup

### 1. CloudWatch Configuration

```bash
# Create log groups
aws logs create-log-group \
  --log-group-name /aws/lambda/task-queue-api-handler \
  --retention-in-days 30

aws logs create-log-group \
  --log-group-name /aws/ecs/task-processor \
  --retention-in-days 30

# Create custom metrics
aws cloudwatch put-metric-data \
  --namespace TaskQueue/Production \
  --metric-data \
    MetricName=ActiveQueues,Value=0,Unit=Count \
    MetricName=TasksProcessed,Value=0,Unit=Count \
    MetricName=AverageTaskDuration,Value=0,Unit=Milliseconds
```

### 2. Alarms and Notifications

```bash
# Create SNS topic for alerts
aws sns create-topic --name task-queue-alerts

# Subscribe to alerts
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:123456789012:task-queue-alerts \
  --protocol email \
  --notification-endpoint alerts@steampunk-idle.com

# Create CloudWatch alarms
aws cloudwatch put-metric-alarm \
  --alarm-name "TaskQueue-HighErrorRate" \
  --alarm-description "Task queue error rate is high" \
  --metric-name ErrorRate \
  --namespace TaskQueue/Production \
  --statistic Average \
  --period 300 \
  --threshold 5.0 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:123456789012:task-queue-alerts

aws cloudwatch put-metric-alarm \
  --alarm-name "TaskQueue-HighLatency" \
  --alarm-description "Task queue response time is high" \
  --metric-name ResponseTime \
  --namespace TaskQueue/Production \
  --statistic Average \
  --period 300 \
  --threshold 1000 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:123456789012:task-queue-alerts
```

### 3. Dashboard Setup

```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["TaskQueue/Production", "ActiveQueues"],
          [".", "TasksProcessed"],
          [".", "ErrorRate"]
        ],
        "period": 300,
        "stat": "Average",
        "region": "us-east-1",
        "title": "Task Queue Metrics"
      }
    },
    {
      "type": "log",
      "properties": {
        "query": "SOURCE '/aws/lambda/task-queue-api-handler' | fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 20",
        "region": "us-east-1",
        "title": "Recent Errors"
      }
    }
  ]
}
```

## Security Configuration

### 1. IAM Roles and Policies

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-1:123456789012:table/TaskQueues-production",
        "arn:aws:dynamodb:us-east-1:123456789012:table/TaskQueues-production/index/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "elasticache:*"
      ],
      "Resource": "arn:aws:elasticache:us-east-1:123456789012:replicationgroup:task-queue-cache-prod"
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:123456789012:secret:task-queue/production/*"
    }
  ]
}
```

### 2. VPC and Security Groups

```bash
# Create security group for task processor
aws ec2 create-security-group \
  --group-name task-processor-sg \
  --description "Security group for task processor" \
  --vpc-id vpc-12345678

# Allow inbound traffic from API Gateway
aws ec2 authorize-security-group-ingress \
  --group-id sg-12345678 \
  --protocol tcp \
  --port 80 \
  --source-group sg-87654321

# Allow outbound traffic to DynamoDB and Redis
aws ec2 authorize-security-group-egress \
  --group-id sg-12345678 \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-egress \
  --group-id sg-12345678 \
  --protocol tcp \
  --port 6379 \
  --source-group sg-redis-access
```

## Deployment Automation

### 1. CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy Task Queue System

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run lint

  deploy-staging:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      - run: npm ci
      - run: npm run build
      - run: cdk deploy SteampunkIdleGameStack-staging --require-approval never

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      - run: npm ci
      - run: npm run build
      - run: cdk deploy SteampunkIdleGameStack-production --require-approval never
```

### 2. Deployment Scripts

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

ENVIRONMENT=${1:-staging}
REGION=${2:-us-east-1}

echo "Deploying Task Queue System to $ENVIRONMENT..."

# Build application
npm run build
npm test

# Deploy infrastructure
cd infrastructure
cdk deploy SteampunkIdleGameStack-$ENVIRONMENT \
  --context environment=$ENVIRONMENT \
  --require-approval never

# Deploy Lambda functions
cd ../src/lambda
zip -r task-queue-handlers.zip .

aws lambda update-function-code \
  --function-name task-queue-api-handler-$ENVIRONMENT \
  --zip-file fileb://task-queue-handlers.zip \
  --region $REGION

# Update Fargate service
aws ecs update-service \
  --cluster task-queue-cluster-$ENVIRONMENT \
  --service task-processor \
  --force-new-deployment \
  --region $REGION

# Wait for deployment to complete
aws ecs wait services-stable \
  --cluster task-queue-cluster-$ENVIRONMENT \
  --services task-processor \
  --region $REGION

echo "Deployment to $ENVIRONMENT completed successfully!"
```

## Health Checks and Validation

### 1. Post-Deployment Validation

```bash
#!/bin/bash
# scripts/validate-deployment.sh

ENVIRONMENT=${1:-staging}
API_ENDPOINT="https://api-$ENVIRONMENT.steampunk-idle.com"

echo "Validating deployment to $ENVIRONMENT..."

# Check API health
response=$(curl -s -o /dev/null -w "%{http_code}" $API_ENDPOINT/health)
if [ $response -eq 200 ]; then
  echo "✓ API health check passed"
else
  echo "✗ API health check failed (HTTP $response)"
  exit 1
fi

# Check WebSocket connectivity
wscat -c wss://websocket-$ENVIRONMENT.steampunk-idle.com/ws -x '{"type":"ping"}' > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✓ WebSocket connectivity check passed"
else
  echo "✗ WebSocket connectivity check failed"
  exit 1
fi

# Check database connectivity
aws dynamodb describe-table --table-name TaskQueues-$ENVIRONMENT > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✓ Database connectivity check passed"
else
  echo "✗ Database connectivity check failed"
  exit 1
fi

# Check Redis connectivity
redis-cli -h task-queue-cache-$ENVIRONMENT.abc123.cache.amazonaws.com ping > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✓ Redis connectivity check passed"
else
  echo "✗ Redis connectivity check failed"
  exit 1
fi

echo "All validation checks passed!"
```

### 2. Smoke Tests

```typescript
// scripts/smoke-tests.ts
import { TaskQueueClient } from '../src/services/taskQueueClient';

async function runSmokeTests() {
  const client = new TaskQueueClient({
    apiUrl: process.env.API_ENDPOINT,
    authToken: process.env.TEST_AUTH_TOKEN
  });

  const testPlayerId = 'smoke-test-player';

  try {
    // Test queue creation
    console.log('Testing queue operations...');
    
    // Add a test task
    const task = await client.addHarvestingTask(testPlayerId, {
      activity: 'chop_oak_trees',
      location: 'test_forest',
      quantity: 1
    });
    console.log('✓ Task added successfully');

    // Get queue status
    const status = await client.getQueueStatus(testPlayerId);
    console.log('✓ Queue status retrieved');

    // Stop all tasks (cleanup)
    await client.stopAllTasks(testPlayerId);
    console.log('✓ Tasks stopped successfully');

    console.log('All smoke tests passed!');
  } catch (error) {
    console.error('Smoke test failed:', error);
    process.exit(1);
  }
}

runSmokeTests();
```

## Rollback Procedures

### 1. Automated Rollback

```bash
#!/bin/bash
# scripts/rollback.sh

ENVIRONMENT=${1:-staging}
PREVIOUS_VERSION=${2}

if [ -z "$PREVIOUS_VERSION" ]; then
  echo "Usage: $0 <environment> <previous_version>"
  exit 1
fi

echo "Rolling back $ENVIRONMENT to version $PREVIOUS_VERSION..."

# Rollback Lambda functions
aws lambda update-function-code \
  --function-name task-queue-api-handler-$ENVIRONMENT \
  --s3-bucket task-queue-deployments \
  --s3-key lambda/$PREVIOUS_VERSION/task-queue-handlers.zip

# Rollback Fargate service
aws ecs update-service \
  --cluster task-queue-cluster-$ENVIRONMENT \
  --service task-processor \
  --task-definition task-processor:$PREVIOUS_VERSION \
  --force-new-deployment

# Wait for rollback to complete
aws ecs wait services-stable \
  --cluster task-queue-cluster-$ENVIRONMENT \
  --services task-processor

echo "Rollback completed successfully!"
```

### 2. Database Migration Rollback

```typescript
// scripts/rollback-migration.ts
import { DynamoDBMigrationManager } from '../src/services/migrationManager';

async function rollbackMigration(migrationId: string) {
  const migrationManager = new DynamoDBMigrationManager();
  
  try {
    await migrationManager.rollback(migrationId);
    console.log(`Migration ${migrationId} rolled back successfully`);
  } catch (error) {
    console.error('Migration rollback failed:', error);
    process.exit(1);
  }
}

const migrationId = process.argv[2];
if (!migrationId) {
  console.error('Usage: npm run rollback-migration <migration_id>');
  process.exit(1);
}

rollbackMigration(migrationId);
```

This deployment guide provides comprehensive procedures for deploying the Task Queue System to production environments with proper monitoring, security, and rollback capabilities.