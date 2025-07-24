// Simple test to check if the module can be imported
const path = require('path');

async function testImport() {
  try {
    console.log('Testing import...');
    
    // Try to import the compiled JS version
    const module = await import('./src/services/queueProcessingPipeline.ts');
    console.log('Import successful!');
    console.log('Exported keys:', Object.keys(module));
    console.log('queueProcessingPipeline:', typeof module.queueProcessingPipeline);
    
    if (module.queueProcessingPipeline) {
      console.log('Methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(module.queueProcessingPipeline)));
    }
    
  } catch (error) {
    console.error('Import failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testImport();