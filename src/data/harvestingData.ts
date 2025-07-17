/**
 * Steampunk-themed harvesting data
 */

import { HarvestingNode, HarvestingArea } from '../types/harvesting';

export const HARVESTING_NODES: HarvestingNode[] = [
  // Mining Nodes
  {
    nodeId: 'copper-vein-basic',
    name: 'Copper Ore Vein',
    description: 'A rich vein of copper ore, essential for steam-powered machinery',
    type: 'ore_vein',
    requiredSkill: 'mining',
    requiredLevel: 1,
    harvestTime: 45,
    resources: [
      { resourceId: 'copper-ore', name: 'Copper Ore', quantity: 3, rarity: 'common', dropChance: 1.0 },
      { resourceId: 'coal-chunk', name: 'Coal Chunk', quantity: 1, rarity: 'common', dropChance: 0.3 },
    ],
    respawnTime: 300,
    maxYield: 5,
    steampunkTheme: {
      flavorText: 'The lifeblood of the industrial revolution lies within these copper-rich veins.',
      visualDescription: 'Gleaming copper streaks run through dark stone, with steam vents nearby.'
    }
  },
  {
    nodeId: 'iron-deposit',
    name: 'Iron Ore Deposit',
    description: 'A substantial iron deposit perfect for crafting sturdy components',
    type: 'ore_vein',
    requiredSkill: 'mining',
    requiredLevel: 5,
    harvestTime: 60,
    resources: [
      { resourceId: 'iron-ore', name: 'Iron Ore', quantity: 2, rarity: 'common', dropChance: 1.0 },
      { resourceId: 'coal-chunk', name: 'Coal Chunk', quantity: 2, rarity: 'common', dropChance: 0.5 },
      { resourceId: 'rare-minerals', name: 'Rare Minerals', quantity: 1, rarity: 'uncommon', dropChance: 0.1 },
    ],
    respawnTime: 450,
    maxYield: 4,
    steampunkTheme: {
      flavorText: 'Strong iron for the backbone of steam-powered civilization.',
      visualDescription: 'Dark iron ore embedded in rocky outcroppings, with pickaxe marks from previous miners.'
    }
  },

  // Foraging Nodes
  {
    nodeId: 'steam-herbs',
    name: 'Steam-Infused Herbs',
    description: 'Medicinal herbs that have absorbed steam energy from nearby vents',
    type: 'herb_patch',
    requiredSkill: 'foraging',
    requiredLevel: 2,
    harvestTime: 30,
    resources: [
      { resourceId: 'medicinal-herbs', name: 'Medicinal Herbs', quantity: 4, rarity: 'common', dropChance: 1.0 },
      { resourceId: 'steam-essence', name: 'Steam Essence', quantity: 1, rarity: 'uncommon', dropChance: 0.2 },
      { resourceId: 'rare-spores', name: 'Rare Spores', quantity: 1, rarity: 'rare', dropChance: 0.05 },
    ],
    respawnTime: 240,
    maxYield: 6,
    steampunkTheme: {
      flavorText: 'Nature adapts to the age of steam, creating herbs with unique properties.',
      visualDescription: 'Vibrant green herbs growing near steam vents, with a faint luminescent glow.'
    }
  },

  // Salvaging Nodes
  {
    nodeId: 'abandoned-workshop',
    name: 'Abandoned Workshop',
    description: 'The remains of a clockmaker\'s workshop, full of salvageable parts',
    type: 'scrap_pile',
    requiredSkill: 'salvaging',
    requiredLevel: 3,
    harvestTime: 90,
    resources: [
      { resourceId: 'scrap-metal', name: 'Scrap Metal', quantity: 5, rarity: 'common', dropChance: 1.0 },
      { resourceId: 'broken-gears', name: 'Broken Gears', quantity: 3, rarity: 'common', dropChance: 0.8 },
      { resourceId: 'precision-parts', name: 'Precision Parts', quantity: 1, rarity: 'uncommon', dropChance: 0.3 },
      { resourceId: 'blueprint-fragment', name: 'Blueprint Fragment', quantity: 1, rarity: 'rare', dropChance: 0.1 },
    ],
    respawnTime: 600,
    maxYield: 3,
    steampunkTheme: {
      flavorText: 'One inventor\'s failure becomes another\'s treasure trove.',
      visualDescription: 'Scattered tools and half-finished clockwork devices covered in dust and rust.'
    }
  },

  // Crystal Extraction Nodes
  {
    nodeId: 'steam-crystal-formation',
    name: 'Steam Crystal Formation',
    description: 'Crystallized steam energy formed over decades of exposure',
    type: 'crystal_formation',
    requiredSkill: 'crystal_extraction',
    requiredLevel: 8,
    harvestTime: 120,
    resources: [
      { resourceId: 'steam-crystal-shard', name: 'Steam Crystal Shard', quantity: 2, rarity: 'uncommon', dropChance: 1.0 },
      { resourceId: 'pure-steam-crystal', name: 'Pure Steam Crystal', quantity: 1, rarity: 'rare', dropChance: 0.4 },
      { resourceId: 'legendary-steam-core', name: 'Legendary Steam Core', quantity: 1, rarity: 'legendary', dropChance: 0.02 },
    ],
    respawnTime: 900,
    maxYield: 2,
    steampunkTheme: {
      flavorText: 'The ultimate fusion of nature and steam technology.',
      visualDescription: 'Brilliant crystalline formations that pulse with contained steam energy.'
    }
  },
];

