"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaderboardQuerySchema = exports.CreatePartyRequestSchema = exports.SendMessageRequestSchema = exports.ChatMessageSchema = exports.PlaceBidRequestSchema = exports.CreateAuctionRequestSchema = exports.AuctionListingSchema = exports.ItemSchema = exports.ThemeDataSchema = exports.ItemStatsSchema = exports.CreateGuildRequestSchema = exports.GuildSchema = exports.GuildSettingsSchema = exports.GuildMemberSchema = exports.CreateCharacterRequestSchema = exports.CharacterSchema = exports.ActivitySchema = exports.SpecializationSchema = exports.CharacterStatsSchema = exports.CombatSkillSetSchema = exports.HarvestingSkillSetSchema = exports.CraftingSkillSetSchema = exports.CreateUserRequestSchema = exports.UserSchema = exports.SocialProviderSchema = void 0;
const zod_1 = require("zod");
exports.SocialProviderSchema = zod_1.z.object({
    provider: zod_1.z.string().refine((val) => ['google', 'facebook', 'x'].includes(val), {
        message: "Provider must be one of: google, facebook, x"
    }),
    providerId: zod_1.z.string().min(1),
    email: zod_1.z.string().email().optional(),
});
exports.UserSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
    email: zod_1.z.string().email(),
    socialProviders: zod_1.z.array(exports.SocialProviderSchema),
    createdAt: zod_1.z.date(),
    lastLogin: zod_1.z.date(),
});
exports.CreateUserRequestSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    socialProvider: exports.SocialProviderSchema,
});
exports.CraftingSkillSetSchema = zod_1.z.object({
    clockmaking: zod_1.z.number().min(0),
    engineering: zod_1.z.number().min(0),
    alchemy: zod_1.z.number().min(0),
    steamcraft: zod_1.z.number().min(0),
    level: zod_1.z.number().min(1),
    experience: zod_1.z.number().min(0),
});
exports.HarvestingSkillSetSchema = zod_1.z.object({
    mining: zod_1.z.number().min(0),
    foraging: zod_1.z.number().min(0),
    salvaging: zod_1.z.number().min(0),
    crystal_extraction: zod_1.z.number().min(0),
    level: zod_1.z.number().min(1),
    experience: zod_1.z.number().min(0),
});
exports.CombatSkillSetSchema = zod_1.z.object({
    melee: zod_1.z.number().min(0),
    ranged: zod_1.z.number().min(0),
    defense: zod_1.z.number().min(0),
    tactics: zod_1.z.number().min(0),
    level: zod_1.z.number().min(1),
    experience: zod_1.z.number().min(0),
});
exports.CharacterStatsSchema = zod_1.z.object({
    strength: zod_1.z.number().min(0),
    dexterity: zod_1.z.number().min(0),
    intelligence: zod_1.z.number().min(0),
    vitality: zod_1.z.number().min(0),
    craftingSkills: exports.CraftingSkillSetSchema,
    harvestingSkills: exports.HarvestingSkillSetSchema,
    combatSkills: exports.CombatSkillSetSchema,
});
exports.SpecializationSchema = zod_1.z.object({
    tankProgress: zod_1.z.number().min(0).max(100),
    healerProgress: zod_1.z.number().min(0).max(100),
    dpsProgress: zod_1.z.number().min(0).max(100),
    primaryRole: zod_1.z.union([zod_1.z.literal('tank'), zod_1.z.literal('healer'), zod_1.z.literal('dps')]).optional(),
    bonuses: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.union([zod_1.z.literal('stat'), zod_1.z.literal('skill'), zod_1.z.literal('ability')]),
        name: zod_1.z.string(),
        value: zod_1.z.number(),
        description: zod_1.z.string(),
    })),
});
exports.ActivitySchema = zod_1.z.object({
    type: zod_1.z.union([zod_1.z.literal('crafting'), zod_1.z.literal('harvesting'), zod_1.z.literal('combat')]),
    startedAt: zod_1.z.date(),
    progress: zod_1.z.number().min(0).max(100),
    rewards: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.union([zod_1.z.literal('experience'), zod_1.z.literal('currency'), zod_1.z.literal('item'), zod_1.z.literal('resource')]),
        amount: zod_1.z.number().min(0),
        itemId: zod_1.z.string().optional(),
    })),
});
exports.CharacterSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
    characterId: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1).max(50),
    level: zod_1.z.number().min(1).max(100),
    experience: zod_1.z.number().min(0),
    currency: zod_1.z.number().min(0),
    stats: exports.CharacterStatsSchema,
    specialization: exports.SpecializationSchema,
    currentActivity: exports.ActivitySchema,
    lastActiveAt: zod_1.z.date(),
    createdAt: zod_1.z.date(),
});
exports.CreateCharacterRequestSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Name can only contain letters, numbers, underscores, and hyphens'),
});
exports.GuildMemberSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
    characterName: zod_1.z.string(),
    role: zod_1.z.union([zod_1.z.literal('leader'), zod_1.z.literal('officer'), zod_1.z.literal('member')]),
    joinedAt: zod_1.z.date(),
    permissions: zod_1.z.array(zod_1.z.union([zod_1.z.literal('invite'), zod_1.z.literal('kick'), zod_1.z.literal('promote'), zod_1.z.literal('demote'), zod_1.z.literal('edit_settings'), zod_1.z.literal('manage_events')])),
    lastActiveAt: zod_1.z.date(),
});
exports.GuildSettingsSchema = zod_1.z.object({
    isPublic: zod_1.z.boolean(),
    requireApproval: zod_1.z.boolean(),
    maxMembers: zod_1.z.number().min(5).max(100),
    description: zod_1.z.string().max(500),
    motd: zod_1.z.string().max(200).optional(),
    allowedActivities: zod_1.z.array(zod_1.z.string()),
});
exports.GuildSchema = zod_1.z.object({
    guildId: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1).max(50),
    description: zod_1.z.string().max(500),
    leaderId: zod_1.z.string().uuid(),
    members: zod_1.z.array(exports.GuildMemberSchema),
    settings: exports.GuildSettingsSchema,
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
    memberCount: zod_1.z.number().min(1),
    level: zod_1.z.number().min(1),
    experience: zod_1.z.number().min(0),
});
exports.CreateGuildRequestSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(50).regex(/^[a-zA-Z0-9\s_-]+$/, 'Guild name can only contain letters, numbers, spaces, underscores, and hyphens'),
    description: zod_1.z.string().max(500),
    leaderId: zod_1.z.string().uuid(),
    settings: exports.GuildSettingsSchema.partial(),
});
exports.ItemStatsSchema = zod_1.z.object({
    strength: zod_1.z.number().optional(),
    dexterity: zod_1.z.number().optional(),
    intelligence: zod_1.z.number().optional(),
    vitality: zod_1.z.number().optional(),
    craftingBonus: zod_1.z.number().optional(),
    harvestingBonus: zod_1.z.number().optional(),
    combatBonus: zod_1.z.number().optional(),
    durability: zod_1.z.number().min(0).optional(),
    maxDurability: zod_1.z.number().min(1).optional(),
});
exports.ThemeDataSchema = zod_1.z.object({
    visualStyle: zod_1.z.union([zod_1.z.literal('brass'), zod_1.z.literal('copper'), zod_1.z.literal('steel'), zod_1.z.literal('crystal'), zod_1.z.literal('steam')]),
    description: zod_1.z.string(),
    flavorText: zod_1.z.string(),
    iconUrl: zod_1.z.string().url().optional(),
    modelUrl: zod_1.z.string().url().optional(),
});
exports.ItemSchema = zod_1.z.object({
    itemId: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1).max(100),
    description: zod_1.z.string().max(500),
    type: zod_1.z.union([zod_1.z.literal('weapon'), zod_1.z.literal('armor'), zod_1.z.literal('trinket'), zod_1.z.literal('material'), zod_1.z.literal('consumable'), zod_1.z.literal('tool')]),
    rarity: zod_1.z.union([zod_1.z.literal('common'), zod_1.z.literal('uncommon'), zod_1.z.literal('rare'), zod_1.z.literal('epic'), zod_1.z.literal('legendary')]),
    slot: zod_1.z.union([zod_1.z.literal('mainhand'), zod_1.z.literal('offhand'), zod_1.z.literal('head'), zod_1.z.literal('chest'), zod_1.z.literal('legs'), zod_1.z.literal('feet'), zod_1.z.literal('hands'), zod_1.z.literal('neck'), zod_1.z.literal('ring'), zod_1.z.literal('trinket')]).optional(),
    stats: exports.ItemStatsSchema,
    value: zod_1.z.number().min(0),
    stackable: zod_1.z.boolean(),
    maxStack: zod_1.z.number().min(1).optional(),
    steampunkTheme: exports.ThemeDataSchema,
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.AuctionListingSchema = zod_1.z.object({
    listingId: zod_1.z.string().uuid(),
    sellerId: zod_1.z.string().uuid(),
    sellerName: zod_1.z.string(),
    itemId: zod_1.z.string().uuid(),
    itemName: zod_1.z.string(),
    itemRarity: zod_1.z.string(),
    quantity: zod_1.z.number().min(1),
    startingPrice: zod_1.z.number().min(1),
    buyoutPrice: zod_1.z.number().min(1).optional(),
    currentBid: zod_1.z.number().min(0).optional(),
    currentBidderId: zod_1.z.string().uuid().optional(),
    currentBidderName: zod_1.z.string().optional(),
    bidHistory: zod_1.z.array(zod_1.z.object({
        bidId: zod_1.z.string().uuid(),
        bidderId: zod_1.z.string().uuid(),
        bidderName: zod_1.z.string(),
        amount: zod_1.z.number().min(1),
        timestamp: zod_1.z.date(),
    })),
    auctionType: zod_1.z.union([zod_1.z.literal('auction'), zod_1.z.literal('buyout'), zod_1.z.literal('both')]),
    status: zod_1.z.union([zod_1.z.literal('active'), zod_1.z.literal('sold'), zod_1.z.literal('expired'), zod_1.z.literal('cancelled')]),
    createdAt: zod_1.z.date(),
    expiresAt: zod_1.z.date(),
    completedAt: zod_1.z.date().optional(),
    fees: zod_1.z.object({
        listingFee: zod_1.z.number().min(0),
        successFee: zod_1.z.number().min(0),
        totalFees: zod_1.z.number().min(0),
    }),
});
exports.CreateAuctionRequestSchema = zod_1.z.object({
    sellerId: zod_1.z.string().uuid(),
    itemId: zod_1.z.string().uuid(),
    quantity: zod_1.z.number().min(1),
    startingPrice: zod_1.z.number().min(1),
    buyoutPrice: zod_1.z.number().min(1).optional(),
    duration: zod_1.z.number().min(1).max(168),
    auctionType: zod_1.z.union([zod_1.z.literal('auction'), zod_1.z.literal('buyout'), zod_1.z.literal('both')]),
}).refine(data => {
    if (data.auctionType === 'buyout' || data.auctionType === 'both') {
        return data.buyoutPrice !== undefined;
    }
    return true;
}, {
    message: "Buyout price is required for buyout auctions",
    path: ["buyoutPrice"],
});
exports.PlaceBidRequestSchema = zod_1.z.object({
    listingId: zod_1.z.string().uuid(),
    bidderId: zod_1.z.string().uuid(),
    bidAmount: zod_1.z.number().min(1),
});
exports.ChatMessageSchema = zod_1.z.object({
    messageId: zod_1.z.string().uuid(),
    channelId: zod_1.z.string().uuid(),
    senderId: zod_1.z.string().uuid(),
    senderName: zod_1.z.string(),
    content: zod_1.z.string().min(1).max(1000),
    type: zod_1.z.union([zod_1.z.literal('text'), zod_1.z.literal('system'), zod_1.z.literal('command'), zod_1.z.literal('emote')]),
    timestamp: zod_1.z.date(),
    recipientId: zod_1.z.string().uuid().optional(),
    isRead: zod_1.z.boolean(),
});
exports.SendMessageRequestSchema = zod_1.z.object({
    channelId: zod_1.z.string().uuid(),
    senderId: zod_1.z.string().uuid(),
    content: zod_1.z.string().min(1).max(1000),
    type: zod_1.z.union([zod_1.z.literal('text'), zod_1.z.literal('system'), zod_1.z.literal('command'), zod_1.z.literal('emote')]).optional(),
    recipientId: zod_1.z.string().uuid().optional(),
});
exports.CreatePartyRequestSchema = zod_1.z.object({
    leaderId: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1).max(50),
    type: zod_1.z.union([zod_1.z.literal('zone'), zod_1.z.literal('dungeon')]),
    visibility: zod_1.z.union([zod_1.z.literal('public'), zod_1.z.literal('guild'), zod_1.z.literal('private')]),
    maxMembers: zod_1.z.number().min(1).max(8),
    minLevel: zod_1.z.number().min(1).max(100),
    maxLevel: zod_1.z.number().min(1).max(100).optional(),
    guildId: zod_1.z.string().uuid().optional(),
}).refine(data => {
    if (data.type === 'zone' && data.maxMembers > 3) {
        return false;
    }
    if (data.type === 'dungeon' && (data.maxMembers < 5 || data.maxMembers > 8)) {
        return false;
    }
    return true;
}, {
    message: "Invalid party size for the selected type",
    path: ["maxMembers"],
});
exports.LeaderboardQuerySchema = zod_1.z.object({
    statType: zod_1.z.union([
        zod_1.z.literal('level'),
        zod_1.z.literal('totalExperience'),
        zod_1.z.literal('craftingLevel'),
        zod_1.z.literal('harvestingLevel'),
        zod_1.z.literal('combatLevel'),
        zod_1.z.literal('guildLevel'),
        zod_1.z.literal('currency'),
        zod_1.z.literal('itemsCreated'),
        zod_1.z.literal('zonesCompleted'),
        zod_1.z.literal('dungeonsCompleted')
    ]),
    limit: zod_1.z.number().min(1).max(100).optional(),
    offset: zod_1.z.number().min(0).optional(),
    userId: zod_1.z.string().uuid().optional(),
});
