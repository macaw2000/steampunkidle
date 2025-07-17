/**
 * Character-related type definitions for the Steampunk Idle Game
 */

export type ActivityType = 'crafting' | 'harvesting' | 'combat';
export type SpecializationRole = 'tank' | 'healer' | 'dps';

export interface CraftingSkillSet {
  clockmaking: number;
  engineering: number;
  alchemy: number;
  steamcraft: number;
  level: number;
  experience: number;
}

export interface HarvestingSkillSet {
  mining: number;
  foraging: number;
  salvaging: number;
  crystal_extraction: number;
  level: number;
  experience: number;
}

export interface CombatSkillSet {
  melee: number;
  ranged: number;
  defense: number;
  tactics: number;
  level: number;
  experience: number;
}

export interface CharacterStats {
  strength: number;
  dexterity: number;
  intelligence: number;
  vitality: number;
  craftingSkills: CraftingSkillSet;
  harvestingSkills: HarvestingSkillSet;
  combatSkills: CombatSkillSet;
}

export interface Specialization {
  tankProgress: number;
  healerProgress: number;
  dpsProgress: number;
  primaryRole: SpecializationRole | null;
  secondaryRole: SpecializationRole | null;
  bonuses: SpecializationBonus[];
}

export interface SpecializationBonus {
  type: 'stat' | 'skill' | 'ability';
  name: string;
  value: number;
  description: string;
}

export interface Activity {
  type: ActivityType;
  startedAt: Date;
  progress: number;
  rewards: ActivityReward[];
}

export interface ActivityReward {
  type: 'experience' | 'currency' | 'item' | 'resource';
  amount: number;
  itemId?: string;
  description?: string;
}

export interface Character {
  userId: string;
  characterId: string;
  name: string;
  level: number;
  experience: number;
  currency: number;
  stats: CharacterStats;
  specialization: Specialization;
  currentActivity: Activity;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCharacterRequest {
  userId: string;
  name: string;
}

export interface UpdateCharacterRequest {
  characterId: string;
  stats?: Partial<CharacterStats>;
  specialization?: Partial<Specialization>;
  currentActivity?: Activity;
  experience?: number;
  level?: number;
  currency?: number;
  lastActiveAt?: Date;
}