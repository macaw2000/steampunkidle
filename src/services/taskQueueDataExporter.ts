import { TaskQueue, Task, TaskQueueStats } from '../types/taskQueue';
import { TaskExecutionTrace } from './taskQueueDebugger';

export interface ExportOptions {
  format: 'json' | 'csv' | 'xlsx' | 'xml';
  dateRange?: {
    start: number;
    end: number;
  };
  includeDebugData?: boolean;
  includePlayerData?: boolean;
  includeSystemMetrics?: boolean;
  compression?: boolean;
}

export interface ExportResult {
  filename: string;
  data: string | Uint8Array;
  mimeType: string;
  size: number;
}

export interface AnalyticsData {
  playerQueues: PlayerQueueAnalytics[];
  systemMetrics: SystemMetrics;
  taskPerformance: TaskPerformanceMetrics[];
  errorAnalysis: ErrorAnalysisData;
  usagePatterns: UsagePatternData;
}

export interface PlayerQueueAnalytics {
  playerId: string;
  playerName: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageTaskTime: number;
  mostUsedTaskTypes: { type: string; count: number }[];
  activityPeriods: { start: number; end: number; taskCount: number }[];
  errorRate: number;
  lastActivity: number;
}

export interface SystemMetrics {
  totalPlayers: number;
  activePlayers: number;
  totalTasksProcessed: number;
  averageQueueLength: number;
  systemUptime: number;
  errorRate: number;
  performanceMetrics: {
    averageResponseTime: number;
    throughput: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}

export interface TaskPerformanceMetrics {
  taskType: string;
  totalExecutions: number;
  averageExecutionTime: number;
  successRate: number;
  commonErrors: string[];
  performanceTrend: { timestamp: number; executionTime: number }[];
}

export interface ErrorAnalysisData {
  totalErrors: number;
  errorsByType: { type: string; count: number; percentage: number }[];
  errorsByPlayer: { playerId: string; errorCount: number }[];
  errorTrends: { timestamp: number; errorCount: number }[];
  criticalErrors: { timestamp: number; error: string; playerId: string }[];
}

export interface UsagePatternData {
  peakHours: { hour: number; taskCount: number }[];
  popularTaskTypes: { type: string; count: number; percentage: number }[];
  averageSessionLength: number;
  retentionMetrics: {
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
    monthlyActiveUsers: number;
  };
}

export class TaskQueueDataExporter {
  private baseUrl: string;
  private adminToken: string;

  constructor(baseUrl: string, adminToken: string) {
    this.baseUrl = baseUrl;
    this.adminToken = adminToken;
  }

  /**
   * Export player queue data
   */
  async exportPlayerData(playerId: string, options: ExportOptions): Promise<ExportResult> {
    try {
      const playerData = await this.fetchPlayerData(playerId, options);
      return this.formatExportData(playerData, options, `player_${playerId}`);
    } catch (error) {
      console.error('Error exporting player data:', error);
      throw error;
    }
  }

  /**
   * Export system-wide analytics data
   */
  async exportAnalyticsData(options: ExportOptions): Promise<ExportResult> {
    try {
      const analyticsData = await this.fetchAnalyticsData(options);
      return this.formatExportData(analyticsData, options, 'system_analytics');
    } catch (error) {
      console.error('Error exporting analytics data:', error);
      throw error;
    }
  }

  /**
   * Export debug traces for troubleshooting
   */
  async exportDebugTraces(playerId?: string, options: ExportOptions = { format: 'json' }): Promise<ExportResult> {
    try {
      const debugData = await this.fetchDebugTraces(playerId, options);
      const filename = playerId ? `debug_traces_${playerId}` : 'debug_traces_all';
      return this.formatExportData(debugData, options, filename);
    } catch (error) {
      console.error('Error exporting debug traces:', error);
      throw error;
    }
  }

  /**
   * Export error logs and analysis
   */
  async exportErrorAnalysis(options: ExportOptions): Promise<ExportResult> {
    try {
      const errorData = await this.fetchErrorAnalysis(options);
      return this.formatExportData(errorData, options, 'error_analysis');
    } catch (error) {
      console.error('Error exporting error analysis:', error);
      throw error;
    }
  }

  /**
   * Export performance metrics
   */
  async exportPerformanceMetrics(options: ExportOptions): Promise<ExportResult> {
    try {
      const performanceData = await this.fetchPerformanceMetrics(options);
      return this.formatExportData(performanceData, options, 'performance_metrics');
    } catch (error) {
      console.error('Error exporting performance metrics:', error);
      throw error;
    }
  }

