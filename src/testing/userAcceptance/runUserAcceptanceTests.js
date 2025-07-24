#!/usr/bin/env node

/**
 * CLI Runner for User Acceptance Tests (JavaScript version)
 * Allows running user acceptance tests independently with detailed output
 */

const { UserAcceptanceTestSuite } = require('./UserAcceptanceTestSuite');

async function main() {
  console.log('🚀 Starting User Acceptance Test Suite...\n');
  
  const testSuite = new UserAcceptanceTestSuite();
  
  try {
    const results = await testSuite.runAllTests();
    
    // Display detailed results
    console.log('\n📊 User Acceptance Test Results Summary');
    console.log('=====================================');
    console.log(`Overall Status: ${results.summary.overallStatus}`);
    console.log(`Total Tests: ${results.summary.totalTests}`);
    console.log(`Passed Tests: ${results.summary.passedTests}`);
    console.log(`Failed Tests: ${results.summary.failedTests}`);
    console.log(`Duration: ${(results.summary.duration / 1000).toFixed(2)}s`);
    console.log(`Pass Rate: ${((results.summary.passedTests / results.summary.totalTests) * 100).toFixed(1)}%`);
    
    // Individual category results
    if (results.playerUsagePatterns) {
      console.log(`\n📋 Player Usage Patterns: ${results.playerUsagePatterns.passedTests}/${results.playerUsagePatterns.totalTests} passed`);
      results.playerUsagePatterns.scenarios.forEach(scenario => {
        const status = scenario.status === 'PASSED' ? '✅' : '❌';
        console.log(`  ${status} ${scenario.name} (${scenario.duration}ms)`);
        if (scenario.status === 'FAILED') {
          console.log(`    └─ ${scenario.details}`);
        }
      });
    }
    
    if (results.offlineOnlineTransitions) {
      console.log(`\n🔄 Offline/Online Transitions: ${results.offlineOnlineTransitions.passedTests}/${results.offlineOnlineTransitions.totalTests} passed`);
      results.offlineOnlineTransitions.scenarios.forEach(scenario => {
        const status = scenario.status === 'PASSED' ? '✅' : '❌';
        console.log(`  ${status} ${scenario.name} (${scenario.duration}ms)`);
        if (scenario.status === 'FAILED') {
          console.log(`    └─ ${scenario.details}`);
        }
      });
    }
    
    if (results.performanceValidation) {
      console.log(`\n⚡ Performance Validation: ${results.performanceValidation.passedTests}/${results.performanceValidation.totalTests} passed`);
      results.performanceValidation.scenarios.forEach(scenario => {
        const status = scenario.status === 'PASSED' ? '✅' : '❌';
        console.log(`  ${status} ${scenario.name} (${scenario.duration}ms)`);
        if (scenario.status === 'FAILED') {
          console.log(`    └─ ${scenario.details}`);
        }
      });
    }
    
    if (results.usabilityTesting) {
      console.log(`\n👤 Usability Testing: ${results.usabilityTesting.passedTests}/${results.usabilityTesting.totalTests} passed`);
      results.usabilityTesting.scenarios.forEach(scenario => {
        const status = scenario.status === 'PASSED' ? '✅' : '❌';
        console.log(`  ${status} ${scenario.name} (${scenario.duration}ms)`);
        if (scenario.status === 'FAILED') {
          console.log(`    └─ ${scenario.details}`);
        }
      });
    }
    
    // Acceptance criteria evaluation
    console.log('\n🎯 Acceptance Criteria Evaluation');
    console.log('=================================');
    
    const overallPassRate = results.summary.passedTests / results.summary.totalTests;
    const meetsOverallCriteria = overallPassRate >= 0.75;
    console.log(`Overall Pass Rate: ${(overallPassRate * 100).toFixed(1)}% (Required: ≥75%) ${meetsOverallCriteria ? '✅' : '❌'}`);
    
    if (results.playerUsagePatterns) {
      const playerUsageRate = results.playerUsagePatterns.passedTests / results.playerUsagePatterns.totalTests;
      const meetsPlayerUsageCriteria = playerUsageRate >= 0.8;
      console.log(`Player Usage Patterns: ${(playerUsageRate * 100).toFixed(1)}% (Required: ≥80%) ${meetsPlayerUsageCriteria ? '✅' : '❌'}`);
    }
    
    if (results.offlineOnlineTransitions) {
      const offlineOnlineRate = results.offlineOnlineTransitions.passedTests / results.offlineOnlineTransitions.totalTests;
      const meetsOfflineOnlineCriteria = offlineOnlineRate >= 0.7;
      console.log(`Offline/Online Transitions: ${(offlineOnlineRate * 100).toFixed(1)}% (Required: ≥70%) ${meetsOfflineOnlineCriteria ? '✅' : '❌'}`);
    }
    
    if (results.performanceValidation) {
      const performanceRate = results.performanceValidation.passedTests / results.performanceValidation.totalTests;
      const meetsPerformanceCriteria = performanceRate >= 0.75;
      console.log(`Performance Validation: ${(performanceRate * 100).toFixed(1)}% (Required: ≥75%) ${meetsPerformanceCriteria ? '✅' : '❌'}`);
    }
    
    if (results.usabilityTesting) {
      const usabilityRate = results.usabilityTesting.passedTests / results.usabilityTesting.totalTests;
      const meetsUsabilityCriteria = usabilityRate >= 0.8;
      console.log(`Usability Testing: ${(usabilityRate * 100).toFixed(1)}% (Required: ≥80%) ${meetsUsabilityCriteria ? '✅' : '❌'}`);
    }
    
    console.log('\n📄 Detailed reports have been generated in the reports/ directory');
    
    // Exit with appropriate code
    const exitCode = meetsOverallCriteria ? 0 : 1;
    process.exit(exitCode);
    
  } catch (error) {
    console.error('❌ User Acceptance Test Suite failed:', error);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
User Acceptance Test Suite Runner

Usage:
  node src/testing/userAcceptance/runUserAcceptanceTests.js [options]

Options:
  --help, -h     Show this help message
  --verbose, -v  Enable verbose output

Examples:
  # Run all tests
  node src/testing/userAcceptance/runUserAcceptanceTests.js
  
  # Run with verbose output
  node src/testing/userAcceptance/runUserAcceptanceTests.js --verbose

Test Categories:
  - Player Usage Patterns: Tests typical player workflows and interactions
  - Offline/Online Transitions: Tests offline/online transitions and data synchronization
  - Performance Validation: Tests system performance under realistic load conditions
  - Usability Testing: Tests user interface and experience quality

Acceptance Criteria:
  - Overall Pass Rate: ≥75% of all tests must pass
  - Player Usage Patterns: ≥80% pass rate
  - Offline/Online Transitions: ≥70% pass rate
  - Performance Validation: ≥75% pass rate
  - Usability Testing: ≥80% pass rate

Note: This is a demonstration of the User Acceptance Testing framework.
In a production environment, these tests would validate the actual system functionality.
The current implementation shows the framework structure and reporting capabilities.
`);
  process.exit(0);
}

// Run the tests
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});