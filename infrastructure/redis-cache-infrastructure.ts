/**
 * Redis Cache Infrastructure for Performance Optimization
 * Adds Redis ElastiCache cluster for caching active queue states and frequently accessed data
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface RedisCacheInfrastructureProps {
  vpc: ec2.Vpc;
  nodeType?: string;
  numCacheNodes?: number;
  engineVersion?: string;
  parameterGroupName?: string;
  enableBackup?: boolean;
  backupRetentionLimit?: number;
  enableMultiAz?: boolean;
  enableTransitEncryption?: boolean;
  enableAtRestEncryption?: boolean;
}

export class RedisCacheInfrastructure extends Construct {
  public readonly replicationGroup: elasticache.CfnReplicationGroup;
  public readonly subnetGroup: elasticache.CfnSubnetGroup;
  public readonly securityGroup: ec2.SecurityGroup;
  public readonly parameterGroup: elasticache.CfnParameterGroup;
  public readonly redisEndpoint: string;
  public readonly redisPort: number;

  constructor(scope: Construct, id: string, props: RedisCacheInfrastructureProps) {
    super(scope, id);

    // Create security group for Redis
    this.securityGroup = new ec2.SecurityGroup(this, 'RedisSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for Redis ElastiCache cluster',
      allowAllOutbound: false,
    });

    // Allow inbound Redis traffic from VPC
    this.securityGroup.addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(6379),
      'Allow Redis traffic from VPC'
    );

    // Create subnet group for Redis
    this.subnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnet group for Redis ElastiCache cluster',
      subnetIds: props.vpc.privateSubnets.map(subnet => subnet.subnetId),
      cacheSubnetGroupName: 'steampunk-idle-game-redis-subnet-group',
    });

    // Create parameter group for Redis optimization
    this.parameterGroup = new elasticache.CfnParameterGroup(this, 'RedisParameterGroup', {
      cacheParameterGroupFamily: 'redis7.x',
      description: 'Parameter group for Redis performance optimization',
      properties: {
        // Memory management optimizations
        'maxmemory-policy': 'allkeys-lru',
        'maxmemory-samples': '10',
        
        // Performance optimizations
        'tcp-keepalive': '300',
        'timeout': '300',
        'tcp-backlog': '511',
        
        // Persistence optimizations (disabled for cache-only usage)
        'save': '',
        'stop-writes-on-bgsave-error': 'no',
        
        // Network optimizations
        'client-output-buffer-limit-normal-hard-limit': '0',
        'client-output-buffer-limit-normal-soft-limit': '0',
        'client-output-buffer-limit-normal-soft-seconds': '0',
        
        // Hash optimizations for task queue data
        'hash-max-ziplist-entries': '512',
        'hash-max-ziplist-value': '64',
        'list-max-ziplist-size': '-2',
        'list-compress-depth': '0',
        'set-max-intset-entries': '512',
        'zset-max-ziplist-entries': '128',
        'zset-max-ziplist-value': '64',
        
        // Memory usage optimizations
        'activerehashing': 'yes',
        'rdbcompression': 'yes',
        'rdbchecksum': 'yes',
      },
    });

    // Create Redis replication group
    this.replicationGroup = new elasticache.CfnReplicationGroup(this, 'RedisReplicationGroup', {
      replicationGroupDescription: 'Redis cluster for task queue performance optimization',
      replicationGroupId: 'steampunk-idle-game-redis',
      
      // Node configuration
      cacheNodeType: props.nodeType || 'cache.t3.micro',
      numCacheClusters: props.numCacheNodes || 2,
      
      // Engine configuration
      engine: 'redis',
      engineVersion: props.engineVersion || '7.0',
      cacheParameterGroupName: this.parameterGroup.ref,
      
      // Network configuration
      cacheSubnetGroupName: this.subnetGroup.ref,
      securityGroupIds: [this.securityGroup.securityGroupId],
      
      // Multi-AZ configuration
      multiAzEnabled: props.enableMultiAz ?? true,
      automaticFailoverEnabled: props.enableMultiAz ?? true,
      
      // Backup configuration
      snapshotRetentionLimit: props.enableBackup ? (props.backupRetentionLimit || 5) : 0,
      snapshotWindow: props.enableBackup ? '03:00-05:00' : undefined,
      preferredMaintenanceWindow: 'sun:05:00-sun:07:00',
      
      // Security configuration
      transitEncryptionEnabled: props.enableTransitEncryption ?? true,
      atRestEncryptionEnabled: props.enableAtRestEncryption ?? true,
      
      // Performance configuration
      port: 6379,
      
      // Notification configuration
      notificationTopicArn: undefined, // Can be added later for monitoring
      
      // Log configuration
      logDeliveryConfigurations: [
        {
          destinationType: 'cloudwatch-logs',
          logFormat: 'json',
          logType: 'slow-log',
          destinationDetails: {
            cloudWatchLogsDetails: {
              logGroup: `/aws/elasticache/redis/steampunk-idle-game`,
            },
          },
        },
      ],
      
      // Tags
      tags: [
        {
          key: 'Name',
          value: 'SteampunkIdleGame-Redis',
        },
        {
          key: 'Environment',
          value: 'production',
        },
        {
          key: 'Purpose',
          value: 'TaskQueuePerformanceOptimization',
        },
      ],
    });

    // Set dependencies
    this.replicationGroup.addDependency(this.subnetGroup);
    this.replicationGroup.addDependency(this.parameterGroup);

    // Export connection details
    this.redisEndpoint = this.replicationGroup.attrPrimaryEndPointAddress;
    this.redisPort = 6379;

    // Create CloudWatch log group for Redis logs
    new cdk.aws_logs.LogGroup(this, 'RedisLogGroup', {
      logGroupName: '/aws/elasticache/redis/steampunk-idle-game',
      retention: cdk.aws_logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Output connection information
    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: this.redisEndpoint,
      description: 'Redis cluster primary endpoint',
      exportName: 'SteampunkIdleGame-RedisEndpoint',
    });

    new cdk.CfnOutput(this, 'RedisPort', {
      value: this.redisPort.toString(),
      description: 'Redis cluster port',
      exportName: 'SteampunkIdleGame-RedisPort',
    });
  }

  /**
   * Grant access to Redis cluster for Lambda functions and Fargate services
   */
  grantAccess(grantee: iam.IGrantable): void {
    // Grant network access through security group
    if (grantee instanceof iam.Role) {
      // Add policy to allow ElastiCache describe operations
      grantee.addToPrincipalPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'elasticache:DescribeReplicationGroups',
          'elasticache:DescribeCacheClusters',
          'elasticache:DescribeCacheSubnetGroups',
        ],
        resources: ['*'],
      }));
    }
  }

  /**
   * Create connection string for applications
   */
  getConnectionString(): string {
    return `redis://${this.redisEndpoint}:${this.redisPort}`;
  }

  /**
   * Get Redis configuration for applications
   */
  getRedisConfig(): {
    host: string;
    port: number;
    tls: boolean;
    family: number;
    connectTimeout: number;
    lazyConnect: boolean;
    maxRetriesPerRequest: number;
    retryDelayOnFailover: number;
    enableReadyCheck: boolean;
    maxLoadingTimeout: number;
  } {
    return {
      host: this.redisEndpoint,
      port: this.redisPort,
      tls: true, // Enable TLS for security
      family: 4, // IPv4
      connectTimeout: 10000, // 10 seconds
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      maxLoadingTimeout: 5000,
    };
  }

  /**
   * Create monitoring alarms for Redis cluster
   */
  createMonitoringAlarms(): void {
    const namespace = 'AWS/ElastiCache';
    const dimensions = {
      CacheClusterId: this.replicationGroup.replicationGroupId || 'steampunk-idle-game-redis',
    };

    // CPU utilization alarm
    new cdk.aws_cloudwatch.Alarm(this, 'RedisCpuAlarm', {
      alarmName: 'SteampunkIdleGame-Redis-HighCPU',
      alarmDescription: 'Redis cluster CPU utilization is high',
      metric: new cdk.aws_cloudwatch.Metric({
        namespace,
        metricName: 'CPUUtilization',
        dimensionsMap: dimensions,
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 80,
      evaluationPeriods: 2,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Memory utilization alarm
    new cdk.aws_cloudwatch.Alarm(this, 'RedisMemoryAlarm', {
      alarmName: 'SteampunkIdleGame-Redis-HighMemory',
      alarmDescription: 'Redis cluster memory utilization is high',
      metric: new cdk.aws_cloudwatch.Metric({
        namespace,
        metricName: 'DatabaseMemoryUsagePercentage',
        dimensionsMap: dimensions,
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 85,
      evaluationPeriods: 2,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Connection count alarm
    new cdk.aws_cloudwatch.Alarm(this, 'RedisConnectionsAlarm', {
      alarmName: 'SteampunkIdleGame-Redis-HighConnections',
      alarmDescription: 'Redis cluster has too many connections',
      metric: new cdk.aws_cloudwatch.Metric({
        namespace,
        metricName: 'CurrConnections',
        dimensionsMap: dimensions,
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 100,
      evaluationPeriods: 2,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Cache hit ratio alarm (should be high)
    new cdk.aws_cloudwatch.Alarm(this, 'RedisCacheHitRatioAlarm', {
      alarmName: 'SteampunkIdleGame-Redis-LowCacheHitRatio',
      alarmDescription: 'Redis cluster cache hit ratio is low',
      metric: new cdk.aws_cloudwatch.Metric({
        namespace,
        metricName: 'CacheHitRate',
        dimensionsMap: dimensions,
        statistic: 'Average',
        period: cdk.Duration.minutes(15),
      }),
      threshold: 80,
      evaluationPeriods: 3,
      comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });
  }
}