import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as xray from 'aws-cdk-lib/aws-xray';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';

export interface MonitoringStackProps extends cdk.StackProps {
  environment: string;
  lambdaFunctions: lambda.Function[];
  dynamoTables: dynamodb.Table[];
  notificationEmail?: string;
}

export class MonitoringStack extends cdk.Stack {
  public readonly alarmTopic: sns.Topic;
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    // SNS Topic for alerts
    this.alarmTopic = new sns.Topic(this, 'AlertTopic', {
      displayName: `Steampunk Idle Game ${props.environment} Alerts`,
      topicName: `steampunk-idle-game-${props.environment}-alerts`,
    });

    if (props.notificationEmail) {
      this.alarmTopic.addSubscription(
        new subscriptions.EmailSubscription(props.notificationEmail)
      );
    }

    // CloudWatch Dashboard
    this.dashboard = new cloudwatch.Dashboard(this, 'GameDashboard', {
      dashboardName: `steampunk-idle-game-${props.environment}`,
    });

    // Create monitoring for Lambda functions
    this.createLambdaMonitoring(props.lambdaFunctions);

    // Create monitoring for DynamoDB tables
    this.createDynamoDBMonitoring(props.dynamoTables);

    // Create custom metrics and alarms
    this.createCustomMetrics();

    // Create X-Ray tracing configuration
    this.createXRayTracing();

    // Create log aggregation and analysis
    this.createLogAnalysis();

