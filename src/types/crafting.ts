/**
 * Crafting-related type definitions for the Steampunk Idle Game
 */

export type CraftingSkillType = 'clockmaking' | 'engineering' | 'alchemy' | 'steamcraft';

export interface CraftingRecipe {
  recipeId: string;
  name: string;
  description: string;
  category: 'weapons' | 'armor' | 'trinkets' | 'consumables' | 'materials';
  requiredSkill: CraftingSkillType;
  requiredLevel: number;
  craftingTime: number; // in seconds
  materials: CraftingMaterial[];
  outputs: CraftingOutput[];
  experienceGain: number;
  steampunkTheme: {
    flavorText: string;
    visualDescription: string;
  };
}

export interface CraftingMaterial {
  materialId: string;
  name: string;
  quantity: number;
  type: 'basic' | 'refined' | 'rare' | 'legendary';
}

export interface CraftingOutput {
  itemId: string;
  name: string;
  quantity: number;
  baseStats?: ItemCraftingStats;
  qualityModifier: number; // 0.8 to 1.2 based on skill level
}

export interface ItemCraftingStats {
  attack?: number;
  defense?: number;
  intelligence?: number;
  dexterity?: number;
  strength?: number;
  vitality?: number;
  durability: number;
}

export interface CraftingSession {
  sessionId: string;
  userId: string;
  recipeId: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'in_progress' | 'completed' | 'cancelled';
  qualityBonus: number;
  experienceEarned: number;
}

export interface CraftingQueue {
  userId: string;
  queue: CraftingQueueItem[];
  maxSlots: number;
}

export interface CraftingQueueItem {
  queueId: string;
  recipeId: string;
  quantity: number;
  startedAt?: Date;
  estimatedCompletion?: Date;
  status: 'queued' | 'crafting' | 'completed';
}

export interface CraftingSkillTree {
  skillType: CraftingSkillType;
  level: number;
  experience: number;
  unlockedRecipes: string[];
  specializations: CraftingSpecialization[];
}

export interface CraftingSpecialization {
  specializationId: string;
  name: string;
  description: string;
  requiredLevel: number;
  bonuses: CraftingBonus[];
  isUnlocked: boolean;
}

export interface CraftingBonus {
  type: 'speed' | 'quality' | 'material_efficiency' | 'experience';
  value: number; // percentage bonus
  description: string;
}

export interface CraftingWorkstation {
  workstationId: string;
  name: string;
  type: 'basic' | 'advanced' | 'master';
  requiredSkills: { skill: CraftingSkillType; level: number }[];
  bonuses: CraftingBonus[];
  unlockCost: number;
  maintenanceCost: number;
  steampunkDescription: string;
}

// Request/Response types for API
export interface StartCraftingRequest {
  userId: string;
  recipeId: string;
  quantity?: number;
  workstationId?: string;
}

export interface StartCraftingResponse {
  session: CraftingSession;
  estimatedCompletion: Date;
  materialsCost: CraftingMaterial[];
}

export interface CompleteCraftingRequest {
  userId: string;
  sessionId: string;
}

export interface CompleteCraftingResponse {
  session: CraftingSession;
  itemsCreated: CraftingOutput[];
  experienceGained: number;
  skillLevelUp?: {
    skill: CraftingSkillType;
    newLevel: number;
    unlockedRecipes: string[];
  };
}

export interface GetCraftingDataRequest {
  userId: string;
}

export interface GetCraftingDataResponse {
  skillTrees: CraftingSkillTree[];
  availableRecipes: CraftingRecipe[];
  queue: CraftingQueue;
  workstations: CraftingWorkstation[];
  materials: { [materialId: string]: number };
}