import * as cdk from 'aws-cdk-lib';
import * as codedeploy from 'aws-cdk-lib/aws-codedeploy';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

export interface DeploymentConfigProps {
  environment: string;
  lambdaFunctions: lambda.Function[];
  notificationEmail?: string;
}

export class DeploymentConfig extends Construct {
  public readonly deploymentGroup: codedeploy.LambdaDeploymentGroup;
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: DeploymentConfigProps) {
    super(scope, id);

    // SNS Topic for deployment notifications
    this.alarmTopic = new sns.Topic(this, 'DeploymentAlarmTopic', {
      displayName: `Steampunk Idle Game ${props.environment} Deployment Alerts`,
    });

    if (props.notificationEmail) {
      this.alarmTopic.addSubscription(
        new subscriptions.EmailSubscription(props.notificationEmail)
      );
    }

    // CloudWatch Alarms for deployment monitoring
    const errorAlarms: cloudwatch.Alarm[] = [];
    const durationAlarms: cloudwatch.Alarm[] = [];

    props.lambdaFunctions.forEach((func, index) => {
      // Error rate alarm
      const errorAlarm = new cloudwatch.Alarm(this, `ErrorAlarm${index}`, {
        metric: func.metricErrors({
          period: cdk.Duration.minutes(1),
        }),
        threshold: 5,
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: `Error rate too high for ${func.functionName}`,
      });

      errorAlarm.addAlarmAction(
        new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic)
      );

      errorAlarms.push(errorAlarm);

      // Duration alarm
      const durationAlarm = new cloudwatch.Alarm(this, `DurationAlarm${index}`, {
        metric: func.metricDuration({
          period: cdk.Duration.minutes(1),
        }),
        threshold: 10000, // 10 seconds
        evaluationPeriods: 3,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: `Duration too high for ${func.functionName}`,
      });

      durationAlarm.addAlarmAction(
        new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic)
      );

      durationAlarms.push(durationAlarm);
    });

    // CodeDeploy Application
    const application = new codedeploy.LambdaApplication(this, 'DeploymentApplication', {
      applicationName: `steampunk-idle-game-${props.environment}`,
    });

    // Deployment Configuration based on environment
    const deploymentConfig = props.environment === 'production'
      ? codedeploy.LambdaDeploymentConfig.CANARY_10PERCENT_5MINUTES
      : codedeploy.LambdaDeploymentConfig.ALL_AT_ONCE;

    // Create deployment group for Lambda functions
    this.deploymentGroup = new codedeploy.LambdaDeploymentGroup(this, 'DeploymentGroup', {
      application,
      deploymentGroupName: `steampunk-idle-game-${props.environment}-deployment-group`,
      deploymentConfig,
      alarms: [...errorAlarms, ...durationAlarms],
      autoRollback: {
        failedDeployment: true,
        stoppedDeployment: true,
        deploymentInAlarm: true,
      },
      preHook: this.createPreDeploymentHook(),
      postHook: this.createPostDeploymentHook(),
    });
  }

  private createPreDeploymentHook(): lambda.Function {
    return new lambda.Function(this, 'PreDeploymentHook', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const { CodeDeployClient, PutLifecycleEventHookExecutionStatusCommand } = require('@aws-sdk/client-codedeploy');
        const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

        const codedeploy = new CodeDeployClient({});
        const cloudwatch = new CloudWatchClient({});

        exports.handler = async (event) => {
          console.log('Pre-deployment hook triggered:', JSON.stringify(event, null, 2));
          
          const { DeploymentId, LifecycleEventHookExecutionId } = event;
          
          try {
            // Record deployment start metric
            await cloudwatch.send(new PutMetricDataCommand({
              Namespace: 'SteampunkIdleGame/Deployment',
              MetricData: [{
                MetricName: 'DeploymentStarted',
                Value: 1,
                Unit: 'Count',
                Dimensions: [{
                  Name: 'Environment',
                  Value: process.env.ENVIRONMENT || 'unknown'
                }]
              }]
            }));

            // Perform pre-deployment checks
            console.log('Running pre-deployment health checks...');
            
            // Add any pre-deployment validation logic here
            // For example: check database connectivity, validate configuration, etc.
            
            await codedeploy.send(new PutLifecycleEventHookExecutionStatusCommand({
              deploymentId: DeploymentId,
              lifecycleEventHookExecutionId: LifecycleEventHookExecutionId,
              status: 'Succeeded'
            }));
            
            return { statusCode: 200, body: 'Pre-deployment hook completed successfully' };
          } catch (error) {
            console.error('Pre-deployment hook failed:', error);
            
            await codedeploy.send(new PutLifecycleEventHookExecutionStatusCommand({
              deploymentId: DeploymentId,
              lifecycleEventHookExecutionId: LifecycleEventHookExecutionId,
              status: 'Failed'
            }));
            
            throw error;
          }
        };
      `),
      timeout: cdk.Duration.minutes(5),
      environment: {
        ENVIRONMENT: this.node.tryGetContext('environment') || 'development',
      },
    });
  }

  private createPostDeploymentHook(): lambda.Function {
    return new lambda.Function(this, 'PostDeploymentHook', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const { CodeDeployClient, PutLifecycleEventHookExecutionStatusCommand } = require('@aws-sdk/client-codedeploy');
        const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

        const codedeploy = new CodeDeployClient({});
        const cloudwatch = new CloudWatchClient({});

        exports.handler = async (event) => {
          console.log('Post-deployment hook triggered:', JSON.stringify(event, null, 2));
          
          const { DeploymentId, LifecycleEventHookExecutionId } = event;
          
          try {
            // Record deployment completion metric
            await cloudwatch.send(new PutMetricDataCommand({
              Namespace: 'SteampunkIdleGame/Deployment',
              MetricData: [{
                MetricName: 'DeploymentCompleted',
                Value: 1,
                Unit: 'Count',
                Dimensions: [{
                  Name: 'Environment',
                  Value: process.env.ENVIRONMENT || 'unknown'
                }]
              }]
            }));

            // Perform post-deployment validation
            console.log('Running post-deployment validation...');
            
            // Add post-deployment validation logic here
            // For example: smoke tests, health checks, etc.
            
            await codedeploy.send(new PutLifecycleEventHookExecutionStatusCommand({
              deploymentId: DeploymentId,
              lifecycleEventHookExecutionId: LifecycleEventHookExecutionId,
              status: 'Succeeded'
            }));
            
            return { statusCode: 200, body: 'Post-deployment hook completed successfully' };
          } catch (error) {
            console.error('Post-deployment hook failed:', error);
            
            await codedeploy.send(new PutLifecycleEventHookExecutionStatusCommand({
              deploymentId: DeploymentId,
              lifecycleEventHookExecutionId: LifecycleEventHookExecutionId,
              status: 'Failed'
            }));
            
            throw error;
          }
        };
      `),
      timeout: cdk.Duration.minutes(5),
      environment: {
        ENVIRONMENT: this.node.tryGetContext('environment') || 'development',
      },
    });
  }
}