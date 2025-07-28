import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';
import { FargateGameEngine } from './fargate-game-engine';
import { TaskQueuePersistenceSchema } from './task-queue-persistence-schema';
import { RedisCacheInfrastructure } from './redis-cache-infrastructure';

export class SteampunkIdleGameStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket for hosting the React frontend
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: `steampunk-idle-game-${this.account}-${this.region}`,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      publicReadAccess: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // CloudFront Distribution for CDN
    const distribution = new cloudfront.Distribution(this, 'WebsiteDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(websiteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    // Cognito User Pool for authentication
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'steampunk-idle-game-users',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Social Identity Providers
    const googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleProvider', {
      userPool,
      clientId: process.env.GOOGLE_CLIENT_ID || 'placeholder-google-client-id',
      clientSecretValue: cdk.SecretValue.unsafePlainText(process.env.GOOGLE_CLIENT_SECRET || 'placeholder-google-client-secret'),
      scopes: ['email', 'profile'],
      attributeMapping: {
        email: cognito.ProviderAttribute.GOOGLE_EMAIL,
        givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
        familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
      },
    });

    const facebookProvider = new cognito.UserPoolIdentityProviderFacebook(this, 'FacebookProvider', {
      userPool,
      clientId: process.env.FACEBOOK_APP_ID || 'placeholder-facebook-app-id',
      clientSecret: process.env.FACEBOOK_APP_SECRET || 'placeholder-facebook-app-secret',
      scopes: ['email', 'public_profile'],
      attributeMapping: {
        email: cognito.ProviderAttribute.FACEBOOK_EMAIL,
        givenName: cognito.ProviderAttribute.FACEBOOK_FIRST_NAME,
        familyName: cognito.ProviderAttribute.FACEBOOK_LAST_NAME,
      },
    });

    // Note: X (Twitter) OAuth 2.0 support in Cognito is limited
    // For now, we'll use OIDC provider for X integration
    const xProvider = new cognito.UserPoolIdentityProviderOidc(this, 'XProvider', {
      userPool,
      name: 'Twitter',
      clientId: process.env.X_CLIENT_ID || 'placeholder-x-client-id',
      clientSecret: process.env.X_CLIENT_SECRET || 'placeholder-x-client-secret',
      issuerUrl: 'https://api.twitter.com',
      scopes: ['tweet.read', 'users.read'],
      attributeMapping: {
        email: cognito.ProviderAttribute.other('email'),
      },
    });

    // Cognito User Pool Client
    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      userPoolClientName: 'steampunk-idle-game-client',
      generateSecret: false,
      authFlows: {
        userSrp: true,
        userPassword: true,
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
        cognito.UserPoolClientIdentityProvider.GOOGLE,
        cognito.UserPoolClientIdentityProvider.FACEBOOK,
        cognito.UserPoolClientIdentityProvider.custom('Twitter'),
      ],
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          'http://localhost:3000/auth/callback',
          `https://${distribution.distributionDomainName}/auth/callback`,
        ],
        logoutUrls: [
          'http://localhost:3000',
          `https://${distribution.distributionDomainName}`,
        ],
      },
    });

    // Ensure client depends on identity providers
    userPoolClient.node.addDependency(googleProvider);
    userPoolClient.node.addDependency(facebookProvider);
    userPoolClient.node.addDependency(xProvider);

    // Identity Pool for AWS resource access
    const identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
      identityPoolName: 'steampunk_idle_game_identity_pool',
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: userPoolClient.userPoolClientId,
          providerName: userPool.userPoolProviderName,
        },
      ],
    });

    // IAM roles for authenticated users
    const authenticatedRole = new iam.Role(this, 'AuthenticatedRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });

    // DynamoDB Tables
    
    // Users Table
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: 'steampunk-idle-game-users',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
    });

    // Add GSI for email lookups
    usersTable.addGlobalSecondaryIndex({
      indexName: 'email-index',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
    });

    // Characters Table
    const charactersTable = new dynamodb.Table(this, 'CharactersTable', {
      tableName: 'steampunk-idle-game-characters',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
    });

    // Guilds Table
    const guildsTable = new dynamodb.Table(this, 'GuildsTable', {
      tableName: 'steampunk-idle-game-guilds',
      partitionKey: { name: 'guildId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
    });

    // Add GSI for leader lookups
    guildsTable.addGlobalSecondaryIndex({
      indexName: 'leader-index',
      partitionKey: { name: 'leaderId', type: dynamodb.AttributeType.STRING },
    });

    // Guild Members Table (separate table for better query performance)
    const guildMembersTable = new dynamodb.Table(this, 'GuildMembersTable', {
      tableName: 'steampunk-idle-game-guild-members',
      partitionKey: { name: 'guildId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
    });

    // Add GSI for user's guild lookup
    guildMembersTable.addGlobalSecondaryIndex({
      indexName: 'user-guild-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
    });

    // Guild Invitations Table
    const guildInvitationsTable = new dynamodb.Table(this, 'GuildInvitationsTable', {
      tableName: 'steampunk-idle-game-guild-invitations',
      partitionKey: { name: 'invitationId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
      timeToLiveAttribute: 'ttl', // Auto-expire invitations
    });

    // Add GSI for invitee lookups
    guildInvitationsTable.addGlobalSecondaryIndex({
      indexName: 'invitee-index',
      partitionKey: { name: 'inviteeId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    // Add GSI for guild invitations
    guildInvitationsTable.addGlobalSecondaryIndex({
      indexName: 'guild-index',
      partitionKey: { name: 'guildId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    // Items Table
    const itemsTable = new dynamodb.Table(this, 'ItemsTable', {
      tableName: 'steampunk-idle-game-items',
      partitionKey: { name: 'itemId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
    });

    // Add GSI for filtering by type and rarity
    itemsTable.addGlobalSecondaryIndex({
      indexName: 'type-rarity-index',
      partitionKey: { name: 'type', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'rarity', type: dynamodb.AttributeType.STRING },
    });

    // Inventory Table
    const inventoryTable = new dynamodb.Table(this, 'InventoryTable', {
      tableName: 'steampunk-idle-game-inventory',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'itemId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
    });

    // Add GSI for item owners lookup (for marketplace)
    inventoryTable.addGlobalSecondaryIndex({
      indexName: 'item-owners-index',
      partitionKey: { name: 'itemId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
    });

    // Auction Listings Table
    const auctionListingsTable = new dynamodb.Table(this, 'AuctionListingsTable', {
      tableName: 'steampunk-idle-game-auction-listings',
      partitionKey: { name: 'listingId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
      timeToLiveAttribute: 'ttl',
    });

    // Add GSI for active listings
    auctionListingsTable.addGlobalSecondaryIndex({
      indexName: 'status-expires-index',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'expiresAt', type: dynamodb.AttributeType.STRING },
    });

    // Add GSI for seller's listings
    auctionListingsTable.addGlobalSecondaryIndex({
      indexName: 'seller-index',
      partitionKey: { name: 'sellerId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    // Chat Messages Table
    const chatMessagesTable = new dynamodb.Table(this, 'ChatMessagesTable', {
      tableName: 'steampunk-idle-game-chat-messages',
      partitionKey: { name: 'channelId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
      timeToLiveAttribute: 'ttl', // 30 days retention
    });

    // Add GSI for private messages
    chatMessagesTable.addGlobalSecondaryIndex({
      indexName: 'recipient-index',
      partitionKey: { name: 'recipientId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
    });

    // Chat Connections Table for WebSocket connections
    const chatConnectionsTable = new dynamodb.Table(this, 'ChatConnectionsTable', {
      tableName: 'steampunk-idle-game-chat-connections',
      partitionKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl', // Auto-cleanup stale connections
    });

    // Add GSI for user connections lookup
    chatConnectionsTable.addGlobalSecondaryIndex({
      indexName: 'userId-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
    });

    // Leaderboards Table
    const leaderboardsTable = new dynamodb.Table(this, 'LeaderboardsTable', {
      tableName: 'steampunk-idle-game-leaderboards',
      partitionKey: { name: 'statType', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'rank', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
    });

    // Parties Table (for zones and dungeons)
    const partiesTable = new dynamodb.Table(this, 'PartiesTable', {
      tableName: 'steampunk-idle-game-parties',
      partitionKey: { name: 'partyId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
    });

    // Add GSI for public parties
    partiesTable.addGlobalSecondaryIndex({
      indexName: 'visibility-type-index',
      partitionKey: { name: 'visibility', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'type', type: dynamodb.AttributeType.STRING },
    });

    // Zone Instances Table
    const zoneInstancesTable = new dynamodb.Table(this, 'ZoneInstancesTable', {
      tableName: 'steampunk-idle-game-zone-instances',
      partitionKey: { name: 'instanceId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
    });

    // Add GSI for party instances
    zoneInstancesTable.addGlobalSecondaryIndex({
      indexName: 'party-index',
      partitionKey: { name: 'partyId', type: dynamodb.AttributeType.STRING },
    });

    // Currency Transactions Table
    const currencyTransactionsTable = new dynamodb.Table(this, 'CurrencyTransactionsTable', {
      tableName: 'steampunk-idle-game-currency-transactions',
      partitionKey: { name: 'transactionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
    });

    // Add GSI for user transaction history
    currencyTransactionsTable.addGlobalSecondaryIndex({
      indexName: 'userId-timestamp-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
    });

    // Crafting Sessions Table
    const craftingSessionsTable = new dynamodb.Table(this, 'CraftingSessionsTable', {
      tableName: 'steampunk-idle-game-crafting-sessions',
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
    });

    // Add GSI for user crafting sessions
    craftingSessionsTable.addGlobalSecondaryIndex({
      indexName: 'userId-status-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'status', type: dynamodb.AttributeType.STRING },
    });

    // Enhanced Task Queue Persistence Schema
    const taskQueuePersistence = new TaskQueuePersistenceSchema(this, 'TaskQueuePersistence', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST
    });

    // Legacy table reference for backward compatibility
    const taskQueuesTable = taskQueuePersistence.taskQueuesTable;

    // API Gateway for REST API
    const api = new apigateway.RestApi(this, 'SteampunkIdleGameApi', {
      restApiName: 'Steampunk Idle Game API',
      description: 'API for Steampunk Idle Game backend services',
      defaultCorsPreflightOptions: {
        allowOrigins: [
          'http://localhost:3000',
          `https://${distribution.distributionDomainName}`,
        ],
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
    });

    // Lambda execution role with DynamoDB permissions
    const lambdaExecutionRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant DynamoDB permissions to Lambda role
    usersTable.grantReadWriteData(lambdaExecutionRole);
    charactersTable.grantReadWriteData(lambdaExecutionRole);
    guildsTable.grantReadWriteData(lambdaExecutionRole);
    guildMembersTable.grantReadWriteData(lambdaExecutionRole);
    guildInvitationsTable.grantReadWriteData(lambdaExecutionRole);
    itemsTable.grantReadWriteData(lambdaExecutionRole);
    inventoryTable.grantReadWriteData(lambdaExecutionRole);
    auctionListingsTable.grantReadWriteData(lambdaExecutionRole);
    chatMessagesTable.grantReadWriteData(lambdaExecutionRole);
    chatConnectionsTable.grantReadWriteData(lambdaExecutionRole);
    leaderboardsTable.grantReadWriteData(lambdaExecutionRole);
    partiesTable.grantReadWriteData(lambdaExecutionRole);
    zoneInstancesTable.grantReadWriteData(lambdaExecutionRole);
    currencyTransactionsTable.grantReadWriteData(lambdaExecutionRole);
    craftingSessionsTable.grantReadWriteData(lambdaExecutionRole);
    
    // Grant permissions for enhanced task queue persistence
    taskQueuePersistence.grantReadWriteData(lambdaExecutionRole);
    taskQueuePersistence.grantStreamRead(lambdaExecutionRole);

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

    // Create Redis Cache Infrastructure for Performance Optimization
    const redisCache = new RedisCacheInfrastructure(this, 'RedisCache', {
      vpc,
      nodeType: 'cache.t3.micro', // Start small, can scale up
      numCacheNodes: 2, // Multi-AZ for high availability
      engineVersion: '7.0',
      enableBackup: true,
      backupRetentionLimit: 5,
      enableMultiAz: true,
      enableTransitEncryption: true,
      enableAtRestEncryption: true,
    });

    // Create monitoring alarms for Redis
    redisCache.createMonitoringAlarms();

    // Create Fargate Game Engine Service
    const gameEngine = new FargateGameEngine(this, 'GameEngine', {
      vpc,
      tableNames: {
        taskQueues: taskQueuePersistence.getTableNames().taskQueues,
        characters: charactersTable.tableName,
        users: usersTable.tableName,
      },
      alertingEmail: process.env.ALERTING_EMAIL,
      environment: this.node.tryGetContext('environment') || 'dev',
    });

    // Authentication Lambda Functions
    const loginFunction = new lambda.Function(this, 'LoginFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'login.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/auth'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        USERS_TABLE: usersTable.tableName,
        USER_POOL_ID: userPool.userPoolId,
      },
    });

    const refreshTokenFunction = new lambda.Function(this, 'RefreshTokenFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'refresh.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/auth'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      },
    });

    const logoutFunction = new lambda.Function(this, 'LogoutFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'logout.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/auth'),
      timeout: cdk.Duration.seconds(30),
    });

    // Grant Cognito permissions to Lambda functions
    loginFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:GetUser',
      ],
      resources: [userPool.userPoolArn],
    }));

    refreshTokenFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:InitiateAuth',
      ],
      resources: [userPool.userPoolArn],
    }));

    logoutFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:GlobalSignOut',
      ],
      resources: [userPool.userPoolArn],
    }));

    // Offline Progress Calculation Lambda Function
    const calculateOfflineProgressFunction = new lambda.Function(this, 'CalculateOfflineProgressFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'calculateOfflineProgress.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/activity'),
      timeout: cdk.Duration.seconds(60),
      environment: {
        CHARACTERS_TABLE: charactersTable.tableName,
        INVENTORY_TABLE: inventoryTable.tableName,
      },
    });

    // EventBridge rule for periodic offline progress updates
    const offlineProgressRule = new events.Rule(this, 'OfflineProgressRule', {
      description: 'Trigger offline progress calculation every 15 minutes',
      schedule: events.Schedule.rate(cdk.Duration.minutes(15)),
    });

    // Add the Lambda function as a target for the EventBridge rule
    offlineProgressRule.addTarget(new targets.LambdaFunction(calculateOfflineProgressFunction));

    // Create a separate Lambda function for batch processing all active users
    const batchOfflineProgressFunction = new lambda.Function(this, 'BatchOfflineProgressFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromInline(`
        const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
        const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
        const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

        const client = new DynamoDBClient({});
        const docClient = DynamoDBDocumentClient.from(client);
        const lambdaClient = new LambdaClient({});

        exports.handler = async (event) => {
          try {
            console.log('Starting batch offline progress calculation');
            
            // Scan for characters that have been offline for more than 15 minutes
            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
            
            const scanResult = await docClient.send(new ScanCommand({
              TableName: process.env.CHARACTERS_TABLE,
              FilterExpression: 'lastActiveAt < :threshold',
              ExpressionAttributeValues: {
                ':threshold': fifteenMinutesAgo,
              },
              ProjectionExpression: 'userId',
            }));

            console.log(\`Found \${scanResult.Items?.length || 0} characters to process\`);

            // Process each character individually
            const promises = (scanResult.Items || []).map(async (item) => {
              try {
                await lambdaClient.send(new InvokeCommand({
                  FunctionName: process.env.CALCULATE_OFFLINE_PROGRESS_FUNCTION_NAME,
                  InvocationType: 'Event', // Async invocation
                  Payload: JSON.stringify({
                    body: JSON.stringify({ userId: item.userId }),
                  }),
                }));
              } catch (error) {
                console.error(\`Error processing user \${item.userId}:\`, error);
              }
            });

            await Promise.all(promises);
            
            return {
              statusCode: 200,
              body: JSON.stringify({
                message: 'Batch offline progress calculation completed',
                processedCount: scanResult.Items?.length || 0,
              }),
            };
          } catch (error) {
            console.error('Error in batch offline progress calculation:', error);
            return {
              statusCode: 500,
              body: JSON.stringify({ error: 'Internal server error' }),
            };
          }
        };
      `),
      timeout: cdk.Duration.minutes(5),
      environment: {
        CHARACTERS_TABLE: charactersTable.tableName,
        CALCULATE_OFFLINE_PROGRESS_FUNCTION_NAME: calculateOfflineProgressFunction.functionName,
      },
    });

    // Grant permissions for batch function to invoke individual progress function
    calculateOfflineProgressFunction.grantInvoke(batchOfflineProgressFunction);

    // Update the EventBridge rule to target the batch function instead
    offlineProgressRule.addTarget(new targets.LambdaFunction(batchOfflineProgressFunction));

    // Guild Lambda Functions
    const createGuildFunction = new lambda.Function(this, 'CreateGuildFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'createGuild.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/guild'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        GUILDS_TABLE: guildsTable.tableName,
        GUILD_MEMBERS_TABLE: guildMembersTable.tableName,
        CHARACTERS_TABLE: charactersTable.tableName,
      },
    });

    const getGuildFunction = new lambda.Function(this, 'GetGuildFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'getGuild.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/guild'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        GUILDS_TABLE: guildsTable.tableName,
        GUILD_MEMBERS_TABLE: guildMembersTable.tableName,
      },
    });

    const updateGuildFunction = new lambda.Function(this, 'UpdateGuildFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'updateGuild.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/guild'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        GUILDS_TABLE: guildsTable.tableName,
        GUILD_MEMBERS_TABLE: guildMembersTable.tableName,
      },
    });

    const deleteGuildFunction = new lambda.Function(this, 'DeleteGuildFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'deleteGuild.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/guild'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        GUILDS_TABLE: guildsTable.tableName,
        GUILD_MEMBERS_TABLE: guildMembersTable.tableName,
      },
    });

    const inviteToGuildFunction = new lambda.Function(this, 'InviteToGuildFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'inviteToGuild.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/guild'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        GUILDS_TABLE: guildsTable.tableName,
        GUILD_MEMBERS_TABLE: guildMembersTable.tableName,
        GUILD_INVITATIONS_TABLE: guildInvitationsTable.tableName,
        CHARACTERS_TABLE: charactersTable.tableName,
      },
    });

    const respondToInvitationFunction = new lambda.Function(this, 'RespondToInvitationFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'respondToInvitation.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/guild'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        GUILDS_TABLE: guildsTable.tableName,
        GUILD_MEMBERS_TABLE: guildMembersTable.tableName,
        GUILD_INVITATIONS_TABLE: guildInvitationsTable.tableName,
        CHARACTERS_TABLE: charactersTable.tableName,
      },
    });

    const kickMemberFunction = new lambda.Function(this, 'KickMemberFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'kickMember.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/guild'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        GUILDS_TABLE: guildsTable.tableName,
        GUILD_MEMBERS_TABLE: guildMembersTable.tableName,
      },
    });

    const leaveGuildFunction = new lambda.Function(this, 'LeaveGuildFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'leaveGuild.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/guild'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        GUILDS_TABLE: guildsTable.tableName,
        GUILD_MEMBERS_TABLE: guildMembersTable.tableName,
      },
    });

    const updateMemberRoleFunction = new lambda.Function(this, 'UpdateMemberRoleFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'updateMemberRole.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/guild'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        GUILDS_TABLE: guildsTable.tableName,
        GUILD_MEMBERS_TABLE: guildMembersTable.tableName,
      },
    });

    const searchGuildsFunction = new lambda.Function(this, 'SearchGuildsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'searchGuilds.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/guild'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        GUILDS_TABLE: guildsTable.tableName,
      },
    });

    const getUserGuildFunction = new lambda.Function(this, 'GetUserGuildFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'getUserGuild.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/guild'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        GUILDS_TABLE: guildsTable.tableName,
        GUILD_MEMBERS_TABLE: guildMembersTable.tableName,
      },
    });

    // Character Lambda Functions
    const createCharacterFunction = new lambda.Function(this, 'CreateCharacterFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'createCharacter.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/character'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        CHARACTERS_TABLE: charactersTable.tableName,
        USERS_TABLE: usersTable.tableName,
      },
    });

    const getCharacterFunction = new lambda.Function(this, 'GetCharacterFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'getCharacter.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/character'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        CHARACTERS_TABLE: charactersTable.tableName,
      },
    });

    const updateCharacterFunction = new lambda.Function(this, 'UpdateCharacterFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'updateCharacter.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/character'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        CHARACTERS_TABLE: charactersTable.tableName,
      },
    });

    const deleteCharacterFunction = new lambda.Function(this, 'DeleteCharacterFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'deleteCharacter.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/character'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        CHARACTERS_TABLE: charactersTable.tableName,
      },
    });

    // Activity Lambda Functions
    const switchActivityFunction = new lambda.Function(this, 'SwitchActivityFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'switchActivity.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/activity'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        CHARACTERS_TABLE: charactersTable.tableName,
      },
    });

    const getActivityProgressFunction = new lambda.Function(this, 'GetActivityProgressFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'getActivityProgress.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/activity'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        CHARACTERS_TABLE: charactersTable.tableName,
      },
    });

    // Currency Lambda Functions
    const earnCurrencyFunction = new lambda.Function(this, 'EarnCurrencyFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'earnCurrency.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/currency'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        CHARACTERS_TABLE: charactersTable.tableName,
        CURRENCY_TRANSACTIONS_TABLE: currencyTransactionsTable.tableName,
      },
    });

    const spendCurrencyFunction = new lambda.Function(this, 'SpendCurrencyFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'spendCurrency.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/currency'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        CHARACTERS_TABLE: charactersTable.tableName,
        CURRENCY_TRANSACTIONS_TABLE: currencyTransactionsTable.tableName,
      },
    });

    const getCurrencyBalanceFunction = new lambda.Function(this, 'GetCurrencyBalanceFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'getCurrencyBalance.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/currency'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        CHARACTERS_TABLE: charactersTable.tableName,
      },
    });

    const getCurrencyHistoryFunction = new lambda.Function(this, 'GetCurrencyHistoryFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'getCurrencyHistory.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/currency'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        CURRENCY_TRANSACTIONS_TABLE: currencyTransactionsTable.tableName,
      },
    });

    // Auction Lambda Functions
    const createAuctionFunction = new lambda.Function(this, 'CreateAuctionFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'createAuction.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/auction'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        AUCTION_LISTINGS_TABLE: auctionListingsTable.tableName,
        INVENTORY_TABLE: inventoryTable.tableName,
        CHARACTERS_TABLE: charactersTable.tableName,
      },
    });

    const searchAuctionsFunction = new lambda.Function(this, 'SearchAuctionsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'searchAuctions.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/auction'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        AUCTION_LISTINGS_TABLE: auctionListingsTable.tableName,
        ITEMS_TABLE: itemsTable.tableName,
      },
    });

    const placeBidFunction = new lambda.Function(this, 'PlaceBidFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'placeBid.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/auction'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        AUCTION_LISTINGS_TABLE: auctionListingsTable.tableName,
        CHARACTERS_TABLE: charactersTable.tableName,
      },
    });

    const buyoutAuctionFunction = new lambda.Function(this, 'BuyoutAuctionFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'buyoutAuction.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/auction'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        AUCTION_LISTINGS_TABLE: auctionListingsTable.tableName,
        CHARACTERS_TABLE: charactersTable.tableName,
        INVENTORY_TABLE: inventoryTable.tableName,
        CURRENCY_TRANSACTIONS_TABLE: currencyTransactionsTable.tableName,
      },
    });

    const getAuctionFunction = new lambda.Function(this, 'GetAuctionFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'getAuction.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/auction'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        AUCTION_LISTINGS_TABLE: auctionListingsTable.tableName,
        ITEMS_TABLE: itemsTable.tableName,
      },
    });

    const getUserAuctionsFunction = new lambda.Function(this, 'GetUserAuctionsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'getUserAuctions.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/auction'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        AUCTION_LISTINGS_TABLE: auctionListingsTable.tableName,
        ITEMS_TABLE: itemsTable.tableName,
      },
    });

    const cancelAuctionFunction = new lambda.Function(this, 'CancelAuctionFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'cancelAuction.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/auction'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        AUCTION_LISTINGS_TABLE: auctionListingsTable.tableName,
        INVENTORY_TABLE: inventoryTable.tableName,
      },
    });

    // Party Lambda Functions
    const createPartyFunction = new lambda.Function(this, 'CreatePartyFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'createParty.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/party'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        PARTIES_TABLE: partiesTable.tableName,
        CHARACTERS_TABLE: charactersTable.tableName,
      },
    });

    const joinPartyFunction = new lambda.Function(this, 'JoinPartyFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'joinParty.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/party'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        PARTIES_TABLE: partiesTable.tableName,
        CHARACTERS_TABLE: charactersTable.tableName,
      },
    });

    const leavePartyFunction = new lambda.Function(this, 'LeavePartyFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'leaveParty.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/party'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        PARTIES_TABLE: partiesTable.tableName,
      },
    });

    const getPartyFunction = new lambda.Function(this, 'GetPartyFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'getParty.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/party'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        PARTIES_TABLE: partiesTable.tableName,
      },
    });

    const getAvailablePartiesFunction = new lambda.Function(this, 'GetAvailablePartiesFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'getAvailableParties.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/party'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        PARTIES_TABLE: partiesTable.tableName,
      },
    });

    const getUserPartyFunction = new lambda.Function(this, 'GetUserPartyFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'getUserParty.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/party'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        PARTIES_TABLE: partiesTable.tableName,
      },
    });

    // Crafting Lambda Functions
    const startCraftingFunction = new lambda.Function(this, 'StartCraftingFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'startCrafting.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/crafting'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        CHARACTERS_TABLE: charactersTable.tableName,
        CRAFTING_SESSIONS_TABLE: craftingSessionsTable.tableName,
        INVENTORY_TABLE: inventoryTable.tableName,
      },
    });

    const completeCraftingFunction = new lambda.Function(this, 'CompleteCraftingFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'completeCrafting.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/crafting'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        CHARACTERS_TABLE: charactersTable.tableName,
        CRAFTING_SESSIONS_TABLE: craftingSessionsTable.tableName,
        INVENTORY_TABLE: inventoryTable.tableName,
      },
    });

    // Chat Lambda Functions
    const chatConnectFunction = new lambda.Function(this, 'ChatConnectFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'connect.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/chat'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        CHAT_CONNECTIONS_TABLE: chatConnectionsTable.tableName,
      },
    });

    const chatDisconnectFunction = new lambda.Function(this, 'ChatDisconnectFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'disconnect.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/chat'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        CHAT_CONNECTIONS_TABLE: chatConnectionsTable.tableName,
      },
    });

    const chatSendMessageFunction = new lambda.Function(this, 'ChatSendMessageFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'sendMessage.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/chat'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        CHAT_CONNECTIONS_TABLE: chatConnectionsTable.tableName,
        CHAT_MESSAGES_TABLE: chatMessagesTable.tableName,
        CHARACTERS_TABLE: charactersTable.tableName,
        GUILD_MEMBERS_TABLE: guildMembersTable.tableName,
      },
    });

    const chatGetMessageHistoryFunction = new lambda.Function(this, 'ChatGetMessageHistoryFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'getMessageHistory.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/chat'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        CHAT_MESSAGES_TABLE: chatMessagesTable.tableName,
        GUILD_MEMBERS_TABLE: guildMembersTable.tableName,
      },
    });

    const chatGetPrivateMessagesFunction = new lambda.Function(this, 'ChatGetPrivateMessagesFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'getPrivateMessages.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/chat'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        CHAT_MESSAGES_TABLE: chatMessagesTable.tableName,
      },
    });

    // Grant API Gateway Management permissions to chat functions
    chatSendMessageFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'execute-api:ManageConnections',
      ],
      resources: ['*'], // Will be restricted to WebSocket API after creation
    }));

    // WebSocket API Gateway for real-time chat
    const webSocketApi = new apigatewayv2.CfnApi(this, 'ChatWebSocketApi', {
      name: 'steampunk-idle-game-chat-websocket',
      protocolType: 'WEBSOCKET',
      routeSelectionExpression: '$request.body.action',
    });

    // WebSocket API Stage
    const webSocketStage = new apigatewayv2.CfnStage(this, 'ChatWebSocketStage', {
      apiId: webSocketApi.ref,
      stageName: 'prod',
      autoDeploy: true,
    });

    // WebSocket Routes
    const connectRoute = new apigatewayv2.CfnRoute(this, 'ConnectRoute', {
      apiId: webSocketApi.ref,
      routeKey: '$connect',
      authorizationType: 'NONE',
      target: `integrations/${new apigatewayv2.CfnIntegration(this, 'ConnectIntegration', {
        apiId: webSocketApi.ref,
        integrationType: 'AWS_PROXY',
        integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${chatConnectFunction.functionArn}/invocations`,
      }).ref}`,
    });

    const disconnectRoute = new apigatewayv2.CfnRoute(this, 'DisconnectRoute', {
      apiId: webSocketApi.ref,
      routeKey: '$disconnect',
      authorizationType: 'NONE',
      target: `integrations/${new apigatewayv2.CfnIntegration(this, 'DisconnectIntegration', {
        apiId: webSocketApi.ref,
        integrationType: 'AWS_PROXY',
        integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${chatDisconnectFunction.functionArn}/invocations`,
      }).ref}`,
    });

    const sendMessageRoute = new apigatewayv2.CfnRoute(this, 'SendMessageRoute', {
      apiId: webSocketApi.ref,
      routeKey: 'sendMessage',
      authorizationType: 'NONE',
      target: `integrations/${new apigatewayv2.CfnIntegration(this, 'SendMessageIntegration', {
        apiId: webSocketApi.ref,
        integrationType: 'AWS_PROXY',
        integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${chatSendMessageFunction.functionArn}/invocations`,
      }).ref}`,
    });

    // Grant WebSocket API permission to invoke Lambda functions
    chatConnectFunction.addPermission('WebSocketConnectPermission', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${webSocketApi.ref}/*/*`,
    });

    chatDisconnectFunction.addPermission('WebSocketDisconnectPermission', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${webSocketApi.ref}/*/*`,
    });

    chatSendMessageFunction.addPermission('WebSocketSendMessagePermission', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${webSocketApi.ref}/*/*`,
    });

    // Update the API Gateway Management permissions with specific WebSocket API ARN
    chatSendMessageFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'execute-api:ManageConnections',
      ],
      resources: [
        `arn:aws:execute-api:${this.region}:${this.account}:${webSocketApi.ref}/${webSocketStage.stageName}/POST/@connections/*`,
      ],
    }));

    // Zone Lambda Functions
    const startZoneInstanceFunction = new lambda.Function(this, 'StartZoneInstanceFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'startZoneInstance.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/zone'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        PARTIES_TABLE: partiesTable.tableName,
        ZONE_INSTANCES_TABLE: zoneInstancesTable.tableName,
      },
    });

    const getZoneInstanceFunction = new lambda.Function(this, 'GetZoneInstanceFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'getZoneInstance.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/zone'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        ZONE_INSTANCES_TABLE: zoneInstancesTable.tableName,
      },
    });

    const attackMonsterFunction = new lambda.Function(this, 'AttackMonsterFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'attackMonster.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/zone'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        ZONE_INSTANCES_TABLE: zoneInstancesTable.tableName,
        CHARACTERS_TABLE: charactersTable.tableName,
        PARTIES_TABLE: partiesTable.tableName,
        INVENTORY_TABLE: inventoryTable.tableName,
      },
    });

    const completeZoneInstanceFunction = new lambda.Function(this, 'CompleteZoneInstanceFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'completeZoneInstance.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/zone'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        ZONE_INSTANCES_TABLE: zoneInstancesTable.tableName,
        CHARACTERS_TABLE: charactersTable.tableName,
        INVENTORY_TABLE: inventoryTable.tableName,
      },
    });

    const leaveZoneInstanceFunction = new lambda.Function(this, 'LeaveZoneInstanceFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'leaveZoneInstance.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/zone'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        ZONE_INSTANCES_TABLE: zoneInstancesTable.tableName,
        PARTIES_TABLE: partiesTable.tableName,
      },
    });

    // Leaderboard Lambda Functions
    const calculateLeaderboardsFunction = new lambda.Function(this, 'CalculateLeaderboardsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'calculateLeaderboards.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/leaderboard'),
      timeout: cdk.Duration.minutes(5),
      environment: {
        CHARACTERS_TABLE: charactersTable.tableName,
        LEADERBOARDS_TABLE: leaderboardsTable.tableName,
        GUILD_MEMBERS_TABLE: guildMembersTable.tableName,
        GUILDS_TABLE: guildsTable.tableName,
      },
    });

    const getLeaderboardFunction = new lambda.Function(this, 'GetLeaderboardFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'getLeaderboard.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/leaderboard'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        LEADERBOARDS_TABLE: leaderboardsTable.tableName,
      },
    });

    const getUserRankingsFunction = new lambda.Function(this, 'GetUserRankingsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'getUserRankings.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/leaderboard'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        LEADERBOARDS_TABLE: leaderboardsTable.tableName,
      },
    });

    // EventBridge rule for scheduled leaderboard updates
    const leaderboardUpdateRule = new events.Rule(this, 'LeaderboardUpdateRule', {
      description: 'Trigger leaderboard calculation every hour',
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
    });

    // Add the Lambda function as a target for the EventBridge rule
    leaderboardUpdateRule.addTarget(new targets.LambdaFunction(calculateLeaderboardsFunction));

    // Health Check Lambda Function
    const healthCheckFunction = new lambda.Function(this, 'HealthCheckFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'healthCheck.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/health'),
      timeout: cdk.Duration.seconds(10),
      environment: {
        USERS_TABLE: usersTable.tableName,
        CHARACTERS_TABLE: charactersTable.tableName,
        GUILDS_TABLE: guildsTable.tableName,
        GUILD_MEMBERS_TABLE: guildMembersTable.tableName,
        GUILD_INVITATIONS_TABLE: guildInvitationsTable.tableName,
        ITEMS_TABLE: itemsTable.tableName,
        INVENTORY_TABLE: inventoryTable.tableName,
        AUCTION_LISTINGS_TABLE: auctionListingsTable.tableName,
        CHAT_MESSAGES_TABLE: chatMessagesTable.tableName,
        LEADERBOARDS_TABLE: leaderboardsTable.tableName,
        PARTIES_TABLE: partiesTable.tableName,
        ZONE_INSTANCES_TABLE: zoneInstancesTable.tableName,
        CRAFTING_SESSIONS_TABLE: craftingSessionsTable.tableName,
        CURRENCY_TRANSACTIONS_TABLE: currencyTransactionsTable.tableName,
      },
    });

    // API Gateway integration
    const healthResource = api.root.addResource('health');
    healthResource.addMethod('GET', new apigateway.LambdaIntegration(healthCheckFunction));

    // Authentication API endpoints
    const authResource = api.root.addResource('auth');
    
    const loginResource = authResource.addResource('login');
    loginResource.addMethod('POST', new apigateway.LambdaIntegration(loginFunction));
    
    const refreshResource = authResource.addResource('refresh');
    refreshResource.addMethod('POST', new apigateway.LambdaIntegration(refreshTokenFunction));
    
    const logoutResource = authResource.addResource('logout');
    logoutResource.addMethod('POST', new apigateway.LambdaIntegration(logoutFunction));

    // Activity API endpoints
    const activityResource = api.root.addResource('activity');
    
    const offlineProgressResource = activityResource.addResource('offline-progress');
    offlineProgressResource.addMethod('POST', new apigateway.LambdaIntegration(calculateOfflineProgressFunction));
    
    // Activity switching and progress endpoints
    const userActivityResource = activityResource.addResource('{userId}');
    const switchResource = userActivityResource.addResource('switch');
    switchResource.addMethod('POST', new apigateway.LambdaIntegration(switchActivityFunction)); // Switch activity
    
    const progressResource = userActivityResource.addResource('progress');
    progressResource.addMethod('GET', new apigateway.LambdaIntegration(getActivityProgressFunction)); // Get activity progress

    // Guild API endpoints
    const guildResource = api.root.addResource('guild');
    
    // Guild CRUD operations
    guildResource.addMethod('POST', new apigateway.LambdaIntegration(createGuildFunction)); // Create guild
    
    const guildIdResource = guildResource.addResource('{guildId}');
    guildIdResource.addMethod('GET', new apigateway.LambdaIntegration(getGuildFunction)); // Get guild
    guildIdResource.addMethod('PUT', new apigateway.LambdaIntegration(updateGuildFunction)); // Update guild
    guildIdResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteGuildFunction)); // Delete guild
    
    // Guild member management
    const membersResource = guildIdResource.addResource('members');
    const memberIdResource = membersResource.addResource('{userId}');
    memberIdResource.addMethod('DELETE', new apigateway.LambdaIntegration(kickMemberFunction)); // Kick member
    memberIdResource.addMethod('PUT', new apigateway.LambdaIntegration(updateMemberRoleFunction)); // Update member role
    
    // Guild invitations
    const inviteResource = guildIdResource.addResource('invite');
    inviteResource.addMethod('POST', new apigateway.LambdaIntegration(inviteToGuildFunction)); // Send invitation
    
    const leaveResource = guildIdResource.addResource('leave');
    leaveResource.addMethod('POST', new apigateway.LambdaIntegration(leaveGuildFunction)); // Leave guild
    
    // Guild search and user guild lookup
    const searchResource = guildResource.addResource('search');
    searchResource.addMethod('GET', new apigateway.LambdaIntegration(searchGuildsFunction)); // Search guilds
    
    const myGuildResource = guildResource.addResource('my-guild');
    myGuildResource.addMethod('GET', new apigateway.LambdaIntegration(getUserGuildFunction)); // Get user's guild
    
    // Invitation management
    const invitationResource = api.root.addResource('invitation');
    const invitationIdResource = invitationResource.addResource('{invitationId}');
    invitationIdResource.addMethod('POST', new apigateway.LambdaIntegration(respondToInvitationFunction)); // Respond to invitation

    // Character API Routes
    const characterResource = api.root.addResource('character');
    
    // Character CRUD operations
    characterResource.addMethod('POST', new apigateway.LambdaIntegration(createCharacterFunction)); // Create character
    characterResource.addMethod('GET', new apigateway.LambdaIntegration(getCharacterFunction)); // Get character
    characterResource.addMethod('PUT', new apigateway.LambdaIntegration(updateCharacterFunction)); // Update character
    characterResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteCharacterFunction)); // Delete character

    // Additional activity endpoints (already defined above, removing duplicates)

    // Currency API Routes
    const currencyResource = api.root.addResource('currency');
    
    // Currency operations
    const earnResource = currencyResource.addResource('earn');
    earnResource.addMethod('POST', new apigateway.LambdaIntegration(earnCurrencyFunction)); // Earn currency
    
    const spendResource = currencyResource.addResource('spend');
    spendResource.addMethod('POST', new apigateway.LambdaIntegration(spendCurrencyFunction)); // Spend currency
    
    const balanceResource = currencyResource.addResource('balance');
    balanceResource.addMethod('GET', new apigateway.LambdaIntegration(getCurrencyBalanceFunction)); // Get currency balance
    
    const historyResource = currencyResource.addResource('history');
    historyResource.addMethod('GET', new apigateway.LambdaIntegration(getCurrencyHistoryFunction)); // Get currency history

    // Auction API Routes
    const auctionResource = api.root.addResource('auction');
    
    // Auction operations
    auctionResource.addMethod('POST', new apigateway.LambdaIntegration(createAuctionFunction)); // Create auction
    auctionResource.addMethod('GET', new apigateway.LambdaIntegration(searchAuctionsFunction)); // Search auctions
    
    const auctionIdResource = auctionResource.addResource('{auctionId}');
    auctionIdResource.addMethod('GET', new apigateway.LambdaIntegration(getAuctionFunction)); // Get auction details
    auctionIdResource.addMethod('DELETE', new apigateway.LambdaIntegration(cancelAuctionFunction)); // Cancel auction
    
    const bidResource = auctionIdResource.addResource('bid');
    bidResource.addMethod('POST', new apigateway.LambdaIntegration(placeBidFunction)); // Place bid
    
    const buyoutResource = auctionIdResource.addResource('buyout');
    buyoutResource.addMethod('POST', new apigateway.LambdaIntegration(buyoutAuctionFunction)); // Buyout auction
    
    const userAuctionsResource = auctionResource.addResource('user');
    const userIdAuctionsResource = userAuctionsResource.addResource('{userId}');
    userIdAuctionsResource.addMethod('GET', new apigateway.LambdaIntegration(getUserAuctionsFunction)); // Get user auctions

    // Party API Routes
    const partyResource = api.root.addResource('party');
    
    // Party operations
    partyResource.addMethod('POST', new apigateway.LambdaIntegration(createPartyFunction)); // Create party
    partyResource.addMethod('GET', new apigateway.LambdaIntegration(getAvailablePartiesFunction)); // Get available parties
    
    const partyIdResource = partyResource.addResource('{partyId}');
    partyIdResource.addMethod('GET', new apigateway.LambdaIntegration(getPartyFunction)); // Get party details
    
    const joinResource = partyIdResource.addResource('join');
    joinResource.addMethod('POST', new apigateway.LambdaIntegration(joinPartyFunction)); // Join party
    
    const partyLeaveResource = partyIdResource.addResource('leave');
    partyLeaveResource.addMethod('POST', new apigateway.LambdaIntegration(leavePartyFunction)); // Leave party
    
    const userPartyResource = partyResource.addResource('user');
    const userIdPartyResource = userPartyResource.addResource('{userId}');
    userIdPartyResource.addMethod('GET', new apigateway.LambdaIntegration(getUserPartyFunction)); // Get user's party

    // Crafting API Routes
    const craftingResource = api.root.addResource('crafting');
    
    // Start crafting session
    const startResource = craftingResource.addResource('start');
    startResource.addMethod('POST', new apigateway.LambdaIntegration(startCraftingFunction)); // Start crafting
    
    // Complete crafting session
    const completeResource = craftingResource.addResource('complete');
    completeResource.addMethod('POST', new apigateway.LambdaIntegration(completeCraftingFunction)); // Complete crafting

    // Chat API Routes
    const chatResource = api.root.addResource('chat');
    
    // Message history endpoints
    const chatHistoryResource = chatResource.addResource('history');
    chatHistoryResource.addMethod('GET', new apigateway.LambdaIntegration(chatGetMessageHistoryFunction)); // Get message history
    
    const privateMessagesResource = chatResource.addResource('private-messages');
    privateMessagesResource.addMethod('GET', new apigateway.LambdaIntegration(chatGetPrivateMessagesFunction)); // Get private messages

    // Zone API Routes
    const zoneResource = api.root.addResource('zone');
    
    // Zone instance management
    zoneResource.addMethod('POST', new apigateway.LambdaIntegration(startZoneInstanceFunction)); // Start zone instance
    
    const instanceResource = zoneResource.addResource('instance');
    const instanceIdResource = instanceResource.addResource('{instanceId}');
    instanceIdResource.addMethod('GET', new apigateway.LambdaIntegration(getZoneInstanceFunction)); // Get zone instance
    instanceIdResource.addMethod('POST', new apigateway.LambdaIntegration(completeZoneInstanceFunction)); // Complete zone instance
    
    const attackResource = instanceIdResource.addResource('attack');
    attackResource.addMethod('POST', new apigateway.LambdaIntegration(attackMonsterFunction)); // Attack monster
    
    const zoneLeaveResource = instanceIdResource.addResource('leave');
    zoneLeaveResource.addMethod('POST', new apigateway.LambdaIntegration(leaveZoneInstanceFunction)); // Leave zone instance

    // Leaderboard API Routes
    const leaderboardResource = api.root.addResource('leaderboard');
    
    // Leaderboard calculation (admin endpoint)
    const calculateResource = leaderboardResource.addResource('calculate');
    calculateResource.addMethod('POST', new apigateway.LambdaIntegration(calculateLeaderboardsFunction)); // Trigger leaderboard calculation
    
    // Get leaderboard by stat type
    const statTypeResource = leaderboardResource.addResource('{statType}');
    statTypeResource.addMethod('GET', new apigateway.LambdaIntegration(getLeaderboardFunction)); // Get leaderboard
    
    // User rankings
    const userResource = leaderboardResource.addResource('user');
    const userIdResource = userResource.addResource('{userId}');
    const rankingsResource = userIdResource.addResource('rankings');
    rankingsResource.addMethod('GET', new apigateway.LambdaIntegration(getUserRankingsFunction)); // Get user rankings

    // Outputs
    new cdk.CfnOutput(this, 'WebsiteURL', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'Website URL',
    });

    new cdk.CfnOutput(this, 'ApiURL', {
      value: api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'WebSocketApiURL', {
      value: `wss://${webSocketApi.ref}.execute-api.${this.region}.amazonaws.com/${webSocketStage.stageName}`,
      description: 'WebSocket API URL',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: identityPool.ref,
      description: 'Cognito Identity Pool ID',
    });
  }
}