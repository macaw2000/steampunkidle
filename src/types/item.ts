/**
 * Item-related type definitions for the Steampunk Idle Game
 */

import { CraftingRecipe } from './crafting';

export type ItemType = 'weapon' | 'armor' | 'trinket' | 'material' | 'consumable' | 'tool';
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type ItemSlot = 'mainhand' | 'offhand' | 'head' | 'chest' | 'legs' | 'feet' | 'hands' | 'neck' | 'ring' | 'trinket';

export interface ItemStats {
  strength?: number;
  dexterity?: number;
  intelligence?: number;
  vitality?: number;
  craftingBonus?: number;
  harvestingBonus?: number;
  combatBonus?: number;
  durability?: number;
  maxDurability?: number;
}

export interface CraftingRequirement {
  itemId: string;
  quantity: number;
}

// CraftingRecipe is now defined in crafting.ts to avoid duplication

export interface ThemeData {
  visualStyle: 'brass' | 'copper' | 'steel' | 'crystal' | 'steam';
  description: string;
  flavorText: string;
  iconUrl?: string;
  modelUrl?: string;
}

export interface Item {
  itemId: string;
  name: string;
  description: string;
  type: ItemType;
  rarity: ItemRarity;
  slot?: ItemSlot;
  stats: ItemStats;
  value: number; // base currency value
  stackable: boolean;
  maxStack?: number;
  craftingRequirements?: CraftingRecipe;
  steampunkTheme: ThemeData;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryItem {
  userId: string;
  itemId: string;
  quantity: number;
  acquiredAt: Date;
  condition?: number; // for durability tracking
  enchantments?: ItemEnchantment[];
}

export interface ItemEnchantment {
  enchantmentId: string;
  name: string;
  description: string;
  statModifiers: Partial<ItemStats>;
  appliedAt: Date;
}

export interface CreateItemRequest {
  name: string;
  description: string;
  type: ItemType;
  rarity: ItemRarity;
  slot?: ItemSlot;
  stats: ItemStats;
  value: number;
  stackable: boolean;
  maxStack?: number;
  steampunkTheme: ThemeData;
}

export interface UpdateInventoryRequest {
  userId: string;
  itemId: string;
  quantity: number;
  operation: 'add' | 'remove' | 'set';
}