  /**
   * Export comprehensive system report
   */
  async exportSystemReport(options: ExportOptions): Promise<ExportResult> {
    try {
      const [analytics, errors, performance, debug] = await Promise.all([
        this.fetchAnalyticsData(options),
        this.fetchErrorAnalysis(options),
        this.fetchPerformanceMetrics(options),
        options.includeDebugData ? this.fetchDebugTraces(undefined, options) : null
      ]);

      const systemReport = {
        generatedAt: Date.now(),
        dateRange: options.dateRange,
        analytics,
        errors,
        performance,
        ...(debug && { debugTraces: debug })
      };

      return this.formatExportData(systemReport, options, 'system_report');
    } catch (error) {
      console.error('Error exporting system report:', error);
      throw error;
    }
  }

  /**
   * Export data for specific time range
   */
  async exportTimeRangeData(
    startTime: number,
    endTime: number,
    dataTypes: ('queues' | 'traces' | 'errors' | 'metrics')[],
    options: Omit<ExportOptions, 'dateRange'>
  ): Promise<ExportResult> {
    const exportOptions: ExportOptions = {
      ...options,
      dateRange: { start: startTime, end: endTime }
    };

    try {
      const data: any = {
        timeRange: { start: startTime, end: endTime },
        generatedAt: Date.now()
      };

      if (dataTypes.includes('queues')) {
        data.queueData = await this.fetchQueueDataForTimeRange(startTime, endTime);
      }

      if (dataTypes.includes('traces')) {
        data.traceData = await this.fetchDebugTraces(undefined, exportOptions);
      }

      if (dataTypes.includes('errors')) {
        data.errorData = await this.fetchErrorAnalysis(exportOptions);
      }

      if (dataTypes.includes('metrics')) {
        data.metricsData = await this.fetchPerformanceMetrics(exportOptions);
      }

      const filename = `timerange_${new Date(startTime).toISOString().split('T')[0]}_to_${new Date(endTime).toISOString().split('T')[0]}`;
      return this.formatExportData(data, exportOptions, filename);
    } catch (error) {
      console.error('Error exporting time range data:', error);
      throw error;
    }
  }

  /**
   * Export data for multiple players (bulk export)
   */
  async exportBulkPlayerData(playerIds: string[], options: ExportOptions): Promise<ExportResult> {
    try {
      const playerDataPromises = playerIds.map(playerId => 
        this.fetchPlayerData(playerId, options).catch(error => ({
          playerId,
          error: error.message
        }))
      );

      const playerDataResults = await Promise.all(playerDataPromises);
      
      const bulkData = {
        exportedAt: Date.now(),
        playerCount: playerIds.length,
        players: playerDataResults
      };

      return this.formatExportData(bulkData, options, `bulk_player_data_${playerIds.length}_players`);
    } catch (error) {
      console.error('Error exporting bulk player data:', error);
      throw error;
    }
  }

  // Private helper methods

  private async fetchPlayerData(playerId: string, options: ExportOptions): Promise<any> {
    const queryParams = new URLSearchParams();
    if (options.dateRange) {
      queryParams.append('startTime', options.dateRange.start.toString());
      queryParams.append('endTime', options.dateRange.end.toString());
    }
    if (options.includeDebugData) {
      queryParams.append('includeDebug', 'true');
    }

    const response = await fetch(`${this.baseUrl}/admin/export/player/${playerId}?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${this.adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch player data: ${response.statusText}`);
    }

    return await response.json();
  }

  private async fetchAnalyticsData(options: ExportOptions): Promise<AnalyticsData> {
    const queryParams = new URLSearchParams();
    if (options.dateRange) {
      queryParams.append('startTime', options.dateRange.start.toString());
      queryParams.append('endTime', options.dateRange.end.toString());
    }

    const response = await fetch(`${this.baseUrl}/admin/export/analytics?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${this.adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch analytics data: ${response.statusText}`);
    }

