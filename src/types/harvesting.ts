/**
 * Harvesting System Types
 * Defines steampunk-themed resource gathering activities
 */

export interface HarvestingActivity {
  id: string;
  name: string;
  description: string;
  category: HarvestingCategory;
  icon: string;
  baseTime: number; // seconds
  energyCost: number;
  requiredLevel: number;
  requiredStats?: {
    intelligence?: number;
    dexterity?: number;
    strength?: number;
    perception?: number;
  };
  statBonuses: {
    intelligence?: number;
    dexterity?: number;
    strength?: number;
    perception?: number;
    experience?: number;
  };
  dropTable: DropTable;
  unlockConditions?: UnlockCondition[];
}

export interface DropTable {
  guaranteed: ResourceDrop[];
  common: ResourceDrop[];
  uncommon: ResourceDrop[];
  rare: ResourceDrop[];
  legendary: ResourceDrop[];
}

export interface ResourceDrop {
  itemId: string;
  minQuantity: number;
  maxQuantity: number;
  dropRate: number; // 0-1 probability
}

export interface UnlockCondition {
  type: 'level' | 'stat' | 'item' | 'activity';
  requirement: string | number;
  value?: any;
}

export enum HarvestingCategory {
  LITERARY = 'literary',
  MECHANICAL = 'mechanical',
  ALCHEMICAL = 'alchemical',
  ARCHAEOLOGICAL = 'archaeological',
  BOTANICAL = 'botanical',
  METALLURGICAL = 'metallurgical',
  ELECTRICAL = 'electrical',
  AERONAUTICAL = 'aeronautical'
}

export interface HarvestingResource {
  id: string;
  name: string;
  description: string;
  category: ResourceCategory;
  rarity: ResourceRarity;
  icon: string;
  value: number;
  stackable: boolean;
  maxStack?: number;
  craftingMaterial: boolean;
  sellable: boolean;
}

export enum ResourceCategory {
  LITERARY_MATERIALS = 'literary_materials',
  MECHANICAL_PARTS = 'mechanical_parts',
  ALCHEMICAL_REAGENTS = 'alchemical_reagents',
  ARCHAEOLOGICAL_ARTIFACTS = 'archaeological_artifacts',
  BOTANICAL_SPECIMENS = 'botanical_specimens',
  METAL_INGOTS = 'metal_ingots',
  ELECTRICAL_COMPONENTS = 'electrical_components',
  AERONAUTICAL_PARTS = 'aeronautical_parts',
  RARE_TREASURES = 'rare_treasures'
}

export enum ResourceRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  LEGENDARY = 'legendary'
}

export interface HarvestingSession {
  activityId: string;
  startTime: number;
  duration: number;
  playerId: string;
  completed: boolean;
  rewards?: HarvestingReward[];
}

export interface HarvestingReward {
  itemId: string;
  quantity: number;
  rarity: ResourceRarity;
  isRare: boolean;
}

export interface EnhancedHarvestingReward {
  primaryMaterial: {
    itemId: string;
    quantity: number;
  };
  exoticItem?: {
    itemId: string;
    quantity: number;
    rarity: 'rare' | 'epic' | 'legendary';
  };
  skillGained: number;
}

export interface ExoticItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'rare' | 'epic' | 'legendary';
  category: HarvestingCategory;
  baseDropRate: number; // Very low, < 0.01
  value: number;
}

export interface HarvestingSkillData {
  categoryLevels: Record<HarvestingCategory, number>;
  categoryExperience: Record<HarvestingCategory, number>;
  totalHarvests: number;
  exoticItemsFound: number;
}

export interface PlayerHarvestingStats {
  playerId: string;
  totalHarvests: number;
  totalTimeSpent: number;
  activitiesUnlocked: string[];
  categoryLevels: Record<HarvestingCategory, number>;
  categoryExperience: Record<HarvestingCategory, number>;
  rareFindCount: number;
  legendaryFindCount: number;
  favoriteActivity?: string;
}