    // Create operational dashboards
    this.createOperationalDashboards();
  }

  private createLambdaMonitoring(functions: lambda.Function[]) {
    const lambdaWidgets: cloudwatch.IWidget[] = [];

    functions.forEach((func, index) => {
      // Error rate alarm
      const errorAlarm = new cloudwatch.Alarm(this, `LambdaErrorAlarm${index}`, {
        alarmName: `${func.functionName}-errors`,
        metric: func.metricErrors({
          period: cdk.Duration.minutes(5),
          statistic: 'Sum',
        }),
        threshold: 5,
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: `High error rate for ${func.functionName}`,
      });

      errorAlarm.addAlarmAction(
        new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic)
      );

      // Duration alarm
      const durationAlarm = new cloudwatch.Alarm(this, `LambdaDurationAlarm${index}`, {
        alarmName: `${func.functionName}-duration`,
        metric: func.metricDuration({
          period: cdk.Duration.minutes(5),
          statistic: 'Average',
        }),
        threshold: 10000, // 10 seconds
        evaluationPeriods: 3,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: `High duration for ${func.functionName}`,
      });

      durationAlarm.addAlarmAction(
        new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic)
      );

      // Throttle alarm
      const throttleAlarm = new cloudwatch.Alarm(this, `LambdaThrottleAlarm${index}`, {
        alarmName: `${func.functionName}-throttles`,
        metric: func.metricThrottles({
          period: cdk.Duration.minutes(5),
          statistic: 'Sum',
        }),
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: `Throttling detected for ${func.functionName}`,
      });

      throttleAlarm.addAlarmAction(
        new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic)
      );

      // Add widgets to dashboard
      lambdaWidgets.push(
        new cloudwatch.GraphWidget({
          title: `${func.functionName} - Invocations & Errors`,
          left: [func.metricInvocations()],
          right: [func.metricErrors()],
          width: 12,
          height: 6,
        })
      );

      lambdaWidgets.push(
        new cloudwatch.GraphWidget({
          title: `${func.functionName} - Duration & Throttles`,
          left: [func.metricDuration()],
          right: [func.metricThrottles()],
          width: 12,
          height: 6,
        })
      );
    });

    // Add Lambda section to dashboard
    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '# Lambda Functions Monitoring',
        width: 24,
        height: 1,
      }),
      ...lambdaWidgets
    );
  }

  private createDynamoDBMonitoring(tables: dynamodb.Table[]) {
    const dynamoWidgets: cloudwatch.IWidget[] = [];

    tables.forEach((table, index) => {
      // Read throttle alarm
      const readThrottleAlarm = new cloudwatch.Alarm(this, `DynamoReadThrottleAlarm${index}`, {
        alarmName: `${table.tableName}-read-throttles`,
        metric: table.metricUserErrors({
          period: cdk.Duration.minutes(5),
          statistic: 'Sum',
        }),
        threshold: 1,
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: `Read throttling for ${table.tableName}`,
      });

      readThrottleAlarm.addAlarmAction(
        new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic)
      );

      // Write throttle alarm
      const writeThrottleAlarm = new cloudwatch.Alarm(this, `DynamoWriteThrottleAlarm${index}`, {
        alarmName: `${table.tableName}-write-throttles`,
        metric: table.metricSystemErrors({
          period: cdk.Duration.minutes(5),
          statistic: 'Sum',
        }),
        threshold: 1,
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: `Write throttling for ${table.tableName}`,
      });

      writeThrottleAlarm.addAlarmAction(
        new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic)
      );

      // Add widgets to dashboard
      dynamoWidgets.push(
        new cloudwatch.GraphWidget({
          title: `${table.tableName} - Read/Write Operations`,
          left: [
            table.metricConsumedReadCapacityUnits(),
            table.metricConsumedWriteCapacityUnits(),
          ],
          width: 12,
          height: 6,
        })
      );

      dynamoWidgets.push(
        new cloudwatch.GraphWidget({
          title: `${table.tableName} - Errors & Throttles`,
          left: [table.metricUserErrors(), table.metricSystemErrors()],
          width: 12,
          height: 6,
        })
      );
    });

    // Add DynamoDB section to dashboard
    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '# DynamoDB Tables Monitoring',
        width: 24,
        height: 1,
      }),
      ...dynamoWidgets
    );
  }

  private createCustomMetrics() {
    // Custom metrics for game-specific events
    const gameMetricsNamespace = 'SteampunkIdleGame/GameMetrics';

    // Player activity metrics
    const activePlayersMetric = new cloudwatch.Metric({
      namespace: gameMetricsNamespace,
      metricName: 'ActivePlayers',
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    const newRegistrationsMetric = new cloudwatch.Metric({
      namespace: gameMetricsNamespace,
      metricName: 'NewRegistrations',
      statistic: 'Sum',
      period: cdk.Duration.hours(1),
    });

    // Game economy metrics
    const auctionTransactionsMetric = new cloudwatch.Metric({
      namespace: gameMetricsNamespace,
      metricName: 'AuctionTransactions',
      statistic: 'Sum',
      period: cdk.Duration.minutes(15),
    });

    const currencyTransactionsMetric = new cloudwatch.Metric({
      namespace: gameMetricsNamespace,
      metricName: 'CurrencyTransactions',
      statistic: 'Sum',
      period: cdk.Duration.minutes(15),
    });

    // Chat activity metrics
    const chatMessagesMetric = new cloudwatch.Metric({
      namespace: gameMetricsNamespace,
      metricName: 'ChatMessages',
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // Add custom metrics to dashboard
    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '# Game Metrics',
        width: 24,
        height: 1,
      }),
      new cloudwatch.GraphWidget({
        title: 'Player Activity',
        left: [activePlayersMetric],
        right: [newRegistrationsMetric],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Game Economy',
        left: [auctionTransactionsMetric, currencyTransactionsMetric],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Chat Activity',
        left: [chatMessagesMetric],
        width: 12,
        height: 6,
      })
    );

    // Alarms for critical game metrics
    const lowActivityAlarm = new cloudwatch.Alarm(this, 'LowActivityAlarm', {
      alarmName: 'low-player-activity',
      metric: activePlayersMetric,
      threshold: 10,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods: 3,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
      alarmDescription: 'Player activity is unusually low',
    });

    lowActivityAlarm.addAlarmAction(
      new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic)
    );
  }

  private createXRayTracing() {
    // X-Ray tracing configuration is handled at the Lambda function level
    // This creates a service map and tracing insights

    // Create a Lambda function to analyze X-Ray traces
    const xrayAnalysisFunction = new lambda.Function(this, 'XRayAnalysisFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const { XRayClient, GetTraceSummariesCommand, GetServiceGraphCommand } = require('@aws-sdk/client-xray');
        const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

        const xray = new XRayClient({});
        const cloudwatch = new CloudWatchClient({});

        exports.handler = async (event) => {
          try {
            const endTime = new Date();
            const startTime = new Date(endTime.getTime() - 5 * 60 * 1000); // Last 5 minutes

            // Get trace summaries
            const traceSummaries = await xray.send(new GetTraceSummariesCommand({
              TimeRangeType: 'TimeRangeByStartTime',
              StartTime: startTime,
              EndTime: endTime,
            }));

            // Analyze traces and publish metrics
            const errorCount = traceSummaries.TraceSummaries?.filter(trace => trace.HasError).length || 0;
            const totalCount = traceSummaries.TraceSummaries?.length || 0;
            const avgResponseTime = traceSummaries.TraceSummaries?.reduce((sum, trace) => 
              sum + (trace.ResponseTime || 0), 0) / totalCount || 0;

            // Publish custom metrics
            await cloudwatch.send(new PutMetricDataCommand({
              Namespace: 'SteampunkIdleGame/XRay',
              MetricData: [
                {
                  MetricName: 'TraceErrorRate',
                  Value: totalCount > 0 ? (errorCount / totalCount) * 100 : 0,
                  Unit: 'Percent',
                },
                {
                  MetricName: 'AverageResponseTime',
                  Value: avgResponseTime,
                  Unit: 'Seconds',
                },
                {
                  MetricName: 'TotalTraces',
                  Value: totalCount,
                  Unit: 'Count',
                }
              ]
            }));

            return { statusCode: 200, body: 'X-Ray analysis completed' };
          } catch (error) {
            console.error('X-Ray analysis failed:', error);
            return { statusCode: 500, body: 'X-Ray analysis failed' };
          }
        };
      `),
      timeout: cdk.Duration.minutes(2),
      tracing: lambda.Tracing.ACTIVE,
    });

    // Grant X-Ray permissions
    xrayAnalysisFunction.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      effect: cdk.aws_iam.Effect.ALLOW,
      actions: [
        'xray:GetTraceSummaries',
        'xray:GetServiceGraph',
        'xray:BatchGetTraces',
      ],
      resources: ['*'],
    }));

    // Grant CloudWatch permissions
    xrayAnalysisFunction.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      effect: cdk.aws_iam.Effect.ALLOW,
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
    }));

    // Schedule X-Ray analysis every 5 minutes
    const xrayAnalysisRule = new events.Rule(this, 'XRayAnalysisRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
    });

    xrayAnalysisRule.addTarget(new targets.LambdaFunction(xrayAnalysisFunction));
  }

  private createLogAnalysis() {
    // Create log groups with retention policies
    const logGroups = [
      '/aws/lambda/steampunk-idle-game-auth',
      '/aws/lambda/steampunk-idle-game-character',
      '/aws/lambda/steampunk-idle-game-guild',
      '/aws/lambda/steampunk-idle-game-marketplace',
      '/aws/lambda/steampunk-idle-game-chat',
    ];

    logGroups.forEach((logGroupName, index) => {
      new logs.LogGroup(this, `LogGroup${index}`, {
        logGroupName,
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });
    });

    // Create log insights queries for common patterns
    const logInsightsQueries = [
      {
        name: 'Error Analysis',
        query: `
          fields @timestamp, @message
          | filter @message like /ERROR/
          | sort @timestamp desc
          | limit 100
        `,
      },
      {
        name: 'Slow Requests',
        query: `
          fields @timestamp, @duration, @requestId
          | filter @duration > 5000
          | sort @duration desc
          | limit 50
        `,
      },
      {
        name: 'Authentication Failures',
        query: `
          fields @timestamp, @message
          | filter @message like /authentication failed/
          | stats count() by bin(5m)
        `,
      },
    ];

    // Create CloudWatch Insights dashboard widgets
    const logWidgets = logInsightsQueries.map((query, index) => 
      new cloudwatch.LogQueryWidget({
        title: query.name,
        logGroups: logGroups.map(name => logs.LogGroup.fromLogGroupName(this, `LogGroupRef${index}`, name)),
        queryString: query.query,
        width: 12,
        height: 6,
      })
    );

    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '# Log Analysis',
        width: 24,
        height: 1,
      }),
      ...logWidgets
    );
  }

  private createOperationalDashboards() {
    // Create summary widgets for operational overview
    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '# Operational Overview',
        width: 24,
        height: 1,
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Total Lambda Invocations (Last Hour)',
        metrics: [
          new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Invocations',
            statistic: 'Sum',
            period: cdk.Duration.hours(1),
          }),
        ],
        width: 6,
        height: 6,
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Total Errors (Last Hour)',
        metrics: [
          new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Errors',
            statistic: 'Sum',
            period: cdk.Duration.hours(1),
          }),
        ],
        width: 6,
        height: 6,
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Average Duration (Last Hour)',
        metrics: [
          new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Duration',
            statistic: 'Average',
            period: cdk.Duration.hours(1),
          }),
        ],
        width: 6,
        height: 6,
      }),
      new cloudwatch.SingleValueWidget({
        title: 'DynamoDB Consumed RCU',
        metrics: [
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ConsumedReadCapacityUnits',
            statistic: 'Sum',
            period: cdk.Duration.hours(1),
          }),
        ],
        width: 6,
        height: 6,
      })
    );
  }
}
