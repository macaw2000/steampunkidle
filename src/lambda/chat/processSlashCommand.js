"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client_apigatewaymanagementapi_1 = require("@aws-sdk/client-apigatewaymanagementapi");
const client = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
const handler = async (event) => {
    try {
        const body = JSON.parse(event.body || '{}');
        const { command, args, channelId, senderId, senderName, messageType } = body;
        if (!command || !senderId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Command and senderId are required' }),
            };
        }
        const context = await getUserContext(senderId);
        const result = await processSlashCommand(command, args, {
            senderId,
            senderName,
            channelId,
            messageType,
            ...context,
        });
        if (result.success && result.message) {
            await sendSystemMessage(senderId, result.message, channelId);
        }
        else if (!result.success && result.error) {
            await sendSystemMessage(senderId, `❌ ${result.error}`, channelId);
        }
        return {
            statusCode: 200,
            body: JSON.stringify(result),
        };
    }
    catch (error) {
        console.error('Slash command processing error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to process slash command' }),
        };
    }
};
exports.handler = handler;
async function getUserContext(userId) {
    try {
        const guildMemberResult = await docClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: process.env.GUILD_MEMBERS_TABLE,
            IndexName: 'user-guild-index',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId,
            },
        }));
        let guildId;
        let guildRole;
        let guildPermissions = [];
        if (guildMemberResult.Items && guildMemberResult.Items.length > 0) {
            const membership = guildMemberResult.Items[0];
            guildId = membership.guildId;
            guildRole = membership.role;
            guildPermissions = membership.permissions || [];
        }
        return {
            guildId,
            guildRole,
            guildPermissions,
        };
    }
    catch (error) {
        console.error('Error getting user context:', error);
        return {};
    }
}
async function processSlashCommand(command, args, context) {
    const cmd = command.toLowerCase();
    switch (cmd) {
        case 'w':
        case 'whisper':
        case 'tell':
        case 'msg':
            return await handleWhisperCommand(args, context);
        case 'profile':
        case 'p':
        case 'char':
        case 'character':
            return await handleProfileCommand(args, context);
        case 'ginvite':
        case 'guildinvite':
        case 'invite':
            return await handleGuildInviteCommand(args, context);
        case 'gkick':
        case 'guildkick':
        case 'kick':
            return await handleGuildKickCommand(args, context);
        case 'guild':
        case 'g':
        case 'ginfo':
            return await handleGuildInfoCommand(args, context);
        case 'help':
        case 'commands':
        case 'h':
            return await handleHelpCommand(args, context);
        case 'who':
        case 'online':
        case 'players':
            return await handleWhoCommand(args, context);
        default:
            return {
                success: false,
                error: `Unknown command: /${command}. Type /help for available commands.`,
            };
    }
}
async function handleWhisperCommand(args, context) {
    if (args.length < 2) {
        return {
            success: false,
            error: 'Usage: /w <player> <message>',
        };
    }
    const targetPlayerName = args[0];
    const message = args.slice(1).join(' ');
    try {
        const targetPlayer = await findPlayerByName(targetPlayerName);
        if (!targetPlayer) {
            return {
                success: false,
                error: `Player "${targetPlayerName}" not found or not online.`,
            };
        }
        await sendPrivateMessage(context.senderId, targetPlayer.userId, message, context.senderName);
        return {
            success: true,
            message: `Whisper sent to ${targetPlayerName}.`,
            systemMessage: true,
        };
    }
    catch (error) {
        return {
            success: false,
            error: 'Failed to send whisper.',
        };
    }
}
async function handleProfileCommand(args, context) {
    if (args.length !== 1) {
        return {
            success: false,
            error: 'Usage: /profile <player>',
        };
    }
    const targetPlayerName = args[0];
    try {
        const player = await findPlayerByName(targetPlayerName);
        if (!player) {
            return {
                success: false,
                error: `Player "${targetPlayerName}" not found.`,
            };
        }
        const character = await getCharacterProfile(player.userId);
        if (!character) {
            return {
                success: false,
                error: 'Character profile not found.',
            };
        }
        const profileMessage = formatPlayerProfile(character);
        return {
            success: true,
            message: profileMessage,
            systemMessage: true,
        };
    }
    catch (error) {
        return {
            success: false,
            error: 'Failed to retrieve player profile.',
        };
    }
}
async function handleGuildInviteCommand(args, context) {
    if (!context.guildId) {
        return {
            success: false,
            error: 'You must be in a guild to use this command.',
        };
    }
    if (!context.guildPermissions?.includes('invite')) {
        return {
            success: false,
            error: 'You do not have permission to invite players to the guild.',
        };
    }
    if (args.length !== 1) {
        return {
            success: false,
            error: 'Usage: /ginvite <player>',
        };
    }
    const targetPlayerName = args[0];
    try {
        const targetPlayer = await findPlayerByName(targetPlayerName);
        if (!targetPlayer) {
            return {
                success: false,
                error: `Player "${targetPlayerName}" not found or not online.`,
            };
        }
        const existingMembership = await docClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: process.env.GUILD_MEMBERS_TABLE,
            IndexName: 'user-guild-index',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': targetPlayer.userId,
            },
        }));
        if (existingMembership.Items && existingMembership.Items.length > 0) {
            return {
                success: false,
                error: `${targetPlayerName} is already in a guild.`,
            };
        }
        await createGuildInvitation(context.guildId, context.senderId, targetPlayer.userId);
        await sendSystemMessage(targetPlayer.userId, `You have been invited to join a guild by ${context.senderName}. Use /guild accept to join.`, 'system');
        return {
            success: true,
            message: `Guild invitation sent to ${targetPlayerName}.`,
            systemMessage: true,
        };
    }
    catch (error) {
        return {
            success: false,
            error: 'Failed to send guild invitation.',
        };
    }
}
async function handleGuildKickCommand(args, context) {
    if (!context.guildId) {
        return {
            success: false,
            error: 'You must be in a guild to use this command.',
        };
    }
    if (!context.guildPermissions?.includes('kick')) {
        return {
            success: false,
            error: 'You do not have permission to kick players from the guild.',
        };
    }
    if (args.length !== 1) {
        return {
            success: false,
            error: 'Usage: /gkick <player>',
        };
    }
    const targetPlayerName = args[0];
    try {
        const targetPlayer = await findPlayerByName(targetPlayerName);
        if (!targetPlayer) {
            return {
                success: false,
                error: `Player "${targetPlayerName}" not found.`,
            };
        }
        const membershipResult = await docClient.send(new lib_dynamodb_1.GetCommand({
            TableName: process.env.GUILD_MEMBERS_TABLE,
            Key: {
                guildId: context.guildId,
                userId: targetPlayer.userId,
            },
        }));
        if (!membershipResult.Item) {
            return {
                success: false,
                error: `${targetPlayerName} is not in your guild.`,
            };
        }
        if (membershipResult.Item.role === 'leader') {
            return {
                success: false,
                error: 'Cannot kick the guild leader.',
            };
        }
        await removeGuildMember(context.guildId, targetPlayer.userId);
        await sendSystemMessage(targetPlayer.userId, `You have been removed from the guild by ${context.senderName}.`, 'system');
        return {
            success: true,
            message: `${targetPlayerName} has been removed from the guild.`,
            systemMessage: true,
        };
    }
    catch (error) {
        return {
            success: false,
            error: 'Failed to kick player from guild.',
        };
    }
}
async function handleGuildInfoCommand(args, context) {
    try {
        let guildId = context.guildId;
        if (args.length > 0) {
            const targetPlayerName = args[0];
            const targetPlayer = await findPlayerByName(targetPlayerName);
            if (!targetPlayer) {
                return {
                    success: false,
                    error: `Player "${targetPlayerName}" not found.`,
                };
            }
            const membershipResult = await docClient.send(new lib_dynamodb_1.QueryCommand({
                TableName: process.env.GUILD_MEMBERS_TABLE,
                IndexName: 'user-guild-index',
                KeyConditionExpression: 'userId = :userId',
                ExpressionAttributeValues: {
                    ':userId': targetPlayer.userId,
                },
            }));
            if (!membershipResult.Items || membershipResult.Items.length === 0) {
                return {
                    success: false,
                    error: `${targetPlayerName} is not in a guild.`,
                };
            }
            guildId = membershipResult.Items[0].guildId;
        }
        if (!guildId) {
            return {
                success: false,
                error: 'You are not in a guild.',
            };
        }
        const guild = await getGuildInfo(guildId);
        if (!guild) {
            return {
                success: false,
                error: 'Guild information not found.',
            };
        }
        const guildMessage = formatGuildInfo(guild);
        return {
            success: true,
            message: guildMessage,
            systemMessage: true,
        };
    }
    catch (error) {
        return {
            success: false,
            error: 'Failed to retrieve guild information.',
        };
    }
}
async function handleHelpCommand(args, context) {
    const commands = [
        '/w <player> <message> - Send a private message',
        '/profile <player> - View player profile',
        '/ginvite <player> - Invite player to guild (requires permission)',
        '/gkick <player> - Remove player from guild (requires permission)',
        '/guild [player] - Show guild information',
        '/who - List online players',
        '/help [command] - Show this help or command details',
    ];
    if (args.length > 0) {
        const commandName = args[0].toLowerCase();
        const commandHelp = getCommandHelp(commandName);
        if (!commandHelp) {
            return {
                success: false,
                error: `Unknown command: /${commandName}`,
            };
        }
        return {
            success: true,
            message: commandHelp,
            systemMessage: true,
        };
    }
    return {
        success: true,
        message: `**Available Commands:**\n${commands.join('\n')}\n\nType /help <command> for detailed usage.`,
        systemMessage: true,
    };
}
async function handleWhoCommand(args, context) {
    try {
        const onlinePlayers = await getOnlinePlayers();
        if (onlinePlayers.length === 0) {
            return {
                success: true,
                message: 'No other players are currently online.',
                systemMessage: true,
            };
        }
        const playerList = onlinePlayers
            .filter((player) => player && player.name && player.level)
            .map(player => `${player.name} (Level ${player.level})`)
            .join('\n');
        return {
            success: true,
            message: `**Online Players (${onlinePlayers.length}):**\n${playerList}`,
            systemMessage: true,
        };
    }
    catch (error) {
        return {
            success: false,
            error: 'Failed to retrieve online players.',
        };
    }
}
async function findPlayerByName(playerName) {
    try {
        const result = await docClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: process.env.CHARACTERS_TABLE,
            IndexName: 'name-index',
            KeyConditionExpression: '#name = :name',
            ExpressionAttributeNames: {
                '#name': 'name',
            },
            ExpressionAttributeValues: {
                ':name': playerName,
            },
        }));
        return result.Items?.[0] || null;
    }
    catch (error) {
        console.error('Error finding player:', error);
        return null;
    }
}
async function getCharacterProfile(userId) {
    try {
        const result = await docClient.send(new lib_dynamodb_1.GetCommand({
            TableName: process.env.CHARACTERS_TABLE,
            Key: { userId },
        }));
        return result.Item || null;
    }
    catch (error) {
        console.error('Error getting character profile:', error);
        return null;
    }
}
async function getGuildInfo(guildId) {
    try {
        const result = await docClient.send(new lib_dynamodb_1.GetCommand({
            TableName: process.env.GUILDS_TABLE,
            Key: { guildId },
        }));
        return result.Item || null;
    }
    catch (error) {
        console.error('Error getting guild info:', error);
        return null;
    }
}
async function createGuildInvitation(guildId, inviterId, inviteeId) {
    const invitationId = `${guildId}_${inviteeId}_${Date.now()}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await docClient.send(new lib_dynamodb_1.PutCommand({
        TableName: process.env.GUILD_INVITATIONS_TABLE,
        Item: {
            invitationId,
            guildId,
            inviterId,
            inviteeId,
            status: 'pending',
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString(),
            ttl: Math.floor(expiresAt.getTime() / 1000),
        },
    }));
}
async function removeGuildMember(guildId, userId) {
    console.log(`Removing member ${userId} from guild ${guildId}`);
}
async function getOnlinePlayers() {
    try {
        const result = await docClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: process.env.CHAT_CONNECTIONS_TABLE,
            IndexName: 'status-index',
            KeyConditionExpression: '#status = :status',
            ExpressionAttributeNames: {
                '#status': 'status',
            },
            ExpressionAttributeValues: {
                ':status': 'connected',
            },
        }));
        const userIds = result.Items?.map(item => item.userId) || [];
        const characterPromises = userIds.map(userId => docClient.send(new lib_dynamodb_1.GetCommand({
            TableName: process.env.CHARACTERS_TABLE,
            Key: { userId },
        })));
        const characterResults = await Promise.all(characterPromises);
        return characterResults
            .map(result => result.Item)
            .filter(item => item !== undefined);
    }
    catch (error) {
        console.error('Error getting online players:', error);
        return [];
    }
}
async function sendSystemMessage(userId, message, channelId) {
    const connectionsResult = await docClient.send(new lib_dynamodb_1.QueryCommand({
        TableName: process.env.CHAT_CONNECTIONS_TABLE,
        IndexName: 'userId-index',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
            ':userId': userId,
        },
    }));
    if (!connectionsResult.Items || connectionsResult.Items.length === 0) {
        return;
    }
    const apiGatewayClient = new client_apigatewaymanagementapi_1.ApiGatewayManagementApiClient({
        endpoint: process.env.WEBSOCKET_ENDPOINT,
    });
    const sendPromises = connectionsResult.Items.map(connection => apiGatewayClient.send(new client_apigatewaymanagementapi_1.PostToConnectionCommand({
        ConnectionId: connection.connectionId,
        Data: JSON.stringify({
            type: 'system_message',
            data: {
                message,
                channelId,
                timestamp: new Date().toISOString(),
            },
        }),
    })));
    await Promise.all(sendPromises);
}
async function sendPrivateMessage(senderId, recipientId, message, senderName) {
    console.log(`Sending private message from ${senderId} to ${recipientId}: ${message}`);
}
function formatPlayerProfile(character) {
    const spec = character.specialization;
    const primaryRole = spec?.primaryRole || 'None';
    return `**${character.name}** (Level ${character.level})\n` +
        `Specialization: ${primaryRole}\n` +
        `Experience: ${character.experience}\n` +
        `Currency: ${character.currency}\n` +
        `Last Active: ${new Date(character.lastActiveAt).toLocaleString()}`;
}
function formatGuildInfo(guild) {
    return `**${guild.name}**\n` +
        `${guild.description}\n` +
        `Members: ${guild.memberCount}/${guild.settings?.maxMembers || 50}\n` +
        `Level: ${guild.level || 1}\n` +
        `Created: ${new Date(guild.createdAt).toLocaleDateString()}`;
}
function getCommandHelp(command) {
    const helpTexts = {
        'w': '**Whisper Command**\nUsage: /w <player> <message>\nSends a private message to the specified player.',
        'whisper': '**Whisper Command**\nUsage: /whisper <player> <message>\nSends a private message to the specified player.',
        'profile': '**Profile Command**\nUsage: /profile <player>\nDisplays the character profile of the specified player.',
        'ginvite': '**Guild Invite Command**\nUsage: /ginvite <player>\nInvites a player to your guild. Requires guild invite permission.',
        'gkick': '**Guild Kick Command**\nUsage: /gkick <player>\nRemoves a player from your guild. Requires guild kick permission.',
        'guild': '**Guild Info Command**\nUsage: /guild [player]\nDisplays guild information for yourself or the specified player.',
        'who': '**Who Command**\nUsage: /who\nLists all currently online players.',
        'help': '**Help Command**\nUsage: /help [command]\nDisplays available commands or detailed help for a specific command.',
    };
    return helpTexts[command] || null;
}
