// Simple test to verify startup sequence works
const { initializationManager } = require('./services/initializationManager');

async function testStartup() {
  console.log('Testing startup sequence...');
  
  try {
    const status = await initializationManager.initialize();
    console.log('Initialization completed:', {
      isInitialized: status.isInitialized,
      progress: status.progress,
      completedSteps: status.completedSteps,
      failedSteps: status.failedSteps,
      errors: status.errors.map(e => ({ step: e.step, error: e.error, recoverable: e.recoverable }))
    });
    
    if (status.isInitialized) {
      console.log('✅ Startup sequence completed successfully!');
    } else {
      console.log('⚠️ Startup sequence completed with errors');
    }
  } catch (error) {
    console.error('❌ Startup sequence failed:', error);
  }
}

testStartup();