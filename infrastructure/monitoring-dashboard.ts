import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface MonitoringDashboardProps {
  lambdaFunctions: lambda.Function[];
  dynamoTables: dynamodb.Table[];
  apiGateway: any;
  environment: string;
}

export class MonitoringDashboard extends Construct {
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: MonitoringDashboardProps) {
    super(scope, id);

    // Create CloudWatch Dashboard
    this.dashboard = new cloudwatch.Dashboard(this, 'GameDashboard', {
      dashboardName: `steampunk-idle-game-${props.environment}`,
      defaultInterval: cdk.Duration.hours(1),
    });

    // Lambda Performance Metrics
    const lambdaWidgets = this.createLambdaWidgets(props.lambdaFunctions);
    
    // DynamoDB Performance Metrics
    const dynamoWidgets = this.createDynamoDBWidgets(props.dynamoTables);
    
    // API Gateway Metrics
    const apiWidgets = this.createAPIGatewayWidgets(props.apiGateway);
    
    // System Health Metrics
    const healthWidgets = this.createHealthWidgets();

    // Add widgets to dashboard
    this.dashboard.addWidgets(
      // Top row - Key metrics
      new cloudwatch.SingleValueWidget({
        title: 'Active Users (24h)',
        metrics: [
          new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Invocations',
            dimensionsMap: {
              FunctionName: props.lambdaFunctions.find(f => f.functionName.includes('Login'))?.functionName || 'LoginFunction',
            },
            statistic: 'Sum',
            period: cdk.Duration.hours(24),
          }),
        ],
        width: 6,
        height: 3,
      }),
      
      new cloudwatch.SingleValueWidget({
        title: 'API Success Rate',
        metrics: [
          new cloudwatch.MathExpression({
            expression: '(requests - errors) / requests * 100',
            usingMetrics: {
              requests: new cloudwatch.Metric({
                namespace: 'AWS/ApiGateway',
                metricName: 'Count',
                statistic: 'Sum',
              }),
              errors: new cloudwatch.Metric({
                namespace: 'AWS/ApiGateway',
                metricName: '4XXError',
                statistic: 'Sum',
              }),
            },
          }),
        ],
        width: 6,
        height: 3,
      }),
    );

    // Second row - Lambda performance
    this.dashboard.addWidgets(...lambdaWidgets);
    
    // Third row - DynamoDB performance
    this.dashboard.addWidgets(...dynamoWidgets);
    
    // Fourth row - API Gateway metrics
    this.dashboard.addWidgets(...apiWidgets);
    
    // Fifth row - Health and error tracking
    this.dashboard.addWidgets(...healthWidgets);
  }

  private createLambdaWidgets(functions: lambda.Function[]): cloudwatch.IWidget[] {
    const widgets: cloudwatch.IWidget[] = [];

    // Lambda Duration Chart
    widgets.push(
      new cloudwatch.GraphWidget({
        title: 'Lambda Function Duration',
        left: functions.map(fn => new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'Duration',
          dimensionsMap: { FunctionName: fn.functionName },
          statistic: 'Average',
        })),
        width: 12,
        height: 6,
      })
    );

    // Lambda Error Rate
    widgets.push(
      new cloudwatch.GraphWidget({
        title: 'Lambda Error Rate',
        left: functions.map(fn => new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'Errors',
          dimensionsMap: { FunctionName: fn.functionName },
          statistic: 'Sum',
        })),
        width: 12,
        height: 6,
      })
    );

    // Lambda Concurrent Executions
    widgets.push(
      new cloudwatch.GraphWidget({
        title: 'Lambda Concurrent Executions',
        left: functions.map(fn => new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'ConcurrentExecutions',
          dimensionsMap: { FunctionName: fn.functionName },
          statistic: 'Maximum',
        })),
        width: 12,
        height: 6,
      })
    );

    return widgets;
  }

  private createDynamoDBWidgets(tables: dynamodb.Table[]): cloudwatch.IWidget[] {
    const widgets: cloudwatch.IWidget[] = [];

    // DynamoDB Read/Write Capacity
    widgets.push(
      new cloudwatch.GraphWidget({
        title: 'DynamoDB Read Capacity Utilization',
        left: tables.map(table => new cloudwatch.Metric({
          namespace: 'AWS/DynamoDB',
          metricName: 'ConsumedReadCapacityUnits',
          dimensionsMap: { TableName: table.tableName },
          statistic: 'Sum',
        })),
        width: 12,
        height: 6,
      })
    );

    widgets.push(
      new cloudwatch.GraphWidget({
        title: 'DynamoDB Write Capacity Utilization',
        left: tables.map(table => new cloudwatch.Metric({
          namespace: 'AWS/DynamoDB',
          metricName: 'ConsumedWriteCapacityUnits',
          dimensionsMap: { TableName: table.tableName },
          statistic: 'Sum',
        })),
        width: 12,
        height: 6,
      })
    );

    // DynamoDB Throttling
    widgets.push(
      new cloudwatch.GraphWidget({
        title: 'DynamoDB Throttled Requests',
        left: tables.map(table => new cloudwatch.Metric({
          namespace: 'AWS/DynamoDB',
          metricName: 'ThrottledRequests',
          dimensionsMap: { TableName: table.tableName },
          statistic: 'Sum',
        })),
        width: 12,
        height: 6,
      })
    );

    return widgets;
  }

  private createAPIGatewayWidgets(apiGateway: any): cloudwatch.IWidget[] {
    const widgets: cloudwatch.IWidget[] = [];

    // API Gateway Request Count
    widgets.push(
      new cloudwatch.GraphWidget({
        title: 'API Gateway Requests',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Count',
            statistic: 'Sum',
          }),
        ],
        width: 6,
        height: 6,
      })
    );

    // API Gateway Latency
    widgets.push(
      new cloudwatch.GraphWidget({
        title: 'API Gateway Latency',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Latency',
            statistic: 'Average',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'IntegrationLatency',
            statistic: 'Average',
          }),
        ],
        width: 6,
        height: 6,
      })
    );

    // API Gateway Errors
    widgets.push(
      new cloudwatch.GraphWidget({
        title: 'API Gateway Errors',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: '4XXError',
            statistic: 'Sum',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: '5XXError',
            statistic: 'Sum',
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    return widgets;
  }

  private createHealthWidgets(): cloudwatch.IWidget[] {
    const widgets: cloudwatch.IWidget[] = [];

    // Custom Application Metrics
    widgets.push(
      new cloudwatch.GraphWidget({
        title: 'Game Metrics - Active Players',
        left: [
          new cloudwatch.Metric({
            namespace: 'SteampunkIdleGame',
            metricName: 'ActivePlayers',
            statistic: 'Average',
          }),
        ],
        width: 6,
        height: 6,
      })
    );

    widgets.push(
      new cloudwatch.GraphWidget({
        title: 'Game Metrics - Transactions',
        left: [
          new cloudwatch.Metric({
            namespace: 'SteampunkIdleGame',
            metricName: 'CurrencyTransactions',
            statistic: 'Sum',
          }),
          new cloudwatch.Metric({
            namespace: 'SteampunkIdleGame',
            metricName: 'AuctionTransactions',
            statistic: 'Sum',
          }),
        ],
        width: 6,
        height: 6,
      })
    );

    // Error Tracking
    widgets.push(
      new cloudwatch.GraphWidget({
        title: 'Application Errors',
        left: [
          new cloudwatch.Metric({
            namespace: 'SteampunkIdleGame',
            metricName: 'ApplicationErrors',
            statistic: 'Sum',
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    return widgets;
  }

  // Create alarms for critical metrics
  public createAlarms(): cloudwatch.Alarm[] {
    const alarms: cloudwatch.Alarm[] = [];

    // High error rate alarm
    alarms.push(
      new cloudwatch.Alarm(this, 'HighErrorRate', {
        alarmName: 'SteampunkIdleGame-HighErrorRate',
        alarmDescription: 'High error rate detected',
        metric: new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: '5XXError',
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 10,
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      })
    );

    // High latency alarm
    alarms.push(
      new cloudwatch.Alarm(this, 'HighLatency', {
        alarmName: 'SteampunkIdleGame-HighLatency',
        alarmDescription: 'High API latency detected',
        metric: new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: 'Latency',
          statistic: 'Average',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 5000, // 5 seconds
        evaluationPeriods: 3,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      })
    );

    // DynamoDB throttling alarm
    alarms.push(
      new cloudwatch.Alarm(this, 'DynamoDBThrottling', {
        alarmName: 'SteampunkIdleGame-DynamoDBThrottling',
        alarmDescription: 'DynamoDB throttling detected',
        metric: new cloudwatch.Metric({
          namespace: 'AWS/DynamoDB',
          metricName: 'ThrottledRequests',
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 5,
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      })
    );

    return alarms;
  }
}