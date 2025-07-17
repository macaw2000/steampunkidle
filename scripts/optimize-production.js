#!/usr/bin/env node

/**
 * Production optimization script
 * Applies performance optimizations before production deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Starting production optimization...');

// Optimization tasks
const optimizations = [
  {
    name: 'Clean build artifacts',
    task: () => {
      const buildDir = path.join(__dirname, '..', 'build');
      const cdkOutDir = path.join(__dirname, '..', 'cdk.out');
      
      if (fs.existsSync(buildDir)) {
        fs.rmSync(buildDir, { recursive: true, force: true });
        console.log('  ✓ Cleaned build directory');
      }
      
      if (fs.existsSync(cdkOutDir)) {
        fs.rmSync(cdkOutDir, { recursive: true, force: true });
        console.log('  ✓ Cleaned CDK output directory');
      }
    }
  },
  
  {
    name: 'Validate environment variables',
    task: () => {
      const requiredEnvVars = [
        'AWS_REGION',
        'AWS_ACCOUNT_ID',
        'GOOGLE_CLIENT_ID',
        'FACEBOOK_APP_ID',
        'X_CLIENT_ID',
      ];
      
      const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
      
      if (missing.length > 0) {
        console.log('  ⚠️  Missing environment variables:', missing.join(', '));
        console.log('  ℹ️  These will use placeholder values in production');
      } else {
        console.log('  ✓ All required environment variables are set');
      }
    }
  },
  
  {
    name: 'Check Lambda function sizes',
    task: () => {
      const lambdaDir = path.join(__dirname, '..', 'src', 'lambda');
      
      if (!fs.existsSync(lambdaDir)) {
        console.log('  ⚠️  Lambda directory not found');
        return;
      }
      
      const checkDirectory = (dir, basePath = '') => {
        const items = fs.readdirSync(dir);
        let totalSize = 0;
        
        items.forEach(item => {
          const itemPath = path.join(dir, item);
          const stat = fs.statSync(itemPath);
          
          if (stat.isDirectory()) {
            totalSize += checkDirectory(itemPath, path.join(basePath, item));
          } else if (stat.isFile()) {
            totalSize += stat.size;
          }
        });
        
        if (basePath) {
          const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
          if (totalSize > 50 * 1024 * 1024) { // 50MB limit
            console.log(`  ⚠️  Large Lambda function: ${basePath} (${sizeMB}MB)`);
          } else {
            console.log(`  ✓ Lambda function size OK: ${basePath} (${sizeMB}MB)`);
          }
        }
        
        return totalSize;
      };
      
      checkDirectory(lambdaDir);
    }
  },
  
  {
    name: 'Validate TypeScript compilation',
    task: () => {
      const { execSync } = require('child_process');
      
      try {
        execSync('npx tsc --noEmit', { stdio: 'pipe' });
        console.log('  ✓ TypeScript compilation successful');
      } catch (error) {
        console.log('  ❌ TypeScript compilation failed');
        console.log('  Error:', error.stdout?.toString() || error.message);
        throw error;
      }
    }
  },
  
  {
    name: 'Run tests',
    task: () => {
      const { execSync } = require('child_process');
      
      try {
        console.log('  Running React tests...');
        execSync('npm run test', { stdio: 'pipe' });
        console.log('  ✓ React tests passed');
        
        console.log('  Running Lambda tests...');
        execSync('npm run test:lambda', { stdio: 'pipe' });
        console.log('  ✓ Lambda tests passed');
      } catch (error) {
        console.log('  ❌ Tests failed');
        console.log('  Error:', error.stdout?.toString() || error.message);
        throw error;
      }
    }
  },
  
  {
    name: 'Build React application',
    task: () => {
      const { execSync } = require('child_process');
      
      try {
        console.log('  Building React application...');
        execSync('npm run build', { stdio: 'pipe' });
        console.log('  ✓ React build successful');
        
        // Check build size
        const buildDir = path.join(__dirname, '..', 'build');
        if (fs.existsSync(buildDir)) {
          const getBuildSize = (dir) => {
            let totalSize = 0;
            const items = fs.readdirSync(dir);
            
            items.forEach(item => {
              const itemPath = path.join(dir, item);
              const stat = fs.statSync(itemPath);
              
              if (stat.isDirectory()) {
                totalSize += getBuildSize(itemPath);
              } else {
                totalSize += stat.size;
              }
            });
            
            return totalSize;
          };
          
          const buildSize = getBuildSize(buildDir);
          const buildSizeMB = (buildSize / (1024 * 1024)).toFixed(2);
          console.log(`  ✓ Build size: ${buildSizeMB}MB`);
          
          if (buildSize > 100 * 1024 * 1024) { // 100MB
            console.log('  ⚠️  Large build size detected - consider optimization');
          }
        }
      } catch (error) {
        console.log('  ❌ React build failed');
        console.log('  Error:', error.stdout?.toString() || error.message);
        throw error;
      }
    }
  },
  
  {
    name: 'Validate CDK synthesis',
    task: () => {
      const { execSync } = require('child_process');
      
      try {
        console.log('  Synthesizing CDK stack...');
        execSync('npm run cdk:synth', { stdio: 'pipe' });
        console.log('  ✓ CDK synthesis successful');
      } catch (error) {
        console.log('  ❌ CDK synthesis failed');
        console.log('  Error:', error.stdout?.toString() || error.message);
        throw error;
      }
    }
  },
  
  {
    name: 'Security checks',
    task: () => {
      const { execSync } = require('child_process');
      
      try {
        console.log('  Running security audit...');
        const auditResult = execSync('npm audit --audit-level=high', { stdio: 'pipe' });
        console.log('  ✓ No high-severity security vulnerabilities found');
      } catch (error) {
        const output = error.stdout?.toString() || '';
        if (output.includes('found 0 vulnerabilities')) {
          console.log('  ✓ No security vulnerabilities found');
        } else {
          console.log('  ⚠️  Security vulnerabilities detected');
          console.log('  Run "npm audit fix" to resolve issues');
        }
      }
    }
  },
];

// Run all optimizations
async function runOptimizations() {
  let failed = false;
  
  for (const optimization of optimizations) {
    console.log(`\n📋 ${optimization.name}...`);
    
    try {
      await optimization.task();
    } catch (error) {
      console.log(`❌ ${optimization.name} failed:`, error.message);
      failed = true;
      break;
    }
  }
  
  if (failed) {
    console.log('\n❌ Production optimization failed!');
    process.exit(1);
  } else {
    console.log('\n✅ Production optimization completed successfully!');
    console.log('\n🚀 Ready for production deployment');
    console.log('\nNext steps:');
    console.log('  1. Run: npm run deploy:production');
    console.log('  2. Run: npm run health-check:production');
    console.log('  3. Monitor deployment in AWS Console');
  }
}

// Run if called directly
if (require.main === module) {
  runOptimizations().catch(error => {
    console.error('Optimization script failed:', error);
    process.exit(1);
  });
}

module.exports = { runOptimizations };