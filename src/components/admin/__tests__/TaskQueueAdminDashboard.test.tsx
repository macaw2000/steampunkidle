/**
 * Tests for Task Queue Admin Dashboard Component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskQueueAdminDashboard from '../TaskQueueAdminDashboard';
import { taskQueueMetrics } from '../../../services/taskQueueMetrics';
import { taskQueueAlerting, AlertSeverity, AlertType } from '../../../services/taskQueueAlerting';

// Mock the services
jest.mock('../../../services/taskQueueMetrics');
jest.mock('../../../services/taskQueueAlerting');

const mockMetrics = {
  averageTaskProcessingTime: 1500,
  taskProcessingTimeP95: 2500,
  taskProcessingTimeP99: 3500,
  tasksProcessedPerSecond: 2.5,
  averageQueueLength: 15,
  maxQueueLength: 45,
  queueLengthDistribution: {
    '0-9': 25,
    '10-19': 15,
    '20-29': 8,
    '30-39': 3,
    '40-49': 1
  },
  errorRate: 2.5,
  taskFailureRate: 2.5,
  validationFailureRate: 1.2,
  syncFailureRate: 0.8,
  memoryUsage: 512 * 1024 * 1024, // 512MB
  cpuUsage: 45.5,
  databaseConnectionCount: 10,
  cacheHitRate: 85.2,
  activePlayerCount: 150,
  concurrentQueueCount: 120,
  playerEngagementRate: 80.0
};

const mockAlerts = [
  {
    id: 'alert1',
    type: AlertType.HIGH_ERROR_RATE,
    severity: AlertSeverity.HIGH,
    title: 'High Task Error Rate Detected',
    message: 'Task error rate is 6.5%, exceeding the 5% threshold',
    timestamp: Date.now() - 300000, // 5 minutes ago
    metrics: mockMetrics,
    acknowledged: false,
    resolved: false
  },
  {
    id: 'alert2',
    type: AlertType.PERFORMANCE_DEGRADATION,
    severity: AlertSeverity.MEDIUM,
    title: 'Task Processing Performance Degradation',
    message: 'Average task processing time is 35000ms, exceeding 30s threshold',
    timestamp: Date.now() - 600000, // 10 minutes ago
    metrics: mockMetrics,
    acknowledged: true,
    resolved: false,
    acknowledgedBy: 'admin'
  }
];

describe('TaskQueueAdminDashboard', () => {
  beforeEach(() => {
    (taskQueueMetrics.exportMetrics as jest.Mock).mockReturnValue(mockMetrics);
    (taskQueueAlerting.getActiveAlerts as jest.Mock).mockReturnValue(mockAlerts);
    (taskQueueAlerting.acknowledgeAlert as jest.Mock).mockResolvedValue(true);
    (taskQueueAlerting.resolveAlert as jest.Mock).mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders dashboard with overview tab by default', async () => {
    render(<TaskQueueAdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Task Queue Admin Dashboard')).toBeInTheDocument();
    });

    // Check that overview tab is active
    expect(screen.getByText('Overview')).toHaveClass('active');
    
    // Check that metric cards are displayed
    expect(screen.getByText('Average Processing Time')).toBeInTheDocument();
    expect(screen.getByText('1500')).toBeInTheDocument(); // Processing time value
    expect(screen.getByText('ms')).toBeInTheDocument();
    
    expect(screen.getByText('Error Rate')).toBeInTheDocument();
    expect(screen.getByText('2.50')).toBeInTheDocument(); // Error rate value
    expect(screen.getByText('%')).toBeInTheDocument();
  });

  test('displays alerts in overview tab', async () => {
    render(<TaskQueueAdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Active Alerts (2)')).toBeInTheDocument();
    });

    expect(screen.getByText('High Task Error Rate Detected')).toBeInTheDocument();
    expect(screen.getByText('Task Processing Performance Degradation')).toBeInTheDocument();
  });

  test('switches to metrics tab correctly', async () => {
    render(<TaskQueueAdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Task Queue Admin Dashboard')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Metrics'));

    expect(screen.getByText('Metrics')).toHaveClass('active');
    expect(screen.getByText('Performance Metrics')).toBeInTheDocument();
    expect(screen.getByText('System Resources')).toBeInTheDocument();
  });

  test('displays performance metrics table', async () => {
    render(<TaskQueueAdminDashboard />);

    await waitFor(() => {
      fireEvent.click(screen.getByText('Metrics'));
    });

    expect(screen.getByText('Task Processing Time')).toBeInTheDocument();
    expect(screen.getByText('1500ms')).toBeInTheDocument(); // Current value
    expect(screen.getByText('2500ms')).toBeInTheDocument(); // P95
    expect(screen.getByText('3500ms')).toBeInTheDocument(); // P99
  });

  test('displays resource usage bars', async () => {
    render(<TaskQueueAdminDashboard />);

    await waitFor(() => {
      fireEvent.click(screen.getByText('Metrics'));
    });

    expect(screen.getByText('Memory Usage')).toBeInTheDocument();
    expect(screen.getByText('512MB')).toBeInTheDocument();
    
    expect(screen.getByText('CPU Usage')).toBeInTheDocument();
    expect(screen.getByText('45.5%')).toBeInTheDocument();
    
    expect(screen.getByText('Cache Hit Rate')).toBeInTheDocument();
    expect(screen.getByText('85.2%')).toBeInTheDocument();
  });

  test('switches to alerts tab and displays alert management', async () => {
    render(<TaskQueueAdminDashboard />);

    await waitFor(() => {
      fireEvent.click(screen.getByText(/Alerts \(2\)/));
    });

    expect(screen.getByText('Alert Management')).toBeInTheDocument();
    expect(screen.getByText('Critical: 0')).toBeInTheDocument();
    expect(screen.getByText('High: 1')).toBeInTheDocument();
    expect(screen.getByText('Medium: 1')).toBeInTheDocument();
    expect(screen.getByText('Low: 0')).toBeInTheDocument();
  });

  test('acknowledges alerts correctly', async () => {
    render(<TaskQueueAdminDashboard />);

    await waitFor(() => {
      fireEvent.click(screen.getByText(/Alerts \(2\)/));
    });

    const acknowledgeButtons = screen.getAllByText('Ack');
    expect(acknowledgeButtons).toHaveLength(1); // Only unacknowledged alert should have button

    fireEvent.click(acknowledgeButtons[0]);

    await waitFor(() => {
      expect(taskQueueAlerting.acknowledgeAlert).toHaveBeenCalledWith('alert1', 'admin');
    });
  });

  test('resolves alerts correctly', async () => {
    render(<TaskQueueAdminDashboard />);

    await waitFor(() => {
      fireEvent.click(screen.getByText(/Alerts \(2\)/));
    });

    const resolveButtons = screen.getAllByText('Resolve');
    expect(resolveButtons).toHaveLength(2); // Both alerts should have resolve button

    fireEvent.click(resolveButtons[0]);

    await waitFor(() => {
      expect(taskQueueAlerting.resolveAlert).toHaveBeenCalledWith('alert1', 'admin');
    });
  });

  test('switches to players tab and displays player metrics', async () => {
    render(<TaskQueueAdminDashboard />);

    await waitFor(() => {
      fireEvent.click(screen.getByText('Players'));
    });

    expect(screen.getByText('Active Players')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument(); // Active player count
    
    expect(screen.getByText('Concurrent Queues')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument(); // Concurrent queue count
    
    expect(screen.getByText('Engagement Rate')).toBeInTheDocument();
    expect(screen.getByText('80.0%')).toBeInTheDocument(); // Engagement rate
  });

  test('displays queue length distribution', async () => {
    render(<TaskQueueAdminDashboard />);

    await waitFor(() => {
      fireEvent.click(screen.getByText('Players'));
    });

    expect(screen.getByText('Queue Length Distribution')).toBeInTheDocument();
    expect(screen.getByText('0-9 tasks')).toBeInTheDocument();
    expect(screen.getByText('25 players')).toBeInTheDocument();
    expect(screen.getByText('10-19 tasks')).toBeInTheDocument();
    expect(screen.getByText('15 players')).toBeInTheDocument();
  });

  test('refreshes data when refresh button is clicked', async () => {
    render(<TaskQueueAdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Task Queue Admin Dashboard')).toBeInTheDocument();
    });

    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(taskQueueMetrics.exportMetrics).toHaveBeenCalledTimes(2); // Initial load + refresh
      expect(taskQueueAlerting.getActiveAlerts).toHaveBeenCalledTimes(2);
    });
  });

  test('displays loading state correctly', () => {
    (taskQueueMetrics.exportMetrics as jest.Mock).mockImplementation(() => {
      return new Promise(resolve => setTimeout(() => resolve(mockMetrics), 100));
    });

    render(<TaskQueueAdminDashboard />);

    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
  });

  test('handles auto-refresh correctly', async () => {
    jest.useFakeTimers();
    
    render(<TaskQueueAdminDashboard refreshInterval={1000} autoRefresh={true} />);

    await waitFor(() => {
      expect(taskQueueMetrics.exportMetrics).toHaveBeenCalledTimes(1);
    });

    // Fast-forward time
    jest.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(taskQueueMetrics.exportMetrics).toHaveBeenCalledTimes(2);
    });

    jest.useRealTimers();
  });

  test('applies correct status classes to metric cards', async () => {
    const criticalMetrics = {
      ...mockMetrics,
      averageTaskProcessingTime: 35000, // Above 30s threshold
      errorRate: 8, // Above 5% threshold
      memoryUsage: 2 * 1024 * 1024 * 1024 // 2GB, above 1GB threshold
    };

    (taskQueueMetrics.exportMetrics as jest.Mock).mockReturnValue(criticalMetrics);

    render(<TaskQueueAdminDashboard />);

    await waitFor(() => {
      const metricCards = document.querySelectorAll('.metric-card');
      
      // Check that some cards have critical status
      const criticalCards = document.querySelectorAll('.metric-card.critical');
      expect(criticalCards.length).toBeGreaterThan(0);
    });
  });

  test('displays last updated timestamp', async () => {
    render(<TaskQueueAdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    });
  });

  test('handles no alerts state', async () => {
    (taskQueueAlerting.getActiveAlerts as jest.Mock).mockReturnValue([]);

    render(<TaskQueueAdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText('No active alerts')).toBeInTheDocument();
    });
  });

  test('displays severity colors correctly', async () => {
    render(<TaskQueueAdminDashboard />);

    await waitFor(() => {
      fireEvent.click(screen.getByText(/Alerts \(2\)/));
    });

    const severityBadges = document.querySelectorAll('.severity-badge');
    expect(severityBadges).toHaveLength(2);
    
    // Check that badges have appropriate background colors
    const highSeverityBadge = Array.from(severityBadges).find(
      badge => badge.textContent === 'HIGH'
    ) as HTMLElement;
    expect(highSeverityBadge).toHaveStyle('background-color: #fd7e14');
  });
});