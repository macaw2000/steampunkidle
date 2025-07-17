/**
 * Combat-related type definitions for the Steampunk Idle Game
 */

export type CombatSkillType = 'melee' | 'ranged' | 'defense' | 'tactics';

export interface Enemy {
  enemyId: string;
  name: string;
  description: string;
  type: 'automaton' | 'construct' | 'rogue_machine' | 'steam_beast';
  level: number;
  stats: EnemyStats;
  lootTable: CombatLoot[];
  experienceReward: number;
  steampunkTheme: {
    appearance: string;
    backstory: string;
    combatStyle: string;
  };
}

export interface EnemyStats {
  health: number;
  attack: number;
  defense: number;
  speed: number;
  resistances: { [damageType: string]: number };
  abilities: EnemyAbility[];
}

export interface EnemyAbility {
  abilityId: string;
  name: string;
  description: string;
  damage: number;
  cooldown: number;
  effects: StatusEffect[];
}

export interface StatusEffect {
  effectId: string;
  name: string;
  type: 'damage' | 'heal' | 'buff' | 'debuff';
  value: number;
  duration: number;
}

export interface CombatLoot {
  itemId: string;
  name: string;
  quantity: number;
  dropChance: number; // 0-1 probability
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
}

export interface CombatSession {
  sessionId: string;
  userId: string;
  enemyId: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'in_progress' | 'victory' | 'defeat' | 'fled';
  playerHealth: number;
  enemyHealth: number;
  combatLog: CombatAction[];
  lootGained: CombatLoot[];
  experienceEarned: number;
}

export interface CombatAction {
  actionId: string;
  timestamp: Date;
  actor: 'player' | 'enemy';
  action: 'attack' | 'defend' | 'ability' | 'item';
  target: 'player' | 'enemy';
  damage?: number;
  healing?: number;
  effects?: StatusEffect[];
  description: string;
}

export interface CombatZone {
  zoneId: string;
  name: string;
  description: string;
  requiredLevel: number;
  enemies: Enemy[];
  steampunkTheme: {
    environment: string;
    atmosphere: string;
    hazards: string[];
  };
}

// Request/Response types
export interface StartCombatRequest {
  userId: string;
  enemyId: string;
}

export interface StartCombatResponse {
  session: CombatSession;
  enemy: Enemy;
  playerStats: PlayerCombatStats;
}

export interface PlayerCombatStats {
  health: number;
  maxHealth: number;
  attack: number;
  defense: number;
  speed: number;
  abilities: PlayerAbility[];
}

export interface PlayerAbility {
  abilityId: string;
  name: string;
  description: string;
  damage: number;
  cooldown: number;
  manaCost: number;
  unlockLevel: number;
}

export interface CompleteCombatRequest {
  userId: string;
  sessionId: string;
}

export interface CompleteCombatResponse {
  session: CombatSession;
  result: 'victory' | 'defeat';
  lootGained: CombatLoot[];
  experienceGained: number;
  skillLevelUp?: {
    skill: CombatSkillType;
    newLevel: number;
  };
}