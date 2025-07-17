/**
 * Steampunk-themed crafting recipes data
 */

import { CraftingRecipe, CraftingWorkstation } from '../types/crafting';

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  // Clockmaking Recipes
  {
    recipeId: 'clockwork-gear-basic',
    name: 'Basic Clockwork Gear',
    description: 'A simple brass gear used in basic clockwork mechanisms',
    category: 'materials',
    requiredSkill: 'clockmaking',
    requiredLevel: 1,
    craftingTime: 30,
    materials: [
      { materialId: 'brass-ingot', name: 'Brass Ingot', quantity: 2, type: 'basic' },
      { materialId: 'coal', name: 'Coal', quantity: 1, type: 'basic' }
    ],
    outputs: [
      {
        itemId: 'clockwork-gear-basic',
        name: 'Basic Clockwork Gear',
        quantity: 1,
        qualityModifier: 1.0
      }
    ],
    experienceGain: 25,
    steampunkTheme: {
      flavorText: 'The foundation of all clockwork contraptions begins with a perfectly crafted gear.',
      visualDescription: 'A gleaming brass gear with precisely cut teeth, warm to the touch from the forge.'
    }
  },
  {
    recipeId: 'pocket-chronometer',
    name: 'Pocket Chronometer',
    description: 'An elegant timepiece that enhances the wearer\'s precision',
    category: 'trinkets',
    requiredSkill: 'clockmaking',
    requiredLevel: 5,
    craftingTime: 300,
    materials: [
      { materialId: 'clockwork-gear-basic', name: 'Basic Clockwork Gear', quantity: 4, type: 'basic' },
      { materialId: 'silver-ingot', name: 'Silver Ingot', quantity: 1, type: 'refined' },
      { materialId: 'crystal-lens', name: 'Crystal Lens', quantity: 1, type: 'refined' }
    ],
    outputs: [
      {
        itemId: 'pocket-chronometer',
        name: 'Pocket Chronometer',
        quantity: 1,
        baseStats: { dexterity: 5, intelligence: 3, durability: 100 },
        qualityModifier: 1.0
      }
    ],
    experienceGain: 150,
    steampunkTheme: {
      flavorText: 'Time itself bends to the will of the master clockmaker.',
      visualDescription: 'An intricate silver timepiece with exposed gears visible through a crystal face.'
    }
  },
  {
    recipeId: 'clockwork-automaton-heart',
    name: 'Clockwork Automaton Heart',
    description: 'The core mechanism that powers mechanical servants',
    category: 'materials',
    requiredSkill: 'clockmaking',
    requiredLevel: 10,
    craftingTime: 600,
    materials: [
      { materialId: 'clockwork-gear-basic', name: 'Basic Clockwork Gear', quantity: 8, type: 'basic' },
      { materialId: 'precision-spring', name: 'Precision Spring', quantity: 2, type: 'refined' },
      { materialId: 'steam-crystal', name: 'Steam Crystal', quantity: 1, type: 'rare' }
    ],
    outputs: [
      {
        itemId: 'clockwork-automaton-heart',
        name: 'Clockwork Automaton Heart',
        quantity: 1,
        qualityModifier: 1.0
      }
    ],
    experienceGain: 300,
    steampunkTheme: {
      flavorText: 'The beating heart of artificial life, powered by steam and precision.',
      visualDescription: 'A complex mechanism of gears and springs, pulsing with contained steam energy.'
    }
  },

  // Engineering Recipes
  {
    recipeId: 'steam-pressure-valve',
    name: 'Steam Pressure Valve',
    description: 'A safety mechanism for steam-powered devices',
    category: 'materials',
    requiredSkill: 'engineering',
    requiredLevel: 1,
    craftingTime: 45,
    materials: [
      { materialId: 'iron-ingot', name: 'Iron Ingot', quantity: 2, type: 'basic' },
      { materialId: 'rubber-gasket', name: 'Rubber Gasket', quantity: 1, type: 'basic' }
    ],
    outputs: [
      {
        itemId: 'steam-pressure-valve',
        name: 'Steam Pressure Valve',
        quantity: 1,
        qualityModifier: 1.0
      }
    ],
    experienceGain: 30,
    steampunkTheme: {
      flavorText: 'Safety first - even the most ambitious engineer needs proper pressure control.',
      visualDescription: 'A sturdy iron valve with brass fittings, designed to withstand immense pressure.'
    }
  },
  {
    recipeId: 'steam-powered-gauntlets',
    name: 'Steam-Powered Gauntlets',
    description: 'Mechanical gloves that enhance the wearer\'s strength',
    category: 'armor',
    requiredSkill: 'engineering',
    requiredLevel: 7,
    craftingTime: 450,
    materials: [
      { materialId: 'steam-pressure-valve', name: 'Steam Pressure Valve', quantity: 2, type: 'basic' },
      { materialId: 'steel-plate', name: 'Steel Plate', quantity: 3, type: 'refined' },
      { materialId: 'leather-padding', name: 'Leather Padding', quantity: 2, type: 'basic' }
    ],
    outputs: [
      {
        itemId: 'steam-powered-gauntlets',
        name: 'Steam-Powered Gauntlets',
        quantity: 1,
        baseStats: { strength: 8, vitality: 2, durability: 120 },
        qualityModifier: 1.0
      }
    ],
    experienceGain: 200,
    steampunkTheme: {
      flavorText: 'Harness the power of steam to amplify your physical prowess.',
      visualDescription: 'Heavy steel gauntlets with visible steam pipes and pressure gauges.'
    }
  },

  // Alchemy Recipes
  {
    recipeId: 'healing-steam-elixir',
    name: 'Healing Steam Elixir',
    description: 'A restorative potion infused with healing steam',
    category: 'consumables',
    requiredSkill: 'alchemy',
    requiredLevel: 3,
    craftingTime: 120,
    materials: [
      { materialId: 'medicinal-herbs', name: 'Medicinal Herbs', quantity: 3, type: 'basic' },
      { materialId: 'distilled-water', name: 'Distilled Water', quantity: 1, type: 'basic' },
      { materialId: 'steam-essence', name: 'Steam Essence', quantity: 1, type: 'refined' }
    ],
    outputs: [
      {
        itemId: 'healing-steam-elixir',
        name: 'Healing Steam Elixir',
        quantity: 2,
        qualityModifier: 1.0
      }
    ],
    experienceGain: 80,
    steampunkTheme: {
      flavorText: 'The healing properties of nature, enhanced by the power of steam.',
      visualDescription: 'A glowing vial of green liquid with wisps of healing steam rising from the cork.'
    }
  },
  {
    recipeId: 'alchemical-enhancement-serum',
    name: 'Alchemical Enhancement Serum',
    description: 'A powerful elixir that temporarily boosts all abilities',
    category: 'consumables',
    requiredSkill: 'alchemy',
    requiredLevel: 12,
    craftingTime: 900,
    materials: [
      { materialId: 'rare-mushrooms', name: 'Rare Mushrooms', quantity: 2, type: 'rare' },
      { materialId: 'philosopher-salt', name: 'Philosopher\'s Salt', quantity: 1, type: 'rare' },
      { materialId: 'steam-crystal', name: 'Steam Crystal', quantity: 1, type: 'rare' },
      { materialId: 'mercury-drops', name: 'Mercury Drops', quantity: 3, type: 'refined' }
    ],
    outputs: [
      {
        itemId: 'alchemical-enhancement-serum',
        name: 'Alchemical Enhancement Serum',
        quantity: 1,
        qualityModifier: 1.0
      }
    ],
    experienceGain: 400,
    steampunkTheme: {
      flavorText: 'The pinnacle of alchemical achievement - temporary transcendence in liquid form.',
      visualDescription: 'A shimmering golden serum that seems to pulse with inner light and energy.'
    }
  },

  // Steamcraft Recipes
  {
    recipeId: 'steam-engine-core',
    name: 'Steam Engine Core',
    description: 'The heart of any steam-powered machine',
    category: 'materials',
    requiredSkill: 'steamcraft',
    requiredLevel: 6,
    craftingTime: 360,
    materials: [
      { materialId: 'steel-plate', name: 'Steel Plate', quantity: 4, type: 'refined' },
      { materialId: 'steam-pressure-valve', name: 'Steam Pressure Valve', quantity: 2, type: 'basic' },
      { materialId: 'copper-tubing', name: 'Copper Tubing', quantity: 6, type: 'basic' }
    ],
    outputs: [
      {
        itemId: 'steam-engine-core',
        name: 'Steam Engine Core',
        quantity: 1,
        qualityModifier: 1.0
      }
    ],
    experienceGain: 180,
    steampunkTheme: {
      flavorText: 'The thundering heart that drives the age of steam forward.',
      visualDescription: 'A compact but powerful engine with gleaming copper pipes and steel housing.'
    }
  },
  {
    recipeId: 'steam-rifle',
    name: 'Steam-Powered Rifle',
    description: 'A precision weapon powered by compressed steam',
    category: 'weapons',
    requiredSkill: 'steamcraft',
    requiredLevel: 15,
    craftingTime: 1200,
    materials: [
      { materialId: 'steam-engine-core', name: 'Steam Engine Core', quantity: 1, type: 'refined' },
      { materialId: 'precision-barrel', name: 'Precision Barrel', quantity: 1, type: 'rare' },
      { materialId: 'mahogany-stock', name: 'Mahogany Stock', quantity: 1, type: 'refined' },
      { materialId: 'brass-fittings', name: 'Brass Fittings', quantity: 4, type: 'basic' }
    ],
    outputs: [
      {
        itemId: 'steam-rifle',
        name: 'Steam-Powered Rifle',
        quantity: 1,
        baseStats: { attack: 25, dexterity: 5, durability: 150 },
        qualityModifier: 1.0
      }
    ],
    experienceGain: 500,
    steampunkTheme: {
      flavorText: 'Where traditional gunpowder fails, the power of steam prevails.',
      visualDescription: 'An elegant rifle with exposed steam mechanisms and brass accents along a mahogany stock.'
    }
  }
];

