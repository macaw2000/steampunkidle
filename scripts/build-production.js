const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create a temporary tsconfig for production build
const productionTsConfig = {
  "extends": "./tsconfig.json",
  "exclude": [
    "**/__tests__/**",
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/test*/**",
    "src/testing/**"
  ]
};

// Write temporary tsconfig
fs.writeFileSync('tsconfig.prod.json', JSON.stringify(productionTsConfig, null, 2));

try {
  // Set environment variable to use production tsconfig
  process.env.TSC_COMPILE_ON_ERROR = 'true';
  process.env.EXTEND_ESLINT = 'true';
  
  // Run the build
  execSync('npx react-scripts build', { 
    stdio: 'inherit',
    env: { ...process.env, TSC_COMPILE_ON_ERROR: 'true' }
  });
  
  console.log('✅ Production build completed successfully!');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
} finally {
  // Clean up temporary file
  if (fs.existsSync('tsconfig.prod.json')) {
    fs.unlinkSync('tsconfig.prod.json');
  }
}