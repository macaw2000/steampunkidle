/**
 * ECS Fargate service for continuous game engine processing
 * Enhanced with auto-scaling, monitoring, and CloudWatch integration
 */

import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as applicationautoscaling from 'aws-cdk-lib/aws-applicationautoscaling';
import { Construct } from 'constructs';

export interface FargateGameEngineProps {
  vpc: ec2.Vpc;
  tableNames: {
    taskQueues: string;
    characters: string;
    users: string;
  };
  alertingEmail?: string;
  environment?: string;
}

export class FargateGameEngine extends Construct {
  public readonly service: ecs.FargateService;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  public readonly cluster: ecs.Cluster;
  public readonly taskDefinition: ecs.FargateTaskDefinition;
  // Scalable target is managed internally
  public readonly logGroup: logs.LogGroup;
  public readonly alarmTopic: sns.Topic;
  public readonly targetGroup: elbv2.ApplicationTargetGroup;
  public readonly listener: elbv2.ApplicationListener;

  constructor(scope: Construct, id: string, props: FargateGameEngineProps) {
    super(scope, id);

    // Create SNS Topic for Alerts
    this.alarmTopic = new sns.Topic(this, 'GameEngineAlarmTopic', {
      topicName: `steampunk-game-engine-alerts-${props.environment || 'dev'}`,
      displayName: 'Steampunk Game Engine Alerts',
    });

    // Subscribe email to alerts if provided
    if (props.alertingEmail) {
      this.alarmTopic.addSubscription(
        new subscriptions.EmailSubscription(props.alertingEmail)
      );
    }

    // Create ECS Cluster with enhanced configuration
    this.cluster = new ecs.Cluster(this, 'GameEngineCluster', {
      vpc: props.vpc,
      clusterName: `steampunk-idle-game-cluster-${props.environment || 'dev'}`,
      containerInsights: true,
      enableFargateCapacityProviders: true,
    });

    // Create CloudWatch Log Group with structured logging
    this.logGroup = new logs.LogGroup(this, 'GameEngineLogGroup', {
      logGroupName: `/ecs/steampunk-idle-game-engine-${props.environment || 'dev'}`,
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create Task Definition with enhanced configuration
    this.taskDefinition = new ecs.FargateTaskDefinition(this, 'GameEngineTaskDef', {
      memoryLimitMiB: 1024,
      cpu: 512,
      family: `steampunk-idle-game-engine-${props.environment || 'dev'}`,
      runtimePlatform: {
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
      },
    });

    // Add comprehensive permissions to task role
    (this.taskDefinition.taskRole as iam.Role).addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
          'dynamodb:Query',
          'dynamodb:Scan',
          'dynamodb:BatchGetItem',
          'dynamodb:BatchWriteItem',
        ],
        resources: [
          `arn:aws:dynamodb:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:table/${props.tableNames.taskQueues}`,
          `arn:aws:dynamodb:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:table/${props.tableNames.taskQueues}/index/*`,
          `arn:aws:dynamodb:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:table/${props.tableNames.characters}`,
          `arn:aws:dynamodb:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:table/${props.tableNames.characters}/index/*`,
          `arn:aws:dynamodb:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:table/${props.tableNames.users}`,
          `arn:aws:dynamodb:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:table/${props.tableNames.users}/index/*`,
        ],
      })
    );

    // Add CloudWatch permissions for custom metrics
    (this.taskDefinition.taskRole as iam.Role).addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cloudwatch:PutMetricData',
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: ['*'],
      })
    );

    // Add Container to Task Definition with enhanced configuration
    const container = this.taskDefinition.addContainer('GameEngineContainer', {
      image: ecs.ContainerImage.fromAsset('./src/server', {
        file: 'Dockerfile',
      }),
      environment: {
        NODE_ENV: props.environment || 'production',
        PORT: '3001',
        AWS_REGION: cdk.Stack.of(this).region,
        TASK_QUEUES_TABLE: props.tableNames.taskQueues,
        CHARACTERS_TABLE: props.tableNames.characters,
        USERS_TABLE: props.tableNames.users,
        LOG_LEVEL: 'info',
        METRICS_NAMESPACE: 'SteampunkIdleGame/GameEngine',
        ENVIRONMENT: props.environment || 'dev',
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'game-engine',
        logGroup: this.logGroup,
        datetimeFormat: '%Y-%m-%d %H:%M:%S',
      }),
      healthCheck: {
        command: ['CMD-SHELL', 'node -e "require(\'http\').get(\'http://localhost:3001/health\', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
      memoryReservationMiB: 512,
      essential: true,
    });

    // Add port mapping
    container.addPortMappings({
      containerPort: 3001,
      protocol: ecs.Protocol.TCP,
    });

    // Create Application Load Balancer with enhanced configuration
    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'GameEngineALB', {
      vpc: props.vpc,
      internetFacing: true,
      loadBalancerName: `steampunk-alb-${props.environment || 'dev'}`,
      deletionProtection: props.environment === 'production',
      idleTimeout: cdk.Duration.seconds(60),
    });

    // Create Target Group with enhanced health checks
    this.targetGroup = new elbv2.ApplicationTargetGroup(this, 'GameEngineTargetGroup', {
      port: 3001,
      protocol: elbv2.ApplicationProtocol.HTTP,
      vpc: props.vpc,
      targetType: elbv2.TargetType.IP,
      targetGroupName: `steampunk-tg-${props.environment || 'dev'}`,
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
      deregistrationDelay: cdk.Duration.seconds(30),
      stickinessCookieDuration: cdk.Duration.hours(1),
    });

    // Add Listener to Load Balancer
    this.listener = this.loadBalancer.addListener('GameEngineListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultTargetGroups: [this.targetGroup],
    });

    // Create Fargate Service with enhanced configuration
    this.service = new ecs.FargateService(this, 'GameEngineService', {
      cluster: this.cluster,
      taskDefinition: this.taskDefinition,
      serviceName: `steampunk-idle-game-engine-${props.environment || 'dev'}`,
      desiredCount: 1, // Start with 1 instance, can scale up later
      assignPublicIp: true,
      healthCheckGracePeriod: cdk.Duration.seconds(120),
      enableExecuteCommand: true, // For debugging
      minHealthyPercent: 50,
      maxHealthyPercent: 200,
      // Deployment configuration will be handled separately
      capacityProviderStrategies: [
        {
          capacityProvider: 'FARGATE',
          weight: 1,
        },
        {
          capacityProvider: 'FARGATE_SPOT',
          weight: 0, // Can be increased for cost optimization in non-prod
        },
      ],
    });

    // Attach service to target group
    this.service.attachToApplicationTargetGroup(this.targetGroup);

    // Enhanced Auto Scaling Configuration
    const scalableTaskCount = this.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: props.environment === 'production' ? 5 : 3,
    });

    // CPU-based scaling with optimized thresholds
    scalableTaskCount.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.minutes(5),
      scaleOutCooldown: cdk.Duration.minutes(2),
      disableScaleIn: false,
    });

    // Memory-based scaling with optimized thresholds
    scalableTaskCount.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.minutes(5),
      scaleOutCooldown: cdk.Duration.minutes(2),
      disableScaleIn: false,
    });

    // Custom metric scaling based on active task queues
    scalableTaskCount.scaleOnMetric('ActiveTaskQueuesScaling', {
      metric: new cloudwatch.Metric({
        namespace: 'SteampunkIdleGame/GameEngine',
        metricName: 'ActiveTaskQueues',
        statistic: 'Average',
        period: cdk.Duration.minutes(1),
      }),
      scalingSteps: [
        { upper: 10, change: 0 },
        { lower: 10, upper: 50, change: +1 },
        { lower: 50, upper: 100, change: +2 },
        { lower: 100, change: +3 },
      ],
      adjustmentType: applicationautoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
      cooldown: cdk.Duration.minutes(3),
    });

    // Create comprehensive CloudWatch monitoring and alarms
    this.createMonitoringAlarms();

    // Output the load balancer DNS name
    new cdk.CfnOutput(this, 'GameEngineURL', {
      value: `http://${this.loadBalancer.loadBalancerDnsName}`,
      description: 'Game Engine API URL',
      exportName: `SteampunkGameEngineURL-${props.environment || 'dev'}`,
    });

    // Output the service ARN
    new cdk.CfnOutput(this, 'GameEngineServiceArn', {
      value: this.service.serviceArn,
      description: 'Game Engine Service ARN',
      exportName: `SteampunkGameEngineServiceArn-${props.environment || 'dev'}`,
    });

    // Output the cluster name
    new cdk.CfnOutput(this, 'GameEngineClusterName', {
      value: this.cluster.clusterName,
      description: 'Game Engine Cluster Name',
      exportName: `SteampunkGameEngineClusterName-${props.environment || 'dev'}`,
    });

    // Output the log group name
    new cdk.CfnOutput(this, 'GameEngineLogGroupName', {
      value: this.logGroup.logGroupName,
      description: 'Game Engine Log Group Name',
      exportName: `SteampunkGameEngineLogGroupName-${props.environment || 'dev'}`,
    });
  }

  /**
   * Create comprehensive CloudWatch monitoring and alarms
   */
  private createMonitoringAlarms(): void {
    // Service-level alarms using manual CloudWatch metrics
    const serviceHighCpuAlarm = new cloudwatch.Alarm(this, 'ServiceHighCpuAlarm', {
      alarmName: `${this.service.serviceName}-high-cpu`,
      alarmDescription: 'Game Engine service CPU utilization is high',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'CPUUtilization',
        dimensionsMap: {
          ServiceName: this.service.serviceName,
          ClusterName: this.cluster.clusterName,
        },
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 80,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    const serviceHighMemoryAlarm = new cloudwatch.Alarm(this, 'ServiceHighMemoryAlarm', {
      alarmName: `${this.service.serviceName}-high-memory`,
      alarmDescription: 'Game Engine service memory utilization is high',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'MemoryUtilization',
        dimensionsMap: {
          ServiceName: this.service.serviceName,
          ClusterName: this.cluster.clusterName,
        },
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 85,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    const serviceTaskCountAlarm = new cloudwatch.Alarm(this, 'ServiceTaskCountAlarm', {
      alarmName: `${this.service.serviceName}-no-running-tasks`,
      alarmDescription: 'Game Engine service has no running tasks',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'RunningTaskCount',
        dimensionsMap: {
          ServiceName: this.service.serviceName,
          ClusterName: this.cluster.clusterName,
        },
        period: cdk.Duration.minutes(1),
        statistic: 'Average',
      }),
      threshold: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods: 3,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });

    // Load balancer alarms
    const targetGroupUnhealthyAlarm = new cloudwatch.Alarm(this, 'TargetGroupUnhealthyAlarm', {
      alarmName: `${this.service.serviceName}-unhealthy-targets`,
      alarmDescription: 'Game Engine has unhealthy targets',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'UnHealthyHostCount',
        dimensionsMap: {
          TargetGroup: this.targetGroup.targetGroupFullName,
          LoadBalancer: this.loadBalancer.loadBalancerFullName,
        },
        period: cdk.Duration.minutes(1),
        statistic: 'Average',
      }),
      threshold: 0,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    const highResponseTimeAlarm = new cloudwatch.Alarm(this, 'HighResponseTimeAlarm', {
      alarmName: `${this.service.serviceName}-high-response-time`,
      alarmDescription: 'Game Engine response time is high',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'TargetResponseTime',
        dimensionsMap: {
          TargetGroup: this.targetGroup.targetGroupFullName,
          LoadBalancer: this.loadBalancer.loadBalancerFullName,
        },
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 5, // 5 seconds
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    const highErrorRateAlarm = new cloudwatch.Alarm(this, 'HighErrorRateAlarm', {
      alarmName: `${this.service.serviceName}-high-error-rate`,
      alarmDescription: 'Game Engine error rate is high',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'HTTPCode_Target_5XX_Count',
        dimensionsMap: {
          TargetGroup: this.targetGroup.targetGroupFullName,
          LoadBalancer: this.loadBalancer.loadBalancerFullName,
        },
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 10,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Custom application metrics alarms
    const taskProcessingErrorsAlarm = new cloudwatch.Alarm(this, 'TaskProcessingErrorsAlarm', {
      alarmName: `${this.service.serviceName}-task-processing-errors`,
      alarmDescription: 'High number of task processing errors',
      metric: new cloudwatch.Metric({
        namespace: 'SteampunkIdleGame/GameEngine',
        metricName: 'TaskProcessingErrors',
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 50,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    const queueBacklogAlarm = new cloudwatch.Alarm(this, 'QueueBacklogAlarm', {
      alarmName: `${this.service.serviceName}-queue-backlog`,
      alarmDescription: 'Task queue backlog is growing',
      metric: new cloudwatch.Metric({
        namespace: 'SteampunkIdleGame/GameEngine',
        metricName: 'QueueBacklog',
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 1000,
      evaluationPeriods: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Add all alarms to SNS topic
    const alarms = [
      serviceHighCpuAlarm,
      serviceHighMemoryAlarm,
      serviceTaskCountAlarm,
      targetGroupUnhealthyAlarm,
      highResponseTimeAlarm,
      highErrorRateAlarm,
      taskProcessingErrorsAlarm,
      queueBacklogAlarm,
    ];

    alarms.forEach(alarm => {
      alarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));
      alarm.addOkAction(new cloudwatchActions.SnsAction(this.alarmTopic));
    });

    // Create CloudWatch Dashboard
    const dashboard = new cloudwatch.Dashboard(this, 'GameEngineDashboard', {
      dashboardName: `SteampunkGameEngine-${this.service.serviceName}`,
      widgets: [
        [
          new cloudwatch.GraphWidget({
            title: 'Service Metrics',
            left: [
              new cloudwatch.Metric({
                namespace: 'AWS/ECS',
                metricName: 'CPUUtilization',
                dimensionsMap: {
                  ServiceName: this.service.serviceName,
                  ClusterName: this.cluster.clusterName,
                },
                period: cdk.Duration.minutes(5),
                statistic: 'Average',
              }),
              new cloudwatch.Metric({
                namespace: 'AWS/ECS',
                metricName: 'MemoryUtilization',
                dimensionsMap: {
                  ServiceName: this.service.serviceName,
                  ClusterName: this.cluster.clusterName,
                },
                period: cdk.Duration.minutes(5),
                statistic: 'Average',
              }),
            ],
            right: [
              new cloudwatch.Metric({
                namespace: 'AWS/ECS',
                metricName: 'RunningTaskCount',
                dimensionsMap: {
                  ServiceName: this.service.serviceName,
                  ClusterName: this.cluster.clusterName,
                },
                period: cdk.Duration.minutes(5),
                statistic: 'Average',
              }),
            ],
            period: cdk.Duration.minutes(5),
            width: 12,
          }),
        ],
        [
          new cloudwatch.GraphWidget({
            title: 'Load Balancer Metrics',
            left: [
              new cloudwatch.Metric({
                namespace: 'AWS/ApplicationELB',
                metricName: 'RequestCount',
                dimensionsMap: {
                  LoadBalancer: this.loadBalancer.loadBalancerFullName,
                },
                period: cdk.Duration.minutes(5),
                statistic: 'Sum',
              }),
              new cloudwatch.Metric({
                namespace: 'AWS/ApplicationELB',
                metricName: 'TargetResponseTime',
                dimensionsMap: {
                  LoadBalancer: this.loadBalancer.loadBalancerFullName,
                },
                period: cdk.Duration.minutes(5),
                statistic: 'Average',
              }),
            ],
            right: [
              new cloudwatch.Metric({
                namespace: 'AWS/ApplicationELB',
                metricName: 'HTTPCode_Target_2XX_Count',
                dimensionsMap: {
                  LoadBalancer: this.loadBalancer.loadBalancerFullName,
                },
                period: cdk.Duration.minutes(5),
                statistic: 'Sum',
              }),
              new cloudwatch.Metric({
                namespace: 'AWS/ApplicationELB',
                metricName: 'HTTPCode_Target_5XX_Count',
                dimensionsMap: {
                  LoadBalancer: this.loadBalancer.loadBalancerFullName,
                },
                period: cdk.Duration.minutes(5),
                statistic: 'Sum',
              }),
            ],
            width: 12,
          }),
        ],
        [
          new cloudwatch.GraphWidget({
            title: 'Custom Application Metrics',
            left: [
              new cloudwatch.Metric({
                namespace: 'SteampunkIdleGame/GameEngine',
                metricName: 'ActiveTaskQueues',
                period: cdk.Duration.minutes(5),
                statistic: 'Average',
              }),
              new cloudwatch.Metric({
                namespace: 'SteampunkIdleGame/GameEngine',
                metricName: 'TasksProcessedPerSecond',
                period: cdk.Duration.minutes(5),
                statistic: 'Average',
              }),
            ],
            right: [
              new cloudwatch.Metric({
                namespace: 'SteampunkIdleGame/GameEngine',
                metricName: 'TaskProcessingErrors',
                period: cdk.Duration.minutes(5),
                statistic: 'Sum',
              }),
              new cloudwatch.Metric({
                namespace: 'SteampunkIdleGame/GameEngine',
                metricName: 'QueueBacklog',
                period: cdk.Duration.minutes(5),
                statistic: 'Average',
              }),
            ],
            width: 12,
          }),
        ],
      ],
    });
  }
}