import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export interface BlueGreenDeploymentStackProps extends cdk.StackProps {
  environment: string;
  version: string;
  activeEnvironment?: 'blue' | 'green';
  domainName?: string;
  hostedZoneId?: string;
}

export class BlueGreenDeploymentStack extends cdk.Stack {
  public readonly blueEnvironment: TaskQueueEnvironment;
  public readonly greenEnvironment: TaskQueueEnvironment;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  public readonly domainRecord?: route53.ARecord;

  constructor(scope: Construct, id: string, props: BlueGreenDeploymentStackProps) {
    super(scope, id, props);

    // Create VPC for the deployment
    const vpc = new ec2.Vpc(this, 'TaskQueueVPC', {
      maxAzs: 3,
      natGateways: 2,
      enableDnsHostnames: true,
      enableDnsSupport: true,
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

    // Create ECS Cluster
    const cluster = new ecs.Cluster(this, 'TaskQueueCluster', {
      vpc,
      clusterName: `task-queue-${props.environment}`,
      containerInsights: true,
    });

    // Create Application Load Balancer
    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'TaskQueueALB', {
      vpc,
      internetFacing: true,
      loadBalancerName: `task-queue-${props.environment}-alb`,
    });

    // Create Blue Environment
    this.blueEnvironment = new TaskQueueEnvironment(this, 'BlueEnvironment', {
      vpc,
      cluster,
      environmentName: 'blue',
      version: props.version,
      loadBalancer: this.loadBalancer,
      listenerPort: 8080,
    });

    // Create Green Environment
    this.greenEnvironment = new TaskQueueEnvironment(this, 'GreenEnvironment', {
      vpc,
      cluster,
      environmentName: 'green',
      version: props.version,
      loadBalancer: this.loadBalancer,
      listenerPort: 8081,
    });

    // Create main listener that routes to active environment
    const mainListener = this.loadBalancer.addListener('MainListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.forward([
        props.activeEnvironment === 'green' 
          ? this.greenEnvironment.targetGroup 
          : this.blueEnvironment.targetGroup
      ]),
    });

    // Create HTTPS listener if domain is provided
    if (props.domainName && props.hostedZoneId) {
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
        hostedZoneId: props.hostedZoneId,
        zoneName: props.domainName,
      });

      // Create domain record pointing to load balancer
      this.domainRecord = new route53.ARecord(this, 'DomainRecord', {
        zone: hostedZone,
        recordName: `task-queue-${props.environment}`,
        target: route53.RecordTarget.fromAlias(
          new route53targets.LoadBalancerTarget(this.loadBalancer)
        ),
      });
    }

    // Create monitoring and alerting
    this.createMonitoringAndAlerting(props);

    // Output important values
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: this.loadBalancer.loadBalancerDnsName,
      description: 'Load Balancer DNS Name',
    });

    new cdk.CfnOutput(this, 'BlueEnvironmentEndpoint', {
      value: `http://${this.loadBalancer.loadBalancerDnsName}:8080`,
      description: 'Blue Environment Direct Endpoint',
    });

    new cdk.CfnOutput(this, 'GreenEnvironmentEndpoint', {
      value: `http://${this.loadBalancer.loadBalancerDnsName}:8081`,
      description: 'Green Environment Direct Endpoint',
    });

    new cdk.CfnOutput(this, 'ActiveEnvironment', {
      value: props.activeEnvironment || 'blue',
      description: 'Currently Active Environment',
    });
  }

  private createMonitoringAndAlerting(props: BlueGreenDeploymentStackProps) {
    // Create SNS topic for deployment notifications
    const deploymentTopic = new sns.Topic(this, 'DeploymentNotifications', {
      topicName: `task-queue-${props.environment}-deployments`,
      displayName: 'Task Queue Deployment Notifications',
    });

    // Create CloudWatch alarms for both environments
    const blueHealthAlarm = new cloudwatch.Alarm(this, 'BlueHealthAlarm', {
      metric: this.blueEnvironment.targetGroup.metricHealthyHostCount(),
      threshold: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods: 2,
      alarmDescription: 'Blue environment has no healthy hosts',
    });

    const greenHealthAlarm = new cloudwatch.Alarm(this, 'GreenHealthAlarm', {
      metric: this.greenEnvironment.targetGroup.metricHealthyHostCount(),
      threshold: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods: 2,
      alarmDescription: 'Green environment has no healthy hosts',
    });

    // Create Lambda function for deployment automation
    const deploymentAutomationFunction = new lambda.Function(this, 'DeploymentAutomation', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const cloudformation = new AWS.CloudFormation();
        const sns = new AWS.SNS();

        exports.handler = async (event) => {
          console.log('Deployment automation triggered:', JSON.stringify(event, null, 2));
          
          try {
            // Handle different types of deployment events
            if (event.source === 'aws.cloudwatch') {
              // Handle CloudWatch alarm
              await handleHealthAlarm(event);
            } else if (event.action === 'switch-traffic') {
              // Handle traffic switching
              await switchTraffic(event.targetEnvironment);
            } else if (event.action === 'rollback') {
              // Handle rollback
              await rollback(event.targetVersion);
            }
            
            return { statusCode: 200, body: 'Success' };
          } catch (error) {
            console.error('Deployment automation error:', error);
            await sendNotification('FAILED', error.message);
            throw error;
          }
        };

        async function handleHealthAlarm(event) {
          const alarmName = event.detail.alarmName;
          const state = event.detail.state.value;
          
          if (state === 'ALARM') {
            console.log(\`Health alarm triggered: \${alarmName}\`);
            await sendNotification('HEALTH_ALARM', \`Health alarm triggered: \${alarmName}\`);
          }
        }

        async function switchTraffic(targetEnvironment) {
          const params = {
            StackName: '${this.stackName}',
            UsePreviousTemplate: true,
            Parameters: [
              {
                ParameterKey: 'ActiveEnvironment',
                ParameterValue: targetEnvironment
              }
            ]
          };
          
          await cloudformation.updateStack(params).promise();
          await sendNotification('TRAFFIC_SWITCH', \`Traffic switched to \${targetEnvironment} environment\`);
        }

        async function rollback(targetVersion) {
          const params = {
            StackName: '${this.stackName}',
            UsePreviousTemplate: true,
            Parameters: [
              {
                ParameterKey: 'Version',
                ParameterValue: targetVersion
              },
              {
                ParameterKey: 'ActiveEnvironment',
                ParameterValue: 'blue'
              }
            ]
          };
          
          await cloudformation.updateStack(params).promise();
          await sendNotification('ROLLBACK', \`Rollback to version \${targetVersion} completed\`);
        }

        async function sendNotification(status, message) {
          const params = {
            TopicArn: '${deploymentTopic.topicArn}',
            Message: JSON.stringify({
              timestamp: new Date().toISOString(),
              status: status,
              message: message,
              environment: '${props.environment}'
            }),
            Subject: \`Task Queue Deployment - \${status}\`
          };
          
          await sns.publish(params).promise();
        }
      `),
      environment: {
        DEPLOYMENT_TOPIC_ARN: deploymentTopic.topicArn,
        STACK_NAME: this.stackName,
      },
    });

    // Grant permissions to the Lambda function
    deploymentTopic.grantPublish(deploymentAutomationFunction);
    deploymentAutomationFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: [
          'cloudformation:UpdateStack',
          'cloudformation:DescribeStacks',
          'cloudformation:DescribeStackEvents',
        ],
        resources: [this.stackArn],
      })
    );

    // Create API Gateway for deployment webhooks
    const deploymentApi = new apigateway.RestApi(this, 'DeploymentAPI', {
      restApiName: `task-queue-${props.environment}-deployment-api`,
      description: 'API for deployment automation',
    });

    const deploymentIntegration = new apigateway.LambdaIntegration(deploymentAutomationFunction);
    
    const deploymentResource = deploymentApi.root.addResource('deploy');
    deploymentResource.addMethod('POST', deploymentIntegration);
    
    const rollbackResource = deploymentApi.root.addResource('rollback');
    rollbackResource.addMethod('POST', deploymentIntegration);

    // Output deployment API endpoint
    new cdk.CfnOutput(this, 'DeploymentAPIEndpoint', {
      value: deploymentApi.url,
      description: 'Deployment API Endpoint',
    });

    new cdk.CfnOutput(this, 'DeploymentTopicArn', {
      value: deploymentTopic.topicArn,
      description: 'Deployment Notifications Topic ARN',
    });
  }
}

