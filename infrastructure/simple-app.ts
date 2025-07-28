#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { SimpleWebAppStack } from './simple-web-app-stack';

const app = new cdk.App();

new SimpleWebAppStack(app, 'SteampunkIdleGameWebApp', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description: 'Steampunk Idle Game - React Web Application',
  tags: {
    Project: 'SteampunkIdleGame',
    Environment: 'production',
    Component: 'WebApp',
  },
});

app.synth();