#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { SimpleS3WebAppStack } from './simple-s3-web-app-stack';

const app = new cdk.App();

new SimpleS3WebAppStack(app, 'SteampunkIdleGameSimpleWeb', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});