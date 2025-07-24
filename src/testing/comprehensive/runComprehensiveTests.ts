#!/usr/bin/env ts-node

/**
 * Comprehensive Task Queue Test Runner
 * 
 * Runs all test suites and generates detailed reports
 */

import { taskQueueTestSuite, TestCategory } from './taskQueueTestSuite';

async function main() {
  console.log('🚀 Starting Comprehensive Task Queue Test Suite');
  console.log('='.repeat(60));
  
  const args = process.argv.slice(2);
  const categories = args.length > 0 ? args as TestCategory[] : ['unit', 'integration', 'e2e', 'regression'];
  
  try {
    let results;
    
    if (categories.length === 4) {
      // Run all tests
      results = await taskQueueTestSuite.runAllTests();
    } else {
      // Run specific categories
      console.log(`Running test categories: ${categories.join(', ')}`);
      results = await taskQueueTestSuite.runTestsByCategory(categories);
    }
    
    // Generate detailed report
    generateDetailedReport(results);
    
    // Exit with appropriate code
    const hasFailures = results.summary?.failed > 0;
    process.exit(hasFailures ? 1 : 0);
    
  } catch (error) {
    console.error('❌ Test suite execution failed:', error);
    process.exit(1);
  }
}

function generateDetailedReport(results: any) {
  console.log('\n📋 Detailed Test Report');
  console.log('='.repeat(60));
  
  if (results.unit) {
    printCategoryReport('Unit Tests', results.unit);
  }
  
  if (results.integration) {
    printCategoryReport('Integration Tests', results.integration);
  }
  
  if (results.e2e) {
    printCategoryReport('End-to-End Tests', results.e2e);
  }
  
  if (results.regression) {
    printCategoryReport('Regression Tests', results.regression);
  }
  
  if (results.summary) {
    console.log('\n🎯 Overall Summary');
    console.log('-'.repeat(40));
    console.log(`Total Tests:    ${results.summary.totalTests}`);
    console.log(`Passed:         ${results.summary.passed} (${((results.summary.passed / results.summary.totalTests) * 100).toFixed(1)}%)`);
    console.log(`Failed:         ${results.summary.failed}`);
    console.log(`Skipped:        ${results.summary.skipped}`);
    console.log(`Total Duration: ${(results.summary.duration / 1000).toFixed(2)}s`);
    
    if (results.summary.failed > 0) {
      console.log('\n❌ Failed Tests Summary:');
      const allErrors = [
        ...(results.unit?.errors || []),
        ...(results.integration?.errors || []),
        ...(results.e2e?.errors || []),
        ...(results.regression?.errors || [])
      ];
      
      allErrors.slice(0, 10).forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.message}`);
      });
      
      if (allErrors.length > 10) {
        console.log(`  ... and ${allErrors.length - 10} more errors`);
      }
    }
  }
  
  // Performance insights
  if (results.summary) {
    console.log('\n⚡ Performance Insights');
    console.log('-'.repeat(40));
    
    const avgTestTime = results.summary.duration / results.summary.totalTests;
    console.log(`Average test time: ${avgTestTime.toFixed(2)}ms`);
    
    if (avgTestTime > 100) {
      console.log('⚠️  Some tests may be running slowly');
    }
    
    if (results.summary.totalTests > 200) {
      console.log('✅ Comprehensive test coverage achieved');
    }
  }
  
  // Recommendations
  console.log('\n💡 Recommendations');
  console.log('-'.repeat(40));
  
  if (results.summary?.failed === 0) {
    console.log('✅ All tests passing - great job!');
    console.log('🔄 Consider running tests regularly in CI/CD');
  } else {
    console.log('🔧 Fix failing tests before deploying');
    console.log('📊 Review test coverage for critical paths');
  }
  
  if (results.summary?.duration > 30000) {
    console.log('⚡ Consider optimizing slow tests');
  }
}

function printCategoryReport(categoryName: string, results: any) {
  console.log(`\n${categoryName}`);
  console.log('-'.repeat(categoryName.length));
  console.log(`Tests:    ${results.passed}/${results.totalTests} passed`);
  console.log(`Duration: ${(results.duration / 1000).toFixed(2)}s`);
  
  if (results.failed > 0) {
    console.log(`❌ ${results.failed} failed`);
  }
  
  if (results.skipped > 0) {
    console.log(`⏭️  ${results.skipped} skipped`);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { main as runComprehensiveTests };