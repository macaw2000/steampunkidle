#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MinimalBackendStack } from './minimal-backend-stack';
import { FargateGameEngine } from './fargate-game-engine';
import { TaskQueuePersistenceSchema } from './task-queue-persistence-schema';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

const app = new cdk.App();

// Get environment configuration
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-west-2',
};

// Create the minimal backend stack (existing)
const backendStack = new MinimalBackendStack(app, 'SteampunkIdleGameMinimalBackend', {
  env,
  description: 'Steampunk Idle Game - Minimal backend infrastructure',
});

// Create a separate stack for the game engine
class GameEngineStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: cdk.StackProps & { backendStack: MinimalBackendStack }) {
    super(scope, id, props);

    // Create VPC for Fargate service
    const vpc = new ec2.Vpc(this, 'GameEngineVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // Create task queue persistence schema
    const taskQueuePersistence = new TaskQueuePersistenceSchema(this, 'TaskQueuePersistence', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST
    });

    // Create Fargate Game Engine Service
    const gameEngine = new FargateGameEngine(this, 'GameEngine', {
      vpc,
      tableNames: {
        taskQueues: taskQueuePersistence.taskQueuesTable.tableName,
        characters: 'steampunk-idle-game-characters', // From minimal backend
        users: 'steampunk-idle-game-users', // From minimal backend
      },
      alertingEmail: process.env.ALERTING_EMAIL,
      environment: this.node.tryGetContext('environment') || 'dev',
    });

    // Output the game engine URL
    new cdk.CfnOutput(this, 'GameEngineUrl', {
      value: `http://${gameEngine.loadBalancer.loadBalancerDnsName}`,
      description: 'Game Engine Load Balancer URL',
    });

    new cdk.CfnOutput(this, 'TaskQueuesTableName', {
      value: taskQueuePersistence.taskQueuesTable.tableName,
      description: 'Task Queues DynamoDB Table Name',
    });
  }
}

// Create the game engine stack
new GameEngineStack(app, 'SteampunkIdleGameEngine', {
  env,
  description: 'Steampunk Idle Game - Fargate Game Engine',
  backendStack,
});

// Add tags to all resources
cdk.Tags.of(app).add('Project', 'SteampunkIdleGame');
cdk.Tags.of(app).add('Environment', process.env.NODE_ENV || 'production');