/**
 * Steampunk-themed combat data
 */

import { Enemy, CombatZone, PlayerAbility } from '../types/combat';

export const ENEMIES: Enemy[] = [
  // Basic Automatons
  {
    enemyId: 'rusty-automaton',
    name: 'Rusty Automaton',
    description: 'A malfunctioning servant automaton, its gears grinding with age',
    type: 'automaton',
    level: 1,
    stats: {
      health: 50,
      attack: 8,
      defense: 3,
      speed: 5,
      resistances: { 'physical': 0.1, 'steam': -0.2 },
      abilities: [
        {
          abilityId: 'rusty-strike',
          name: 'Rusty Strike',
          description: 'A clumsy attack with rusted appendages',
          damage: 12,
          cooldown: 3,
          effects: []
        }
      ]
    },
    lootTable: [
      { itemId: 'scrap-metal', name: 'Scrap Metal', quantity: 2, dropChance: 0.8, rarity: 'common' },
      { itemId: 'broken-gears', name: 'Broken Gears', quantity: 1, dropChance: 0.5, rarity: 'common' },
      { itemId: 'copper-wire', name: 'Copper Wire', quantity: 1, dropChance: 0.3, rarity: 'common' },
    ],
    experienceReward: 25,
    steampunkTheme: {
      appearance: 'A humanoid figure of tarnished brass and iron, with visible rust and steam leaks',
      backstory: 'Once a faithful servant, now driven mad by years of neglect and corrosion',
      combatStyle: 'Slow but persistent, using grinding mechanical attacks'
    }
  },
  {
    enemyId: 'clockwork-spider',
    name: 'Clockwork Spider',
    description: 'A mechanical arachnid with razor-sharp legs and precise movements',
    type: 'construct',
    level: 3,
    stats: {
      health: 35,
      attack: 12,
      defense: 2,
      speed: 12,
      resistances: { 'physical': 0.05, 'precision': 0.2 },
      abilities: [
        {
          abilityId: 'web-trap',
          name: 'Steam Web',
          description: 'Shoots a web of superheated steam',
          damage: 8,
          cooldown: 4,
          effects: [
            { effectId: 'slow', name: 'Slowed', type: 'debuff', value: -3, duration: 2 }
          ]
        },
        {
          abilityId: 'precision-strike',
          name: 'Precision Strike',
          description: 'A calculated attack targeting weak points',
          damage: 18,
          cooldown: 5,
          effects: []
        }
      ]
    },
    lootTable: [
      { itemId: 'precision-parts', name: 'Precision Parts', quantity: 1, dropChance: 0.6, rarity: 'uncommon' },
      { itemId: 'spider-silk-wire', name: 'Spider Silk Wire', quantity: 2, dropChance: 0.4, rarity: 'uncommon' },
      { itemId: 'clockwork-leg', name: 'Clockwork Leg', quantity: 1, dropChance: 0.2, rarity: 'rare' },
    ],
    experienceReward: 45,
    steampunkTheme: {
      appearance: 'Eight articulated brass legs supporting a compact body filled with whirring gears',
      backstory: 'Created as a precision manufacturing tool, repurposed for combat by unknown forces',
      combatStyle: 'Fast and agile, using hit-and-run tactics with web traps'
    }
  },
  {
    enemyId: 'steam-golem',
    name: 'Steam-Powered Golem',
    description: 'A massive construct powered by a roaring steam engine',
    type: 'construct',
    level: 8,
    stats: {
      health: 150,
      attack: 20,
      defense: 8,
      speed: 3,
      resistances: { 'physical': 0.3, 'steam': 0.5, 'fire': 0.4 },
      abilities: [
        {
          abilityId: 'steam-blast',
          name: 'Steam Blast',
          description: 'Releases a powerful burst of superheated steam',
          damage: 25,
          cooldown: 6,
          effects: [
            { effectId: 'burn', name: 'Burned', type: 'damage', value: 5, duration: 3 }
          ]
        },
        {
          abilityId: 'ground-pound',
          name: 'Ground Pound',
          description: 'Slams the ground with massive fists',
          damage: 30,
          cooldown: 8,
          effects: [
            { effectId: 'stun', name: 'Stunned', type: 'debuff', value: 0, duration: 1 }
          ]
        }
      ]
    },
    lootTable: [
      { itemId: 'steam-engine-part', name: 'Steam Engine Part', quantity: 1, dropChance: 0.7, rarity: 'uncommon' },
      { itemId: 'reinforced-plating', name: 'Reinforced Plating', quantity: 2, dropChance: 0.5, rarity: 'uncommon' },
      { itemId: 'steam-core', name: 'Steam Core', quantity: 1, dropChance: 0.1, rarity: 'rare' },
    ],
    experienceReward: 120,
    steampunkTheme: {
      appearance: 'A towering figure of steel and brass with a visible steam engine in its chest',
      backstory: 'Built as a guardian for important facilities, now operating without oversight',
      combatStyle: 'Slow but devastating, using area attacks and steam-based abilities'
    }
  },

  // Rogue Machines
  {
    enemyId: 'malfunctioning-harvester',
    name: 'Malfunctioning Harvester',
    description: 'A mining machine gone rogue, its drill arms spinning wildly',
    type: 'rogue_machine',
    level: 5,
    stats: {
      health: 80,
      attack: 15,
      defense: 6,
      speed: 7,
      resistances: { 'physical': 0.2, 'electrical': -0.3 },
      abilities: [
        {
          abilityId: 'drill-spin',
          name: 'Drill Spin',
          description: 'Spins drill arms in a devastating whirlwind',
          damage: 22,
          cooldown: 5,
          effects: []
        },
        {
          abilityId: 'ore-spray',
          name: 'Ore Spray',
          description: 'Launches chunks of ore as projectiles',
          damage: 10,
          cooldown: 3,
          effects: [
            { effectId: 'bleed', name: 'Bleeding', type: 'damage', value: 3, duration: 3 }
          ]
        }
      ]
    },
    lootTable: [
      { itemId: 'drill-bit', name: 'Drill Bit', quantity: 1, dropChance: 0.6, rarity: 'uncommon' },
      { itemId: 'hydraulic-fluid', name: 'Hydraulic Fluid', quantity: 2, dropChance: 0.4, rarity: 'common' },
      { itemId: 'mining-processor', name: 'Mining Processor', quantity: 1, dropChance: 0.15, rarity: 'rare' },
    ],
    experienceReward: 75,
    steampunkTheme: {
      appearance: 'A bulky machine with multiple spinning drill arms and ore collection bins',
      backstory: 'A mining automaton that lost its programming and now attacks anything that moves',
      combatStyle: 'Aggressive and unpredictable, using industrial tools as weapons'
    }
  },

  // Steam Beasts
  {
    enemyId: 'steam-wolf',
    name: 'Steam Wolf',
    description: 'A mechanical wolf with glowing steam vents along its spine',
    type: 'steam_beast',
    level: 6,
    stats: {
      health: 70,
      attack: 18,
      defense: 4,
      speed: 15,
      resistances: { 'steam': 0.6, 'cold': -0.4 },
      abilities: [
        {
          abilityId: 'steam-howl',
          name: 'Steam Howl',
          description: 'A haunting howl that releases scalding steam',
          damage: 15,
          cooldown: 4,
          effects: [
            { effectId: 'fear', name: 'Frightened', type: 'debuff', value: -2, duration: 2 }
          ]
        },
        {
          abilityId: 'pack-pounce',
          name: 'Pack Pounce',
          description: 'A swift pouncing attack with heated claws',
          damage: 24,
          cooldown: 6,
          effects: []
        }
      ]
    },
    lootTable: [
      { itemId: 'steam-pelt', name: 'Steam Pelt', quantity: 1, dropChance: 0.5, rarity: 'uncommon' },
      { itemId: 'heated-claw', name: 'Heated Claw', quantity: 2, dropChance: 0.3, rarity: 'uncommon' },
      { itemId: 'wolf-steam-core', name: 'Wolf Steam Core', quantity: 1, dropChance: 0.1, rarity: 'rare' },
    ],
    experienceReward: 90,
    steampunkTheme: {
      appearance: 'A sleek mechanical wolf with brass and steel construction, steam rising from its back',
      backstory: 'Created as a companion but evolved beyond its programming into a wild predator',
      combatStyle: 'Fast and pack-oriented, using speed and intimidation'
    }
  },
];