    return await response.json();
  }

  private async fetchDebugTraces(playerId?: string, options: ExportOptions = { format: 'json' }): Promise<TaskExecutionTrace[]> {
    const queryParams = new URLSearchParams();
    if (playerId) {
      queryParams.append('playerId', playerId);
    }
    if (options.dateRange) {
      queryParams.append('startTime', options.dateRange.start.toString());
      queryParams.append('endTime', options.dateRange.end.toString());
    }

    const response = await fetch(`${this.baseUrl}/admin/export/traces?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${this.adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch debug traces: ${response.statusText}`);
    }

    const data = await response.json();
    return data.traces || [];
  }

  private async fetchErrorAnalysis(options: ExportOptions): Promise<ErrorAnalysisData> {
    const queryParams = new URLSearchParams();
    if (options.dateRange) {
      queryParams.append('startTime', options.dateRange.start.toString());
      queryParams.append('endTime', options.dateRange.end.toString());
    }

    const response = await fetch(`${this.baseUrl}/admin/export/errors?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${this.adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch error analysis: ${response.statusText}`);
    }

    return await response.json();
  }

  private async fetchPerformanceMetrics(options: ExportOptions): Promise<TaskPerformanceMetrics[]> {
    const queryParams = new URLSearchParams();
    if (options.dateRange) {
      queryParams.append('startTime', options.dateRange.start.toString());
      queryParams.append('endTime', options.dateRange.end.toString());
    }

    const response = await fetch(`${this.baseUrl}/admin/export/performance?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${this.adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch performance metrics: ${response.statusText}`);
    }

    const data = await response.json();
    return data.metrics || [];
  }

  private async fetchQueueDataForTimeRange(startTime: number, endTime: number): Promise<any> {
    const response = await fetch(`${this.baseUrl}/admin/export/queues?startTime=${startTime}&endTime=${endTime}`, {
      headers: {
        'Authorization': `Bearer ${this.adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch queue data: ${response.statusText}`);
    }

    return await response.json();
  }

  private async formatExportData(data: any, options: ExportOptions, baseFilename: string): Promise<ExportResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${baseFilename}_${timestamp}`;

    switch (options.format) {
      case 'json':
        return this.formatAsJSON(data, filename, options.compression);
      case 'csv':
        return this.formatAsCSV(data, filename);
      case 'xlsx':
        return this.formatAsXLSX(data, filename);
      case 'xml':
        return this.formatAsXML(data, filename);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  private formatAsJSON(data: any, filename: string, compression?: boolean): ExportResult {
    const jsonString = JSON.stringify(data, null, 2);
    
    if (compression) {
      // In a real implementation, you would use a compression library like pako
      // For now, we'll just return the uncompressed data
      console.warn('Compression requested but not implemented');
    }

    return {
      filename: `${filename}.json`,
      data: jsonString,
      mimeType: 'application/json',
      size: jsonString.length
    };
  }

  private formatAsCSV(data: any, filename: string): ExportResult {
    let csvContent = '';

    if (Array.isArray(data)) {
      if (data.length > 0) {
        // Use keys from first object as headers
        const headers = Object.keys(data[0]);
        csvContent = headers.join(',') + '\n';
        
        data.forEach(row => {
          const values = headers.map(header => {
            const value = row[header];
            if (typeof value === 'object') {
              return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
            }
            return `"${String(value).replace(/"/g, '""')}"`;
          });
          csvContent += values.join(',') + '\n';
        });
      }
    } else {
      // Convert object to key-value CSV
      csvContent = 'Key,Value\n';
      Object.entries(data).forEach(([key, value]) => {
        const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
        csvContent += `"${key}","${valueStr.replace(/"/g, '""')}"\n`;
      });
    }

    return {
      filename: `${filename}.csv`,
      data: csvContent,
      mimeType: 'text/csv',
      size: csvContent.length
    };
  }

  private formatAsXLSX(data: any, filename: string): ExportResult {
    // In a real implementation, you would use a library like xlsx or exceljs
    // For now, we'll return CSV format with xlsx extension
    console.warn('XLSX format not fully implemented, returning CSV format');
    const csvResult = this.formatAsCSV(data, filename);
    
    return {
      ...csvResult,
      filename: `${filename}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
  }

  private formatAsXML(data: any, filename: string): ExportResult {
    const xmlContent = this.objectToXML(data, 'root');
    
    return {
      filename: `${filename}.xml`,
      data: xmlContent,
      mimeType: 'application/xml',
      size: xmlContent.length
    };
  }

  private objectToXML(obj: any, rootName: string): string {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<${rootName}>\n`;
    
    const convertValue = (value: any, key: string, indent: string): string => {
      if (value === null || value === undefined) {
        return `${indent}<${key}></${key}>\n`;
      }
      
      if (typeof value === 'object') {
        if (Array.isArray(value)) {
          let result = `${indent}<${key}>\n`;
          value.forEach((item, index) => {
            result += convertValue(item, 'item', indent + '  ');
          });
          result += `${indent}</${key}>\n`;
          return result;
        } else {
          let result = `${indent}<${key}>\n`;
          Object.entries(value).forEach(([k, v]) => {
            result += convertValue(v, k, indent + '  ');
          });
          result += `${indent}</${key}>\n`;
          return result;
        }
      }
      
      return `${indent}<${key}>${String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</${key}>\n`;
    };
    
    Object.entries(obj).forEach(([key, value]) => {
      xml += convertValue(value, key, '  ');
    });
    
    xml += `</${rootName}>`;
    return xml;
  }
}