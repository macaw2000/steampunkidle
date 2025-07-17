#!/usr/bin/env node

/**
 * Simple load testing script for Steampunk Idle Game API
 * Tests concurrent users and real-time features
 */

const https = require('https');
const WebSocket = require('ws');

// Configuration
const CONFIG = {
  baseUrl: process.env.API_BASE_URL || 'https://api.steampunk-idle-game.com',
  wsUrl: process.env.WS_URL || 'wss://ws.steampunk-idle-game.com',
  concurrentUsers: parseInt(process.env.CONCURRENT_USERS) || 10,
  testDuration: parseInt(process.env.TEST_DURATION) || 60, // seconds
  requestInterval: parseInt(process.env.REQUEST_INTERVAL) || 1000, // ms
};

// Test statistics
const stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalResponseTime: 0,
  minResponseTime: Infinity,
  maxResponseTime: 0,
  wsConnections: 0,
  wsMessages: 0,
  errors: [],
};

// Helper function to make HTTP requests
function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const url = new URL(path, CONFIG.baseUrl);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LoadTest/1.0',
      },
    };
    
    if (data) {
      const jsonData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(jsonData);
    }
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        stats.totalRequests++;
        stats.totalResponseTime += responseTime;
        stats.minResponseTime = Math.min(stats.minResponseTime, responseTime);
        stats.maxResponseTime = Math.max(stats.maxResponseTime, responseTime);
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          stats.successfulRequests++;
          resolve({ statusCode: res.statusCode, data: responseData, responseTime });
        } else {
          stats.failedRequests++;
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });
    
    req.on('error', (error) => {
      stats.failedRequests++;
      stats.errors.push(error.message);
      reject(error);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Test scenarios
const testScenarios = [
  {
    name: 'Health Check',
    path: '/health',
    weight: 1,
  },
  {
    name: 'Get Character',
    path: '/api/character',
    weight: 3,
    requiresAuth: true,
  },
  {
    name: 'Switch Activity',
    path: '/api/activity/switch',
    method: 'POST',
    data: { activity: 'crafting' },
    weight: 2,
    requiresAuth: true,
  },
  {
    name: 'Get Leaderboard',
    path: '/api/leaderboard/level',
    weight: 2,
  },
  {
    name: 'Search Auctions',
    path: '/api/auction/search?limit=20',
    weight: 2,
  },
  {
    name: 'Get Guild Info',
    path: '/api/guild/info',
    weight: 1,
    requiresAuth: true,
  },
];

// WebSocket test
function testWebSocket(userId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(CONFIG.wsUrl);
    let messageCount = 0;
    
    ws.on('open', () => {
      stats.wsConnections++;
      console.log(`WebSocket connected for user ${userId}`);
      
      // Send periodic messages
      const interval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            action: 'chat',
            channel: 'general',
            message: `Test message from user ${userId}`,
          }));
          messageCount++;
        }
      }, 5000);
      
      setTimeout(() => {
        clearInterval(interval);
        ws.close();
        resolve(messageCount);
      }, CONFIG.testDuration * 1000);
    });
    
    ws.on('message', (data) => {
      stats.wsMessages++;
      try {
        const message = JSON.parse(data);
        console.log(`Received message for user ${userId}:`, message.type);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });
    
    ws.on('error', (error) => {
      stats.errors.push(`WebSocket error for user ${userId}: ${error.message}`);
      reject(error);
    });
    
    ws.on('close', () => {
      console.log(`WebSocket closed for user ${userId}`);
    });
  });
}

// Simulate a single user's behavior
async function simulateUser(userId) {
  console.log(`Starting simulation for user ${userId}`);
  
  const endTime = Date.now() + (CONFIG.testDuration * 1000);
  const promises = [];
  
  // Start WebSocket connection
  promises.push(testWebSocket(userId));
  
  // Make HTTP requests
  while (Date.now() < endTime) {
    try {
      // Select random test scenario based on weight
      const totalWeight = testScenarios.reduce((sum, scenario) => sum + scenario.weight, 0);
      let randomWeight = Math.random() * totalWeight;
      let selectedScenario = testScenarios[0];
      
      for (const scenario of testScenarios) {
        randomWeight -= scenario.weight;
        if (randomWeight <= 0) {
          selectedScenario = scenario;
          break;
        }
      }
      
      // Skip auth-required scenarios for now (would need proper auth setup)
      if (selectedScenario.requiresAuth) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.requestInterval));
        continue;
      }
      
      const result = await makeRequest(
        selectedScenario.path,
        selectedScenario.method || 'GET',
        selectedScenario.data
      );
      
      console.log(`User ${userId} - ${selectedScenario.name}: ${result.responseTime}ms`);
      
    } catch (error) {
      console.error(`User ${userId} request failed:`, error.message);
    }
    
    // Wait before next request
    await new Promise(resolve => setTimeout(resolve, CONFIG.requestInterval));
  }
  
  await Promise.allSettled(promises);
  console.log(`User ${userId} simulation completed`);
}

// Main load test function
async function runLoadTest() {
  console.log('Starting load test with configuration:');
  console.log(`- Base URL: ${CONFIG.baseUrl}`);
  console.log(`- WebSocket URL: ${CONFIG.wsUrl}`);
  console.log(`- Concurrent Users: ${CONFIG.concurrentUsers}`);
  console.log(`- Test Duration: ${CONFIG.testDuration} seconds`);
  console.log(`- Request Interval: ${CONFIG.requestInterval}ms`);
  console.log('');
  
  const startTime = Date.now();
  
  // Start all user simulations
  const userPromises = [];
  for (let i = 1; i <= CONFIG.concurrentUsers; i++) {
    userPromises.push(simulateUser(i));
  }
  
  // Wait for all users to complete
  await Promise.allSettled(userPromises);
  
  const endTime = Date.now();
  const totalDuration = (endTime - startTime) / 1000;
  
  // Print results
  console.log('\n=== Load Test Results ===');
  console.log(`Total Duration: ${totalDuration.toFixed(2)} seconds`);
  console.log(`Total Requests: ${stats.totalRequests}`);
  console.log(`Successful Requests: ${stats.successfulRequests}`);
  console.log(`Failed Requests: ${stats.failedRequests}`);
  console.log(`Success Rate: ${((stats.successfulRequests / stats.totalRequests) * 100).toFixed(2)}%`);
  console.log(`Requests per Second: ${(stats.totalRequests / totalDuration).toFixed(2)}`);
  
  if (stats.totalRequests > 0) {
    console.log(`Average Response Time: ${(stats.totalResponseTime / stats.totalRequests).toFixed(2)}ms`);
    console.log(`Min Response Time: ${stats.minResponseTime}ms`);
    console.log(`Max Response Time: ${stats.maxResponseTime}ms`);
  }
  
  console.log(`WebSocket Connections: ${stats.wsConnections}`);
  console.log(`WebSocket Messages: ${stats.wsMessages}`);
  
  if (stats.errors.length > 0) {
    console.log('\n=== Errors ===');
    const errorCounts = {};
    stats.errors.forEach(error => {
      errorCounts[error] = (errorCounts[error] || 0) + 1;
    });
    
    Object.entries(errorCounts).forEach(([error, count]) => {
      console.log(`${error}: ${count} times`);
    });
  }
  
  console.log('\nLoad test completed!');
}

// Run the load test
if (require.main === module) {
  runLoadTest().catch(error => {
    console.error('Load test failed:', error);
    process.exit(1);
  });
}

module.exports = { runLoadTest, makeRequest };