export const HARVESTING_AREAS: HarvestingArea[] = [
  {
    areaId: 'industrial-outskirts',
    name: 'Industrial Outskirts',
    description: 'The abandoned edges of the great steam city, rich with resources',
    requiredLevel: 1,
    nodes: [
      HARVESTING_NODES.find(n => n.nodeId === 'copper-vein-basic')!,
      HARVESTING_NODES.find(n => n.nodeId === 'steam-herbs')!,
    ],
    steampunkTheme: {
      atmosphere: 'Misty air filled with the distant sound of steam engines and industrial machinery',
      dangers: ['Steam vents', 'Unstable ground', 'Toxic fumes']
    }
  },
  {
    areaId: 'forgotten-mines',
    name: 'The Forgotten Mines',
    description: 'Deep underground tunnels where the first steam miners worked',
    requiredLevel: 5,
    nodes: [
      HARVESTING_NODES.find(n => n.nodeId === 'iron-deposit')!,
      HARVESTING_NODES.find(n => n.nodeId === 'abandoned-workshop')!,
    ],
    steampunkTheme: {
      atmosphere: 'Dark tunnels lit by flickering steam-powered lamps, echoing with dripping water',
      dangers: ['Cave-ins', 'Poisonous gases', 'Rogue mining automatons']
    }
  },
  {
    areaId: 'crystal-caverns',
    name: 'The Crystal Caverns',
    description: 'Deep caverns where steam energy has crystallized over centuries',
    requiredLevel: 8,
    nodes: [
      HARVESTING_NODES.find(n => n.nodeId === 'steam-crystal-formation')!,
    ],
    steampunkTheme: {
      atmosphere: 'Ethereal caverns filled with glowing crystals and swirling steam',
      dangers: ['Energy discharges', 'Crystal guardians', 'Temporal anomalies']
    }
  },
];

// Resource definitions for reference
export const HARVESTING_RESOURCES = {
  // Basic Mining Resources
  'copper-ore': { name: 'Copper Ore', type: 'ore', description: 'Raw copper ore for smelting into ingots' },
  'iron-ore': { name: 'Iron Ore', type: 'ore', description: 'Iron ore for creating strong metal components' },
  'coal-chunk': { name: 'Coal Chunk', type: 'fuel', description: 'Fuel for steam engines and forges' },
  'rare-minerals': { name: 'Rare Minerals', type: 'ore', description: 'Uncommon minerals with special properties' },

  // Foraging Resources
  'medicinal-herbs': { name: 'Medicinal Herbs', type: 'herb', description: 'Natural healing ingredients' },
  'steam-essence': { name: 'Steam Essence', type: 'essence', description: 'Concentrated steam energy in liquid form' },
  'rare-spores': { name: 'Rare Spores', type: 'herb', description: 'Exotic fungal spores with alchemical properties' },

  // Salvaging Resources
  'scrap-metal': { name: 'Scrap Metal', type: 'material', description: 'Recycled metal for basic crafting' },
  'broken-gears': { name: 'Broken Gears', type: 'component', description: 'Damaged gears that can be repaired' },
  'precision-parts': { name: 'Precision Parts', type: 'component', description: 'High-quality mechanical components' },
  'blueprint-fragment': { name: 'Blueprint Fragment', type: 'knowledge', description: 'Pieces of lost engineering knowledge' },

  // Crystal Extraction Resources
  'steam-crystal-shard': { name: 'Steam Crystal Shard', type: 'crystal', description: 'Fragments of crystallized steam energy' },
  'pure-steam-crystal': { name: 'Pure Steam Crystal', type: 'crystal', description: 'Highly concentrated steam energy crystal' },
  'legendary-steam-core': { name: 'Legendary Steam Core', type: 'crystal', description: 'The ultimate source of steam power' },
};