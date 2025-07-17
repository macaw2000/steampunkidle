/**
 * Tests for SlashCommandService
 */

import SlashCommandService, { SlashCommandContext, SlashCommandResult } from '../slashCommandService';

// Mock fetch globally
global.fetch = jest.fn();

describe('SlashCommandService', () => {
  let service: SlashCommandService;
  let mockContext: SlashCommandContext;

  beforeEach(() => {
    service = SlashCommandService.getInstance();
    mockContext = {
      senderId: 'user123',
      senderName: 'TestUser',
      channelId: 'general',
      messageType: 'general',
      guildId: 'guild123',
      guildRole: 'member',
      guildPermissions: ['invite', 'kick'],
    };

    // Reset fetch mock
    (fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('parseCommand', () => {
    it('should parse valid slash commands', () => {
      const result = service.parseCommand('/w player hello world');
      expect(result).toEqual({
        isCommand: true,
        command: 'w',
        args: ['player', 'hello', 'world'],
      });
    });

    it('should parse commands with no arguments', () => {
      const result = service.parseCommand('/help');
      expect(result).toEqual({
        isCommand: true,
        command: 'help',
        args: [],
      });
    });

    it('should not parse regular messages', () => {
      const result = service.parseCommand('hello world');
      expect(result).toEqual({
        isCommand: false,
      });
    });

    it('should handle empty slash command', () => {
      const result = service.parseCommand('/');
      expect(result).toEqual({
        isCommand: true,
        command: '',
        args: [],
      });
    });
  });

  describe('getCommandSuggestions', () => {
    it('should return suggestions for partial commands', () => {
      const suggestions = service.getCommandSuggestions('/w');
      expect(suggestions).toContain('/w');
      expect(suggestions).toContain('/who');
    });

    it('should return empty array for non-slash input', () => {
      const suggestions = service.getCommandSuggestions('hello');
      expect(suggestions).toEqual([]);
    });

    it('should return empty array for no matches', () => {
      const suggestions = service.getCommandSuggestions('/xyz');
      expect(suggestions).toEqual([]);
    });

    it('should limit suggestions to 10 items', () => {
      const suggestions = service.getCommandSuggestions('/');
      expect(suggestions.length).toBeLessThanOrEqual(10);
    });
  });

  describe('processCommand', () => {
    it('should return error for unknown command', async () => {
      const result = await service.processCommand('unknown', [], mockContext);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown command');
    });

    it('should validate minimum arguments', async () => {
      const result = await service.processCommand('w', ['player'], mockContext);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Not enough arguments');
    });

    it('should validate maximum arguments', async () => {
      const result = await service.processCommand('profile', ['player1', 'player2'], mockContext);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Too many arguments');
    });

    it('should check guild requirements', async () => {
      const contextWithoutGuild = { ...mockContext, guildId: undefined };
      const result = await service.processCommand('ginvite', ['player'], contextWithoutGuild);
      expect(result.success).toBe(false);
      expect(result.error).toContain('must be in a guild');
    });

    it('should check permission requirements', async () => {
      const contextWithoutPermission = { ...mockContext, guildPermissions: [] };
      const result = await service.processCommand('ginvite', ['player'], contextWithoutPermission);
      expect(result.success).toBe(false);
      expect(result.error).toContain('do not have permission');
    });
  });

  describe('whisper command', () => {
    it('should process whisper command successfully', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ userId: 'target123' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ messageId: 'msg123' }),
        });

      const result = await service.processCommand('w', ['targetPlayer', 'hello', 'there'], mockContext);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Whisper sent to targetPlayer');
      expect(result.systemMessage).toBe(true);
    });

    it('should handle player not found', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await service.processCommand('w', ['unknownPlayer', 'hello'], mockContext);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found or not online');
    });
  });

  describe('profile command', () => {
    const mockProfile = {
      name: 'TestPlayer',
      level: 25,
      specialization: { primaryRole: 'tank' },
      guildName: 'TestGuild',
      lastActiveAt: '2023-01-01T00:00:00Z',
    };

    it('should display player profile', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProfile),
      });

      const result = await service.processCommand('profile', ['TestPlayer'], mockContext);
      expect(result.success).toBe(true);
      expect(result.message).toContain('TestPlayer');
      expect(result.message).toContain('Level 25');
      expect(result.message).toContain('tank');
      expect(result.systemMessage).toBe(true);
    });

    it('should handle profile not found', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await service.processCommand('profile', ['UnknownPlayer'], mockContext);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('guild invite command', () => {
    beforeEach(() => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ userId: 'target123' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        });
    });

    it('should send guild invitation', async () => {
      const result = await service.processCommand('ginvite', ['targetPlayer'], mockContext);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Guild invitation sent');
      expect(result.systemMessage).toBe(true);
    });

    it('should require guild membership', async () => {
      const contextWithoutGuild = { ...mockContext, guildId: undefined };
      const result = await service.processCommand('ginvite', ['player'], contextWithoutGuild);
      expect(result.success).toBe(false);
      expect(result.error).toContain('must be in a guild');
    });

    it('should require invite permission', async () => {
      const contextWithoutPermission = { ...mockContext, guildPermissions: ['kick'] };
      const result = await service.processCommand('ginvite', ['player'], contextWithoutPermission);
      expect(result.success).toBe(false);
      expect(result.error).toContain('do not have permission');
    });
  });

  describe('guild kick command', () => {
    beforeEach(() => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ userId: 'target123' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        });
    });

    it('should kick player from guild', async () => {
      const result = await service.processCommand('gkick', ['targetPlayer'], mockContext);
      expect(result.success).toBe(true);
      expect(result.message).toContain('has been removed from the guild');
      expect(result.systemMessage).toBe(true);
    });

    it('should require guild membership', async () => {
      const contextWithoutGuild = { ...mockContext, guildId: undefined };
      const result = await service.processCommand('gkick', ['player'], contextWithoutGuild);
      expect(result.success).toBe(false);
      expect(result.error).toContain('must be in a guild');
    });

    it('should require kick permission', async () => {
      const contextWithoutPermission = { ...mockContext, guildPermissions: ['invite'] };
      const result = await service.processCommand('gkick', ['player'], contextWithoutPermission);
      expect(result.success).toBe(false);
      expect(result.error).toContain('do not have permission');
    });
  });

  describe('guild info command', () => {
    const mockGuild = {
      name: 'TestGuild',
      description: 'A test guild',
      memberCount: 15,
      settings: { maxMembers: 50 },
      level: 5,
      leaderName: 'GuildLeader',
    };

    beforeEach(() => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGuild),
      });
    });

    it('should display guild information', async () => {
      const result = await service.processCommand('guild', [], mockContext);
      expect(result.success).toBe(true);
      expect(result.message).toContain('TestGuild');
      expect(result.message).toContain('15/50');
      expect(result.message).toContain('Level: 5');
      expect(result.systemMessage).toBe(true);
    });

    it('should handle no guild membership', async () => {
      const contextWithoutGuild = { ...mockContext, guildId: undefined };
      const result = await service.processCommand('guild', [], contextWithoutGuild);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not in a guild');
    });
  });

  describe('help command', () => {
    it('should display all commands when no argument provided', async () => {
      const result = await service.processCommand('help', [], mockContext);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Available Commands');
      expect(result.message).toContain('/w');
      expect(result.message).toContain('/profile');
      expect(result.systemMessage).toBe(true);
    });

    it('should display specific command help', async () => {
      const result = await service.processCommand('help', ['w'], mockContext);
      expect(result.success).toBe(true);
      expect(result.message).toContain('/w');
      expect(result.message).toContain('private message');
      expect(result.systemMessage).toBe(true);
    });

    it('should handle unknown command help request', async () => {
      const result = await service.processCommand('help', ['unknown'], mockContext);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown command');
    });
  });

  describe('who command', () => {
    const mockPlayers = [
      { name: 'Player1', level: 10 },
      { name: 'Player2', level: 25 },
    ];

    it('should list online players', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ players: mockPlayers }),
      });

      const result = await service.processCommand('who', [], mockContext);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Online Players (2)');
      expect(result.message).toContain('Player1 (Level 10)');
      expect(result.message).toContain('Player2 (Level 25)');
      expect(result.systemMessage).toBe(true);
    });

    it('should handle no online players', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ players: [] }),
      });

      const result = await service.processCommand('who', [], mockContext);
      expect(result.success).toBe(true);
      expect(result.message).toContain('No other players');
      expect(result.systemMessage).toBe(true);
    });
  });

  describe('command aliases', () => {
    it('should handle whisper aliases', async () => {
      const aliases = ['whisper', 'tell', 'msg'];
      
      for (const alias of aliases) {
        (fetch as jest.Mock)
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ userId: 'target123' }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ messageId: 'msg123' }),
          });

        const result = await service.processCommand(alias, ['player', 'hello'], mockContext);
        expect(result.success).toBe(true);
        expect(result.message).toContain('Whisper sent');
      }
    });

    it('should handle profile aliases', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          name: 'TestPlayer',
          level: 25,
          specialization: { primaryRole: 'tank' },
          guildName: 'TestGuild',
          lastActiveAt: '2023-01-01T00:00:00Z',
        }),
      });

      const aliases = ['p', 'char', 'character'];
      
      for (const alias of aliases) {
        const result = await service.processCommand(alias, ['player'], mockContext);
        expect(result.success).toBe(true);
        expect(result.message).toContain('TestPlayer');
      }
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await service.processCommand('profile', ['player'], mockContext);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Player "player" not found');
    });

    it('should handle API errors gracefully', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await service.processCommand('profile', ['player'], mockContext);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Player "player" not found');
    });
  });

  describe('getAllCommands', () => {
    it('should return all unique commands', () => {
      const commands = service.getAllCommands();
      const commandNames = commands.map(cmd => cmd.command);
      
      expect(commandNames).toContain('w');
      expect(commandNames).toContain('profile');
      expect(commandNames).toContain('ginvite');
      expect(commandNames).toContain('gkick');
      expect(commandNames).toContain('guild');
      expect(commandNames).toContain('help');
      expect(commandNames).toContain('who');
      
      // Should not contain aliases
      expect(commandNames).not.toContain('whisper');
      expect(commandNames).not.toContain('p');
    });

    it('should return commands with proper structure', () => {
      const commands = service.getAllCommands();
      
      commands.forEach(cmd => {
        expect(cmd).toHaveProperty('command');
        expect(cmd).toHaveProperty('aliases');
        expect(cmd).toHaveProperty('description');
        expect(cmd).toHaveProperty('usage');
        expect(cmd).toHaveProperty('minArgs');
        expect(cmd).toHaveProperty('maxArgs');
        expect(cmd).toHaveProperty('handler');
      });
    });
  });
});