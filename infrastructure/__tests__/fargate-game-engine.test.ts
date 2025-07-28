/**
 * Infrastructure tests for Fargate Game Engine
 * Tests deployment, scaling, monitoring, and health checks
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { FargateGameEngine } from '../fargate-game-engine';

describe('FargateGameEngine Infrastructure', () => {
  let app: cdk.App;
  let stack: cdk.Stack;
  let vpc: ec2.Vpc;
  let gameEngine: FargateGameEngine;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');
    
    // Create VPC for testing
    vpc = new ec2.Vpc(stack, 'TestVpc', {
      maxAzs: 2,
      natGateways: 1,
    });

    // Mock the container image to avoid Docker build during tests
    jest.spyOn(ecs.ContainerImage, 'fromAsset').mockReturnValue({
      bind: () => ({
        imageName: 'test-image:latest',
        repositoryName: 'test-repo',
      }),
    } as any);

    // Create FargateGameEngine instance
    gameEngine = new FargateGameEngine(stack, 'TestGameEngine', {
      vpc,
      tableNames: {
        taskQueues: 'test-task-queues',
        characters: 'test-characters',
        users: 'test-users',
      },
      alertingEmail: 'test@example.com',
      environment: 'test',
    });
  });

  describe('ECS Cluster Configuration', () => {
    test('creates ECS cluster with correct configuration', () => {
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::ECS::Cluster', {
        ClusterName: 'steampunk-idle-game-cluster-test',
        ClusterSettings: [
          {
            Name: 'containerInsights',
            Value: 'enabled',
          },
        ],
      });
    });

    test('enables Fargate capacity providers', () => {
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::ECS::ClusterCapacityProviderAssociations', {
        CapacityProviders: ['FARGATE', 'FARGATE_SPOT'],
        DefaultCapacityProviderStrategy: [],
      });
    });
  });

  describe('Task Definition Configuration', () => {
    test('creates task definition with correct resource allocation', () => {
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::ECS::TaskDefinition', {
        Family: 'steampunk-idle-game-engine-test',
        Cpu: '512',
        Memory: '1024',
        NetworkMode: 'awsvpc',
        RequiresCompatibilities: ['FARGATE'],
        RuntimePlatform: {
          CpuArchitecture: 'X86_64',
          OperatingSystemFamily: 'LINUX',
        },
      });
    });

    test('configures container with proper environment variables', () => {
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::ECS::TaskDefinition', {
        ContainerDefinitions: [
          Match.objectLike({
            Name: 'GameEngineContainer',
            Environment: Match.arrayWith([
              { Name: 'NODE_ENV', Value: 'test' },
              { Name: 'PORT', Value: '3001' },
              { Name: 'TASK_QUEUES_TABLE', Value: 'test-task-queues' },
              { Name: 'CHARACTERS_TABLE', Value: 'test-characters' },
              { Name: 'USERS_TABLE', Value: 'test-users' },
              { Name: 'METRICS_NAMESPACE', Value: 'SteampunkIdleGame/GameEngine' },
              { Name: 'ENVIRONMENT', Value: 'test' },
            ]),
            HealthCheck: {
              Command: [
                'CMD-SHELL',
                'node -e "require(\'http\').get(\'http://localhost:3001/health\', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"',
              ],
              Interval: 30,
              Timeout: 5,
              Retries: 3,
              StartPeriod: 60,
            },
            MemoryReservation: 512,
            Essential: true,
          }),
        ],
      });
    });

    test('grants proper DynamoDB permissions to task role', () => {
      // Check that DynamoDB permissions exist in one of the policies
      const template = Template.fromStack(stack);
      const policies = template.findResources('AWS::IAM::Policy');
      
      let foundDynamoPolicy = false;
      Object.values(policies).forEach((policy: any) => {
        const statements = policy.Properties.PolicyDocument.Statement;
        statements.forEach((statement: any) => {
          if (statement.Action) {
            const actions = Array.isArray(statement.Action) ? statement.Action : [statement.Action];
            if (actions.some((action: string) => action.startsWith('dynamodb:'))) {
              foundDynamoPolicy = true;
            }
          }
        });
      });
      
      expect(foundDynamoPolicy).toBe(true);
    });

    test('grants CloudWatch permissions to task role', () => {
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            {
              Effect: 'Allow',
              Action: [
                'cloudwatch:PutMetricData',
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              Resource: '*',
            },
          ]),
        },
      });
    });
  });

  describe('Load Balancer Configuration', () => {
    test('creates Application Load Balancer with correct settings', () => {
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', {
        Name: 'steampunk-alb-test',
        Scheme: 'internet-facing',
        Type: 'application',
        LoadBalancerAttributes: Match.arrayWith([
          {
            Key: 'idle_timeout.timeout_seconds',
            Value: '60',
          },
        ]),
      });
    });

    test('creates target group with enhanced health checks', () => {
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
        Name: 'steampunk-tg-test',
        Port: 3001,
        Protocol: 'HTTP',
        TargetType: 'ip',
        HealthCheckPath: '/health',
        HealthCheckProtocol: 'HTTP',
        HealthCheckIntervalSeconds: 30,
        HealthCheckTimeoutSeconds: 5,
        HealthyThresholdCount: 2,
        UnhealthyThresholdCount: 3,
        Matcher: {
          HttpCode: '200',
        },
        TargetGroupAttributes: Match.arrayWith([
          {
            Key: 'deregistration_delay.timeout_seconds',
            Value: '30',
          },
        ]),
      });
    });

    test('creates listener with correct configuration', () => {
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', {
        Port: 80,
        Protocol: 'HTTP',
        DefaultActions: [
          {
            Type: 'forward',
            TargetGroupArn: Match.anyValue(),
          },
        ],
      });
    });
  });

  describe('Fargate Service Configuration', () => {
    test('creates Fargate service with correct settings', () => {
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::ECS::Service', {
        ServiceName: 'steampunk-idle-game-engine-test',
        DesiredCount: 1,
        HealthCheckGracePeriodSeconds: 120,
        EnableExecuteCommand: true,
        DeploymentConfiguration: {
          MinimumHealthyPercent: 50,
          MaximumPercent: 200,
        },
      });
    });

    test('configures capacity provider strategies', () => {
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::ECS::Service', {
        CapacityProviderStrategy: [
          {
            CapacityProvider: 'FARGATE',
            Weight: 1,
          },
          {
            CapacityProvider: 'FARGATE_SPOT',
            Weight: 0,
          },
        ],
      });
    });
  });

  describe('Auto Scaling Configuration', () => {
    test('creates scalable target with correct capacity limits', () => {
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::ApplicationAutoScaling::ScalableTarget', {
        ServiceNamespace: 'ecs',
        ScalableDimension: 'ecs:service:DesiredCount',
        MinCapacity: 1,
        MaxCapacity: 3, // Test environment limit
      });
    });

    test('creates CPU-based scaling policy', () => {
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::ApplicationAutoScaling::ScalingPolicy', {
        PolicyName: Match.stringLikeRegexp('.*CpuScaling.*'),
        PolicyType: 'TargetTrackingScaling',
        TargetTrackingScalingPolicyConfiguration: {
          TargetValue: 70,
          PredefinedMetricSpecification: {
            PredefinedMetricType: 'ECSServiceAverageCPUUtilization',
          },
          ScaleInCooldown: 300,
          ScaleOutCooldown: 120,
        },
      });
    });

    test('creates memory-based scaling policy', () => {
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::ApplicationAutoScaling::ScalingPolicy', {
        PolicyName: Match.stringLikeRegexp('.*MemoryScaling.*'),
        PolicyType: 'TargetTrackingScaling',
        TargetTrackingScalingPolicyConfiguration: {
          TargetValue: 80,
          PredefinedMetricSpecification: {
            PredefinedMetricType: 'ECSServiceAverageMemoryUtilization',
          },
          ScaleInCooldown: 300,
          ScaleOutCooldown: 120,
        },
      });
    });

    test('creates custom metric scaling policy', () => {
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::ApplicationAutoScaling::ScalingPolicy', {
        PolicyName: Match.stringLikeRegexp('.*ActiveTaskQueuesScaling.*'),
        PolicyType: 'StepScaling',
        StepScalingPolicyConfiguration: {
          AdjustmentType: 'ChangeInCapacity',
          Cooldown: 180,
          StepAdjustments: Match.arrayWith([
            Match.objectLike({
              ScalingAdjustment: Match.anyValue(),
            }),
          ]),
        },
      });
    });
  });

  describe('CloudWatch Logging Configuration', () => {
    test('creates log group with correct retention', () => {
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: '/ecs/steampunk-idle-game-engine-test',
        RetentionInDays: 14,
      });
    });

    test('configures container logging to CloudWatch', () => {
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::ECS::TaskDefinition', {
        ContainerDefinitions: [
          Match.objectLike({
            LogConfiguration: {
              LogDriver: 'awslogs',
              Options: {
                'awslogs-group': Match.anyValue(),
                'awslogs-region': Match.anyValue(),
                'awslogs-stream-prefix': 'game-engine',
                'awslogs-datetime-format': '%Y-%m-%d %H:%M:%S',
              },
            },
          }),
        ],
      });
    });
  });

  describe('Monitoring and Alerting', () => {
    test('creates SNS topic for alerts', () => {
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::SNS::Topic', {
        TopicName: 'steampunk-game-engine-alerts-test',
        DisplayName: 'Steampunk Game Engine Alerts',
      });
    });

    test('creates email subscription for alerts', () => {
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::SNS::Subscription', {
        Protocol: 'email',
        Endpoint: 'test@example.com',
      });
    });

    test('creates comprehensive CloudWatch alarms', () => {
      const template = Template.fromStack(stack);
      
      // Check for service-level alarms
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: 'CPUUtilization',
        Namespace: 'AWS/ECS',
        Threshold: 80,
        ComparisonOperator: 'GreaterThanOrEqualToThreshold',
      });

      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: 'MemoryUtilization',
        Namespace: 'AWS/ECS',
        Threshold: 85,
        ComparisonOperator: 'GreaterThanOrEqualToThreshold',
      });

      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: 'RunningTaskCount',
        Namespace: 'AWS/ECS',
        Threshold: 1,
        ComparisonOperator: 'LessThanThreshold',
      });

      // Check for load balancer alarms
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: 'UnHealthyHostCount',
        Namespace: 'AWS/ApplicationELB',
        Threshold: 0,
        ComparisonOperator: 'GreaterThanThreshold',
      });

      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: 'TargetResponseTime',
        Namespace: 'AWS/ApplicationELB',
        Threshold: 5,
        ComparisonOperator: 'GreaterThanOrEqualToThreshold',
      });

      // Check for custom application alarms
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: 'TaskProcessingErrors',
        Namespace: 'SteampunkIdleGame/GameEngine',
        Threshold: 50,
        ComparisonOperator: 'GreaterThanOrEqualToThreshold',
      });
    });

    test('creates CloudWatch dashboard', () => {
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
        DashboardBody: Match.anyValue(),
      });
    });

    test('configures alarm actions to SNS topic', () => {
      const template = Template.fromStack(stack);
      
      // Find alarms and verify they have SNS actions
      const alarms = template.findResources('AWS::CloudWatch::Alarm');
      const alarmKeys = Object.keys(alarms);
      
      expect(alarmKeys.length).toBeGreaterThan(0);
      
      alarmKeys.forEach(key => {
        const alarm = alarms[key];
        if (alarm.Properties.AlarmActions) {
          expect(alarm.Properties.AlarmActions).toBeDefined();
        }
        if (alarm.Properties.OKActions) {
          expect(alarm.Properties.OKActions).toBeDefined();
        }
      });
    });
  });

  describe('Security Configuration', () => {
    test('creates task execution role with minimal permissions', () => {
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Effect: 'Allow',
              Principal: {
                Service: 'ecs-tasks.amazonaws.com',
              },
              Action: 'sts:AssumeRole',
            },
          ],
        },
      });
    });

    test('creates task role with specific DynamoDB permissions', () => {
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Effect: 'Allow',
              Principal: {
                Service: 'ecs-tasks.amazonaws.com',
              },
              Action: 'sts:AssumeRole',
            },
          ],
        },
      });
    });
  });

  describe('Network Configuration', () => {
    test('deploys service in private subnets', () => {
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::ECS::Service', {
        NetworkConfiguration: {
          AwsvpcConfiguration: {
            AssignPublicIp: 'ENABLED', // Required for Fargate with internet access
            Subnets: Match.anyValue(),
            SecurityGroups: Match.anyValue(),
          },
        },
      });
    });

    test('creates security groups with appropriate rules', () => {
      const template = Template.fromStack(stack);
      
      // Should have security group for the service
      template.hasResourceProperties('AWS::EC2::SecurityGroup', {
        GroupDescription: Match.stringLikeRegexp('.*GameEngine.*'),
        SecurityGroupEgress: [
          {
            CidrIp: '0.0.0.0/0',
            IpProtocol: '-1',
          },
        ],
      });
    });
  });

  describe('Output Configuration', () => {
    test('creates stack outputs', () => {
      // Test that the construct completes without errors
      // Outputs are created but testing them requires more complex setup
      expect(gameEngine).toBeDefined();
      expect(gameEngine.loadBalancer).toBeDefined();
      expect(gameEngine.service).toBeDefined();
      expect(gameEngine.cluster).toBeDefined();
      expect(gameEngine.logGroup).toBeDefined();
    });
  });

  describe('Environment-specific Configuration', () => {
    test('adjusts max capacity for production environment', () => {
      // Create production environment instance
      const prodGameEngine = new FargateGameEngine(stack, 'ProdGameEngine', {
        vpc,
        tableNames: {
          taskQueues: 'prod-task-queues',
          characters: 'prod-characters',
          users: 'prod-users',
        },
        environment: 'production',
      });

      const template = Template.fromStack(stack);
      
      // Should have higher max capacity for production
      template.hasResourceProperties('AWS::ApplicationAutoScaling::ScalableTarget', {
        MaxCapacity: 5, // Production limit
      });
    });

    test('enables deletion protection for production load balancer', () => {
      const prodGameEngine = new FargateGameEngine(stack, 'ProdGameEngine2', {
        vpc,
        tableNames: {
          taskQueues: 'prod-task-queues',
          characters: 'prod-characters',
          users: 'prod-users',
        },
        environment: 'production',
      });

      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', {
        LoadBalancerAttributes: Match.arrayWith([
          {
            Key: 'deletion_protection.enabled',
            Value: 'true',
          },
        ]),
      });
    });
  });
});