export const CRAFTING_WORKSTATIONS: CraftingWorkstation[] = [
  {
    workstationId: 'basic-forge',
    name: 'Basic Steam Forge',
    type: 'basic',
    requiredSkills: [],
    bonuses: [
      { type: 'speed', value: 10, description: '+10% crafting speed for basic recipes' }
    ],
    unlockCost: 0,
    maintenanceCost: 5,
    steampunkDescription: 'A simple forge powered by steam, perfect for basic metalworking and gear crafting.'
  },
  {
    workstationId: 'precision-workbench',
    name: 'Precision Clockwork Bench',
    type: 'advanced',
    requiredSkills: [
      { skill: 'clockmaking', level: 5 }
    ],
    bonuses: [
      { type: 'quality', value: 15, description: '+15% quality bonus for clockmaking recipes' },
      { type: 'speed', value: 20, description: '+20% speed for clockmaking recipes' }
    ],
    unlockCost: 500,
    maintenanceCost: 15,
    steampunkDescription: 'A specialized workbench with precision tools and magnifying lenses for intricate clockwork.'
  },
  {
    workstationId: 'alchemical-laboratory',
    name: 'Steam-Powered Laboratory',
    type: 'advanced',
    requiredSkills: [
      { skill: 'alchemy', level: 8 }
    ],
    bonuses: [
      { type: 'material_efficiency', value: 25, description: '25% chance to save materials in alchemy' },
      { type: 'experience', value: 30, description: '+30% experience from alchemy recipes' }
    ],
    unlockCost: 750,
    maintenanceCost: 20,
    steampunkDescription: 'A sophisticated laboratory with steam-powered distillation equipment and precise temperature control.'
  },
  {
    workstationId: 'master-workshop',
    name: 'Master Artificer\'s Workshop',
    type: 'master',
    requiredSkills: [
      { skill: 'clockmaking', level: 10 },
      { skill: 'engineering', level: 10 },
      { skill: 'steamcraft', level: 10 }
    ],
    bonuses: [
      { type: 'quality', value: 25, description: '+25% quality bonus for all recipes' },
      { type: 'speed', value: 30, description: '+30% crafting speed for all recipes' },
      { type: 'material_efficiency', value: 20, description: '20% chance to save materials' }
    ],
    unlockCost: 2000,
    maintenanceCost: 50,
    steampunkDescription: 'The pinnacle of crafting facilities, combining the best of all disciplines under one steam-powered roof.'
  }
];

