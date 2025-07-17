/**
 * Validation schemas for all game entities using Zod
 */

import { z } from 'zod';

// User validation schemas
export const SocialProviderSchema = z.object({
  provider: z.string().refine((val) => ['google', 'facebook', 'x'].includes(val), {
    message: "Provider must be one of: google, facebook, x"
  }),
  providerId: z.string().min(1),
  email: z.string().email().optional(),
});

export const UserSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  socialProviders: z.array(SocialProviderSchema),
  createdAt: z.date(),
  lastLogin: z.date(),
});

export const CreateUserRequestSchema = z.object({
  email: z.string().email(),
  socialProvider: SocialProviderSchema,
});

// Character validation schemas
export const CraftingSkillSetSchema = z.object({
  clockmaking: z.number().min(0),
  engineering: z.number().min(0),
  alchemy: z.number().min(0),
  steamcraft: z.number().min(0),
  level: z.number().min(1),
  experience: z.number().min(0),
});

export const HarvestingSkillSetSchema = z.object({
  mining: z.number().min(0),
  foraging: z.number().min(0),
  salvaging: z.number().min(0),
  crystal_extraction: z.number().min(0),
  level: z.number().min(1),
  experience: z.number().min(0),
});

export const CombatSkillSetSchema = z.object({
  melee: z.number().min(0),
  ranged: z.number().min(0),
  defense: z.number().min(0),
  tactics: z.number().min(0),
  level: z.number().min(1),
  experience: z.number().min(0),
});

export const CharacterStatsSchema = z.object({
  strength: z.number().min(0),
  dexterity: z.number().min(0),
  intelligence: z.number().min(0),
  vitality: z.number().min(0),
  craftingSkills: CraftingSkillSetSchema,
  harvestingSkills: HarvestingSkillSetSchema,
  combatSkills: CombatSkillSetSchema,
});

export const SpecializationSchema = z.object({
  tankProgress: z.number().min(0).max(100),
  healerProgress: z.number().min(0).max(100),
  dpsProgress: z.number().min(0).max(100),
  primaryRole: z.union([z.literal('tank'), z.literal('healer'), z.literal('dps')]).optional(),
  bonuses: z.array(z.object({
    type: z.union([z.literal('stat'), z.literal('skill'), z.literal('ability')]),
    name: z.string(),
    value: z.number(),
    description: z.string(),
  })),
});

export const ActivitySchema = z.object({
  type: z.union([z.literal('crafting'), z.literal('harvesting'), z.literal('combat')]),
  startedAt: z.date(),
  progress: z.number().min(0).max(100),
  rewards: z.array(z.object({
    type: z.union([z.literal('experience'), z.literal('currency'), z.literal('item'), z.literal('resource')]),
    amount: z.number().min(0),
    itemId: z.string().optional(),
  })),
});

export const CharacterSchema = z.object({
  userId: z.string().uuid(),
  characterId: z.string().uuid(),
  name: z.string().min(1).max(50),
  level: z.number().min(1).max(100),
  experience: z.number().min(0),
  currency: z.number().min(0),
  stats: CharacterStatsSchema,
  specialization: SpecializationSchema,
  currentActivity: ActivitySchema,
  lastActiveAt: z.date(),
  createdAt: z.date(),
});

export const CreateCharacterRequestSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Name can only contain letters, numbers, underscores, and hyphens'),
});

// Guild validation schemas
export const GuildMemberSchema = z.object({
  userId: z.string().uuid(),
  characterName: z.string(),
  role: z.union([z.literal('leader'), z.literal('officer'), z.literal('member')]),
  joinedAt: z.date(),
  permissions: z.array(z.union([z.literal('invite'), z.literal('kick'), z.literal('promote'), z.literal('demote'), z.literal('edit_settings'), z.literal('manage_events')])),
  lastActiveAt: z.date(),
});

export const GuildSettingsSchema = z.object({
  isPublic: z.boolean(),
  requireApproval: z.boolean(),
  maxMembers: z.number().min(5).max(100),
  description: z.string().max(500),
  motd: z.string().max(200).optional(),
  allowedActivities: z.array(z.string()),
});

export const GuildSchema = z.object({
  guildId: z.string().uuid(),
  name: z.string().min(1).max(50),
  description: z.string().max(500),
  leaderId: z.string().uuid(),
  members: z.array(GuildMemberSchema),
  settings: GuildSettingsSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  memberCount: z.number().min(1),
  level: z.number().min(1),
  experience: z.number().min(0),
});

export const CreateGuildRequestSchema = z.object({
  name: z.string().min(1).max(50).regex(/^[a-zA-Z0-9\s_-]+$/, 'Guild name can only contain letters, numbers, spaces, underscores, and hyphens'),
  description: z.string().max(500),
  leaderId: z.string().uuid(),
  settings: GuildSettingsSchema.partial(),
});

// Item validation schemas
export const ItemStatsSchema = z.object({
  strength: z.number().optional(),
  dexterity: z.number().optional(),
  intelligence: z.number().optional(),
  vitality: z.number().optional(),
  craftingBonus: z.number().optional(),
  harvestingBonus: z.number().optional(),
  combatBonus: z.number().optional(),
  durability: z.number().min(0).optional(),
  maxDurability: z.number().min(1).optional(),
});