export const COMBAT_ZONES: CombatZone[] = [
  {
    zoneId: 'abandoned-factory',
    name: 'Abandoned Factory District',
    description: 'The ruins of once-great manufacturing facilities',
    requiredLevel: 1,
    enemies: [
      ENEMIES.find(e => e.enemyId === 'rusty-automaton')!,
      ENEMIES.find(e => e.enemyId === 'clockwork-spider')!,
    ],
    steampunkTheme: {
      environment: 'Crumbling brick buildings with broken steam pipes and rusted machinery',
      atmosphere: 'Echoing footsteps and the distant hiss of escaping steam',
      hazards: ['Steam vents', 'Unstable floors', 'Toxic gas leaks']
    }
  },
  {
    zoneId: 'rogue-workshop',
    name: 'The Rogue Workshop',
    description: 'A workshop where experiments went terribly wrong',
    requiredLevel: 5,
    enemies: [
      ENEMIES.find(e => e.enemyId === 'malfunctioning-harvester')!,
      ENEMIES.find(e => e.enemyId === 'steam-wolf')!,
    ],
    steampunkTheme: {
      environment: 'Chaotic laboratory filled with broken experiments and rogue machinery',
      atmosphere: 'Sparking electrical equipment and the growls of mechanical beasts',
      hazards: ['Electrical discharges', 'Chemical spills', 'Rogue experiments']
    }
  },
  {
    zoneId: 'steam-foundry',
    name: 'The Great Steam Foundry',
    description: 'A massive foundry where the largest constructs were built',
    requiredLevel: 8,
    enemies: [
      ENEMIES.find(e => e.enemyId === 'steam-golem')!,
    ],
    steampunkTheme: {
      environment: 'Enormous halls with towering steam engines and molten metal flows',
      atmosphere: 'Deafening industrial noise and waves of intense heat',
      hazards: ['Molten metal', 'Steam explosions', 'Crushing machinery']
    }
  },
];

