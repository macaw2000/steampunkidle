#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SteampunkIdleGameStack } from './steampunk-idle-game-stack';

const app = new cdk.App();

// Get environment configuration
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Create the main stack
new SteampunkIdleGameStack(app, 'SteampunkIdleGameStack', {
  env,
  description: 'Steampunk Idle Game - Serverless backend infrastructure',
});

// Add tags to all resources
cdk.Tags.of(app).add('Project', 'SteampunkIdleGame');
cdk.Tags.of(app).add('Environment', process.env.NODE_ENV || 'production');