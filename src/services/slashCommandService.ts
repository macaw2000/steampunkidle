/**
 * Slash command service for processing chat commands
 */

import { ChatService } from './chatService';
import { PartyService } from './partyService';

export interface SlashCommandResult {
  success: boolean;
  message?: string;
  error?: string;
  systemMessage?: boolean;
}

export interface SlashCommandDefinition {
  command: string;
  aliases: string[];
  description: string;
  usage: string;
  minArgs: number;
  maxArgs: number;
  requiresGuild?: boolean;
  requiresPermission?: string;
  handler: (args: string[], context: SlashCommandContext) => Promise<SlashCommandResult>;
}

export interface SlashCommandContext {
  senderId: string;
  senderName: string;
  channelId: string;
  messageType: 'general' | 'guild' | 'private';
  guildId?: string;
  guildRole?: string;
  guildPermissions?: string[];
}

export class SlashCommandService {
  private static instance: SlashCommandService;
  private commands: Map<string, SlashCommandDefinition> = new Map();
  private chatService: ChatService;

  private constructor() {
    this.chatService = ChatService.getInstance();
    this.initializeCommands();
  }

  static getInstance(): SlashCommandService {
    if (!SlashCommandService.instance) {
      SlashCommandService.instance = new SlashCommandService();
    }
    return SlashCommandService.instance;
  }

  /**
   * Initialize all available slash commands
   */
  private initializeCommands(): void {
    // Whisper commands
    this.registerCommand({
      command: 'w',
      aliases: ['whisper', 'tell', 'msg'],
      description: 'Send a private message to another player',
      usage: '/w <player> <message>',
      minArgs: 2,
      maxArgs: -1, // unlimited
      handler: this.handleWhisperCommand.bind(this),
    });

    // Profile commands
    this.registerCommand({
      command: 'profile',
      aliases: ['p', 'char', 'character'],
      description: 'View a player\'s character profile',
      usage: '/profile <player>',
      minArgs: 1,
      maxArgs: 1,
      handler: this.handleProfileCommand.bind(this),
    });

    // Guild invite command
    this.registerCommand({
      command: 'ginvite',
      aliases: ['guildinvite', 'invite'],
      description: 'Invite a player to your guild',
      usage: '/ginvite <player>',
      minArgs: 1,
      maxArgs: 1,
      requiresGuild: true,
      requiresPermission: 'invite',
      handler: this.handleGuildInviteCommand.bind(this),
    });

    // Guild kick command
    this.registerCommand({
      command: 'gkick',
      aliases: ['guildkick', 'kick'],
      description: 'Remove a player from your guild',
      usage: '/gkick <player>',
      minArgs: 1,
      maxArgs: 1,
      requiresGuild: true,
      requiresPermission: 'kick',
      handler: this.handleGuildKickCommand.bind(this),
    });

    // Guild info command
    this.registerCommand({
      command: 'guild',
      aliases: ['g', 'ginfo'],
      description: 'Display guild information',
      usage: '/guild [player]',
      minArgs: 0,
      maxArgs: 1,
      handler: this.handleGuildInfoCommand.bind(this),
    });

    // Help command
    this.registerCommand({
      command: 'help',
      aliases: ['commands', 'h'],
      description: 'Display available commands',
      usage: '/help [command]',
      minArgs: 0,
      maxArgs: 1,
      handler: this.handleHelpCommand.bind(this),
    });

    // Who command
    this.registerCommand({
      command: 'who',
      aliases: ['online', 'players'],
      description: 'List online players',
      usage: '/who',
      minArgs: 0,
      maxArgs: 0,
      handler: this.handleWhoCommand.bind(this),
    });
  }

  /**
   * Register a new slash command
   */
  private registerCommand(definition: SlashCommandDefinition): void {
    this.commands.set(definition.command, definition);
    definition.aliases.forEach(alias => {
      this.commands.set(alias, definition);
    });
  }

  /**
   * Parse a message to check if it's a slash command
   */
  parseCommand(message: string): { isCommand: boolean; command?: string; args?: string[] } {
    if (!message.startsWith('/')) {
      return { isCommand: false };
    }

    const parts = message.slice(1).split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    return {
      isCommand: true,
      command,
      args,
    };
  }

  /**
   * Process a slash command
   */
  async processCommand(
    command: string,
    args: string[],
    context: SlashCommandContext
  ): Promise<SlashCommandResult> {
    const commandDef = this.commands.get(command.toLowerCase());

    if (!commandDef) {
      return {
        success: false,
        error: `Unknown command: /${command}. Type /help for available commands.`,
      };
    }

    // Validate argument count
    if (args.length < commandDef.minArgs) {
      return {
        success: false,
        error: `Not enough arguments. Usage: ${commandDef.usage}`,
      };
    }

    if (commandDef.maxArgs !== -1 && args.length > commandDef.maxArgs) {
      return {
        success: false,
        error: `Too many arguments. Usage: ${commandDef.usage}`,
      };
    }

    // Check guild requirements
    if (commandDef.requiresGuild && !context.guildId) {
      return {
        success: false,
        error: 'You must be in a guild to use this command.',
      };
    }

    // Check permission requirements
    if (commandDef.requiresPermission && context.guildPermissions) {
      if (!context.guildPermissions.includes(commandDef.requiresPermission)) {
        return {
          success: false,
          error: 'You do not have permission to use this command.',
        };
      }
    }

    try {
      return await commandDef.handler(args, context);
    } catch (error) {
      console.error('Command execution error:', error);
      return {
        success: false,
        error: 'An error occurred while executing the command.',
      };
    }
  }

