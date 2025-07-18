/**
 * Exotic Items Database
 * Rare treasures that can be discovered during harvesting with very low probability
 */

import { ExoticItem, HarvestingCategory } from '../types/harvesting';

export const EXOTIC_ITEMS: ExoticItem[] = [
  // LITERARY CATEGORY EXOTICS
  {
    id: 'legendary_tome',
    name: 'Legendary Tome of Forbidden Knowledge',
    description: 'An ancient book containing secrets that were meant to be forgotten. Its pages whisper with otherworldly wisdom.',
    icon: '📜',
    rarity: 'legendary',
    category: HarvestingCategory.LITERARY,
    baseDropRate: 0.003, // 0.3%
    value: 2500
  },
  {
    id: 'ancient_scroll',
    name: 'Ancient Scroll of Power',
    description: 'A mystical scroll inscribed with runes that glow faintly in moonlight.',
    icon: '🗞️',
    rarity: 'epic',
    category: HarvestingCategory.LITERARY,
    baseDropRate: 0.005, // 0.5%
    value: 1200
  },
  {
    id: 'forbidden_knowledge',
    name: 'Fragment of Forbidden Knowledge',
    description: 'A piece of knowledge so dangerous it was hidden away from the world.',
    icon: '🧠',
    rarity: 'rare',
    category: HarvestingCategory.LITERARY,
    baseDropRate: 0.008, // 0.8%
    value: 600
  },

  // MECHANICAL CATEGORY EXOTICS
  {
    id: 'perpetual_motion_device',
    name: 'Perpetual Motion Device',
    description: 'A miraculous machine that defies the laws of physics, running forever without fuel.',
    icon: '⚙️',
    rarity: 'legendary',
    category: HarvestingCategory.MECHANICAL,
    baseDropRate: 0.002, // 0.2%
    value: 3000
  },
  {
    id: 'master_clockwork',
    name: 'Master Clockwork Heart',
    description: 'The beating heart of a legendary automaton, still pulsing with mechanical life.',
    icon: '💓',
    rarity: 'epic',
    category: HarvestingCategory.MECHANICAL,
    baseDropRate: 0.004, // 0.4%
    value: 1500
  },
  {
    id: 'steam_core',
    name: 'Eternal Steam Core',
    description: 'A core that generates infinite steam pressure, the dream of every engineer.',
    icon: '🔥',
    rarity: 'rare',
    category: HarvestingCategory.MECHANICAL,
    baseDropRate: 0.007, // 0.7%
    value: 800
  },

  // ALCHEMICAL CATEGORY EXOTICS
  {
    id: 'philosophers_stone_fragment',
    name: "Philosopher's Stone Fragment",
    description: 'A small piece of the legendary stone that can transmute base metals into gold.',
    icon: '💎',
    rarity: 'legendary',
    category: HarvestingCategory.ALCHEMICAL,
    baseDropRate: 0.0025, // 0.25%
    value: 3500
  },
  {
    id: 'transmutation_catalyst',
    name: 'Transmutation Catalyst',
    description: 'A rare substance that accelerates alchemical transformations beyond normal limits.',
    icon: '⚗️',
    rarity: 'epic',
    category: HarvestingCategory.ALCHEMICAL,
    baseDropRate: 0.0045, // 0.45%
    value: 1400
  },
  {
    id: 'elixir_base',
    name: 'Primordial Elixir Base',
    description: 'The foundation ingredient for creating the most powerful potions.',
    icon: '🧪',
    rarity: 'rare',
    category: HarvestingCategory.ALCHEMICAL,
    baseDropRate: 0.006, // 0.6%
    value: 700
  },

  // ARCHAEOLOGICAL CATEGORY EXOTICS
  {
    id: 'lost_civilization_artifact',
    name: 'Lost Civilization Artifact',
    description: 'A mysterious device from a civilization that vanished without a trace.',
    icon: '🗿',
    rarity: 'legendary',
    category: HarvestingCategory.ARCHAEOLOGICAL,
    baseDropRate: 0.003, // 0.3%
    value: 2800
  },
  {
    id: 'ancient_power_source',
    name: 'Ancient Power Source',
    description: 'A crystalline device that still hums with energy after millennia.',
    icon: '🔋',
    rarity: 'epic',
    category: HarvestingCategory.ARCHAEOLOGICAL,
    baseDropRate: 0.005, // 0.5%
    value: 1300
  },
  {
    id: 'mystical_relic',
    name: 'Mystical Relic',
    description: 'An artifact imbued with ancient magic, its purpose lost to time.',
    icon: '🔮',
    rarity: 'rare',
    category: HarvestingCategory.ARCHAEOLOGICAL,
    baseDropRate: 0.007, // 0.7%
    value: 650
  },

  // BOTANICAL CATEGORY EXOTICS
  {
    id: 'mythical_seed',
    name: 'Mythical World Tree Seed',
    description: 'A seed from the legendary World Tree, said to grow into a tree that touches the heavens.',
    icon: '🌰',
    rarity: 'legendary',
    category: HarvestingCategory.BOTANICAL,
    baseDropRate: 0.0035, // 0.35%
    value: 2200
  },
  {
    id: 'evolutionary_specimen',
    name: 'Evolutionary Specimen',
    description: 'A plant that seems to be evolving in real-time, adapting to its environment.',
    icon: '🌱',
    rarity: 'epic',
    category: HarvestingCategory.BOTANICAL,
    baseDropRate: 0.006, // 0.6%
    value: 1100
  },
  {
    id: 'symbiotic_organism',
    name: 'Symbiotic Organism',
    description: 'A unique organism that forms beneficial partnerships with other life forms.',
    icon: '🍄',
    rarity: 'rare',
    category: HarvestingCategory.BOTANICAL,
    baseDropRate: 0.008, // 0.8%
    value: 550
  },

  // METALLURGICAL CATEGORY EXOTICS
  {
    id: 'meteoric_metal',
    name: 'Meteoric Metal',
    description: 'Metal from beyond the stars, harder than any earthly material.',
    icon: '☄️',
    rarity: 'legendary',
    category: HarvestingCategory.METALLURGICAL,
    baseDropRate: 0.0025, // 0.25%
    value: 3200
  },
  {
    id: 'crystalline_alloy',
    name: 'Crystalline Alloy',
    description: 'A metal that has somehow crystallized while maintaining its metallic properties.',
    icon: '💠',
    rarity: 'epic',
    category: HarvestingCategory.METALLURGICAL,
    baseDropRate: 0.004, // 0.4%
    value: 1600
  },
  {
    id: 'living_metal',
    name: 'Living Metal',
    description: 'A metal that seems to pulse with life, reshaping itself when needed.',
    icon: '🤖',
    rarity: 'rare',
    category: HarvestingCategory.METALLURGICAL,
    baseDropRate: 0.006, // 0.6%
    value: 900
  },

  // ELECTRICAL CATEGORY EXOTICS
  {
    id: 'tesla_coil_core',
    name: 'Tesla Coil Core',
    description: "The original core from Nikola Tesla's most powerful invention.",
    icon: '⚡',
    rarity: 'legendary',
    category: HarvestingCategory.ELECTRICAL,
    baseDropRate: 0.002, // 0.2%
    value: 3800
  },
  {
    id: 'lightning_crystal',
    name: 'Lightning Crystal',
    description: 'A crystal that has captured and crystallized pure lightning energy.',
    icon: '💎',
    rarity: 'epic',
    category: HarvestingCategory.ELECTRICAL,
    baseDropRate: 0.0035, // 0.35%
    value: 1800
  },
  {
    id: 'perpetual_battery',
    name: 'Perpetual Battery',
    description: 'A battery that never runs out of power, defying all known science.',
    icon: '🔋',
    rarity: 'rare',
    category: HarvestingCategory.ELECTRICAL,
    baseDropRate: 0.005, // 0.5%
    value: 1000
  },

  // AERONAUTICAL CATEGORY EXOTICS
  {
    id: 'anti_gravity_crystal',
    name: 'Anti-Gravity Crystal',
    description: 'A crystal that defies gravity, floating perpetually in the air.',
    icon: '🔮',
    rarity: 'legendary',
    category: HarvestingCategory.AERONAUTICAL,
    baseDropRate: 0.003, // 0.3%
    value: 2900
  },
  {
    id: 'weather_control_device',
    name: 'Weather Control Device',
    description: 'An ancient device capable of controlling wind, rain, and storms.',
    icon: '🌪️',
    rarity: 'epic',
    category: HarvestingCategory.AERONAUTICAL,
    baseDropRate: 0.0045, // 0.45%
    value: 1700
  },
  {
    id: 'sky_ship_core',
    name: 'Sky Ship Core',
    description: 'The heart of a legendary flying vessel, still humming with aerial magic.',
    icon: '🚁',
    rarity: 'rare',
    category: HarvestingCategory.AERONAUTICAL,
    baseDropRate: 0.007, // 0.7%
    value: 750
  }
];

// Helper function to get exotic items by category
export function getExoticItemsByCategory(category: HarvestingCategory): ExoticItem[] {
  return EXOTIC_ITEMS.filter(item => item.category === category);
}

// Helper function to get exotic item by ID
export function getExoticItemById(id: string): ExoticItem | undefined {
  return EXOTIC_ITEMS.find(item => item.id === id);
}