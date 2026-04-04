/**
 * Comprehensive Test Suite Execution Report Generator
 * Generates detailed test reports with pass/fail status
 */

import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  testCase: string;
  category: string;
  status: 'PASS' | 'FAIL' | 'SKIP' | 'PENDING';
  duration: number;
  error?: string;
  message: string;
}

interface TestReport {
  timestamp: string;
  environment: {
    nodeVersion: string;
    platform: string;
    testRunId: string;
  };
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    pending: number;
    coverage: number;
  };
  results: TestResult[];
  categories: {
    [key: string]: {
      total: number;
      passed: number;
      percentage: number;
    };
  };
}

/**
 * Generate test report from Jest/Playwright results
 */
export function generateTestReport(testResults: any[]): TestReport {
  const timestamp = new Date().toISOString();
  const testRunId = `TEST-${Date.now()}`;

  // Parse test results
  const results: TestResult[] = testResults.map((result) => ({
    testCase: result.testCase || 'Unknown',
    category: result.suite || 'Unknown',
    status: result.status || 'PENDING',
    duration: result.duration || 0,
    error: result.error,
    message: result.message || result.title || 'No message',
  }));

  // Calculate summary
  const summary = {
    total: results.length,
    passed: results.filter((r) => r.status === 'PASS').length,
    failed: results.filter((r) => r.status === 'FAIL').length,
    skipped: results.filter((r) => r.status === 'SKIP').length,
    pending: results.filter((r) => r.status === 'PENDING').length,
    coverage: (results.filter((r) => r.status === 'PASS').length / results.length) * 100,
  };

  // Group by category
  const categories: { [key: string]: { total: number; passed: number; percentage: number } } = {};

  results.forEach((result) => {
    if (!categories[result.category]) {
      categories[result.category] = { total: 0, passed: 0, percentage: 0 };
    }
    categories[result.category].total += 1;
    if (result.status === 'PASS') {
      categories[result.category].passed += 1;
    }
    categories[result.category].percentage =
      (categories[result.category].passed / categories[result.category].total) * 100;
  });

  return {
    timestamp,
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      testRunId,
    },
    summary,
    results,
    categories,
  };
}

/**
 * Format test report as markdown
 */
export function formatTestReportMarkdown(report: TestReport): string {
  const lines: string[] = [];

  // Header
  lines.push('# 🧪 RESTOP Automated Test Suite Report\n');
  lines.push(`**Test Run ID**: ${report.environment.testRunId}`);
  lines.push(`**Timestamp**: ${report.timestamp}`);
  lines.push(`**Platform**: ${report.environment.platform}`);
  lines.push(`**Node Version**: ${report.environment.nodeVersion}\n`);

  // Summary
  lines.push('## 📊 Test Summary\n');
  lines.push('```');
  lines.push(`Total Tests:        ${report.summary.total}`);
  lines.push(`✅ PASSED:           ${report.summary.passed} (${((report.summary.passed / report.summary.total) * 100).toFixed(1)}%)`);
  lines.push(`❌ FAILED:           ${report.summary.failed} (${((report.summary.failed / report.summary.total) * 100).toFixed(1)}%)`);
  lines.push(`⏭️  SKIPPED:          ${report.summary.skipped}`);
  lines.push(`⏳ PENDING:           ${report.summary.pending}`);
  lines.push(`📈 Coverage:         ${report.summary.coverage.toFixed(1)}%`);
  lines.push('```\n');

  // Category breakdown
  lines.push('## 🎯 Results by Category\n');
  lines.push('| Category | Total | Passed | Success Rate |');
  lines.push('|----------|-------|--------|--------------|');

  Object.entries(report.categories)
    .sort(([, a], [, b]) => b.percentage - a.percentage)
    .forEach(([category, stats]) => {
      lines.push(
        `| ${category} | ${stats.total} | ${stats.passed} | ${stats.percentage.toFixed(1)}% |`,
      );
    });

  lines.push('');

  // Detailed results
  lines.push('## 📋 Detailed Test Results\n');

  // Group results by category
  const grouped: { [key: string]: TestResult[] } = {};
  report.results.forEach((result) => {
    if (!grouped[result.category]) {
      grouped[result.category] = [];
    }
    grouped[result.category].push(result);
  });

  Object.entries(grouped).forEach(([category, results]) => {
    lines.push(`### ${category}\n`);

    results.forEach((result) => {
      const statusIcon =
        result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️ ';
      lines.push(
        `${statusIcon} **${result.message}** (${result.duration}ms) - ${result.status}`,
      );
      if (result.error) {
        lines.push(`   Error: ${result.error}`);
      }
    });

    lines.push('');
  });

  // Recommendations
  lines.push('## 💡 Recommendations\n');

  if (report.summary.failed > 0) {
    lines.push('- ⚠️ Fix failing tests before deployment');
    lines.push('- 🔍 Review error logs above for details');
  } else {
    lines.push('- ✅ All tests passing - ready for deployment!');
  }

  if (report.summary.coverage < 80) {
    lines.push('- 📈 Consider increasing test coverage target (currently ' +
      report.summary.coverage.toFixed(1) + '%)')
  }

  lines.push('- 🔄 Run tests regularly in CI/CD pipeline');
  lines.push('- 📊 Monitor test execution times for performance');

  lines.push('');

  // Footer
  lines.push('---');
  lines.push('Generated by RESTOP Automated Test Suite');
  lines.push(`Report Generated: ${new Date().toLocaleString()}`);

  return lines.join('\n');
}

