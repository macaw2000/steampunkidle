import React, { useState } from 'react';
import { TaskQueueDataExporter, ExportOptions, ExportResult } from '../../services/taskQueueDataExporter';
import './TaskQueueDataExporter.css';

interface TaskQueueDataExporterProps {
  dataExporter: TaskQueueDataExporter;
}

export const TaskQueueDataExporterComponent: React.FC<TaskQueueDataExporterProps> = ({
  dataExporter
}) => {
  const [exportType, setExportType] = useState<'player' | 'analytics' | 'debug' | 'errors' | 'performance' | 'system' | 'timerange' | 'bulk'>('analytics');
  const [playerId, setPlayerId] = useState('');
  const [playerIds, setPlayerIds] = useState('');
  const [format, setFormat] = useState<'json' | 'csv' | 'xlsx' | 'xml'>('json');
  const [dateRange, setDateRange] = useState({
    enabled: false,
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [options, setOptions] = useState({
    includeDebugData: false,
    includePlayerData: true,
    includeSystemMetrics: true,
    compression: false
  });
  const [timeRangeDataTypes, setTimeRangeDataTypes] = useState({
    queues: true,
    traces: false,
    errors: true,
    metrics: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportHistory, setExportHistory] = useState<(ExportResult & { timestamp: number; type: string })[]>([]);

  const handleExport = async () => {
    if (!validateInputs()) return;

    try {
      setLoading(true);
      setError(null);

      const exportOptions: ExportOptions = {
        format,
        ...(dateRange.enabled && {
          dateRange: {
            start: new Date(dateRange.start).getTime(),
            end: new Date(dateRange.end).getTime()
          }
        }),
        includeDebugData: options.includeDebugData,
        includePlayerData: options.includePlayerData,
        includeSystemMetrics: options.includeSystemMetrics,
        compression: options.compression
      };

      let result: ExportResult;

      switch (exportType) {
        case 'player':
          result = await dataExporter.exportPlayerData(playerId, exportOptions);
          break;
        case 'analytics':
          result = await dataExporter.exportAnalyticsData(exportOptions);
          break;
        case 'debug':
          result = await dataExporter.exportDebugTraces(playerId || undefined, exportOptions);
          break;
        case 'errors':
          result = await dataExporter.exportErrorAnalysis(exportOptions);
          break;
        case 'performance':
          result = await dataExporter.exportPerformanceMetrics(exportOptions);
          break;
        case 'system':
          result = await dataExporter.exportSystemReport(exportOptions);
          break;
        case 'timerange':
          const selectedTypes = Object.entries(timeRangeDataTypes)
            .filter(([_, selected]) => selected)
            .map(([type, _]) => type) as ('queues' | 'traces' | 'errors' | 'metrics')[];
          
          result = await dataExporter.exportTimeRangeData(
            new Date(dateRange.start).getTime(),
            new Date(dateRange.end).getTime(),
            selectedTypes,
            { format, ...options }
          );
          break;
        case 'bulk':
          const playerIdList = playerIds.split(',').map(id => id.trim()).filter(id => id);
          result = await dataExporter.exportBulkPlayerData(playerIdList, exportOptions);
          break;
        default:
          throw new Error('Invalid export type');
      }

      // Download the file
      downloadFile(result);

      // Add to history
      setExportHistory(prev => [{
        ...result,
        timestamp: Date.now(),
        type: exportType
      }, ...prev.slice(0, 9)]); // Keep last 10 exports

    } catch (err) {
      setError(`Export failed: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const validateInputs = (): boolean => {
    if (exportType === 'player' && !playerId.trim()) {
      setError('Player ID is required for player export');
      return false;
    }

    if (exportType === 'bulk' && !playerIds.trim()) {
      setError('Player IDs are required for bulk export');
      return false;
    }

    if (dateRange.enabled && new Date(dateRange.start) >= new Date(dateRange.end)) {
      setError('Start date must be before end date');
      return false;
    }

    if (exportType === 'timerange' && !Object.values(timeRangeDataTypes).some(Boolean)) {
      setError('At least one data type must be selected for time range export');
      return false;
    }

    return true;
  };

  const downloadFile = (result: ExportResult) => {
    const blob = new Blob([result.data], { type: result.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="task-queue-data-exporter">
      <div className="exporter-header">
        <h2>Data Export Tools</h2>
        <div className="export-type-selector">
          <label>Export Type:</label>
          <select value={exportType} onChange={(e) => setExportType(e.target.value as any)}>
            <option value="analytics">System Analytics</option>
            <option value="player">Player Data</option>
            <option value="debug">Debug Traces</option>
            <option value="errors">Error Analysis</option>
            <option value="performance">Performance Metrics</option>
            <option value="system">System Report</option>
            <option value="timerange">Time Range Data</option>
            <option value="bulk">Bulk Player Data</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="export-configuration">
        <div className="config-section">
          <h3>Export Configuration</h3>
          
          {(exportType === 'player' || exportType === 'debug') && (
            <div className="input-group">
              <label>Player ID:</label>
              <input
                type="text"
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
                placeholder="Enter player ID (optional for debug traces)"
                className="player-input"
              />
            </div>
          )}

          {exportType === 'bulk' && (
            <div className="input-group">
              <label>Player IDs (comma-separated):</label>
              <textarea
                value={playerIds}
                onChange={(e) => setPlayerIds(e.target.value)}
                placeholder="player1, player2, player3..."
                className="player-ids-input"
                rows={3}
              />
            </div>
          )}

          <div className="input-group">
            <label>Format:</label>
            <select value={format} onChange={(e) => setFormat(e.target.value as any)}>
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
              <option value="xlsx">Excel (XLSX)</option>
              <option value="xml">XML</option>
            </select>
          </div>

          <div className="input-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={dateRange.enabled}
                onChange={(e) => setDateRange(prev => ({ ...prev, enabled: e.target.checked }))}
              />
              Filter by Date Range
            </label>
          </div>

          {dateRange.enabled && (
            <div className="date-range-inputs">
              <div className="date-input">
                <label>Start Date:</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                />
              </div>
              <div className="date-input">
                <label>End Date:</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                />
              </div>
            </div>
          )}

          {exportType === 'timerange' && (
            <div className="data-types-selection">
              <label>Data Types to Include:</label>
              <div className="data-type-checkboxes">
                {Object.entries(timeRangeDataTypes).map(([type, selected]) => (
                  <label key={type} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(e) => setTimeRangeDataTypes(prev => ({
                        ...prev,
                        [type]: e.target.checked
                      }))}
                    />
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="config-section">
          <h3>Export Options</h3>
          
          <div className="options-checkboxes">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={options.includeDebugData}
                onChange={(e) => setOptions(prev => ({ ...prev, includeDebugData: e.target.checked }))}
              />
              Include Debug Data
            </label>
            
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={options.includePlayerData}
                onChange={(e) => setOptions(prev => ({ ...prev, includePlayerData: e.target.checked }))}
              />
              Include Player Data
            </label>
            
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={options.includeSystemMetrics}
                onChange={(e) => setOptions(prev => ({ ...prev, includeSystemMetrics: e.target.checked }))}
              />
              Include System Metrics
            </label>
            
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={options.compression}
                onChange={(e) => setOptions(prev => ({ ...prev, compression: e.target.checked }))}
              />
              Enable Compression
            </label>
          </div>
        </div>
      </div>

      <div className="export-actions">
        <button
          onClick={handleExport}
          disabled={loading}
          className="export-btn"
        >
          {loading ? 'Exporting...' : 'Export Data'}
        </button>
      </div>

      {exportHistory.length > 0 && (
        <div className="export-history">
          <h3>Export History</h3>
          <div className="history-list">
            {exportHistory.map((export_, index) => (
              <div key={index} className="history-item">
                <div className="history-info">
                  <span className="filename">{export_.filename}</span>
                  <span className="export-type">{export_.type}</span>
                  <span className="file-size">{formatFileSize(export_.size)}</span>
                  <span className="timestamp">
                    {new Date(export_.timestamp).toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={() => downloadFile(export_)}
                  className="redownload-btn"
                >
                  Download Again
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="export-info">
        <h3>Export Types Information</h3>
        <div className="info-grid">
          <div className="info-item">
            <strong>System Analytics:</strong>
            <p>Comprehensive system-wide analytics including player statistics, usage patterns, and performance metrics.</p>
          </div>
          <div className="info-item">
            <strong>Player Data:</strong>
            <p>Individual player queue data, task history, and performance metrics for a specific player.</p>
          </div>
          <div className="info-item">
            <strong>Debug Traces:</strong>
            <p>Detailed execution traces for troubleshooting task queue issues and performance problems.</p>
          </div>
          <div className="info-item">
            <strong>Error Analysis:</strong>
            <p>Error logs, trends, and analysis data for identifying and resolving system issues.</p>
          </div>
          <div className="info-item">
            <strong>Performance Metrics:</strong>
            <p>Task execution times, throughput metrics, and system performance data.</p>
          </div>
          <div className="info-item">
            <strong>System Report:</strong>
            <p>Complete system health report including all analytics, errors, and performance data.</p>
          </div>
          <div className="info-item">
            <strong>Time Range Data:</strong>
            <p>Export specific data types for a custom time range with flexible data type selection.</p>
          </div>
          <div className="info-item">
            <strong>Bulk Player Data:</strong>
            <p>Export data for multiple players simultaneously for batch analysis and reporting.</p>
          </div>
        </div>
      </div>
    </div>
  );
};