/**
 * Enhanced DynamoDB Schema for Task Queue Persistence
 * Optimized for atomic operations, state snapshots, and recovery
 */

import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface TaskQueuePersistenceSchemaProps {
  removalPolicy?: cdk.RemovalPolicy;
  pointInTimeRecovery?: boolean;
  billingMode?: dynamodb.BillingMode;
}

export class TaskQueuePersistenceSchema extends Construct {
  public readonly taskQueuesTable: dynamodb.Table;
  public readonly snapshotsTable: dynamodb.Table;
  public readonly migrationsTable: dynamodb.Table;
  public readonly metricsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: TaskQueuePersistenceSchemaProps = {}) {
    super(scope, id);

    const {
      removalPolicy = cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery = true,
      billingMode = dynamodb.BillingMode.PAY_PER_REQUEST
    } = props;

    // Enhanced Task Queues Table with optimized indexing
    this.taskQueuesTable = new dynamodb.Table(this, 'TaskQueuesTable', {
      tableName: 'steampunk-idle-game-task-queues-enhanced',
      partitionKey: { name: 'playerId', type: dynamodb.AttributeType.STRING },
      billingMode,
      removalPolicy,
      pointInTimeRecovery,
      
      // Enable streams for real-time processing
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      
      // Deletion protection for production
      deletionProtection: false, // Set to true in production
    });

    // GSI for active queue processing - optimized for Fargate processing
    this.taskQueuesTable.addGlobalSecondaryIndex({
      indexName: 'running-status-lastprocessed-index',
      partitionKey: { name: 'isRunning', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'lastProcessed', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.INCLUDE,
      nonKeyAttributes: [
        'playerId',
        'currentTaskId',
        'queueSize',
        'isPaused',
        'lastUpdated',
        'version'
      ]
    });

    // GSI for paused queues - for recovery and monitoring
    this.taskQueuesTable.addGlobalSecondaryIndex({
      indexName: 'paused-status-index',
      partitionKey: { name: 'isPaused', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'lastUpdated', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.INCLUDE,
      nonKeyAttributes: [
        'playerId',
        'pauseReason',
        'canResume',
        'queueSize'
      ]
    });

    // GSI for queue size monitoring and load balancing
    this.taskQueuesTable.addGlobalSecondaryIndex({
      indexName: 'queuesize-lastprocessed-index',
      partitionKey: { name: 'queueSize', type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: 'lastProcessed', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.KEYS_ONLY
    });

    // GSI for version-based queries (for migrations)
    this.taskQueuesTable.addGlobalSecondaryIndex({
      indexName: 'version-lastupdated-index',
      partitionKey: { name: 'version', type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: 'lastUpdated', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.KEYS_ONLY
    });

    // State Snapshots Table for recovery and rollback
    this.snapshotsTable = new dynamodb.Table(this, 'TaskQueueSnapshotsTable', {
      tableName: 'steampunk-idle-game-task-queue-snapshots',
      partitionKey: { name: 'snapshotId', type: dynamodb.AttributeType.STRING },
      billingMode,
      removalPolicy,
      pointInTimeRecovery,
      
      // TTL for automatic cleanup of old snapshots
      timeToLiveAttribute: 'ttl',
    });

    // GSI for player snapshots lookup
    this.snapshotsTable.addGlobalSecondaryIndex({
      indexName: 'playerId-timestamp-index',
      partitionKey: { name: 'playerId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // GSI for snapshot cleanup by timestamp
    this.snapshotsTable.addGlobalSecondaryIndex({
      indexName: 'timestamp-reason-index',
      partitionKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: 'reason', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.KEYS_ONLY
    });

    // Data Migrations Table for schema versioning
    this.migrationsTable = new dynamodb.Table(this, 'TaskQueueMigrationsTable', {
      tableName: 'steampunk-idle-game-task-queue-migrations',
      partitionKey: { name: 'migrationId', type: dynamodb.AttributeType.STRING },
      billingMode,
      removalPolicy,
      pointInTimeRecovery,
    });

    // GSI for migration status tracking
    this.migrationsTable.addGlobalSecondaryIndex({
      indexName: 'status-timestamp-index',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // GSI for version-based migration queries
    this.migrationsTable.addGlobalSecondaryIndex({
      indexName: 'fromversion-toversion-index',
      partitionKey: { name: 'fromVersion', type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: 'toVersion', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // Task Queue Metrics Table for performance monitoring
    this.metricsTable = new dynamodb.Table(this, 'TaskQueueMetricsTable', {
      tableName: 'steampunk-idle-game-task-queue-metrics',
      partitionKey: { name: 'metricId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      billingMode,
      removalPolicy,
      pointInTimeRecovery,
      
      // TTL for automatic cleanup of old metrics (90 days)
      timeToLiveAttribute: 'ttl',
    });

    // GSI for player metrics lookup
    this.metricsTable.addGlobalSecondaryIndex({
      indexName: 'playerId-timestamp-index',
      partitionKey: { name: 'playerId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // GSI for metric type aggregation
    this.metricsTable.addGlobalSecondaryIndex({
      indexName: 'metrictype-timestamp-index',
      partitionKey: { name: 'metricType', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // Add tags for resource management
    cdk.Tags.of(this.taskQueuesTable).add('Component', 'TaskQueuePersistence');
    cdk.Tags.of(this.snapshotsTable).add('Component', 'TaskQueuePersistence');
    cdk.Tags.of(this.migrationsTable).add('Component', 'TaskQueuePersistence');
    cdk.Tags.of(this.metricsTable).add('Component', 'TaskQueuePersistence');
    
    cdk.Tags.of(this.taskQueuesTable).add('Purpose', 'MainStorage');
    cdk.Tags.of(this.snapshotsTable).add('Purpose', 'Backup');
    cdk.Tags.of(this.migrationsTable).add('Purpose', 'SchemaManagement');
    cdk.Tags.of(this.metricsTable).add('Purpose', 'Monitoring');
  }

  /**
   * Grant read/write permissions to a role for all tables
   */
  public grantReadWriteData(grantee: any): void {
    this.taskQueuesTable.grantReadWriteData(grantee);
    this.snapshotsTable.grantReadWriteData(grantee);
    this.migrationsTable.grantReadWriteData(grantee);
    this.metricsTable.grantReadWriteData(grantee);
  }

  /**
   * Grant stream read permissions for real-time processing
   */
  public grantStreamRead(grantee: any): void {
    this.taskQueuesTable.grantStreamRead(grantee);
  }

  /**
   * Get table names for environment variables
   */
  public getTableNames(): { [key: string]: string } {
    return {
      TASK_QUEUES_TABLE: this.taskQueuesTable.tableName,
      SNAPSHOTS_TABLE: this.snapshotsTable.tableName,
      MIGRATIONS_TABLE: this.migrationsTable.tableName,
      METRICS_TABLE: this.metricsTable.tableName
    };
  }

  /**
   * Get table ARNs for IAM policies
   */
  public getTableArns(): { [key: string]: string } {
    return {
      TASK_QUEUES_TABLE_ARN: this.taskQueuesTable.tableArn,
      SNAPSHOTS_TABLE_ARN: this.snapshotsTable.tableArn,
      MIGRATIONS_TABLE_ARN: this.migrationsTable.tableArn,
      METRICS_TABLE_ARN: this.metricsTable.tableArn
    };
  }
}

/**
 * DynamoDB Item Attribute Definitions for Type Safety
 */
export interface TaskQueueDynamoItem {
  playerId: string;
  queueData: any; // Serialized TaskQueue object
  version: number;
  checksum: string;
  lastUpdated: number;
  lastValidated: number;
  
  // Indexed attributes for GSI queries
  isRunning: string; // 'true' | 'false'
  isPaused: string; // 'true' | 'false'
  currentTaskId: string; // task ID or 'none'
  queueSize: number;
  totalTasksCompleted: number;
  lastProcessed: string; // ISO timestamp
}

export interface SnapshotDynamoItem {
  snapshotId: string;
  playerId: string;
  timestamp: number;
  snapshotData: any; // Serialized StateSnapshot object
  reason: string;
  ttl: number; // Unix timestamp for TTL
}

export interface MigrationDynamoItem {
  migrationId: string;
  fromVersion: number;
  toVersion: number;
  timestamp: number;
  status: string;
  affectedPlayers: string[];
  migrationData: any;
  rollbackData?: any;
  error?: string;
}

export interface MetricDynamoItem {
  metricId: string;
  playerId: string;
  timestamp: number;
  metricType: string;
  metricData: any;
  ttl: number; // Unix timestamp for TTL
}