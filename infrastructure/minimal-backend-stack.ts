import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class MinimalBackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Tables
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: 'steampunk-idle-game-users',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const charactersTable = new dynamodb.Table(this, 'CharactersTable', {
      tableName: 'steampunk-idle-game-characters',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda execution role
    const lambdaExecutionRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant DynamoDB permissions
    usersTable.grantReadWriteData(lambdaExecutionRole);
    charactersTable.grantReadWriteData(lambdaExecutionRole);

    // Health Check Lambda
    const healthFunction = new lambda.Function(this, 'HealthFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'health.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/health'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        USERS_TABLE: usersTable.tableName,
        CHARACTERS_TABLE: charactersTable.tableName,
      },
    });

    // Auth Lambda Functions
    const loginFunction = new lambda.Function(this, 'LoginFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'login.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/auth'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        USERS_TABLE: usersTable.tableName,
      },
    });

    const refreshFunction = new lambda.Function(this, 'RefreshFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'refresh.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/auth'),
      timeout: cdk.Duration.seconds(30),
    });

    const logoutFunction = new lambda.Function(this, 'LogoutFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'logout.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/auth'),
      timeout: cdk.Duration.seconds(30),
    });

    // Character Lambda
    const characterFunction = new lambda.Function(this, 'CharacterFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'character.handler',
      role: lambdaExecutionRole,
      code: lambda.Code.fromAsset('src/lambda/character'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        USERS_TABLE: usersTable.tableName,
        CHARACTERS_TABLE: charactersTable.tableName,
      },
    });

    // API Gateway (without default CORS - we'll handle it manually)
    const api = new apigateway.RestApi(this, 'SteampunkIdleGameApi', {
      restApiName: 'Steampunk Idle Game API',
      description: 'Minimal API for Steampunk Idle Game',
    });

    // Health endpoint with explicit CORS handling
    const healthResource = api.root.addResource('health');
    
    // Add GET method
    healthResource.addMethod('GET', new apigateway.LambdaIntegration(healthFunction));
    
    // Add OPTIONS method for CORS preflight
    healthResource.addMethod('OPTIONS', new apigateway.MockIntegration({
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
            'method.response.header.Access-Control-Allow-Methods': "'GET,OPTIONS'",
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
      ],
      requestTemplates: {
        'application/json': '{"statusCode": 200}',
      },
    }), {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Headers': true,
            'method.response.header.Access-Control-Allow-Methods': true,
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // Helper function to add CORS to a resource
    const addCorsOptions = (resource: apigateway.Resource) => {
      resource.addMethod('OPTIONS', new apigateway.MockIntegration({
        integrationResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
              'method.response.header.Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'",
              'method.response.header.Access-Control-Allow-Origin': "'*'",
            },
          },
        ],
        requestTemplates: {
          'application/json': '{"statusCode": 200}',
        },
      }), {
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Headers': true,
              'method.response.header.Access-Control-Allow-Methods': true,
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
        ],
      });
    };

    // Auth endpoints
    const authResource = api.root.addResource('auth');
    addCorsOptions(authResource);
    
    const loginResource = authResource.addResource('login');
    loginResource.addMethod('POST', new apigateway.LambdaIntegration(loginFunction));
    addCorsOptions(loginResource);
    
    const refreshResource = authResource.addResource('refresh');
    refreshResource.addMethod('POST', new apigateway.LambdaIntegration(refreshFunction));
    addCorsOptions(refreshResource);
    
    const logoutResource = authResource.addResource('logout');
    logoutResource.addMethod('POST', new apigateway.LambdaIntegration(logoutFunction));
    addCorsOptions(logoutResource);

    // Character endpoints
    const characterResource = api.root.addResource('character');
    characterResource.addMethod('GET', new apigateway.LambdaIntegration(characterFunction));
    characterResource.addMethod('POST', new apigateway.LambdaIntegration(characterFunction));
    addCorsOptions(characterResource);
    
    // Character name validation endpoint
    const validateNameResource = characterResource.addResource('validate-name');
    validateNameResource.addMethod('POST', new apigateway.LambdaIntegration(characterFunction));
    addCorsOptions(validateNameResource);
    
    const characterByIdResource = characterResource.addResource('{userId}');
    characterByIdResource.addMethod('PUT', new apigateway.LambdaIntegration(characterFunction));
    addCorsOptions(characterByIdResource);

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'UsersTableName', {
      value: usersTable.tableName,
      description: 'Users DynamoDB Table Name',
    });

    new cdk.CfnOutput(this, 'CharactersTableName', {
      value: charactersTable.tableName,
      description: 'Characters DynamoDB Table Name',
    });
  }
}