interface TaskQueueEnvironmentProps {
  vpc: ec2.Vpc;
  cluster: ecs.Cluster;
  environmentName: string;
  version: string;
  loadBalancer: elbv2.ApplicationLoadBalancer;
  listenerPort: number;
}

class TaskQueueEnvironment extends Construct {
  public readonly service: ecs.FargateService;
  public readonly targetGroup: elbv2.ApplicationTargetGroup;
  public readonly taskDefinition: ecs.FargateTaskDefinition;

  constructor(scope: Construct, id: string, props: TaskQueueEnvironmentProps) {
    super(scope, id);

    // Create task definition
    this.taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDefinition', {
      memoryLimitMiB: 2048,
      cpu: 1024,
      family: `task-queue-${props.environmentName}`,
    });

    // Add container to task definition
    const container = this.taskDefinition.addContainer('TaskQueueContainer', {
      image: ecs.ContainerImage.fromRegistry(`task-queue:${props.version}`),
      memoryLimitMiB: 2048,
      cpu: 1024,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: `task-queue-${props.environmentName}`,
        logRetention: cdk.aws_logs.RetentionDays.ONE_WEEK,
      }),
      environment: {
        NODE_ENV: 'production',
        ENVIRONMENT: props.environmentName,
        VERSION: props.version,
      },
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:3000/api/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    container.addPortMappings({
      containerPort: 3000,
      protocol: ecs.Protocol.TCP,
    });

    // Create Fargate service
    this.service = new ecs.FargateService(this, 'Service', {
      cluster: props.cluster,
      taskDefinition: this.taskDefinition,
      serviceName: `task-queue-${props.environmentName}`,
      desiredCount: 2,
      minHealthyPercent: 50,
      maxHealthyPercent: 200,
      enableExecuteCommand: true,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    // Create target group
    this.targetGroup = new elbv2.ApplicationTargetGroup(this, 'TargetGroup', {
      vpc: props.vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      targetGroupName: `task-queue-${props.environmentName}-tg`,
      healthCheck: {
        enabled: true,
        path: '/health',
        protocol: elbv2.Protocol.HTTP,
        port: '3000',
        healthyHttpCodes: '200',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    // Attach service to target group
    this.service.attachToApplicationTargetGroup(this.targetGroup);

    // Create listener for direct access to this environment
    props.loadBalancer.addListener(`${props.environmentName}Listener`, {
      port: props.listenerPort,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.forward([this.targetGroup]),
    });

    // Auto scaling
    const scaling = this.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 10,
    });

    scaling.scaleOnCpuUtilization(`${props.environmentName}CpuScaling`, {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.minutes(5),
      scaleOutCooldown: cdk.Duration.minutes(2),
    });

    scaling.scaleOnMemoryUtilization(`${props.environmentName}MemoryScaling`, {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.minutes(5),
      scaleOutCooldown: cdk.Duration.minutes(2),
    });
  }
}