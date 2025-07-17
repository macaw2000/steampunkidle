import * as cdk from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

export interface LogMetricsProps {
  logGroups: logs.LogGroup[];
  environment: string;
}

export class LogMetrics extends Construct {
  constructor(scope: Construct, id: string, props: LogMetricsProps) {
    super(scope, id);

    // Create metric filters for custom metrics logged by Lambda functions
    this.createCustomMetricFilters(props.logGroups, props.environment);
    
    // Create metric filters for error tracking
    this.createErrorMetricFilters(props.logGroups, props.environment);
    
    // Create metric filters for performance tracking
    this.createPerformanceMetricFilters(props.logGroups, props.environment);
    
    // Create metric filters for business events
    this.createBusinessEventFilters(props.logGroups, props.environment);
  }

  private createCustomMetricFilters(logGroups: logs.LogGroup[], environment: string) {
    logGroups.forEach((logGroup, index) => {
      // Filter for custom metrics logged in structured format
      new logs.MetricFilter(this, `CustomMetricFilter${index}`, {
        logGroup,
        metricNamespace: 'SteampunkIdleGame/CustomMetrics',
        metricName: 'CustomMetricCount',
        filterPattern: logs.FilterPattern.literal('[timestamp, level="INFO", message, context, data]'),
        metricValue: '1',
        defaultValue: 0,
      });

      // Filter for health check metrics
      new logs.MetricFilter(this, `HealthCheckMetricFilter${index}`, {
        logGroup,
        metricNamespace: 'SteampunkIdleGame/Health',
        metricName: 'HealthCheckRequests',
        filterPattern: logs.FilterPattern.literal('[timestamp, level="INFO", message="Health check started", ...]'),
        metricValue: '1',
        defaultValue: 0,
      });

      // Filter for API request metrics
      new logs.MetricFilter(this, `ApiRequestMetricFilter${index}`, {
        logGroup,
        metricNamespace: 'SteampunkIdleGame/API',
        metricName: 'ApiRequests',
        filterPattern: logs.FilterPattern.literal('[timestamp, level="INFO", message="API request received", ...]'),
        metricValue: '1',
        defaultValue: 0,
      });
    });
  }

  private createErrorMetricFilters(logGroups: logs.LogGroup[], environment: string) {
    logGroups.forEach((logGroup, index) => {
      // Filter for ERROR level logs
      new logs.MetricFilter(this, `ErrorLogFilter${index}`, {
        logGroup,
        metricNamespace: 'SteampunkIdleGame/Errors',
        metricName: 'ErrorCount',
        filterPattern: logs.FilterPattern.literal('[timestamp, level="ERROR", ...]'),
        metricValue: '1',
        defaultValue: 0,
      });

      // Filter for authentication errors
      new logs.MetricFilter(this, `AuthErrorFilter${index}`, {
        logGroup,
        metricNamespace: 'SteampunkIdleGame/Auth',
        metricName: 'AuthenticationErrors',
        filterPattern: logs.FilterPattern.literal('[..., message="*authentication*failed*", ...]'),
        metricValue: '1',
        defaultValue: 0,
      });

      // Filter for database errors
      new logs.MetricFilter(this, `DatabaseErrorFilter${index}`, {
        logGroup,
        metricNamespace: 'SteampunkIdleGame/Database',
        metricName: 'DatabaseErrors',
        filterPattern: logs.FilterPattern.literal('[..., message="*database*error*", ...]'),
        metricValue: '1',
        defaultValue: 0,
      });

      // Filter for timeout errors
      new logs.MetricFilter(this, `TimeoutErrorFilter${index}`, {
        logGroup,
        metricNamespace: 'SteampunkIdleGame/Performance',
        metricName: 'TimeoutErrors',
        filterPattern: logs.FilterPattern.literal('[..., message="*timeout*", ...]'),
        metricValue: '1',
        defaultValue: 0,
      });
    });
  }

