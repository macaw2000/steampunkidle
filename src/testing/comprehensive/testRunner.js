/**
 * Simple test runner for comprehensive test suite
 */

const { taskQueueTestSuite } = require('./taskQueueTestSuite');

async function runTests() {
  console.log('🧪 Running Comprehensive Task Queue Test Suite...');
  
  try {
    const results = await taskQueueTestSuite.runAllTests();
    
    console.log('\n📊 Test Results Summary:');
    console.log(`Total Tests: ${results.summary.totalTests}`);
    console.log(`Passed: ${results.summary.passed}`);
    console.log(`Failed: ${results.summary.failed}`);
    console.log(`Duration: ${(results.summary.duration / 1000).toFixed(2)}s`);
    
    if (results.summary.failed === 0) {
      console.log('\n✅ All tests passed!');
      process.exit(0);
    } else {
      console.log('\n❌ Some tests failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test suite failed to run:', error.message);
    process.exit(1);
  }
}

runTests();