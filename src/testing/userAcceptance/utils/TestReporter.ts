import { UserAcceptanceTestResults } from '../UserAcceptanceTestSuite';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Generates comprehensive reports for user acceptance testing
 */
export class TestReporter {
  private reportDir: string;

  constructor() {
    this.reportDir = path.join(process.cwd(), 'src', 'testing', 'userAcceptance', 'reports');
    this.ensureReportDirectory();
  }

  /**
   * Generate comprehensive test report
   */
  async generateReport(results: UserAcceptanceTestResults): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFileName = `user-acceptance-report-${timestamp}.html`;
    const reportPath = path.join(this.reportDir, reportFileName);

    const htmlReport = this.generateHtmlReport(results);
    
    fs.writeFileSync(reportPath, htmlReport);
    
    // Also generate JSON report for programmatic access
    const jsonReportPath = path.join(this.reportDir, `user-acceptance-report-${timestamp}.json`);
    fs.writeFileSync(jsonReportPath, JSON.stringify(results, null, 2));

    console.log(`📊 Test report generated: ${reportPath}`);
    console.log(`📋 JSON report generated: ${jsonReportPath}`);
  }

  /**
   * Generate HTML report
   */
  private generateHtmlReport(results: UserAcceptanceTestResults): string {
    const { summary } = results;
    const passRate = summary.totalTests > 0 ? (summary.passedTests / summary.totalTests * 100).toFixed(1) : '0';
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>User Acceptance Test Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }
        .summary-card h3 {
            margin: 0 0 10px 0;
            color: #666;
            font-size: 14px;
            text-transform: uppercase;
        }
        .summary-card .value {
            font-size: 32px;
            font-weight: bold;
            margin: 0;
        }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .pending { color: #ffc107; }
        .section {
            background: white;
            margin-bottom: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .section-header {
            background: #f8f9fa;
            padding: 20px;
            border-bottom: 1px solid #dee2e6;
        }
        .section-content {
            padding: 20px;
        }
        .test-scenario {
            border: 1px solid #dee2e6;
            border-radius: 6px;
            margin-bottom: 15px;
            overflow: hidden;
        }
        .scenario-header {
            background: #f8f9fa;
            padding: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .scenario-content {
            padding: 15px;
            background: white;
        }
        .status-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .status-passed {
            background: #d4edda;
            color: #155724;
        }
        .status-failed {
            background: #f8d7da;
            color: #721c24;
        }
        .metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        .metric {
            text-align: center;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 6px;
        }
        .metric-label {
            font-size: 12px;
            color: #666;
            margin-bottom: 5px;
        }
        .metric-value {
            font-size: 18px;
            font-weight: bold;
            color: #333;
        }
        .progress-bar {
            width: 100%;
            height: 20px;
            background: #e9ecef;
            border-radius: 10px;
            overflow: hidden;
            margin: 10px 0;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #28a745, #20c997);
            transition: width 0.3s ease;
        }
        .timestamp {
            text-align: center;
            color: #666;
            font-size: 14px;
            margin-top: 30px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎮 User Acceptance Test Report</h1>
        <p>Task Queue System Validation Results</p>
    </div>

    <div class="summary">
        <div class="summary-card">
            <h3>Overall Status</h3>
            <p class="value ${summary.overallStatus.toLowerCase()}">${summary.overallStatus}</p>
        </div>
        <div class="summary-card">
            <h3>Total Tests</h3>
            <p class="value">${summary.totalTests}</p>
        </div>
        <div class="summary-card">
            <h3>Passed</h3>
            <p class="value passed">${summary.passedTests}</p>
        </div>
        <div class="summary-card">
            <h3>Failed</h3>
            <p class="value failed">${summary.failedTests}</p>
        </div>
        <div class="summary-card">
            <h3>Pass Rate</h3>
            <p class="value">${passRate}%</p>
        </div>
        <div class="summary-card">
            <h3>Duration</h3>
            <p class="value">${this.formatDuration(summary.duration)}</p>
        </div>
    </div>

    <div class="progress-bar">
        <div class="progress-fill" style="width: ${passRate}%"></div>
    </div>

    ${this.generateSectionReport('Player Usage Patterns', results.playerUsagePatterns)}
    ${this.generateSectionReport('Offline/Online Transitions', results.offlineOnlineTransitions)}
    ${this.generateSectionReport('Performance Validation', results.performanceValidation)}
    ${this.generateSectionReport('Usability Testing', results.usabilityTesting)}

    <div class="timestamp">
        Report generated on ${new Date().toLocaleString()}
    </div>
</body>
</html>`;
  }

  /**
   * Generate section report HTML
   */
  private generateSectionReport(title: string, sectionResults: any): string {
    if (!sectionResults) {
      return `
        <div class="section">
            <div class="section-header">
                <h2>${title}</h2>
            </div>
            <div class="section-content">
                <p>No results available for this section.</p>
            </div>
        </div>`;
    }

    const passRate = sectionResults.totalTests > 0 
      ? (sectionResults.passedTests / sectionResults.totalTests * 100).toFixed(1) 
      : '0';

    const scenariosHtml = sectionResults.scenarios?.map((scenario: any) => `
        <div class="test-scenario">
            <div class="scenario-header">
                <h4>${scenario.name}</h4>
                <span class="status-badge status-${scenario.status.toLowerCase()}">${scenario.status}</span>
            </div>
            <div class="scenario-content">
                <p>${scenario.details}</p>
                <div class="metrics">
                    <div class="metric">
                        <div class="metric-label">Duration</div>
                        <div class="metric-value">${this.formatDuration(scenario.duration)}</div>
                    </div>
                    ${this.generateMetricsHtml(scenario.metrics || scenario.syncMetrics || scenario.performanceMetrics || scenario.usabilityMetrics)}
                </div>
            </div>
        </div>
    `).join('') || '<p>No scenarios available.</p>';

    return `
        <div class="section">
            <div class="section-header">
                <h2>${title}</h2>
                <div class="metrics">
                    <div class="metric">
                        <div class="metric-label">Total Tests</div>
                        <div class="metric-value">${sectionResults.totalTests}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Passed</div>
                        <div class="metric-value passed">${sectionResults.passedTests}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Pass Rate</div>
                        <div class="metric-value">${passRate}%</div>
                    </div>
                </div>
            </div>
            <div class="section-content">
                ${scenariosHtml}
            </div>
        </div>`;
  }

  /**
   * Generate metrics HTML
   */
  private generateMetricsHtml(metrics: any): string {
    if (!metrics) return '';

    return Object.entries(metrics).map(([key, value]) => `
        <div class="metric">
            <div class="metric-label">${this.formatMetricLabel(key)}</div>
            <div class="metric-value">${this.formatMetricValue(value)}</div>
        </div>
    `).join('');
  }

  /**
   * Format metric label for display
   */
  private formatMetricLabel(key: string): string {
    return key.replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase())
              .trim();
  }

  /**
   * Format metric value for display
   */
  private formatMetricValue(value: any): string {
    if (typeof value === 'number') {
      if (value > 1000) {
        return (value / 1000).toFixed(1) + 'k';
      }
      return value.toFixed(2);
    }
    return String(value);
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  }

  /**
   * Ensure report directory exists
   */
  private ensureReportDirectory(): void {
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
  }

  /**
   * Generate summary report for console output
   */
  generateConsoleSummary(results: UserAcceptanceTestResults): void {
    const { summary } = results;
    
    console.log('\n' + '='.repeat(60));
    console.log('🎮 USER ACCEPTANCE TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Overall Status: ${summary.overallStatus === 'PASSED' ? '✅' : '❌'} ${summary.overallStatus}`);
    console.log(`Total Tests: ${summary.totalTests}`);
    console.log(`Passed: ${summary.passedTests}`);
    console.log(`Failed: ${summary.failedTests}`);
    console.log(`Pass Rate: ${summary.totalTests > 0 ? (summary.passedTests / summary.totalTests * 100).toFixed(1) : '0'}%`);
    console.log(`Duration: ${this.formatDuration(summary.duration)}`);
    console.log('='.repeat(60));

    // Section summaries
    if (results.playerUsagePatterns) {
      console.log(`📋 Player Usage Patterns: ${results.playerUsagePatterns.passedTests}/${results.playerUsagePatterns.totalTests} passed`);
    }
    if (results.offlineOnlineTransitions) {
      console.log(`🔄 Offline/Online Transitions: ${results.offlineOnlineTransitions.passedTests}/${results.offlineOnlineTransitions.totalTests} passed`);
    }
    if (results.performanceValidation) {
      console.log(`⚡ Performance Validation: ${results.performanceValidation.passedTests}/${results.performanceValidation.totalTests} passed`);
    }
    if (results.usabilityTesting) {
      console.log(`👤 Usability Testing: ${results.usabilityTesting.passedTests}/${results.usabilityTesting.totalTests} passed`);
    }
    
    console.log('='.repeat(60) + '\n');
  }
}