/**
 * Harvesting-related type definitions for the Steampunk Idle Game
 */

export type HarvestingSkillType = 'mining' | 'foraging' | 'salvaging' | 'crystal_extraction';

export interface HarvestingNode {
  nodeId: string;
  name: string;
  description: string;
  type: 'ore_vein' | 'herb_patch' | 'scrap_pile' | 'crystal_formation';
  requiredSkill: HarvestingSkillType;
  requiredLevel: number;
  harvestTime: number; // in seconds
  resources: HarvestingResource[];
  respawnTime: number; // in seconds
  maxYield: number;
  steampunkTheme: {
    flavorText: string;
    visualDescription: string;
  };
}

export interface HarvestingResource {
  resourceId: string;
  name: string;
  quantity: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  dropChance: number; // 0-1 probability
}

export interface HarvestingSession {
  sessionId: string;
  userId: string;
  nodeId: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'in_progress' | 'completed' | 'cancelled';
  resourcesGathered: HarvestingResource[];
  experienceEarned: number;
}

export interface HarvestingArea {
  areaId: string;
  name: string;
  description: string;
  requiredLevel: number;
  nodes: HarvestingNode[];
  steampunkTheme: {
    atmosphere: string;
    dangers: string[];
  };
}

// Request/Response types
export interface StartHarvestingRequest {
  userId: string;
  nodeId: string;
}

export interface StartHarvestingResponse {
  session: HarvestingSession;
  estimatedCompletion: Date;
  potentialResources: HarvestingResource[];
}

export interface CompleteHarvestingRequest {
  userId: string;
  sessionId: string;
}

export interface CompleteHarvestingResponse {
  session: HarvestingSession;
  resourcesGathered: HarvestingResource[];
  experienceGained: number;
  skillLevelUp?: {
    skill: HarvestingSkillType;
    newLevel: number;
  };
}