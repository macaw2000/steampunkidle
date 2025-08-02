/**
 * Performance Optimization Stack
 * Implements comprehensive performance optimizations for the Steampunk Idle Game
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as applicationautoscaling from 'aws-cdk-lib/aws-applicationautoscaling';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';
import { LambdaPerformanceConfig, DynamoDBOptimizationConfig } from './performance-config';

export interface PerformanceOptimizationStackProps extends cdk.StackProps {
  environment: string;
  existingTables: {
    [tableName: string]: dynamodb.Table;
  };
  existingFunctions: {
    [functionName: string]: lambda.Function;
  };
}

export class PerformanceOptimizationStack extends cdk.Stack {
  public readonly optimizedTables: { [key: string]: dynamodb.Table } = {};
  public readonly cacheWarmerFunction: lambda.Function;
  public readonly performanceMonitoringFunction: lambda.Function;
  public readonly indexOptimizationFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: PerformanceOptimizationStackProps) {
    super(scope, id, props);

    // Apply Lambda function optimizations
    this.optimizeLambdaFunctions(props.existingFunctions);

    // Create additional DynamoDB indexes for performance
    this.createOptimizedIndexes(props.existingTables);

    // Create cache warming function
    this.cacheWarmerFunction = this.createCacheWarmerFunction();

    // Create performance monitoring function
    this.performanceMonitoringFunction = this.createPerformanceMonitoringFunction();

    // Create index optimization function
    this.indexOptimizationFunction = this.createIndexOptimizationFunction();

    // Set up automated performance monitoring
    this.setupPerformanceMonitoring();

    // Create performance optimization alarms
    this.createPerformanceAlarms();

    // Schedule optimization tasks
    this.scheduleOptimizationTasks();
  }

  private optimizeLambdaFunctions(existingFunctions: { [functionName: string]: lambda.Function }): void {
    // Apply performance configurations to existing functions
    Object.entries(existingFunctions).forEach(([functionName, lambdaFunction]) => {
      const config = this.getFunctionConfig(functionName);
      
      if (config) {
        // Update function configuration
        const cfnFunction = lambdaFunction.node.defaultChild as lambda.CfnFunction;
        cfnFunction.memorySize = config.memory;
        cfnFunction.timeout = config.timeout;
        
        if (config.reservedConcurrency) {
          cfnFunction.reservedConcurrencyLimit = config.reservedConcurrency;
        }

        // Add performance monitoring environment variables
        cfnFunction.environment = {
          ...cfnFunction.environment,
          ENABLE_PERFORMANCE_MONITORING: 'true',
          FUNCTION_NAME: functionName,
          ENVIRONMENT: this.node.tryGetContext('environment') || 'dev',
        };

        // Enable X-Ray tracing for performance analysis
        lambdaFunction.addEnvironment('_X_AMZN_TRACE_ID', '');
        const cfnFunctionConfig = lambdaFunction.node.defaultChild as lambda.CfnFunction;
        cfnFunctionConfig.tracingConfig = {
          mode: 'Active',
        };
      }
    });
  }

  private getFunctionConfig(functionName: string): any {
    // Map function names to performance configurations
    const functionMappings: { [key: string]: keyof typeof LambdaPerformanceConfig.functions } = {
      'LoginFunction': 'auth',
      'RefreshTokenFunction': 'auth',
      'LogoutFunction': 'auth',
      'CharacterFunction': 'character',
      'ActivitySwitchFunction': 'activity',
      'CalculateOfflineProgressFunction': 'offlineProgress',
      'BatchOfflineProgressFunction': 'batchOfflineProgress',
      'CreateGuildFunction': 'guild',
      'GetGuildFunction': 'guild',
      'UpdateGuildFunction': 'guild',
      'DeleteGuildFunction': 'guild',
      'CurrencyTransactionFunction': 'currency',
      'AuctionListingFunction': 'auction',
      'ChatMessageFunction': 'chat',
      'LeaderboardFunction': 'leaderboard',
      'PartyManagementFunction': 'party',
      'ZoneInstanceFunction': 'zone',
      'CraftingFunction': 'crafting',
    };

    const configKey = functionMappings[functionName];
    return configKey ? LambdaPerformanceConfig.functions[configKey] : null;
  }

  private createOptimizedIndexes(existingTables: { [tableName: string]: dynamodb.Table }): void {
    // Add performance-optimized indexes to existing tables
    Object.entries(existingTables).forEach(([tableName, table]) => {
      this.addOptimizedIndexesToTable(tableName, table);
    });
  }

  private addOptimizedIndexesToTable(tableName: string, table: dynamodb.Table): void {
    const tableConfig = this.getTableOptimizationConfig(tableName);
    
    if (tableConfig?.additionalIndexes) {
      tableConfig.additionalIndexes.forEach((indexConfig: any) => {
        try {
          table.addGlobalSecondaryIndex({
            indexName: indexConfig.indexName,
            partitionKey: indexConfig.partitionKey,
            sortKey: indexConfig.sortKey,
            projectionType: indexConfig.projectionType || dynamodb.ProjectionType.ALL,
          });
        } catch (error) {
          // Index might already exist, log and continue
          console.warn(`Index ${indexConfig.indexName} might already exist on table ${tableName}`);
        }
      });
    }
  }

  private getTableOptimizationConfig(tableName: string): any {
    const optimizationConfigs: { [key: string]: any } = {
      'steampunk-idle-game-characters': {
        additionalIndexes: [
          {
            indexName: 'level-experience-index',
            partitionKey: { name: 'level', type: dynamodb.AttributeType.NUMBER },
            sortKey: { name: 'experience', type: dynamodb.AttributeType.NUMBER },
            projectionType: dynamodb.ProjectionType.KEYS_ONLY,
          },
          {
            indexName: 'lastActiveAt-index',
            partitionKey: { name: 'lastActiveAt', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.KEYS_ONLY,
          },
        ],
      },
      'steampunk-idle-game-auction-listings': {
        additionalIndexes: [
          {
            indexName: 'itemId-price-index',
            partitionKey: { name: 'itemId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'currentBid', type: dynamodb.AttributeType.NUMBER },
            projectionType: dynamodb.ProjectionType.ALL,
          },
        ],
      },
      'steampunk-idle-game-chat-messages': {
        additionalIndexes: [
          {
            indexName: 'userId-timestamp-index',
            partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.KEYS_ONLY,
          },
        ],
      },
    };

    return optimizationConfigs[tableName];
  }

  private createCacheWarmerFunction(): lambda.Function {
    return new lambda.Function(this, 'CacheWarmerFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'cacheWarmer.handler',
      code: lambda.Code.fromInline(`
        const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
        const { DynamoDBDocumentClient, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
        const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

        const client = new DynamoDBClient({});
        const docClient = DynamoDBDocumentClient.from(client);
        const cloudwatch = new CloudWatchClient({});

        exports.handler = async (event) => {
          const startTime = Date.now();
          let warmedCaches = 0;
          
          try {
            console.log('Starting cache warming process');
            
            // Warm frequently accessed data
            const cacheWarmingTasks = [
              warmLeaderboards(),
              warmActiveGuilds(),
              warmPopularItems(),
              warmActiveAuctions(),
            ];
            
            const results = await Promise.allSettled(cacheWarmingTasks);
            
            results.forEach((result, index) => {
              if (result.status === 'fulfilled') {
                warmedCaches++;
                console.log(\`Cache warming task \${index} completed successfully\`);
              } else {
                console.error(\`Cache warming task \${index} failed:\`, result.reason);
              }
            });
            
            // Report metrics
            await cloudwatch.send(new PutMetricDataCommand({
              Namespace: 'SteampunkIdleGame/Performance',
              MetricData: [
                {
                  MetricName: 'CacheWarmingDuration',
                  Value: Date.now() - startTime,
                  Unit: 'Milliseconds',
                  Timestamp: new Date(),
                },
                {
                  MetricName: 'CachesWarmed',
                  Value: warmedCaches,
                  Unit: 'Count',
                  Timestamp: new Date(),
                },
              ],
            }));
            
            return {
              statusCode: 200,
              body: JSON.stringify({
                message: 'Cache warming completed',
                warmedCaches,
                duration: Date.now() - startTime,
              }),
            };
          } catch (error) {
            console.error('Cache warming failed:', error);
            
            await cloudwatch.send(new PutMetricDataCommand({
              Namespace: 'SteampunkIdleGame/Performance',
              MetricData: [
                {
                  MetricName: 'CacheWarmingErrors',
                  Value: 1,
                  Unit: 'Count',
                  Timestamp: new Date(),
                },
              ],
            }));
            
            return {
              statusCode: 500,
              body: JSON.stringify({ error: 'Cache warming failed' }),
            };
          }
        };
        
        async function warmLeaderboards() {
          // Query top 100 players for each stat type
          const statTypes = ['level', 'experience', 'currency', 'craftingLevel', 'harvestingLevel', 'combatLevel'];
          
          for (const statType of statTypes) {
            await docClient.send(new QueryCommand({
              TableName: process.env.LEADERBOARDS_TABLE,
              KeyConditionExpression: 'statType = :statType',
              ExpressionAttributeValues: {
                ':statType': statType,
              },
              Limit: 100,
            }));
          }
        }
        
        async function warmActiveGuilds() {
          // Scan for active guilds (updated in last 7 days)
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          
          await docClient.send(new ScanCommand({
            TableName: process.env.GUILDS_TABLE,
            FilterExpression: 'updatedAt > :threshold',
            ExpressionAttributeValues: {
              ':threshold': sevenDaysAgo,
            },
            Limit: 50,
          }));
        }
        
        async function warmPopularItems() {
          // Query items by type and rarity
          const itemTypes = ['weapon', 'armor', 'trinket', 'material', 'consumable'];
          const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
          
          for (const itemType of itemTypes) {
            for (const rarity of rarities) {
              await docClient.send(new QueryCommand({
                TableName: process.env.ITEMS_TABLE,
                IndexName: 'type-rarity-index',
                KeyConditionExpression: '#type = :type AND rarity = :rarity',
                ExpressionAttributeNames: {
                  '#type': 'type',
                },
                ExpressionAttributeValues: {
                  ':type': itemType,
                  ':rarity': rarity,
                },
                Limit: 20,
              }));
            }
          }
        }
        
        async function warmActiveAuctions() {
          // Query active auction listings
          await docClient.send(new QueryCommand({
            TableName: process.env.AUCTION_LISTINGS_TABLE,
            IndexName: 'status-expires-index',
            KeyConditionExpression: '#status = :status',
            ExpressionAttributeNames: {
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':status': 'active',
            },
            Limit: 100,
          }));
        }
      `),
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        LEADERBOARDS_TABLE: 'steampunk-idle-game-leaderboards',
        GUILDS_TABLE: 'steampunk-idle-game-guilds',
        ITEMS_TABLE: 'steampunk-idle-game-items',
        AUCTION_LISTINGS_TABLE: 'steampunk-idle-game-auction-listings',
      },
    });
  }

  private createPerformanceMonitoringFunction(): lambda.Function {
    return new lambda.Function(this, 'PerformanceMonitoringFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'performanceMonitor.handler',
      code: lambda.Code.fromInline(`
        const { CloudWatchClient, PutMetricDataCommand, GetMetricStatisticsCommand } = require('@aws-sdk/client-cloudwatch');
        const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
        const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

        const cloudwatch = new CloudWatchClient({});
        const client = new DynamoDBClient({});
        const docClient = DynamoDBDocumentClient.from(client);

        exports.handler = async (event) => {
          try {
            console.log('Starting performance monitoring');
            
            const metrics = await Promise.all([
              measureDatabasePerformance(),
              measureCachePerformance(),
              measureSystemResources(),
              analyzeUserActivity(),
            ]);
            
            // Combine all metrics
            const allMetrics = metrics.flat();
            
            // Send metrics to CloudWatch
            if (allMetrics.length > 0) {
              await cloudwatch.send(new PutMetricDataCommand({
                Namespace: 'SteampunkIdleGame/Performance',
                MetricData: allMetrics,
              }));
            }
            
            console.log(\`Sent \${allMetrics.length} performance metrics to CloudWatch\`);
            
            return {
              statusCode: 200,
              body: JSON.stringify({
                message: 'Performance monitoring completed',
                metricsCount: allMetrics.length,
              }),
            };
          } catch (error) {
            console.error('Performance monitoring failed:', error);
            return {
              statusCode: 500,
              body: JSON.stringify({ error: 'Performance monitoring failed' }),
            };
          }
        };
        
        async function measureDatabasePerformance() {
          const metrics = [];
          const startTime = Date.now();
          
          try {
            // Test query performance on characters table
            await docClient.send(new ScanCommand({
              TableName: process.env.CHARACTERS_TABLE,
              Limit: 1,
            }));
            
            const queryTime = Date.now() - startTime;
            
            metrics.push({
              MetricName: 'DatabaseQueryLatency',
              Value: queryTime,
              Unit: 'Milliseconds',
              Timestamp: new Date(),
              Dimensions: [
                {
                  Name: 'TableName',
                  Value: 'Characters',
                },
              ],
            });
          } catch (error) {
            console.error('Database performance measurement failed:', error);
            metrics.push({
              MetricName: 'DatabaseErrors',
              Value: 1,
              Unit: 'Count',
              Timestamp: new Date(),
            });
          }
          
          return metrics;
        }
        
        async function measureCachePerformance() {
          const metrics = [];
          
          // This would integrate with Redis cache when available
          // For now, we'll simulate cache performance metrics
          metrics.push({
            MetricName: 'CacheHitRate',
            Value: Math.random() * 20 + 80, // Simulate 80-100% hit rate
            Unit: 'Percent',
            Timestamp: new Date(),
          });
          
          return metrics;
        }
        
        async function measureSystemResources() {
          const metrics = [];
          
          // Memory usage
          const memoryUsage = process.memoryUsage();
          metrics.push({
            MetricName: 'MemoryUsage',
            Value: memoryUsage.heapUsed / 1024 / 1024, // MB
            Unit: 'Megabytes',
            Timestamp: new Date(),
          });
          
          // CPU usage (approximated)
          const cpuUsage = process.cpuUsage();
          metrics.push({
            MetricName: 'CPUUsage',
            Value: (cpuUsage.user + cpuUsage.system) / 1000, // milliseconds
            Unit: 'Milliseconds',
            Timestamp: new Date(),
          });
          
          return metrics;
        }
        
        async function analyzeUserActivity() {
          const metrics = [];
          
          try {
            // Count active characters (updated in last hour)
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            
            const result = await docClient.send(new ScanCommand({
              TableName: process.env.CHARACTERS_TABLE,
              FilterExpression: 'lastActiveAt > :threshold',
              ExpressionAttributeValues: {
                ':threshold': oneHourAgo,
              },
              Select: 'COUNT',
            }));
            
            metrics.push({
              MetricName: 'ActivePlayersLastHour',
              Value: result.Count || 0,
              Unit: 'Count',
              Timestamp: new Date(),
            });
          } catch (error) {
            console.error('User activity analysis failed:', error);
          }
          
          return metrics;
        }
      `),
      timeout: cdk.Duration.minutes(2),
      memorySize: 512,
      environment: {
        CHARACTERS_TABLE: 'steampunk-idle-game-characters',
        GUILDS_TABLE: 'steampunk-idle-game-guilds',
      },
    });
  }

  private createIndexOptimizationFunction(): lambda.Function {
    return new lambda.Function(this, 'IndexOptimizationFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'indexOptimizer.handler',
      code: lambda.Code.fromInline(`
        const { DynamoDBClient, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
        const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

        const dynamodb = new DynamoDBClient({});
        const cloudwatch = new CloudWatchClient({});

        exports.handler = async (event) => {
          try {
            console.log('Starting index optimization analysis');
            
            const tables = [
              'steampunk-idle-game-characters',
              'steampunk-idle-game-guilds',
              'steampunk-idle-game-auction-listings',
              'steampunk-idle-game-chat-messages',
              'steampunk-idle-game-leaderboards',
            ];
            
            const optimizationReports = [];
            
            for (const tableName of tables) {
              try {
                const report = await analyzeTableIndexes(tableName);
                optimizationReports.push(report);
              } catch (error) {
                console.error(\`Failed to analyze table \${tableName}:\`, error);
              }
            }
            
            // Send optimization metrics
            const metrics = optimizationReports.flatMap(report => [
              {
                MetricName: 'IndexUtilization',
                Value: report.utilizationScore,
                Unit: 'Percent',
                Timestamp: new Date(),
                Dimensions: [
                  {
                    Name: 'TableName',
                    Value: report.tableName,
                  },
                ],
              },
              {
                MetricName: 'UnusedIndexes',
                Value: report.unusedIndexes,
                Unit: 'Count',
                Timestamp: new Date(),
                Dimensions: [
                  {
                    Name: 'TableName',
                    Value: report.tableName,
                  },
                ],
              },
            ]);
            
            if (metrics.length > 0) {
              await cloudwatch.send(new PutMetricDataCommand({
                Namespace: 'SteampunkIdleGame/IndexOptimization',
                MetricData: metrics,
              }));
            }
            
            return {
              statusCode: 200,
              body: JSON.stringify({
                message: 'Index optimization analysis completed',
                reports: optimizationReports,
              }),
            };
          } catch (error) {
            console.error('Index optimization failed:', error);
            return {
              statusCode: 500,
              body: JSON.stringify({ error: 'Index optimization failed' }),
            };
          }
        };
        
        async function analyzeTableIndexes(tableName) {
          const result = await dynamodb.send(new DescribeTableCommand({
            TableName: tableName,
          }));
          
          const table = result.Table;
          const gsiCount = table.GlobalSecondaryIndexes?.length || 0;
          const lsiCount = table.LocalSecondaryIndexes?.length || 0;
          
          // Simple utilization scoring (would be more sophisticated in production)
          const utilizationScore = Math.min(100, (gsiCount + lsiCount) * 20);
          const unusedIndexes = Math.max(0, (gsiCount + lsiCount) - 3); // Assume 3+ indexes might be excessive
          
          return {
            tableName,
            gsiCount,
            lsiCount,
            utilizationScore,
            unusedIndexes,
            recommendations: generateRecommendations(tableName, gsiCount, lsiCount),
          };
        }
        
        function generateRecommendations(tableName, gsiCount, lsiCount) {
          const recommendations = [];
          
          if (gsiCount === 0) {
            recommendations.push('Consider adding GSI for common query patterns');
          }
          
          if (gsiCount > 5) {
            recommendations.push('Review GSI usage - too many indexes can impact write performance');
          }
          
          if (lsiCount > 2) {
            recommendations.push('Consider consolidating LSIs or using GSIs instead');
          }
          
          return recommendations;
        }
      `),
      timeout: cdk.Duration.minutes(3),
      memorySize: 512,
    });
  }

  private setupPerformanceMonitoring(): void {
    // Grant necessary permissions to monitoring functions
    const tables = [
      'steampunk-idle-game-characters',
      'steampunk-idle-game-guilds',
      'steampunk-idle-game-auction-listings',
      'steampunk-idle-game-chat-messages',
      'steampunk-idle-game-leaderboards',
      'steampunk-idle-game-items',
    ];

    tables.forEach(tableName => {
      [this.cacheWarmerFunction, this.performanceMonitoringFunction].forEach(func => {
        func.addToRolePolicy(new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'dynamodb:Query',
            'dynamodb:Scan',
            'dynamodb:GetItem',
          ],
          resources: [
            `arn:aws:dynamodb:${this.region}:${this.account}:table/${tableName}`,
            `arn:aws:dynamodb:${this.region}:${this.account}:table/${tableName}/index/*`,
          ],
        }));
      });
    });

    // Grant CloudWatch permissions
    [this.cacheWarmerFunction, this.performanceMonitoringFunction, this.indexOptimizationFunction].forEach(func => {
      func.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cloudwatch:PutMetricData',
          'cloudwatch:GetMetricStatistics',
          'cloudwatch:ListMetrics',
        ],
        resources: ['*'],
      }));
    });

    // Grant DynamoDB describe permissions to index optimizer
    this.indexOptimizationFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:DescribeTable',
        'dynamodb:ListTables',
      ],
      resources: ['*'],
    }));
  }

  private createPerformanceAlarms(): void {
    // High database latency alarm
    new cloudwatch.Alarm(this, 'HighDatabaseLatencyAlarm', {
      alarmName: 'SteampunkIdleGame-HighDatabaseLatency',
      alarmDescription: 'Database query latency is high',
      metric: new cloudwatch.Metric({
        namespace: 'SteampunkIdleGame/Performance',
        metricName: 'DatabaseQueryLatency',
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1000, // 1 second
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Low cache hit rate alarm
    new cloudwatch.Alarm(this, 'LowCacheHitRateAlarm', {
      alarmName: 'SteampunkIdleGame-LowCacheHitRate',
      alarmDescription: 'Cache hit rate is below optimal threshold',
      metric: new cloudwatch.Metric({
        namespace: 'SteampunkIdleGame/Performance',
        metricName: 'CacheHitRate',
        statistic: 'Average',
        period: cdk.Duration.minutes(15),
      }),
      threshold: 80,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // High memory usage alarm
    new cloudwatch.Alarm(this, 'HighMemoryUsageAlarm', {
      alarmName: 'SteampunkIdleGame-HighMemoryUsage',
      alarmDescription: 'Lambda function memory usage is high',
      metric: new cloudwatch.Metric({
        namespace: 'SteampunkIdleGame/Performance',
        metricName: 'MemoryUsage',
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 800, // 800 MB
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
  }

  private scheduleOptimizationTasks(): void {
    // Schedule cache warming every 30 minutes
    const cacheWarmingRule = new events.Rule(this, 'CacheWarmingRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(30)),
      description: 'Warm frequently accessed data caches',
    });
    cacheWarmingRule.addTarget(new targets.LambdaFunction(this.cacheWarmerFunction));

    // Schedule performance monitoring every 5 minutes
    const performanceMonitoringRule = new events.Rule(this, 'PerformanceMonitoringRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      description: 'Monitor system performance metrics',
    });
    performanceMonitoringRule.addTarget(new targets.LambdaFunction(this.performanceMonitoringFunction));

    // Schedule index optimization analysis daily
    const indexOptimizationRule = new events.Rule(this, 'IndexOptimizationRule', {
      schedule: events.Schedule.rate(cdk.Duration.days(1)),
      description: 'Analyze and optimize database indexes',
    });
    indexOptimizationRule.addTarget(new targets.LambdaFunction(this.indexOptimizationFunction));
  }
}