// Material definitions for reference
export const CRAFTING_MATERIALS = {
  // Basic Materials
  'brass-ingot': { name: 'Brass Ingot', type: 'basic', description: 'A basic alloy perfect for clockwork mechanisms' },
  'iron-ingot': { name: 'Iron Ingot', type: 'basic', description: 'Sturdy iron for structural components' },
  'coal': { name: 'Coal', type: 'basic', description: 'Fuel for the forge and steam engines' },
  'rubber-gasket': { name: 'Rubber Gasket', type: 'basic', description: 'Essential for steam-tight seals' },
  'leather-padding': { name: 'Leather Padding', type: 'basic', description: 'Comfortable padding for wearable items' },
  'copper-tubing': { name: 'Copper Tubing', type: 'basic', description: 'Flexible tubing for steam systems' },
  'brass-fittings': { name: 'Brass Fittings', type: 'basic', description: 'Decorative and functional brass components' },
  'medicinal-herbs': { name: 'Medicinal Herbs', type: 'basic', description: 'Natural healing ingredients' },
  'distilled-water': { name: 'Distilled Water', type: 'basic', description: 'Pure water for alchemical processes' },

  // Refined Materials
  'silver-ingot': { name: 'Silver Ingot', type: 'refined', description: 'Precious metal for fine craftsmanship' },
  'steel-plate': { name: 'Steel Plate', type: 'refined', description: 'Strong steel for armor and weapons' },
  'crystal-lens': { name: 'Crystal Lens', type: 'refined', description: 'Precisely cut crystal for optical devices' },
  'precision-spring': { name: 'Precision Spring', type: 'refined', description: 'Carefully calibrated springs for clockwork' },
  'steam-essence': { name: 'Steam Essence', type: 'refined', description: 'Concentrated steam energy in liquid form' },
  'mercury-drops': { name: 'Mercury Drops', type: 'refined', description: 'Liquid metal for advanced alchemy' },
  'mahogany-stock': { name: 'Mahogany Stock', type: 'refined', description: 'Fine wood for weapon crafting' },

  // Rare Materials
  'steam-crystal': { name: 'Steam Crystal', type: 'rare', description: 'A crystallized form of pure steam energy' },
  'rare-mushrooms': { name: 'Rare Mushrooms', type: 'rare', description: 'Exotic fungi with magical properties' },
  'philosopher-salt': { name: 'Philosopher\'s Salt', type: 'rare', description: 'Legendary alchemical catalyst' },
  'precision-barrel': { name: 'Precision Barrel', type: 'rare', description: 'Masterwork barrel for steam weapons' }
};