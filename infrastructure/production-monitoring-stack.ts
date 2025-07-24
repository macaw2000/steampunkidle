import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface ProductionMonitoringStackProps extends cdk.StackProps {
  environment: string;
  alertEmail?: string;
  slackWebhookUrl?: string;
  taskQueueStackName: string;
}

export class ProductionMonitoringStack extends cdk.Stack {
  public readonly alertingTopic: sns.Topic;
  public readonly dashboard: cloudwatch.Dashboard;
  public readonly logGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: ProductionMonitoringStackProps) {
    super(scope, id, props);

    // Create SNS topic for alerts
    this.alertingTopic = new sns.Topic(this, 'ProductionAlerts', {
      topicName: `task-queue-${props.environment}-alerts`,
      displayName: 'Task Queue Production Alerts',
    });

    // Add email subscription if provided
    if (props.alertEmail) {
      this.alertingTopic.addSubscription(
        new snsSubscriptions.EmailSubscription(props.alertEmail)
      );
    }

    // Create centralized log group
    this.logGroup = new logs.LogGroup(this, 'ProductionLogs', {
      logGroupName: `/aws/task-queue/${props.environment}`,
      retention: logs.RetentionDays.ONE_MONTH,
    });

    // Create monitoring Lambda function
    const monitoringFunction = this.createMonitoringFunction(props);

    // Create CloudWatch dashboard
    this.dashboard = this.createDashboard(props);

    // Create alarms
    this.createAlarms(props);

    // Create custom metrics and monitoring
    this.createCustomMonitoring(props, monitoringFunction);

    // Output important values
    new cdk.CfnOutput(this, 'AlertTopicArn', {
      value: this.alertingTopic.topicArn,
      description: 'Production Alerts Topic ARN',
    });

    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
    });

    new cdk.CfnOutput(this, 'LogGroupName', {
      value: this.logGroup.logGroupName,
      description: 'Production Log Group Name',
    });
  }

  private createMonitoringFunction(props: ProductionMonitoringStackProps): lambda.Function {
    const monitoringFunction = new lambda.Function(this, 'MonitoringFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const cloudwatch = new AWS.CloudWatch();
        const sns = new AWS.SNS();
        const ecs = new AWS.ECS();
        const rds = new AWS.RDS();

        exports.handler = async (event) => {
          console.log('Monitoring check triggered:', JSON.stringify(event, null, 2));
          
          try {
            const metrics = await collectMetrics();
            await publishMetrics(metrics);
            await checkHealthStatus();
            
            return { statusCode: 200, body: 'Monitoring completed successfully' };
          } catch (error) {
            console.error('Monitoring error:', error);
            await sendAlert('MONITORING_ERROR', error.message);
            throw error;
          }
        };

        async function collectMetrics() {
          const metrics = {
            timestamp: new Date(),
            taskQueue: await getTaskQueueMetrics(),
            system: await getSystemMetrics(),
            database: await getDatabaseMetrics(),
          };
          
          return metrics;
        }

        async function getTaskQueueMetrics() {
          // Collect task queue specific metrics
          return {
            activeTasksCount: await getActiveTasksCount(),
            queueDepth: await getQueueDepth(),
            processingRate: await getProcessingRate(),
            errorRate: await getErrorRate(),
          };
        }

        async function getSystemMetrics() {
          // Get ECS service metrics
          const params = {
            serviceName: 'task-queue-${props.environment}',
            cluster: 'task-queue-${props.environment}',
          };
          
          try {
            const service = await ecs.describeServices(params).promise();
            const serviceData = service.services[0];
            
            return {
              runningCount: serviceData.runningCount,
              pendingCount: serviceData.pendingCount,
              desiredCount: serviceData.desiredCount,
              status: serviceData.status,
            };
          } catch (error) {
            console.error('Error getting system metrics:', error);
            return { error: error.message };
          }
        }

        async function getDatabaseMetrics() {
          // Get RDS metrics if applicable
          try {
            const params = {
              DBInstanceIdentifier: 'task-queue-${props.environment}',
            };
            
            const instance = await rds.describeDBInstances(params).promise();
            const dbInstance = instance.DBInstances[0];
            
            return {
              status: dbInstance.DBInstanceStatus,
              engine: dbInstance.Engine,
              allocatedStorage: dbInstance.AllocatedStorage,
            };
          } catch (error) {
            // Database might not exist or be named differently
            return { status: 'not_monitored' };
          }
        }

        async function getActiveTasksCount() {
          // This would integrate with your task queue service
          // For now, return a mock value
          return Math.floor(Math.random() * 100);
        }

        async function getQueueDepth() {
          // This would integrate with your task queue service
          return Math.floor(Math.random() * 50);
        }

        async function getProcessingRate() {
          // Tasks processed per minute
          return Math.floor(Math.random() * 20) + 5;
        }

        async function getErrorRate() {
          // Error percentage
          return Math.random() * 5; // 0-5% error rate
        }

        async function publishMetrics(metrics) {
          const metricData = [
            {
              MetricName: 'ActiveTasks',
              Value: metrics.taskQueue.activeTasksCount,
              Unit: 'Count',
              Dimensions: [
                { Name: 'Environment', Value: '${props.environment}' },
                { Name: 'Service', Value: 'TaskQueue' }
              ]
            },
            {
              MetricName: 'QueueDepth',
              Value: metrics.taskQueue.queueDepth,
              Unit: 'Count',
              Dimensions: [
                { Name: 'Environment', Value: '${props.environment}' },
                { Name: 'Service', Value: 'TaskQueue' }
              ]
            },
            {
              MetricName: 'ProcessingRate',
              Value: metrics.taskQueue.processingRate,
              Unit: 'Count/Minute',
              Dimensions: [
                { Name: 'Environment', Value: '${props.environment}' },
                { Name: 'Service', Value: 'TaskQueue' }
              ]
            },
            {
              MetricName: 'ErrorRate',
              Value: metrics.taskQueue.errorRate,
              Unit: 'Percent',
              Dimensions: [
                { Name: 'Environment', Value: '${props.environment}' },
                { Name: 'Service', Value: 'TaskQueue' }
              ]
            }
          ];

          if (metrics.system.runningCount !== undefined) {
            metricData.push({
              MetricName: 'RunningTasks',
              Value: metrics.system.runningCount,
              Unit: 'Count',
              Dimensions: [
                { Name: 'Environment', Value: '${props.environment}' },
                { Name: 'Service', Value: 'ECS' }
              ]
            });
          }

          const params = {
            Namespace: 'TaskQueue/Production',
            MetricData: metricData
          };

          await cloudwatch.putMetricData(params).promise();
        }

        async function checkHealthStatus() {
          // Perform health checks
          const healthChecks = [
            checkApiHealth(),
            checkDatabaseHealth(),
            checkQueueHealth(),
          ];

          const results = await Promise.allSettled(healthChecks);
          
          for (let i = 0; i < results.length; i++) {
            if (results[i].status === 'rejected') {
              const checkNames = ['API', 'Database', 'Queue'];
              await sendAlert('HEALTH_CHECK_FAILED', \`\${checkNames[i]} health check failed: \${results[i].reason}\`);
            }
          }
        }

        async function checkApiHealth() {
          // This would make an actual HTTP request to your API
          const isHealthy = Math.random() > 0.1; // 90% success rate for demo
          if (!isHealthy) {
            throw new Error('API health check failed');
          }
        }

        async function checkDatabaseHealth() {
          // This would check database connectivity
          const isHealthy = Math.random() > 0.05; // 95% success rate for demo
          if (!isHealthy) {
            throw new Error('Database health check failed');
          }
        }

        async function checkQueueHealth() {
          // This would check queue processing
          const isHealthy = Math.random() > 0.02; // 98% success rate for demo
          if (!isHealthy) {
            throw new Error('Queue health check failed');
          }
        }

        async function sendAlert(alertType, message) {
          const params = {
            TopicArn: '${this.alertingTopic.topicArn}',
            Message: JSON.stringify({
              timestamp: new Date().toISOString(),
              environment: '${props.environment}',
              alertType: alertType,
              message: message,
              severity: getSeverity(alertType)
            }),
            Subject: \`[ALERT] Task Queue \${alertType} - \${props.environment}\`
          };

          await sns.publish(params).promise();
        }

        function getSeverity(alertType) {
          const severityMap = {
            'HEALTH_CHECK_FAILED': 'HIGH',
            'MONITORING_ERROR': 'MEDIUM',
            'PERFORMANCE_DEGRADATION': 'MEDIUM',
            'RESOURCE_EXHAUSTION': 'HIGH',
          };
          
          return severityMap[alertType] || 'LOW';
        }
      `),
      environment: {
        ALERT_TOPIC_ARN: this.alertingTopic.topicArn,
        ENVIRONMENT: props.environment,
        LOG_GROUP_NAME: this.logGroup.logGroupName,
      },
    });

    // Grant permissions
    this.alertingTopic.grantPublish(monitoringFunction);
    monitoringFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cloudwatch:PutMetricData',
          'cloudwatch:GetMetricStatistics',
          'ecs:DescribeServices',
          'ecs:DescribeTasks',
          'rds:DescribeDBInstances',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: ['*'],
      })
    );

    // Schedule monitoring function to run every 5 minutes
    const monitoringRule = new events.Rule(this, 'MonitoringSchedule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      description: 'Trigger monitoring function every 5 minutes',
    });

    monitoringRule.addTarget(new targets.LambdaFunction(monitoringFunction));

    return monitoringFunction;
  }

  private createDashboard(props: ProductionMonitoringStackProps): cloudwatch.Dashboard {
    const dashboard = new cloudwatch.Dashboard(this, 'ProductionDashboard', {
      dashboardName: `task-queue-${props.environment}-production`,
    });

    // Task Queue Metrics
    const taskQueueWidget = new cloudwatch.GraphWidget({
      title: 'Task Queue Metrics',
      left: [
        new cloudwatch.Metric({
          namespace: 'TaskQueue/Production',
          metricName: 'ActiveTasks',
          dimensionsMap: {
            Environment: props.environment,
            Service: 'TaskQueue',
          },
          statistic: 'Average',
        }),
        new cloudwatch.Metric({
          namespace: 'TaskQueue/Production',
          metricName: 'QueueDepth',
          dimensionsMap: {
            Environment: props.environment,
            Service: 'TaskQueue',
          },
          statistic: 'Average',
        }),
      ],
      right: [
        new cloudwatch.Metric({
          namespace: 'TaskQueue/Production',
          metricName: 'ProcessingRate',
          dimensionsMap: {
            Environment: props.environment,
            Service: 'TaskQueue',
          },
          statistic: 'Average',
        }),
      ],
    });

    // Error Rate Widget
    const errorRateWidget = new cloudwatch.GraphWidget({
      title: 'Error Rate',
      left: [
        new cloudwatch.Metric({
          namespace: 'TaskQueue/Production',
          metricName: 'ErrorRate',
          dimensionsMap: {
            Environment: props.environment,
            Service: 'TaskQueue',
          },
          statistic: 'Average',
        }),
      ],
    });

    // System Metrics Widget
    const systemMetricsWidget = new cloudwatch.GraphWidget({
      title: 'System Metrics',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/ECS',
          metricName: 'CPUUtilization',
          dimensionsMap: {
            ServiceName: `task-queue-${props.environment}`,
            ClusterName: `task-queue-${props.environment}`,
          },
          statistic: 'Average',
        }),
        new cloudwatch.Metric({
          namespace: 'AWS/ECS',
          metricName: 'MemoryUtilization',
          dimensionsMap: {
            ServiceName: `task-queue-${props.environment}`,
            ClusterName: `task-queue-${props.environment}`,
          },
          statistic: 'Average',
        }),
      ],
    });

    // Add widgets to dashboard
    dashboard.addWidgets(taskQueueWidget);
    dashboard.addWidgets(errorRateWidget, systemMetricsWidget);

    return dashboard;
  }

  private createAlarms(props: ProductionMonitoringStackProps) {
    // High Error Rate Alarm
    const highErrorRateAlarm = new cloudwatch.Alarm(this, 'HighErrorRateAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'TaskQueue/Production',
        metricName: 'ErrorRate',
        dimensionsMap: {
          Environment: props.environment,
          Service: 'TaskQueue',
        },
        statistic: 'Average',
      }),
      threshold: 5, // 5% error rate
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Task queue error rate is too high',
    });

    highErrorRateAlarm.addAlarmAction(
      new cdk.aws_cloudwatch_actions.SnsAction(this.alertingTopic)
    );

    // High Queue Depth Alarm
    const highQueueDepthAlarm = new cloudwatch.Alarm(this, 'HighQueueDepthAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'TaskQueue/Production',
        metricName: 'QueueDepth',
        dimensionsMap: {
          Environment: props.environment,
          Service: 'TaskQueue',
        },
        statistic: 'Average',
      }),
      threshold: 100,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Task queue depth is too high',
    });

    highQueueDepthAlarm.addAlarmAction(
      new cdk.aws_cloudwatch_actions.SnsAction(this.alertingTopic)
    );

    // Low Processing Rate Alarm
    const lowProcessingRateAlarm = new cloudwatch.Alarm(this, 'LowProcessingRateAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'TaskQueue/Production',
        metricName: 'ProcessingRate',
        dimensionsMap: {
          Environment: props.environment,
          Service: 'TaskQueue',
        },
        statistic: 'Average',
      }),
      threshold: 1, // Less than 1 task per minute
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods: 5,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
      alarmDescription: 'Task processing rate is too low',
    });

    lowProcessingRateAlarm.addAlarmAction(
      new cdk.aws_cloudwatch_actions.SnsAction(this.alertingTopic)
    );

    // High CPU Utilization Alarm
    const highCpuAlarm = new cloudwatch.Alarm(this, 'HighCpuAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'CPUUtilization',
        dimensionsMap: {
          ServiceName: `task-queue-${props.environment}`,
          ClusterName: `task-queue-${props.environment}`,
        },
        statistic: 'Average',
      }),
      threshold: 80, // 80% CPU utilization
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'ECS service CPU utilization is too high',
    });

    highCpuAlarm.addAlarmAction(
      new cdk.aws_cloudwatch_actions.SnsAction(this.alertingTopic)
    );

    // High Memory Utilization Alarm
    const highMemoryAlarm = new cloudwatch.Alarm(this, 'HighMemoryAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'MemoryUtilization',
        dimensionsMap: {
          ServiceName: `task-queue-${props.environment}`,
          ClusterName: `task-queue-${props.environment}`,
        },
        statistic: 'Average',
      }),
      threshold: 85, // 85% memory utilization
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'ECS service memory utilization is too high',
    });

    highMemoryAlarm.addAlarmAction(
      new cdk.aws_cloudwatch_actions.SnsAction(this.alertingTopic)
    );
  }

  private createCustomMonitoring(props: ProductionMonitoringStackProps, monitoringFunction: lambda.Function) {
    // Create custom log insights queries
    const logInsightsQueries = [
      {
        name: 'ErrorAnalysis',
        query: `
          fields @timestamp, @message
          | filter @message like /ERROR/
          | stats count() by bin(5m)
          | sort @timestamp desc
        `,
      },
      {
        name: 'PerformanceAnalysis',
        query: `
          fields @timestamp, @message
          | filter @message like /duration/
          | parse @message /duration: (?<duration>\\d+)ms/
          | stats avg(duration), max(duration), min(duration) by bin(5m)
          | sort @timestamp desc
        `,
      },
      {
        name: 'TaskProcessingAnalysis',
        query: `
          fields @timestamp, @message
          | filter @message like /task.*completed/
          | stats count() by bin(1m)
          | sort @timestamp desc
        `,
      },
    ];

    // Store queries as parameters for easy access
    logInsightsQueries.forEach((query, index) => {
      new cdk.CfnParameter(this, `LogInsightsQuery${index}`, {
        type: 'String',
        default: query.query,
        description: `Log Insights Query: ${query.name}`,
      });
    });

    // Create composite alarm for overall system health
    const systemHealthAlarm = new cloudwatch.CompositeAlarm(this, 'SystemHealthAlarm', {
      compositeAlarmName: `task-queue-${props.environment}-system-health`,
      alarmDescription: 'Overall system health composite alarm',
      alarmRule: cloudwatch.AlarmRule.anyOf(
        cloudwatch.AlarmRule.fromAlarm(
          cloudwatch.Alarm.fromAlarmArn(this, 'HighErrorRateAlarmRef', 
            `arn:aws:cloudwatch:${this.region}:${this.account}:alarm:HighErrorRateAlarm`
          ),
          cloudwatch.AlarmState.ALARM
        ),
        cloudwatch.AlarmRule.fromAlarm(
          cloudwatch.Alarm.fromAlarmArn(this, 'HighQueueDepthAlarmRef',
            `arn:aws:cloudwatch:${this.region}:${this.account}:alarm:HighQueueDepthAlarm`
          ),
          cloudwatch.AlarmState.ALARM
        )
      ),
    });

    systemHealthAlarm.addAlarmAction(
      new cdk.aws_cloudwatch_actions.SnsAction(this.alertingTopic)
    );
  }
}