  /**
   * Get command suggestions for autocomplete
   */
  getCommandSuggestions(input: string): string[] {
    if (!input.startsWith('/')) {
      return [];
    }

    const commandPart = input.slice(1).toLowerCase();
    const suggestions: string[] = [];

    for (const [name, definition] of Array.from(this.commands.entries())) {
      if (name.startsWith(commandPart) && name === definition.command) {
        // Only include primary command names, not aliases
        suggestions.push(`/${name}`);
      }
    }

    return suggestions.slice(0, 10); // Limit to 10 suggestions
  }

  /**
   * Get all available commands
   */
  getAllCommands(): SlashCommandDefinition[] {
    const uniqueCommands = new Map<string, SlashCommandDefinition>();
    
    for (const definition of Array.from(this.commands.values())) {
      uniqueCommands.set(definition.command, definition);
    }

    return Array.from(uniqueCommands.values());
  }

  // Command handlers

  private async handleWhisperCommand(
    args: string[],
    context: SlashCommandContext
  ): Promise<SlashCommandResult> {
    const targetPlayer = args[0];
    const message = args.slice(1).join(' ');

    try {
      // Get target player's user ID
      const targetUserId = await this.getPlayerUserId(targetPlayer);
      if (!targetUserId) {
        return {
          success: false,
          error: `Player "${targetPlayer}" not found or not online.`,
        };
      }

      // Send private message
      await this.chatService.sendMessage({
        channelId: `private_${context.senderId}_${targetUserId}`,
        senderId: context.senderId,
        content: message,
        type: 'text',
        recipientId: targetUserId,
      });

      return {
        success: true,
        message: `Whisper sent to ${targetPlayer}.`,
        systemMessage: true,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to send whisper.',
      };
    }
  }

  private async handleProfileCommand(
    args: string[],
    context: SlashCommandContext
  ): Promise<SlashCommandResult> {
    const targetPlayer = args[0];

    try {
      const profile = await this.getPlayerProfile(targetPlayer);
      if (!profile) {
        return {
          success: false,
          error: `Player "${targetPlayer}" not found.`,
        };
      }

      const profileMessage = this.formatPlayerProfile(profile);
      return {
        success: true,
        message: profileMessage,
        systemMessage: true,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to retrieve player profile.',
      };
    }
  }

  private async handleGuildInviteCommand(
    args: string[],
    context: SlashCommandContext
  ): Promise<SlashCommandResult> {
    const targetPlayer = args[0];

    try {
      const targetUserId = await this.getPlayerUserId(targetPlayer);
      if (!targetUserId) {
        return {
          success: false,
          error: `Player "${targetPlayer}" not found or not online.`,
        };
      }

      await this.invitePlayerToGuild(context.guildId!, targetUserId, context.senderId);

      return {
        success: true,
        message: `Guild invitation sent to ${targetPlayer}.`,
        systemMessage: true,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to send guild invitation.',
      };
    }
  }

  private async handleGuildKickCommand(
    args: string[],
    context: SlashCommandContext
  ): Promise<SlashCommandResult> {
    const targetPlayer = args[0];

    try {
      const targetUserId = await this.getPlayerUserId(targetPlayer);
      if (!targetUserId) {
        return {
          success: false,
          error: `Player "${targetPlayer}" not found.`,
        };
      }

      await this.kickPlayerFromGuild(context.guildId!, targetUserId, context.senderId);

      return {
        success: true,
        message: `${targetPlayer} has been removed from the guild.`,
        systemMessage: true,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to kick player from guild.',
      };
    }
  }

  private async handleGuildInfoCommand(
    args: string[],
    context: SlashCommandContext
  ): Promise<SlashCommandResult> {
    try {
      let guildId = context.guildId;
      
      if (args.length > 0) {
        // Get guild info for specified player
        const targetPlayer = args[0];
        const targetUserId = await this.getPlayerUserId(targetPlayer);
        if (!targetUserId) {
          return {
            success: false,
            error: `Player "${targetPlayer}" not found.`,
          };
        }
        
        const targetGuildId = await this.getPlayerGuildId(targetUserId);
        if (!targetGuildId) {
          return {
            success: false,
            error: `${targetPlayer} is not in a guild.`,
          };
        }
        guildId = targetGuildId;
      }

      if (!guildId) {
        return {
          success: false,
          error: 'You are not in a guild.',
        };
      }

      const guildInfo = await this.getGuildInfo(guildId);
      if (!guildInfo) {
        return {
          success: false,
          error: 'Guild information not found.',
        };
      }

      const guildMessage = this.formatGuildInfo(guildInfo);
      return {
        success: true,
        message: guildMessage,
        systemMessage: true,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to retrieve guild information.',
      };
    }
  }