  private createPerformanceMetricFilters(logGroups: logs.LogGroup[], environment: string) {
    logGroups.forEach((logGroup, index) => {
      // Filter for slow requests (duration > 5000ms)
      new logs.MetricFilter(this, `SlowRequestFilter${index}`, {
        logGroup,
        metricNamespace: 'SteampunkIdleGame/Performance',
        metricName: 'SlowRequests',
        filterPattern: logs.FilterPattern.literal('[timestamp, level="INFO", message="API response sent", context, data]')
          .whereString('$.data.duration', '>', '5000'),
        metricValue: '$.data.duration',
        defaultValue: 0,
      });

      // Filter for database operation performance
      new logs.MetricFilter(this, `DatabasePerformanceFilter${index}`, {
        logGroup,
        metricNamespace: 'SteampunkIdleGame/Database',
        metricName: 'DatabaseOperationDuration',
        filterPattern: logs.FilterPattern.literal('[timestamp, level="INFO", message="Database operation completed", ...]'),
        metricValue: '$.data.duration',
        defaultValue: 0,
      });

      // Filter for memory usage warnings
      new logs.MetricFilter(this, `MemoryUsageFilter${index}`, {
        logGroup,
        metricNamespace: 'SteampunkIdleGame/Performance',
        metricName: 'HighMemoryUsage',
        filterPattern: logs.FilterPattern.literal('[..., message="*memory*usage*high*", ...]'),
        metricValue: '1',
        defaultValue: 0,
      });
    });
  }

  private createBusinessEventFilters(logGroups: logs.LogGroup[], environment: string) {
    logGroups.forEach((logGroup, index) => {
      // Filter for user registrations
      new logs.MetricFilter(this, `UserRegistrationFilter${index}`, {
        logGroup,
        metricNamespace: 'SteampunkIdleGame/Business',
        metricName: 'UserRegistrations',
        filterPattern: logs.FilterPattern.literal('[timestamp, level="INFO", message="Business event occurred", context, data]')
          .whereString('$.data.eventType', '=', 'user_registered'),
        metricValue: '1',
        defaultValue: 0,
      });

      // Filter for character creations
      new logs.MetricFilter(this, `CharacterCreationFilter${index}`, {
        logGroup,
        metricNamespace: 'SteampunkIdleGame/Business',
        metricName: 'CharacterCreations',
        filterPattern: logs.FilterPattern.literal('[timestamp, level="INFO", message="Business event occurred", context, data]')
          .whereString('$.data.eventType', '=', 'character_created'),
        metricValue: '1',
        defaultValue: 0,
      });

      // Filter for guild activities
      new logs.MetricFilter(this, `GuildActivityFilter${index}`, {
        logGroup,
        metricNamespace: 'SteampunkIdleGame/Business',
        metricName: 'GuildActivities',
        filterPattern: logs.FilterPattern.literal('[timestamp, level="INFO", message="Business event occurred", context, data]')
          .whereString('$.data.eventType', '=', 'guild_*'),
        metricValue: '1',
        defaultValue: 0,
      });

      // Filter for auction transactions
      new logs.MetricFilter(this, `AuctionTransactionFilter${index}`, {
        logGroup,
        metricNamespace: 'SteampunkIdleGame/Business',
        metricName: 'AuctionTransactions',
        filterPattern: logs.FilterPattern.literal('[timestamp, level="INFO", message="Business event occurred", context, data]')
          .whereString('$.data.eventType', '=', 'auction_*'),
        metricValue: '1',
        defaultValue: 0,
      });

      // Filter for chat messages
      new logs.MetricFilter(this, `ChatMessageFilter${index}`, {
        logGroup,
        metricNamespace: 'SteampunkIdleGame/Business',
        metricName: 'ChatMessages',
        filterPattern: logs.FilterPattern.literal('[timestamp, level="INFO", message="Business event occurred", context, data]')
          .whereString('$.data.eventType', '=', 'chat_message_sent'),
        metricValue: '1',
        defaultValue: 0,
      });

      // Filter for crafting activities
      new logs.MetricFilter(this, `CraftingActivityFilter${index}`, {
        logGroup,
        metricNamespace: 'SteampunkIdleGame/Business',
        metricName: 'CraftingActivities',
        filterPattern: logs.FilterPattern.literal('[timestamp, level="INFO", message="Business event occurred", context, data]')
          .whereString('$.data.eventType', '=', 'crafting_*'),
        metricValue: '1',
        defaultValue: 0,
      });
    });
  }
}