export const ThemeDataSchema = z.object({
  visualStyle: z.union([z.literal('brass'), z.literal('copper'), z.literal('steel'), z.literal('crystal'), z.literal('steam')]),
  description: z.string(),
  flavorText: z.string(),
  iconUrl: z.string().url().optional(),
  modelUrl: z.string().url().optional(),
});

export const ItemSchema = z.object({
  itemId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  type: z.union([z.literal('weapon'), z.literal('armor'), z.literal('trinket'), z.literal('material'), z.literal('consumable'), z.literal('tool')]),
  rarity: z.union([z.literal('common'), z.literal('uncommon'), z.literal('rare'), z.literal('epic'), z.literal('legendary')]),
  slot: z.union([z.literal('mainhand'), z.literal('offhand'), z.literal('head'), z.literal('chest'), z.literal('legs'), z.literal('feet'), z.literal('hands'), z.literal('neck'), z.literal('ring'), z.literal('trinket')]).optional(),
  stats: ItemStatsSchema,
  value: z.number().min(0),
  stackable: z.boolean(),
  maxStack: z.number().min(1).optional(),
  steampunkTheme: ThemeDataSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Auction validation schemas
export const AuctionListingSchema = z.object({
  listingId: z.string().uuid(),
  sellerId: z.string().uuid(),
  sellerName: z.string(),
  itemId: z.string().uuid(),
  itemName: z.string(),
  itemRarity: z.string(),
  quantity: z.number().min(1),
  startingPrice: z.number().min(1),
  buyoutPrice: z.number().min(1).optional(),
  currentBid: z.number().min(0).optional(),
  currentBidderId: z.string().uuid().optional(),
  currentBidderName: z.string().optional(),
  bidHistory: z.array(z.object({
    bidId: z.string().uuid(),
    bidderId: z.string().uuid(),
    bidderName: z.string(),
    amount: z.number().min(1),
    timestamp: z.date(),
  })),
  auctionType: z.union([z.literal('auction'), z.literal('buyout'), z.literal('both')]),
  status: z.union([z.literal('active'), z.literal('sold'), z.literal('expired'), z.literal('cancelled')]),
  createdAt: z.date(),
  expiresAt: z.date(),
  completedAt: z.date().optional(),
  fees: z.object({
    listingFee: z.number().min(0),
    successFee: z.number().min(0),
    totalFees: z.number().min(0),
  }),
});

export const CreateAuctionRequestSchema = z.object({
  sellerId: z.string().uuid(),
  itemId: z.string().uuid(),
  quantity: z.number().min(1),
  startingPrice: z.number().min(1),
  buyoutPrice: z.number().min(1).optional(),
  duration: z.number().min(1).max(168), // 1 hour to 1 week
  auctionType: z.union([z.literal('auction'), z.literal('buyout'), z.literal('both')]),
}).refine(data => {
  if (data.auctionType === 'buyout' || data.auctionType === 'both') {
    return data.buyoutPrice !== undefined;
  }
  return true;
}, {
  message: "Buyout price is required for buyout auctions",
  path: ["buyoutPrice"],
});

export const PlaceBidRequestSchema = z.object({
  listingId: z.string().uuid(),
  bidderId: z.string().uuid(),
  bidAmount: z.number().min(1),
});

// Chat validation schemas
export const ChatMessageSchema = z.object({
  messageId: z.string().uuid(),
  channelId: z.string().uuid(),
  senderId: z.string().uuid(),
  senderName: z.string(),
  content: z.string().min(1).max(1000),
  type: z.union([z.literal('text'), z.literal('system'), z.literal('command'), z.literal('emote')]),
  timestamp: z.date(),
  recipientId: z.string().uuid().optional(),
  isRead: z.boolean(),
});

export const SendMessageRequestSchema = z.object({
  channelId: z.string().uuid(),
  senderId: z.string().uuid(),
  content: z.string().min(1).max(1000),
  type: z.union([z.literal('text'), z.literal('system'), z.literal('command'), z.literal('emote')]).optional(),
  recipientId: z.string().uuid().optional(),
});

// Zone/Party validation schemas
export const CreatePartyRequestSchema = z.object({
  leaderId: z.string().uuid(),
  name: z.string().min(1).max(50),
  type: z.union([z.literal('zone'), z.literal('dungeon')]),
  visibility: z.union([z.literal('public'), z.literal('guild'), z.literal('private')]),
  maxMembers: z.number().min(1).max(8),
  minLevel: z.number().min(1).max(100),
  maxLevel: z.number().min(1).max(100).optional(),
  guildId: z.string().uuid().optional(),
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

// Leaderboard validation schemas
export const LeaderboardQuerySchema = z.object({
  statType: z.union([
    z.literal('level'),
    z.literal('totalExperience'),
    z.literal('craftingLevel'),
    z.literal('harvestingLevel'),
    z.literal('combatLevel'),
    z.literal('guildLevel'),
    z.literal('currency'),
    z.literal('itemsCreated'),
    z.literal('zonesCompleted'),
    z.literal('dungeonsCompleted')
  ]),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
  userId: z.string().uuid().optional(),
});