/**
 * Monitoring Infrastructure for Task Queue System
 * Sets up CloudWatch, SNS, and Lambda functions for comprehensive monitoring
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';

export interface MonitoringInfrastructureProps {
  api: apigateway.RestApi;
  alertEmail?: string;
  slackWebhookUrl?: string;
}

export class MonitoringInfrastructure extends Construct {
  public readonly monitoringFunction: lambda.Function;
  public readonly healthCheckFunction: lambda.Function;
  public readonly alertTopic: sns.Topic;
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: MonitoringInfrastructureProps) {
    super(scope, id);

    // SNS Topic for alerts
    this.alertTopic = new sns.Topic(this, 'TaskQueueAlerts', {
      displayName: 'Task Queue System Alerts',
      topicName: 'task-queue-alerts'
    });

    // Add email subscription if provided
    if (props.alertEmail) {
      this.alertTopic.addSubscription(
        new snsSubscriptions.EmailSubscription(props.alertEmail)
      );
    }

    // Lambda function for monitoring operations
    this.monitoringFunction = new lambda.Function(this, 'MonitoringFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'taskQueueMonitoringHandler.handler',
      code: lambda.Code.fromAsset('src/lambda/activity'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        ALERT_TOPIC_ARN: this.alertTopic.topicArn,
        SLACK_WEBHOOK_URL: props.slackWebhookUrl || '',
        NODE_ENV: 'production'
      },
      logRetention: logs.RetentionDays.ONE_MONTH
    });

    // Health check function
    this.healthCheckFunction = new lambda.Function(this, 'HealthCheckFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'taskQueueMonitoringHandler.healthCheck',
      code: lambda.Code.fromAsset('src/lambda/activity'),
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      environment: {
        NODE_ENV: 'production'
      },
      logRetention: logs.RetentionDays.ONE_WEEK
    });

    // Grant permissions to publish to SNS
    this.alertTopic.grantPublish(this.monitoringFunction);

    // Grant CloudWatch permissions
    this.monitoringFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cloudwatch:PutMetricData',
        'cloudwatch:GetMetricStatistics',
        'cloudwatch:ListMetrics'
      ],
      resources: ['*']
    }));

    this.healthCheckFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cloudwatch:GetMetricStatistics',
        'cloudwatch:ListMetrics'
      ],
      resources: ['*']
    }));

    // API Gateway integration
    const monitoringResource = props.api.root.addResource('monitoring');
    
    // Monitoring endpoints
    monitoringResource.addMethod('POST', new apigateway.LambdaIntegration(this.monitoringFunction), {
      authorizationType: apigateway.AuthorizationType.NONE, // Add proper auth in production
      methodResponses: [
        {
          statusCode: '200',
          responseHeaders: {
            'Access-Control-Allow-Origin': true,
            'Access-Control-Allow-Methods': true,
            'Access-Control-Allow-Headers': true,
          }
        }
      ]
    });

    // Health check endpoint
    const healthResource = monitoringResource.addResource('health');
    healthResource.addMethod('GET', new apigateway.LambdaIntegration(this.healthCheckFunction), {
      authorizationType: apigateway.AuthorizationType.NONE,
      methodResponses: [
        {
          statusCode: '200',
          responseHeaders: {
            'Access-Control-Allow-Origin': true,
          }
        }
      ]
    });

    // CORS preflight
    monitoringResource.addMethod('OPTIONS', new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
          'method.response.header.Access-Control-Allow-Origin': "'*'",
          'method.response.header.Access-Control-Allow-Methods': "'GET,POST,OPTIONS'"
        }
      }],
      passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_MATCH,
      requestTemplates: {
        'application/json': '{"statusCode": 200}'
      }
    }), {
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Access-Control-Allow-Methods': true,
          'method.response.header.Access-Control-Allow-Origin': true,
        }
      }]
    });

    // CloudWatch Dashboard
    this.dashboard = new cloudwatch.Dashboard(this, 'TaskQueueDashboard', {
      dashboardName: 'TaskQueueMonitoring'
    });

    // Create CloudWatch Alarms
    this.createCloudWatchAlarms();

    // Create custom metrics
    this.createCustomMetrics();

    // Schedule health checks
    this.scheduleHealthChecks();
  }

  private createCloudWatchAlarms(): void {
    // High error rate alarm
    const errorRateAlarm = new cloudwatch.Alarm(this, 'HighErrorRateAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'TaskQueue',
        metricName: 'ErrorRate',
        statistic: 'Average'
      }),
      threshold: 5,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'Task queue error rate is above 5%',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    });

    errorRateAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alertTopic));

    // High processing time alarm
    const processingTimeAlarm = new cloudwatch.Alarm(this, 'HighProcessingTimeAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'TaskQueue',
        metricName: 'AverageProcessingTime',
        statistic: 'Average'
      }),
      threshold: 30000, // 30 seconds
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'Average task processing time is above 30 seconds',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    });

    processingTimeAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alertTopic));

    // Large queue backup alarm
    const queueBackupAlarm = new cloudwatch.Alarm(this, 'QueueBackupAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'TaskQueue',
        metricName: 'MaxQueueLength',
        statistic: 'Maximum'
      }),
      threshold: 1000,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'Queue length exceeds 1000 tasks',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    });

    queueBackupAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alertTopic));

    // Lambda function errors
    const lambdaErrorAlarm = new cloudwatch.Alarm(this, 'LambdaErrorAlarm', {
      metric: this.monitoringFunction.metricErrors(),
      threshold: 5,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'Monitoring function is experiencing errors',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    });

    lambdaErrorAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alertTopic));
  }

  private createCustomMetrics(): void {
    // Add widgets to dashboard
    this.dashboard.addWidgets(
      // Performance metrics row
      new cloudwatch.GraphWidget({
        title: 'Task Processing Performance',
        left: [
          new cloudwatch.Metric({
            namespace: 'TaskQueue',
            metricName: 'AverageProcessingTime',
            statistic: 'Average'
          }),
          new cloudwatch.Metric({
            namespace: 'TaskQueue',
            metricName: 'ProcessingTimeP95',
            statistic: 'Average'
          })
        ],
        width: 12,
        height: 6
      }),

      new cloudwatch.GraphWidget({
        title: 'Error Rates',
        left: [
          new cloudwatch.Metric({
            namespace: 'TaskQueue',
            metricName: 'ErrorRate',
            statistic: 'Average'
          }),
          new cloudwatch.Metric({
            namespace: 'TaskQueue',
            metricName: 'TaskFailureRate',
            statistic: 'Average'
          })
        ],
        width: 12,
        height: 6
      }),

      // Queue metrics row
      new cloudwatch.GraphWidget({
        title: 'Queue Metrics',
        left: [
          new cloudwatch.Metric({
            namespace: 'TaskQueue',
            metricName: 'AverageQueueLength',
            statistic: 'Average'
          }),
          new cloudwatch.Metric({
            namespace: 'TaskQueue',
            metricName: 'MaxQueueLength',
            statistic: 'Maximum'
          })
        ],
        width: 12,
        height: 6
      }),

      new cloudwatch.GraphWidget({
        title: 'Player Activity',
        left: [
          new cloudwatch.Metric({
            namespace: 'TaskQueue',
            metricName: 'ActivePlayerCount',
            statistic: 'Average'
          }),
          new cloudwatch.Metric({
            namespace: 'TaskQueue',
            metricName: 'ConcurrentQueueCount',
            statistic: 'Average'
          })
        ],
        width: 12,
        height: 6
      }),

      // System resources row
      new cloudwatch.GraphWidget({
        title: 'System Resources',
        left: [
          new cloudwatch.Metric({
            namespace: 'TaskQueue',
            metricName: 'MemoryUsage',
            statistic: 'Average'
          }),
          new cloudwatch.Metric({
            namespace: 'TaskQueue',
            metricName: 'CPUUsage',
            statistic: 'Average'
          })
        ],
        width: 12,
        height: 6
      }),

      new cloudwatch.GraphWidget({
        title: 'Cache Performance',
        left: [
          new cloudwatch.Metric({
            namespace: 'TaskQueue',
            metricName: 'CacheHitRate',
            statistic: 'Average'
          })
        ],
        width: 12,
        height: 6
      }),

      // Lambda function metrics
      new cloudwatch.GraphWidget({
        title: 'Lambda Function Performance',
        left: [
          this.monitoringFunction.metricDuration(),
          this.monitoringFunction.metricInvocations(),
          this.monitoringFunction.metricErrors()
        ],
        width: 24,
        height: 6
      })
    );
  }

  private scheduleHealthChecks(): void {
    // Create EventBridge rule for periodic health checks
    const healthCheckRule = new events.Rule(this, 'HealthCheckRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      description: 'Periodic health check for task queue system'
    });

    // Add Lambda target
    healthCheckRule.addTarget(new targets.LambdaFunction(this.healthCheckFunction));

    // Create a custom metric filter for health check results
    const healthCheckLogGroup = this.healthCheckFunction.logGroup;
    
    new logs.MetricFilter(this, 'HealthCheckMetricFilter', {
      logGroup: healthCheckLogGroup,
      metricNamespace: 'TaskQueue',
      metricName: 'HealthCheckStatus',
      filterPattern: logs.FilterPattern.literal('[timestamp, requestId, level="INFO", message="Health check completed", status]'),
      metricValue: '1',
      defaultValue: 0
    });

    // Create alarm for failed health checks
    const healthCheckAlarm = new cloudwatch.Alarm(this, 'HealthCheckFailureAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'TaskQueue',
        metricName: 'HealthCheckStatus',
        statistic: 'Sum'
      }),
      threshold: 1,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      alarmDescription: 'Health checks are failing',
      treatMissingData: cloudwatch.TreatMissingData.BREACHING
    });

    healthCheckAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alertTopic));
  }
}