import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface AlertingConfigProps {
  environment: string;
  notificationEmail?: string;
  slackWebhookUrl?: string;
  pagerDutyIntegrationKey?: string;
}

export class AlertingConfig extends Construct {
  public readonly criticalAlarmTopic: sns.Topic;
  public readonly warningAlarmTopic: sns.Topic;
  public readonly infoAlarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: AlertingConfigProps) {
    super(scope, id);

    // Create SNS topics for different severity levels
    this.criticalAlarmTopic = new sns.Topic(this, 'CriticalAlarmTopic', {
      displayName: `Steampunk Idle Game ${props.environment} Critical Alerts`,
      topicName: `steampunk-idle-game-${props.environment}-critical`,
    });

    this.warningAlarmTopic = new sns.Topic(this, 'WarningAlarmTopic', {
      displayName: `Steampunk Idle Game ${props.environment} Warning Alerts`,
      topicName: `steampunk-idle-game-${props.environment}-warning`,
    });

    this.infoAlarmTopic = new sns.Topic(this, 'InfoAlarmTopic', {
      displayName: `Steampunk Idle Game ${props.environment} Info Alerts`,
      topicName: `steampunk-idle-game-${props.environment}-info`,
    });

    // Add email subscriptions if provided
    if (props.notificationEmail) {
      this.criticalAlarmTopic.addSubscription(
        new subscriptions.EmailSubscription(props.notificationEmail)
      );
      this.warningAlarmTopic.addSubscription(
        new subscriptions.EmailSubscription(props.notificationEmail)
      );
    }

    // Create Lambda function for Slack notifications
    if (props.slackWebhookUrl) {
      this.createSlackNotificationFunction(props.slackWebhookUrl, props.environment);
    }

    // Create Lambda function for PagerDuty integration
    if (props.pagerDutyIntegrationKey) {
      this.createPagerDutyNotificationFunction(props.pagerDutyIntegrationKey, props.environment);
    }

    // Create composite alarms for intelligent alerting
    this.createCompositeAlarms();

    // Create anomaly detection alarms
    this.createAnomalyDetectionAlarms();
  }

  private createSlackNotificationFunction(webhookUrl: string, environment: string) {
    const slackNotificationFunction = new lambda.Function(this, 'SlackNotificationFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const https = require('https');
        const url = require('url');

        exports.handler = async (event) => {
          console.log('Slack notification triggered:', JSON.stringify(event, null, 2));
          
          const message = JSON.parse(event.Records[0].Sns.Message);
          const subject = event.Records[0].Sns.Subject;
          
          const slackMessage = {
            text: subject,
            attachments: [{
              color: message.NewStateValue === 'ALARM' ? 'danger' : 'good',
              fields: [
                {
                  title: 'Alarm Name',
                  value: message.AlarmName,
                  short: true
                },
                {
                  title: 'State',
                  value: message.NewStateValue,
                  short: true
                },
                {
                  title: 'Reason',
                  value: message.NewStateReason,
                  short: false
                },
                {
                  title: 'Environment',
                  value: '${environment}',
                  short: true
                },
                {
                  title: 'Timestamp',
                  value: message.StateChangeTime,
                  short: true
                }
              ]
            }]
          };

          const webhookUrl = '${webhookUrl}';
          const parsedUrl = url.parse(webhookUrl);
          
          const postData = JSON.stringify(slackMessage);
          
          const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.path,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            }
          };

          return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
              let data = '';
              res.on('data', (chunk) => data += chunk);
              res.on('end', () => {
                if (res.statusCode === 200) {
                  console.log('Slack notification sent successfully');
                  resolve({ statusCode: 200, body: 'Success' });
                } else {
                  console.error('Slack notification failed:', res.statusCode, data);
                  reject(new Error(\`Slack notification failed: \${res.statusCode}\`));
                }
              });
            });

            req.on('error', (error) => {
              console.error('Slack notification error:', error);
              reject(error);
            });

            req.write(postData);
            req.end();
          });
        };
      `),
      timeout: cdk.Duration.seconds(30),
    });

    // Subscribe Slack function to all alarm topics
    this.criticalAlarmTopic.addSubscription(
      new subscriptions.LambdaSubscription(slackNotificationFunction)
    );
    this.warningAlarmTopic.addSubscription(
      new subscriptions.LambdaSubscription(slackNotificationFunction)
    );
  }

  private createPagerDutyNotificationFunction(integrationKey: string, environment: string) {
    const pagerDutyFunction = new lambda.Function(this, 'PagerDutyNotificationFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const https = require('https');

        exports.handler = async (event) => {
          console.log('PagerDuty notification triggered:', JSON.stringify(event, null, 2));
          
          const message = JSON.parse(event.Records[0].Sns.Message);
          const subject = event.Records[0].Sns.Subject;
          
          const severity = message.NewStateValue === 'ALARM' ? 'critical' : 'info';
          const eventAction = message.NewStateValue === 'ALARM' ? 'trigger' : 'resolve';
          
          const pagerDutyEvent = {
            routing_key: '${integrationKey}',
            event_action: eventAction,
            dedup_key: message.AlarmName,
            payload: {
              summary: subject,
              source: '${environment}',
              severity: severity,
              custom_details: {
                alarm_name: message.AlarmName,
                state: message.NewStateValue,
                reason: message.NewStateReason,
                timestamp: message.StateChangeTime,
                environment: '${environment}'
              }
            }
          };

          const postData = JSON.stringify(pagerDutyEvent);
          
          const options = {
            hostname: 'events.pagerduty.com',
            port: 443,
            path: '/v2/enqueue',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            }
          };

          return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
              let data = '';
              res.on('data', (chunk) => data += chunk);
              res.on('end', () => {
                if (res.statusCode === 202) {
                  console.log('PagerDuty notification sent successfully');
                  resolve({ statusCode: 200, body: 'Success' });
                } else {
                  console.error('PagerDuty notification failed:', res.statusCode, data);
                  reject(new Error(\`PagerDuty notification failed: \${res.statusCode}\`));
                }
              });
            });

            req.on('error', (error) => {
              console.error('PagerDuty notification error:', error);
              reject(error);
            });

            req.write(postData);
            req.end();
          });
        };
      `),
      timeout: cdk.Duration.seconds(30),
    });

    // Subscribe PagerDuty function only to critical alarms
    this.criticalAlarmTopic.addSubscription(
      new subscriptions.LambdaSubscription(pagerDutyFunction)
    );
  }

  private createCompositeAlarms() {
    // Create composite alarm for overall system health
    const systemHealthAlarm = new cloudwatch.CompositeAlarm(this, 'SystemHealthAlarm', {
      alarmName: 'steampunk-idle-game-system-health',
      alarmDescription: 'Overall system health composite alarm',
      compositeAlarmRule: cloudwatch.AlarmRule.anyOf(
        cloudwatch.AlarmRule.fromAlarm(
          cloudwatch.Alarm.fromAlarmArn(this, 'LambdaErrorsRef',
            `arn:aws:cloudwatch:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:alarm:*lambda*errors*`
          ),
          cloudwatch.TreatMissingData.NOT_BREACHING
        ),
        cloudwatch.AlarmRule.fromAlarm(
          cloudwatch.Alarm.fromAlarmArn(this, 'DynamoThrottleRef',
            `arn:aws:cloudwatch:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:alarm:*dynamo*throttle*`
          ),
          cloudwatch.TreatMissingData.NOT_BREACHING
        )
      ),
      actionsEnabled: true,
    });

    systemHealthAlarm.addAlarmAction(
      new cdk.aws_cloudwatch_actions.SnsAction(this.criticalAlarmTopic)
    );

    // Create composite alarm for performance degradation
    const performanceAlarm = new cloudwatch.CompositeAlarm(this, 'PerformanceAlarm', {
      alarmName: 'steampunk-idle-game-performance-degradation',
      alarmDescription: 'Performance degradation composite alarm',
      compositeAlarmRule: cloudwatch.AlarmRule.allOf(
        cloudwatch.AlarmRule.fromAlarm(
          cloudwatch.Alarm.fromAlarmArn(this, 'HighDurationRef',
            `arn:aws:cloudwatch:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:alarm:*duration*`
          ),
          cloudwatch.TreatMissingData.NOT_BREACHING
        ),
        cloudwatch.AlarmRule.fromAlarm(
          cloudwatch.Alarm.fromAlarmArn(this, 'SlowRequestsRef',
            `arn:aws:cloudwatch:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:alarm:*slow*requests*`
          ),
          cloudwatch.TreatMissingData.NOT_BREACHING
        )
      ),
      actionsEnabled: true,
    });

    performanceAlarm.addAlarmAction(
      new cdk.aws_cloudwatch_actions.SnsAction(this.warningAlarmTopic)
    );
  }

  private createAnomalyDetectionAlarms() {
    // Create anomaly detector for API request volume
    const apiRequestAnomalyDetector = new cloudwatch.CfnAnomalyDetector(this, 'ApiRequestAnomalyDetector', {
      metricName: 'ApiRequests',
      namespace: 'SteampunkIdleGame/API',
      stat: 'Sum',
      dimensions: [{
        name: 'Environment',
        value: this.node.tryGetContext('environment') || 'development',
      }],
    });

    // Create alarm based on anomaly detection
    const apiRequestAnomalyAlarm = new cloudwatch.CfnAlarm(this, 'ApiRequestAnomalyAlarm', {
      alarmName: 'steampunk-idle-game-api-request-anomaly',
      alarmDescription: 'Anomalous API request volume detected',
      comparisonOperator: 'LessThanLowerOrGreaterThanUpperThreshold',
      evaluationPeriods: 2,
      metrics: [{
        id: 'm1',
        metricStat: {
          metric: {
            metricName: 'ApiRequests',
            namespace: 'SteampunkIdleGame/API',
            dimensions: [{
              name: 'Environment',
              value: this.node.tryGetContext('environment') || 'development',
            }],
          },
          period: 300,
          stat: 'Sum',
        },
      }, {
        id: 'ad1',
        anomalyDetector: {
          metricMathAnomalyDetector: {
            metricDataQueries: [{
              id: 'm1',
              metricStat: {
                metric: {
                  metricName: 'ApiRequests',
                  namespace: 'SteampunkIdleGame/API',
                  dimensions: [{
                    name: 'Environment',
                    value: this.node.tryGetContext('environment') || 'development',
                  }],
                },
                period: 300,
                stat: 'Sum',
              },
            }],
          },
        },
      }],
      thresholdMetricId: 'ad1',
      treatMissingData: 'notBreaching',
      alarmActions: [this.warningAlarmTopic.topicArn],
    });

    // Create anomaly detector for error rates
    const errorRateAnomalyDetector = new cloudwatch.CfnAnomalyDetector(this, 'ErrorRateAnomalyDetector', {
      metricName: 'ErrorCount',
      namespace: 'SteampunkIdleGame/Errors',
      stat: 'Sum',
      dimensions: [{
        name: 'Environment',
        value: this.node.tryGetContext('environment') || 'development',
      }],
    });

    const errorRateAnomalyAlarm = new cloudwatch.CfnAlarm(this, 'ErrorRateAnomalyAlarm', {
      alarmName: 'steampunk-idle-game-error-rate-anomaly',
      alarmDescription: 'Anomalous error rate detected',
      comparisonOperator: 'GreaterThanUpperThreshold',
      evaluationPeriods: 1,
      thresholdMetricId: 'ad2',
      treatMissingData: 'notBreaching',
      alarmActions: [this.criticalAlarmTopic.topicArn],
    });
  }
}
