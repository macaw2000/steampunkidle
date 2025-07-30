"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataTransformers = void 0;
class DataTransformers {
    static dynamoToUser(dynamoItem) {
        return {
            userId: dynamoItem.userId,
            email: dynamoItem.email,
            socialProviders: dynamoItem.socialProviders || [],
            createdAt: new Date(dynamoItem.createdAt),
            lastLogin: new Date(dynamoItem.lastLogin),
        };
    }
    static userToDynamo(user) {
        return {
            userId: user.userId,
            email: user.email,
            socialProviders: user.socialProviders,
            createdAt: user.createdAt.toISOString(),
            lastLogin: user.lastLogin.toISOString(),
        };
    }
    static dynamoToCharacter(dynamoItem) {
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
    static characterToDynamo(character) {
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
    static dynamoToGuild(dynamoItem) {
        return {
            guildId: dynamoItem.guildId,
            name: dynamoItem.name,
            description: dynamoItem.description,
            leaderId: dynamoItem.leaderId,
            members: dynamoItem.members.map((member) => ({
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
    static guildToDynamo(guild) {
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
    static dynamoToItem(dynamoItem) {
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
    static itemToDynamo(item) {
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
    static dynamoToAuctionListing(dynamoItem) {
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
            bidHistory: dynamoItem.bidHistory?.map((bid) => ({
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
    static auctionListingToDynamo(listing) {
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
            ttl: Math.floor(listing.expiresAt.getTime() / 1000) + (7 * 24 * 60 * 60),
        };
    }
    static dynamoToChatMessage(dynamoItem) {
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
    static chatMessageToDynamo(message) {
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
            ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
        };
    }
    static sanitizeString(input) {
        return input
            .replace(/<[^>]*>/g, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+=/gi, '')
            .trim();
    }
    static formatCurrency(amount) {
        if (amount >= 1000000) {
            return `${(amount / 1000000).toFixed(1)}M`;
        }
        else if (amount >= 1000) {
            return `${(amount / 1000).toFixed(1)}K`;
        }
        return amount.toString();
    }
    static experienceForLevel(level) {
        return Math.floor(100 * Math.pow(1.1, level - 1));
    }
    static levelFromExperience(experience) {
        let level = 1;
        let totalExpNeeded = 0;
        while (totalExpNeeded <= experience) {
            const expForNextLevel = this.experienceForLevel(level);
            if (totalExpNeeded + expForNextLevel <= experience) {
                totalExpNeeded += expForNextLevel;
                level++;
            }
            else {
                break;
            }
        }
        return level;
    }
    static calculateSpecializationProgress(character) {
        const { stats } = character;
        const tankProgress = Math.min(100, (stats.vitality * 0.6 + stats.strength * 0.4) / character.level * 10);
        const healerProgress = Math.min(100, (stats.intelligence * 0.6 + stats.vitality * 0.4) / character.level * 10);
        const dpsProgress = Math.min(100, (stats.strength * 0.5 + stats.dexterity * 0.5) / character.level * 10);
        return { tankProgress, healerProgress, dpsProgress };
    }
    static getRarityColor(rarity) {
        const colors = {
            common: '#9d9d9d',
            uncommon: '#1eff00',
            rare: '#0070dd',
            epic: '#a335ee',
            legendary: '#ff8000',
        };
        return colors[rarity] || colors.common;
    }
    static formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        }
        else {
            return `${secs}s`;
        }
    }
}
exports.DataTransformers = DataTransformers;
