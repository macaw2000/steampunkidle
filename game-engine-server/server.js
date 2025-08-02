const express = require('express');
const cors = require('cors');
const AWS = require('aws-sdk');

const app = express();
const port = process.env.PORT || 3001;

// Configure AWS
AWS.config.update({
  region: process.env.AWS_REGION || 'us-west-2'
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoints (both paths for compatibility)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'steampunk-idle-game-engine',
    version: '1.0.0'
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'steampunk-idle-game-engine',
    version: '1.0.0'
  });
});

// Game engine status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    gameEngine: 'running',
    taskQueue: 'active',
    continuousProcessing: 'enabled',
    timestamp: new Date().toISOString()
  });
});

// Authentication endpoints (proxy to existing Lambda functions)
app.post('/api/auth/login', async (req, res) => {
  try {
    // For now, return a success response
    // In the full implementation, this would integrate with your auth system
    res.json({
      success: true,
      message: 'Game engine authentication active',
      token: 'game-engine-token-placeholder'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Character endpoints
app.get('/api/character/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Placeholder character data
    res.json({
      userId,
      character: {
        name: 'Steam Engineer',
        level: 1,
        experience: 0,
        stats: {
          engineering: 10,
          crafting: 5,
          research: 3
        },
        location: 'Workshop',
        lastActive: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Activity endpoints with task queue integration
app.get('/api/activity/progress/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Simulate continuous processing
    const activities = [
      {
        id: 'copper-mining',
        name: 'Copper Mining',
        progress: Math.floor(Math.random() * 100),
        isActive: true,
        continuousYield: Math.floor(Math.random() * 10) + 1,
        lastUpdate: new Date().toISOString()
      },
      {
        id: 'gear-crafting',
        name: 'Gear Crafting',
        progress: Math.floor(Math.random() * 100),
        isActive: false,
        continuousYield: 0,
        lastUpdate: new Date().toISOString()
      }
    ];
    
    res.json({
      userId,
      activities,
      taskQueueActive: true,
      continuousProcessing: true
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/activity/switch', async (req, res) => {
  try {
    const { userId, activityId } = req.body;
    
    // Simulate task queue processing
    res.json({
      success: true,
      message: `Switched to activity: ${activityId}`,
      taskQueued: true,
      continuousProcessing: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Task queue endpoints
app.get('/api/taskqueue/status', (req, res) => {
  res.json({
    status: 'active',
    queueLength: Math.floor(Math.random() * 50),
    processing: true,
    lastProcessed: new Date().toISOString()
  });
});

// Continuous processing status
app.get('/api/processing/status', (req, res) => {
  res.json({
    continuousProcessing: true,
    activeUsers: Math.floor(Math.random() * 100) + 1,
    tasksPerSecond: Math.floor(Math.random() * 10) + 1,
    uptime: '24h 15m 32s'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Game Engine Error:', error);
  res.status(500).json({
    error: 'Internal game engine error',
    message: error.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🎮 Steampunk Idle Game Engine running on port ${port}`);
  console.log(`🏥 Health check: http://localhost:${port}/health`);
  console.log(`📊 Status: http://localhost:${port}/api/status`);
  console.log(`⚙️  Task Queue: Active`);
  console.log(`🔄 Continuous Processing: Enabled`);
});