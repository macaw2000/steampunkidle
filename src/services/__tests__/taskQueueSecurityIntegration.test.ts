import { TaskQueueSecurityMiddleware } from '../taskQueueSecurityMiddleware';
import { TaskQueueTokenManager } from '../taskQueueSecurity';

describe('Task Queue Security Integration', () => {
  beforeEach(() => {
    // Clear all security state before each test
    (TaskQueueTokenManager as any).tokens.clear();
  });

  describe('Basic Security Flow', () => {
    it('should complete full security validation flow', async () => {
      // 1. Generate a valid token
      const sessionToken = TaskQueueTokenManager.generateSessionToken('player-123', ['queue:read', 'queue:write']);
      expect(sessionToken.token).toBeDefined();
      expect(sessionToken.permissions).toContain('queue:write');

      // 2. Validate a simple operation
      const taskData = {
        id: 'task-123',
        type: 'harvesting',
        name: 'Test Task',
        playerId: 'player-123',
        duration: 30000,
        priority: 5
      };

      const context = {
        token: sessionToken.token,
        ipAddress: '192.168.1.1',
        userAgent: 'Test Browser',
        sessionId: 'session-123'
      };

      const result = await TaskQueueSecurityMiddleware.validateOperation(
        'add',
        'player-123',
        taskData,
        context
      );

      expect(result.success).toBe(true);
      expect(result.sanitizedData).toBeDefined();
      expect(result.playerId).toBe('player-123');
    });

    it('should reject operations with invalid tokens', async () => {
      const taskData = {
        id: 'task-123',
        type: 'harvesting',
        name: 'Test Task',
        playerId: 'player-123',
        duration: 30000,
        priority: 5
      };

      const context = {
        token: 'invalid-token',
        ipAddress: '192.168.1.1',
        userAgent: 'Test Browser',
        sessionId: 'session-123'
      };

      const result = await TaskQueueSecurityMiddleware.validateOperation(
        'add',
        'player-123',
        taskData,
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication failed');
      expect(result.statusCode).toBe(401);
    });

    it('should enforce rate limiting', async () => {
      // Generate a valid token
      const sessionToken = TaskQueueTokenManager.generateSessionToken('player-123', ['queue:read', 'queue:write']);
      
      const taskData = {
        id: 'task-123',
        type: 'harvesting',
        name: 'Test Task',
        playerId: 'player-123',
        duration: 30000,
        priority: 5
      };

      const context = {
        token: sessionToken.token,
        ipAddress: '192.168.1.1',
        userAgent: 'Test Browser',
        sessionId: 'session-123'
      };

      // Make requests up to the limit (10 for add operations)
      for (let i = 0; i < 10; i++) {
        const result = await TaskQueueSecurityMiddleware.validateOperation(
          'add',
          'player-123',
          { ...taskData, id: `task-${i}` },
          context
        );
        expect(result.success).toBe(true);
      }

      // The 11th request should be rate limited
      const rateLimitedResult = await TaskQueueSecurityMiddleware.validateOperation(
        'add',
        'player-123',
        { ...taskData, id: 'task-11' },
        context
      );

      expect(rateLimitedResult.success).toBe(false);
      expect(rateLimitedResult.error).toBe('Rate limit exceeded');
      expect(rateLimitedResult.statusCode).toBe(429);
    });

    it('should validate and sanitize input data', async () => {
      const sessionToken = TaskQueueTokenManager.generateSessionToken('player-123', ['queue:read', 'queue:write']);
      
      const maliciousTaskData = {
        id: 'task-123',
        type: 'harvesting',
        name: 'Test <script>alert("xss")</script> Task',
        playerId: 'player-123',
        duration: 30000,
        priority: 5
      };

      const context = {
        token: sessionToken.token,
        ipAddress: '192.168.1.1',
        userAgent: 'Test Browser',
        sessionId: 'session-123'
      };

      const result = await TaskQueueSecurityMiddleware.validateOperation(
        'add',
        'player-123',
        maliciousTaskData,
        context
      );

      expect(result.success).toBe(true);
      expect(result.sanitizedData?.name).toBe('Test alert(xss) Task');
    });

    it('should track security status', async () => {
      // Generate some security events
      const invalidContext = {
        token: 'invalid-token',
        ipAddress: '192.168.1.1',
        userAgent: 'Test Browser',
        sessionId: 'session-123'
      };

      await TaskQueueSecurityMiddleware.validateOperation(
        'add',
        'player-123',
        {},
        invalidContext
      );

      const status = TaskQueueSecurityMiddleware.getSecurityStatus();
      
      expect(status.timestamp).toBeGreaterThan(0);
      expect(status.authenticationFailures).toBeGreaterThan(0);
      expect(Array.isArray(status.recentAlerts)).toBe(true);
    });
  });

  describe('Token Management', () => {
    it('should manage token lifecycle', () => {
      // Generate token
      const sessionToken = TaskQueueTokenManager.generateSessionToken('player-123', ['queue:read']);
      expect(sessionToken.token).toBeDefined();

      // Validate token
      const validation = TaskQueueTokenManager.validateToken(sessionToken.token);
      expect(validation.valid).toBe(true);
      expect(validation.playerId).toBe('player-123');

      // Revoke token
      const revoked = TaskQueueTokenManager.revokeToken(sessionToken.token);
      expect(revoked).toBe(true);

      // Token should no longer be valid
      const invalidValidation = TaskQueueTokenManager.validateToken(sessionToken.token);
      expect(invalidValidation.valid).toBe(false);
    });

    it('should limit tokens per player', () => {
      const playerId = 'player-123';
      
      // Generate maximum allowed tokens (5)
      for (let i = 0; i < 6; i++) {
        TaskQueueTokenManager.generateSessionToken(playerId);
      }

      const playerTokens = TaskQueueTokenManager.getPlayerTokens(playerId);
      expect(playerTokens.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Admin Operations', () => {
    it('should validate admin operations with elevated security', async () => {
      const adminSession = TaskQueueTokenManager.generateSessionToken('admin-456', ['admin:view_player_queue']);
      
      const adminContext = {
        token: adminSession.token,
        ipAddress: '192.168.1.100',
        userAgent: 'Admin Browser',
        sessionId: 'admin-session-123',
        adminLevel: 'moderator'
      };

      const result = await TaskQueueSecurityMiddleware.validateAdminOperation(
        'view_player_queue',
        'admin-456',
        'player-123',
        { action: 'view' },
        adminContext
      );

      expect(result.success).toBe(true);
      expect(result.playerId).toBe('admin-456');
    });

    it('should reject admin operations with insufficient permissions', async () => {
      const limitedAdminSession = TaskQueueTokenManager.generateSessionToken('admin-456', ['admin:view_player_queue']);
      
      const adminContext = {
        token: limitedAdminSession.token,
        ipAddress: '192.168.1.100',
        userAgent: 'Admin Browser',
        sessionId: 'admin-session-123',
        adminLevel: 'moderator'
      };

      const result = await TaskQueueSecurityMiddleware.validateAdminOperation(
        'modify_player_queue',
        'admin-456',
        'player-123',
        { action: 'clear' },
        adminContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Admin authentication failed');
      expect(result.statusCode).toBe(403);
    });
  });
});