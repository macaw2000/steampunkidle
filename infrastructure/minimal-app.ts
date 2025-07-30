#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MinimalBackendStack } from './minimal-backend-stack';

const app = new cdk.App();

// Get environment configuration
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-west-2',
};

// Create the minimal backend stack
new MinimalBackendStack(app, 'SteampunkIdleGameMinimalBackend', {
  env,
  description: 'Minimal backend for Steampunk Idle Game - fixes network connectivity',
});

// Add tags to all resources
cdk.Tags.of(app).add('Project', 'SteampunkIdleGame');
cdk.Tags.of(app).add('Environment', 'minimal-backend');