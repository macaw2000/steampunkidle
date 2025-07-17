/**
 * Data transformation utilities for converting between different data formats
 */

import { 
  User, Character, Guild, Item, AuctionListing, 
  ChatMessage, Party, LeaderboardEntry 
} from './index';

// Database to API transformers
export class DataTransformers {
  
  /**
   * Transform DynamoDB item to User object
   */
  static dynamoToUser(dynamoItem: any): User {
    return {
      userId: dynamoItem.userId,
      email: dynamoItem.email,
      socialProviders: dynamoItem.socialProviders || [],
      createdAt: new Date(dynamoItem.createdAt),
      lastLogin: new Date(dynamoItem.lastLogin),
    };
  }

  /**
   * Transform User object to DynamoDB item
   */
  static userToDynamo(user: User): any {
    return {
      userId: user.userId,
      email: user.email,
      socialProviders: user.socialProviders,
      createdAt: user.createdAt.toISOString(),
      lastLogin: user.lastLogin.toISOString(),
    };
  }

  /**
   * Transform DynamoDB item to Character object
   */
  static dynamoToCharacter(dynamoItem: any): Character {
    return {
      userId: dynamoItem.userId,
      characterId: dynamoItem.characterId,
      name: dynamoItem.name,
      level: dynamoItem.level,
      experience: dynamoItem.experience,
      currency: dynamoItem.currency || 0,
      stats: dynamoItem.stats,
      specialization: dynamoItem.specialization,
      currentActivity: {
        ...dynamoItem.currentActivity,
        startedAt: new Date(dynamoItem.currentActivity.startedAt),
      },
      lastActiveAt: new Date(dynamoItem.lastActiveAt),
      createdAt: new Date(dynamoItem.createdAt),
      updatedAt: new Date(dynamoItem.updatedAt),
    };
  }

  /**
   * Transform Character object to DynamoDB item
   */
  static characterToDynamo(character: Character): any {
    return {
      userId: character.userId,
      characterId: character.characterId,
      name: character.name,
      level: character.level,
      experience: character.experience,
      currency: character.currency,
      stats: character.stats,
      specialization: character.specialization,
      currentActivity: {
        ...character.currentActivity,
        startedAt: character.currentActivity.startedAt.toISOString(),
      },
      lastActiveAt: character.lastActiveAt.toISOString(),
      createdAt: character.createdAt.toISOString(),
      updatedAt: character.updatedAt.toISOString(),
    };
  }

  /**
   * Transform DynamoDB item to Guild object
   */
  static dynamoToGuild(dynamoItem: any): Guild {
    return {
      guildId: dynamoItem.guildId,
      name: dynamoItem.name,
      description: dynamoItem.description,
      leaderId: dynamoItem.leaderId,
      members: dynamoItem.members.map((member: any) => ({
        ...member,
        joinedAt: new Date(member.joinedAt),
        lastActiveAt: new Date(member.lastActiveAt),
      })),
      settings: dynamoItem.settings,
      createdAt: new Date(dynamoItem.createdAt),
      updatedAt: new Date(dynamoItem.updatedAt),
      memberCount: dynamoItem.memberCount,
      level: dynamoItem.level,
      experience: dynamoItem.experience,
    };
  }

  /**
   * Transform Guild object to DynamoDB item
   */
  static guildToDynamo(guild: Guild): any {
    return {
      guildId: guild.guildId,
      name: guild.name,
      description: guild.description,
      leaderId: guild.leaderId,
      members: guild.members.map(member => ({
        ...member,
        joinedAt: member.joinedAt.toISOString(),
        lastActiveAt: member.lastActiveAt.toISOString(),
      })),
      settings: guild.settings,
      createdAt: guild.createdAt.toISOString(),
      updatedAt: guild.updatedAt.toISOString(),
      memberCount: guild.memberCount,
      level: guild.level,
      experience: guild.experience,
    };
  }

  /**
   * Transform DynamoDB item to Item object
   */
  static dynamoToItem(dynamoItem: any): Item {
    return {
      itemId: dynamoItem.itemId,
      name: dynamoItem.name,
      description: dynamoItem.description,
      type: dynamoItem.type,
      rarity: dynamoItem.rarity,
      slot: dynamoItem.slot,
      stats: dynamoItem.stats,
      value: dynamoItem.value,
      stackable: dynamoItem.stackable,
      maxStack: dynamoItem.maxStack,
      craftingRequirements: dynamoItem.craftingRequirements,
      steampunkTheme: dynamoItem.steampunkTheme,
      createdAt: new Date(dynamoItem.createdAt),
      updatedAt: new Date(dynamoItem.updatedAt),
    };
  }

