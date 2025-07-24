/**
 * ECS Fargate service for continuous game engine processing
 */

import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface FargateGameEngineProps {
  vpc: ec2.Vpc;
  tableNames: {
    taskQueues: string;
    characters: string;
    users: string;
  };
}

export class FargateGameEngine extends Construct {
  public readonly service: ecs.FargateService;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props: FargateGameEngineProps) {
    super(scope, id);

    // Create ECS Cluster
    const cluster = new ecs.Cluster(this, 'GameEngineCluster', {
      vpc: props.vpc,
      clusterName: 'steampunk-idle-game-cluster',
      containerInsights: true,
    });

    // Create CloudWatch Log Group
    const logGroup = new logs.LogGroup(this, 'GameEngineLogGroup', {
      logGroupName: '/ecs/steampunk-idle-game-engine',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'GameEngineTaskDef', {
      memoryLimitMiB: 1024,
      cpu: 512,
      family: 'steampunk-idle-game-engine',
    });

    // Add DynamoDB permissions to task role
    (taskDefinition.taskRole as iam.Role).addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
          'dynamodb:Query',
          'dynamodb:Scan',
        ],
        resources: [
          `arn:aws:dynamodb:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:table/${props.tableNames.taskQueues}`,
          `arn:aws:dynamodb:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:table/${props.tableNames.characters}`,
          `arn:aws:dynamodb:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:table/${props.tableNames.users}`,
        ],
      })
    );

    // Add Container to Task Definition
    const container = taskDefinition.addContainer('GameEngineContainer', {
      image: ecs.ContainerImage.fromAsset('../src/server', {
        file: 'Dockerfile',
      }),
      environment: {
        NODE_ENV: 'production',
        PORT: '3001',
        AWS_REGION: cdk.Stack.of(this).region,
        TASK_QUEUES_TABLE: props.tableNames.taskQueues,
        CHARACTERS_TABLE: props.tableNames.characters,
        USERS_TABLE: props.tableNames.users,
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'game-engine',
        logGroup: logGroup,
      }),
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:3001/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // Add port mapping
    container.addPortMappings({
      containerPort: 3001,
      protocol: ecs.Protocol.TCP,
    });

    // Create Application Load Balancer
    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'GameEngineALB', {
      vpc: props.vpc,
      internetFacing: true,
      loadBalancerName: 'steampunk-game-engine-alb',
    });

    // Create Target Group
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'GameEngineTargetGroup', {
      port: 3001,
      protocol: elbv2.ApplicationProtocol.HTTP,
      vpc: props.vpc,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        enabled: true,
        path: '/health',
        protocol: elbv2.Protocol.HTTP,
        port: '3001',
        healthyHttpCodes: '200',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    // Add Listener to Load Balancer
    this.loadBalancer.addListener('GameEngineListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultTargetGroups: [targetGroup],
    });

    // Create Fargate Service
    this.service = new ecs.FargateService(this, 'GameEngineService', {
      cluster: cluster,
      taskDefinition: taskDefinition,
      serviceName: 'steampunk-idle-game-engine',
      desiredCount: 1, // Start with 1 instance, can scale up later
      assignPublicIp: true,
      healthCheckGracePeriod: cdk.Duration.seconds(120),
      enableExecuteCommand: true, // For debugging
    });

    // Attach service to target group
    this.service.attachToApplicationTargetGroup(targetGroup);

    // Auto Scaling Configuration
    const scaling = this.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 3,
    });

    // Scale up when CPU > 70%
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.minutes(5),
      scaleOutCooldown: cdk.Duration.minutes(2),
    });

    // Scale up when memory > 80%
    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.minutes(5),
      scaleOutCooldown: cdk.Duration.minutes(2),
    });

    // Output the load balancer DNS name
    new cdk.CfnOutput(this, 'GameEngineURL', {
      value: `http://${this.loadBalancer.loadBalancerDnsName}`,
      description: 'Game Engine API URL',
      exportName: 'SteampunkGameEngineURL',
    });

    // Output the service ARN
    new cdk.CfnOutput(this, 'GameEngineServiceArn', {
      value: this.service.serviceArn,
      description: 'Game Engine Service ARN',
      exportName: 'SteampunkGameEngineServiceArn',
    });
  }
}