/**
 * Save report to file
 */
export function saveReport(report: TestReport, outputDir: string): string {
  // Create output directory if needed
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Save JSON report
  const jsonPath = path.join(outputDir, `test-report-${Date.now()}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  // Save Markdown report
  const mdPath = path.join(outputDir, `test-report-${Date.now()}.md`);
  const markdown = formatTestReportMarkdown(report);
  fs.writeFileSync(mdPath, markdown);

  // Save HTML report
  const htmlPath = path.join(outputDir, `test-report-${Date.now()}.html`);
  const html = generateHtmlReport(report);
  fs.writeFileSync(htmlPath, html);

  return mdPath;
}

/**
 * Generate HTML report
 */
function generateHtmlReport(report: TestReport): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RESTOP Test Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #333; margin-bottom: 10px; }
    .meta { color: #666; font-size: 14px; margin-bottom: 30px; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
    .metric { background: #f9f9f9; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff; }
    .metric.success { border-left-color: #28a745; }
    .metric.danger { border-left-color: #dc3545; }
    .metric h3 { color: #666; font-size: 14px; margin-bottom: 5px; }
    .metric .value { font-size: 32px; font-weight: bold; color: #333; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #f5f5f5; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; }
    td { padding: 12px; border-bottom: 1px solid #eee; }
    tr:hover { background: #f9f9f9; }
    .pass { color: #28a745; font-weight: 600; }
    .fail { color: #dc3545; font-weight: 600; }
    .skip { color: #ffc107; font-weight: 600; }
    .progress-bar { height: 20px; background: #eee; border-radius: 10px; overflow: hidden; margin: 10px 0; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #28a745 0%, #20c997 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🧪 RESTOP Automated Test Suite Report</h1>
    <div class="meta">
      <p><strong>Test Run ID:</strong> ${report.environment.testRunId}</p>
      <p><strong>Timestamp:</strong> ${report.timestamp}</p>
      <p><strong>Platform:</strong> ${report.environment.platform} | <strong>Node:</strong> ${report.environment.nodeVersion}</p>
    </div>

    <h2>📊 Summary</h2>
    <div class="summary-grid">
      <div class="metric">
        <h3>Total Tests</h3>
        <div class="value">${report.summary.total}</div>
      </div>
      <div class="metric success">
        <h3>✅ Passed</h3>
        <div class="value">${report.summary.passed}</div>
      </div>
      <div class="metric ${report.summary.failed > 0 ? 'danger' : 'success'}">
        <h3>❌ Failed</h3>
        <div class="value">${report.summary.failed}</div>
      </div>
      <div class="metric">
        <h3>Coverage</h3>
        <div class="value">${report.summary.coverage.toFixed(1)}%</div>
      </div>
    </div>

    <div class="progress-bar">
      <div class="progress-fill" style="width: ${report.summary.coverage}%">${report.summary.coverage.toFixed(1)}%</div>
    </div>

    <h2 style="margin-top: 40px;">🎯 Results by Category</h2>
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th>Total</th>
          <th>Passed</th>
          <th>Success Rate</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(report.categories)
          .sort(([, a], [, b]) => b.percentage - a.percentage)
          .map(
            ([category, stats]) => `
          <tr>
            <td>${category}</td>
            <td>${stats.total}</td>
            <td class="pass">${stats.passed}</td>
            <td>${stats.percentage.toFixed(1)}%</td>
          </tr>
        `,
          )
          .join('')}
      </tbody>
    </table>

    <p style="margin-top: 40px; text-align: center; color: #666; font-size: 14px;">
      Generated by RESTOP Automated Test Suite | ${new Date().toLocaleString()}
    </p>
  </div>
</body>
</html>
`;
}

// Export for use in test runners
export default {
  generateTestReport,
  formatTestReportMarkdown,
  saveReport,
};