export const PLAYER_ABILITIES: PlayerAbility[] = [
  // Melee Abilities
  {
    abilityId: 'steam-strike',
    name: 'Steam Strike',
    description: 'A powerful melee attack enhanced with steam pressure',
    damage: 20,
    cooldown: 4,
    manaCost: 10,
    unlockLevel: 3
  },
  {
    abilityId: 'whirlwind-attack',
    name: 'Whirlwind Attack',
    description: 'Spin attack that hits multiple enemies',
    damage: 15,
    cooldown: 6,
    manaCost: 15,
    unlockLevel: 7
  },

  // Ranged Abilities
  {
    abilityId: 'steam-shot',
    name: 'Steam Shot',
    description: 'Fire a concentrated blast of steam energy',
    damage: 18,
    cooldown: 3,
    manaCost: 8,
    unlockLevel: 2
  },
  {
    abilityId: 'precision-shot',
    name: 'Precision Shot',
    description: 'A carefully aimed shot that ignores armor',
    damage: 25,
    cooldown: 8,
    manaCost: 20,
    unlockLevel: 10
  },

  // Defense Abilities
  {
    abilityId: 'steam-shield',
    name: 'Steam Shield',
    description: 'Create a protective barrier of superheated steam',
    damage: 0,
    cooldown: 10,
    manaCost: 12,
    unlockLevel: 4
  },
  {
    abilityId: 'repair-protocol',
    name: 'Repair Protocol',
    description: 'Quickly repair damage using steam-powered nanobots',
    damage: -30, // Negative damage = healing
    cooldown: 15,
    manaCost: 25,
    unlockLevel: 12
  },

  // Tactical Abilities
  {
    abilityId: 'analyze-weakness',
    name: 'Analyze Weakness',
    description: 'Study enemy patterns to increase damage',
    damage: 0,
    cooldown: 12,
    manaCost: 15,
    unlockLevel: 6
  },
  {
    abilityId: 'steam-overcharge',
    name: 'Steam Overcharge',
    description: 'Temporarily boost all abilities with excess steam power',
    damage: 0,
    cooldown: 20,
    manaCost: 30,
    unlockLevel: 15
  },
];