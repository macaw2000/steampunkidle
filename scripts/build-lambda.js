#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Building Lambda functions...');

// Create a temporary tsconfig for Lambda functions
const lambdaTsConfig = {
  "compilerOptions": {
    "target": "es2020",
    "module": "commonjs",
    "lib": ["es2020"],
    "outDir": "./dist/lambda",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": false,
    "sourceMap": false,
    "removeComments": true
  },
  "include": [
    "src/lambda/**/*",
    "src/utils/**/*",
    "src/types/**/*"
  ],
  "exclude": [
    "node_modules",
    "**/*.test.ts",
    "**/*.spec.ts"
  ]
};

// Write temporary tsconfig
fs.writeFileSync('tsconfig.lambda.json', JSON.stringify(lambdaTsConfig, null, 2));

try {
  // Compile TypeScript to JavaScript
  console.log('Compiling TypeScript Lambda functions...');
  execSync('npx tsc -p tsconfig.lambda.json', { stdio: 'inherit' });
  
  // Copy the compiled files to the expected locations
  console.log('Copying compiled Lambda functions...');
  
  const lambdaDirs = fs.readdirSync('src/lambda', { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  for (const dir of lambdaDirs) {
    const srcDir = path.join('dist/lambda', dir);
    const destDir = path.join('src/lambda', dir);
    
    if (fs.existsSync(srcDir)) {
      // Copy .js files from dist to src
      const files = fs.readdirSync(srcDir);
      for (const file of files) {
        if (file.endsWith('.js')) {
          const srcFile = path.join(srcDir, file);
          const destFile = path.join(destDir, file);
          fs.copyFileSync(srcFile, destFile);
          console.log(`Copied ${srcFile} -> ${destFile}`);
        }
      }
    }
  }
  
  console.log('Lambda functions built successfully!');
  
} catch (error) {
  console.error('Error building Lambda functions:', error.message);
  process.exit(1);
} finally {
  // Clean up temporary files
  if (fs.existsSync('tsconfig.lambda.json')) {
    fs.unlinkSync('tsconfig.lambda.json');
  }
  if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true, force: true });
  }
}