  /**
   * Transform Item object to DynamoDB item
   */
  static itemToDynamo(item: Item): any {
    return {
      itemId: item.itemId,
      name: item.name,
      description: item.description,
      type: item.type,
      rarity: item.rarity,
      slot: item.slot,
      stats: item.stats,
      value: item.value,
      stackable: item.stackable,
      maxStack: item.maxStack,
      craftingRequirements: item.craftingRequirements,
      steampunkTheme: item.steampunkTheme,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  /**
   * Transform DynamoDB item to AuctionListing object
   */
  static dynamoToAuctionListing(dynamoItem: any): AuctionListing {
    return {
      listingId: dynamoItem.listingId,
      sellerId: dynamoItem.sellerId,
      sellerName: dynamoItem.sellerName,
      itemId: dynamoItem.itemId,
      itemName: dynamoItem.itemName,
      itemRarity: dynamoItem.itemRarity,
      quantity: dynamoItem.quantity,
      startingPrice: dynamoItem.startingPrice,
      buyoutPrice: dynamoItem.buyoutPrice,
      currentBid: dynamoItem.currentBid,
      currentBidderId: dynamoItem.currentBidderId,
      currentBidderName: dynamoItem.currentBidderName,
      bidHistory: dynamoItem.bidHistory?.map((bid: any) => ({
        ...bid,
        timestamp: new Date(bid.timestamp),
      })) || [],
      auctionType: dynamoItem.auctionType,
      status: dynamoItem.status,
      createdAt: new Date(dynamoItem.createdAt),
      expiresAt: new Date(dynamoItem.expiresAt),
      completedAt: dynamoItem.completedAt ? new Date(dynamoItem.completedAt) : undefined,
      fees: dynamoItem.fees,
    };
  }

  /**
   * Transform AuctionListing object to DynamoDB item
   */
  static auctionListingToDynamo(listing: AuctionListing): any {
    return {
      listingId: listing.listingId,
      sellerId: listing.sellerId,
      sellerName: listing.sellerName,
      itemId: listing.itemId,
      itemName: listing.itemName,
      itemRarity: listing.itemRarity,
      quantity: listing.quantity,
      startingPrice: listing.startingPrice,
      buyoutPrice: listing.buyoutPrice,
      currentBid: listing.currentBid,
      currentBidderId: listing.currentBidderId,
      currentBidderName: listing.currentBidderName,
      bidHistory: listing.bidHistory.map(bid => ({
        ...bid,
        timestamp: bid.timestamp.toISOString(),
      })),
      auctionType: listing.auctionType,
      status: listing.status,
      createdAt: listing.createdAt.toISOString(),
      expiresAt: listing.expiresAt.toISOString(),
      completedAt: listing.completedAt?.toISOString(),
      fees: listing.fees,
      // Add TTL for automatic cleanup
      ttl: Math.floor(listing.expiresAt.getTime() / 1000) + (7 * 24 * 60 * 60), // 7 days after expiration
    };
  }

  /**
   * Transform DynamoDB item to ChatMessage object
   */
  static dynamoToChatMessage(dynamoItem: any): ChatMessage {
    return {
      messageId: dynamoItem.messageId,
      channelId: dynamoItem.channelId,
      senderId: dynamoItem.senderId,
      senderName: dynamoItem.senderName,
      content: dynamoItem.content,
      type: dynamoItem.type,
      timestamp: new Date(dynamoItem.timestamp),
      recipientId: dynamoItem.recipientId,
      isRead: dynamoItem.isRead || false,
    };
  }

  /**
   * Transform ChatMessage object to DynamoDB item
   */
  static chatMessageToDynamo(message: ChatMessage): any {
    return {
      messageId: message.messageId,
      channelId: message.channelId,
      senderId: message.senderId,
      senderName: message.senderName,
      content: message.content,
      type: message.type,
      timestamp: message.timestamp.toISOString(),
      recipientId: message.recipientId,
      isRead: message.isRead,
      // Add TTL for message retention (30 days)
      ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
    };
  }

  /**
   * Sanitize user input to prevent XSS and other attacks
   */
  static sanitizeString(input: string): string {
    return input
      .replace(/<[^>]*>/g, '') // Remove HTML tags completely
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Format currency for display
   */
  static formatCurrency(amount: number): string {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }
    return amount.toString();
  }

  /**
   * Calculate experience needed for next level
   */
  static experienceForLevel(level: number): number {
    return Math.floor(100 * Math.pow(1.1, level - 1));
  }

  /**
   * Calculate level from total experience
   */
  static levelFromExperience(experience: number): number {
    let level = 1;
    let totalExpNeeded = 0;
    
    while (totalExpNeeded <= experience) {
      const expForNextLevel = this.experienceForLevel(level);
      if (totalExpNeeded + expForNextLevel <= experience) {
        totalExpNeeded += expForNextLevel;
        level++;
      } else {
        break;
      }
    }
    
    return level;
  }

  /**
   * Calculate specialization progress based on character stats and activities
   */
  static calculateSpecializationProgress(character: Character): {
    tankProgress: number;
    healerProgress: number;
    dpsProgress: number;
  } {
    const { stats } = character;
    
    // Tank specialization based on vitality and strength
    const tankProgress = Math.min(100, 
      (stats.vitality * 0.6 + stats.strength * 0.4) / character.level * 10
    );
    
    // Healer specialization based on intelligence and vitality
    const healerProgress = Math.min(100,
      (stats.intelligence * 0.6 + stats.vitality * 0.4) / character.level * 10
    );
    
    // DPS specialization based on strength and dexterity
    const dpsProgress = Math.min(100,
      (stats.strength * 0.5 + stats.dexterity * 0.5) / character.level * 10
    );
    
    return { tankProgress, healerProgress, dpsProgress };
  }

  /**
   * Generate item rarity color for UI display
   */
  static getRarityColor(rarity: string): string {
    const colors = {
      common: '#9d9d9d',
      uncommon: '#1eff00',
      rare: '#0070dd',
      epic: '#a335ee',
      legendary: '#ff8000',
    };
    return colors[rarity as keyof typeof colors] || colors.common;
  }

  /**
   * Format time duration for display
   */
  static formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }
}