  private async handleHelpCommand(
    args: string[],
    context: SlashCommandContext
  ): Promise<SlashCommandResult> {
    if (args.length > 0) {
      // Show help for specific command
      const commandName = args[0].toLowerCase();
      const commandDef = this.commands.get(commandName);
      
      if (!commandDef) {
        return {
          success: false,
          error: `Unknown command: /${commandName}`,
        };
      }

      let helpMessage = `**/${commandDef.command}** - ${commandDef.description}\n` +
                        `Usage: ${commandDef.usage}`;
      
      if (commandDef.aliases.length > 0) {
        helpMessage += `\nAliases: ${commandDef.aliases.map(a => `/${a}`).join(', ')}`;
      }

      return {
        success: true,
        message: helpMessage,
        systemMessage: true,
      };
    }

    // Show all commands
    const commands = this.getAllCommands();
    const helpMessage = '**Available Commands:**\n' +
      commands.map(cmd => `/${cmd.command} - ${cmd.description}`).join('\n') +
      '\n\nType /help <command> for detailed usage information.';

    return {
      success: true,
      message: helpMessage,
      systemMessage: true,
    };
  }

  private async handleWhoCommand(
    args: string[],
    context: SlashCommandContext
  ): Promise<SlashCommandResult> {
    try {
      const onlinePlayers = await this.getOnlinePlayers();
      
      if (onlinePlayers.length === 0) {
        return {
          success: true,
          message: 'No other players are currently online.',
          systemMessage: true,
        };
      }

      const playerList = onlinePlayers
        .filter((player): player is any => player && player.name && player.level)
        .map(player => `${player.name} (Level ${player.level})`)
        .join('\n');

      return {
        success: true,
        message: `**Online Players (${onlinePlayers.length}):**\n${playerList}`,
        systemMessage: true,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to retrieve online players.',
      };
    }
  }

  // Helper methods (these would typically call actual API endpoints)

  private async getPlayerUserId(playerName: string): Promise<string | null> {
    // This would call an API to find the player by name
    // For now, return a mock implementation
    try {
      const response = await fetch(`/api/players/search?name=${encodeURIComponent(playerName)}`);
      if (!response.ok) return null;
      
      const data = await response.json();
      return data.userId || null;
    } catch {
      return null;
    }
  }

  private async getPlayerProfile(playerName: string): Promise<any | null> {
    try {
      const response = await fetch(`/api/players/profile?name=${encodeURIComponent(playerName)}`);
      if (!response.ok) return null;
      
      return await response.json();
    } catch {
      return null;
    }
  }

  private async getPlayerGuildId(userId: string): Promise<string | null> {
    try {
      const response = await fetch(`/api/players/${userId}/guild`);
      if (!response.ok) return null;
      
      const data = await response.json();
      return data.guildId || null;
    } catch {
      return null;
    }
  }

  private async getGuildInfo(guildId: string): Promise<any | null> {
    try {
      const response = await fetch(`/api/guilds/${guildId}`);
      if (!response.ok) return null;
      
      return await response.json();
    } catch {
      return null;
    }
  }

  private async invitePlayerToGuild(guildId: string, targetUserId: string, inviterId: string): Promise<void> {
    const response = await fetch(`/api/guilds/${guildId}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId, inviterId }),
    });

    if (!response.ok) {
      throw new Error('Failed to send guild invitation');
    }
  }

  private async kickPlayerFromGuild(guildId: string, targetUserId: string, kickerId: string): Promise<void> {
    const response = await fetch(`/api/guilds/${guildId}/kick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId, kickerId }),
    });

    if (!response.ok) {
      throw new Error('Failed to kick player from guild');
    }
  }

  private async getOnlinePlayers(): Promise<any[]> {
    try {
      const response = await fetch('/api/players/online');
      if (!response.ok) return [];
      
      const data = await response.json();
      return data.players || [];
    } catch {
      return [];
    }
  }

  private formatPlayerProfile(profile: any): string {
    return `**${profile.name}** (Level ${profile.level})\n` +
           `Specialization: ${profile.specialization?.primaryRole || 'None'}\n` +
           `Guild: ${profile.guildName || 'None'}\n` +
           `Last Active: ${new Date(profile.lastActiveAt).toLocaleString()}`;
  }

  private formatGuildInfo(guild: any): string {
    return `**${guild.name}**\n` +
           `${guild.description}\n` +
           `Members: ${guild.memberCount}/${guild.settings.maxMembers}\n` +
           `Level: ${guild.level}\n` +
           `Leader: ${guild.leaderName}`;
  }
}

export default SlashCommandService;