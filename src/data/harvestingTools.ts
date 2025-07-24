/**
 * Steampunk Harvesting Tools Data
 * Defines tools that can be used for harvesting activities
 */

import { EquippedTool, ToolBonus } from '../types/taskQueue';
import { HarvestingCategory } from '../types/harvesting';

export interface HarvestingToolTemplate {
  toolId: string;
  name: string;
  description: string;
  category: HarvestingCategory | 'universal';
  bonuses: ToolBonus[];
  durability: number;
  maxDurability: number;
  requiredLevel: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
}

export const HARVESTING_TOOLS: HarvestingToolTemplate[] = [
  // UNIVERSAL TOOLS
  {
    toolId: 'brass_multitool',
    name: 'Brass Multitool',
    description: 'A versatile brass tool with interchangeable parts for various harvesting tasks.',
    category: 'universal',
    bonuses: [
      { type: 'speed', value: 0.05, description: '5% faster harvesting' },
      { type: 'yield', value: 0.05, description: '5% increased yield' }
    ],
    durability: 100,
    maxDurability: 100,
    requiredLevel: 1,
    rarity: 'common'
  },
  {
    toolId: 'clockwork_assistant',
    name: 'Clockwork Assistant',
    description: 'A small mechanical helper that aids in all harvesting activities.',
    category: 'universal',
    bonuses: [
      { type: 'speed', value: 0.1, description: '10% faster harvesting' },
      { type: 'efficiency', value: 0.1, description: '10% reduced energy cost' }
    ],
    durability: 150,
    maxDurability: 150,
    requiredLevel: 10,
    rarity: 'rare'
  },

  // LITERARY TOOLS
  {
    toolId: 'brass_magnifying_glass',
    name: 'Brass Magnifying Glass',
    description: 'A finely crafted magnifying glass for examining literary works.',
    category: HarvestingCategory.LITERARY,
    bonuses: [
      { type: 'speed', value: 0.1, description: '10% faster literary harvesting' },
      { type: 'quality', value: 0.05, description: '5% higher quality finds' }
    ],
    durability: 80,
    maxDurability: 80,
    requiredLevel: 2,
    rarity: 'common'
  },
  {
    toolId: 'automated_page_turner',
    name: 'Automated Page Turner',
    description: 'A mechanical device that carefully turns pages while you take notes.',
    category: HarvestingCategory.LITERARY,
    bonuses: [
      { type: 'speed', value: 0.2, description: '20% faster literary harvesting' },
      { type: 'yield', value: 0.15, description: '15% increased literary yield' }
    ],
    durability: 120,
    maxDurability: 120,
    requiredLevel: 8,
    rarity: 'uncommon'
  },

  // MECHANICAL TOOLS
  {
    toolId: 'precision_screwdriver_set',
    name: 'Precision Screwdriver Set',
    description: 'A set of finely machined screwdrivers for mechanical work.',
    category: HarvestingCategory.MECHANICAL,
    bonuses: [
      { type: 'speed', value: 0.1, description: '10% faster mechanical harvesting' },
      { type: 'quality', value: 0.05, description: '5% higher quality components' }
    ],
    durability: 90,
    maxDurability: 90,
    requiredLevel: 3,
    rarity: 'common'
  },
  {
    toolId: 'steam_powered_wrench',
    name: 'Steam-Powered Wrench',
    description: 'A wrench with steam-powered assistance for difficult mechanical tasks.',
    category: HarvestingCategory.MECHANICAL,
    bonuses: [
      { type: 'speed', value: 0.15, description: '15% faster mechanical harvesting' },
      { type: 'yield', value: 0.2, description: '20% increased mechanical yield' }
    ],
    durability: 150,
    maxDurability: 150,
    requiredLevel: 12,
    rarity: 'rare'
  },

  // ALCHEMICAL TOOLS
  {
    toolId: 'brass_mortar_pestle',
    name: 'Brass Mortar and Pestle',
    description: 'A sturdy brass mortar and pestle for alchemical preparations.',
    category: HarvestingCategory.ALCHEMICAL,
    bonuses: [
      { type: 'quality', value: 0.1, description: '10% higher quality alchemical materials' },
      { type: 'efficiency', value: 0.05, description: '5% reduced energy cost' }
    ],
    durability: 70,
    maxDurability: 70,
    requiredLevel: 2,
    rarity: 'common'
  },
  {
    toolId: 'essence_extractor',
    name: 'Essence Extractor',
    description: 'A complex device that efficiently extracts essences from alchemical materials.',
    category: HarvestingCategory.ALCHEMICAL,
    bonuses: [
      { type: 'yield', value: 0.25, description: '25% increased alchemical yield' },
      { type: 'quality', value: 0.15, description: '15% higher quality essences' }
    ],
    durability: 100,
    maxDurability: 100,
    requiredLevel: 15,
    rarity: 'rare'
  },

  // ARCHAEOLOGICAL TOOLS
  {
    toolId: 'excavation_trowel',
    name: 'Precision Excavation Trowel',
    description: 'A carefully balanced trowel for archaeological excavations.',
    category: HarvestingCategory.ARCHAEOLOGICAL,
    bonuses: [
      { type: 'quality', value: 0.1, description: '10% higher quality artifacts' },
      { type: 'efficiency', value: 0.05, description: '5% reduced energy cost' }
    ],
    durability: 60,
    maxDurability: 60,
    requiredLevel: 5,
    rarity: 'common'
  },
  {
    toolId: 'sonic_excavator',
    name: 'Sonic Excavator',
    description: 'A device that uses sound waves to carefully extract delicate artifacts.',
    category: HarvestingCategory.ARCHAEOLOGICAL,
    bonuses: [
      { type: 'speed', value: 0.2, description: '20% faster archaeological harvesting' },
      { type: 'quality', value: 0.25, description: '25% higher quality artifacts' }
    ],
    durability: 120,
    maxDurability: 120,
    requiredLevel: 18,
    rarity: 'rare'
  },

  // ELECTRICAL TOOLS
  {
    toolId: 'insulated_pliers',
    name: 'Insulated Pliers',
    description: 'Rubber-insulated pliers for safely handling electrical components.',
    category: HarvestingCategory.ELECTRICAL,
    bonuses: [
      { type: 'efficiency', value: 0.1, description: '10% reduced energy cost' },
      { type: 'speed', value: 0.05, description: '5% faster electrical harvesting' }
    ],
    durability: 80,
    maxDurability: 80,
    requiredLevel: 8,
    rarity: 'common'
  },
  {
    toolId: 'tesla_capacitor',
    name: 'Tesla Capacitor',
    description: 'A device that safely captures and stores electrical energy.',
    category: HarvestingCategory.ELECTRICAL,
    bonuses: [
      { type: 'yield', value: 0.3, description: '30% increased electrical yield' },
      { type: 'quality', value: 0.2, description: '20% higher quality electrical components' }
    ],
    durability: 100,
    maxDurability: 100,
    requiredLevel: 16,
    rarity: 'rare'
  },

  // AERONAUTICAL TOOLS
  {
    toolId: 'barometric_sampler',
    name: 'Barometric Sampler',
    description: 'A device for collecting atmospheric samples at various altitudes.',
    category: HarvestingCategory.AERONAUTICAL,
    bonuses: [
      { type: 'yield', value: 0.1, description: '10% increased aeronautical yield' },
      { type: 'quality', value: 0.05, description: '5% higher quality samples' }
    ],
    durability: 70,
    maxDurability: 70,
    requiredLevel: 10,
    rarity: 'common'
  },
  {
    toolId: 'aether_collector',
    name: 'Aether Collector',
    description: 'A sophisticated device that collects rare aetheric materials from the upper atmosphere.',
    category: HarvestingCategory.AERONAUTICAL,
    bonuses: [
      { type: 'yield', value: 0.25, description: '25% increased aeronautical yield' },
      { type: 'quality', value: 0.2, description: '20% higher quality aetheric materials' }
    ],
    durability: 90,
    maxDurability: 90,
    requiredLevel: 22,
    rarity: 'rare'
  },

  // METALLURGICAL TOOLS
  {
    toolId: 'reinforced_pickaxe',
    name: 'Reinforced Pickaxe',
    description: 'A sturdy pickaxe reinforced with steel for mining operations.',
    category: HarvestingCategory.METALLURGICAL,
    bonuses: [
      { type: 'speed', value: 0.1, description: '10% faster mining' },
      { type: 'yield', value: 0.05, description: '5% increased ore yield' }
    ],
    durability: 100,
    maxDurability: 100,
    requiredLevel: 3,
    rarity: 'common'
  },
  {
    toolId: 'resonance_drill',
    name: 'Resonance Drill',
    description: 'A drill that uses harmonic resonance to extract ore with minimal effort.',
    category: HarvestingCategory.METALLURGICAL,
    bonuses: [
      { type: 'speed', value: 0.25, description: '25% faster mining' },
      { type: 'yield', value: 0.2, description: '20% increased ore yield' },
      { type: 'efficiency', value: 0.15, description: '15% reduced energy cost' }
    ],
    durability: 150,
    maxDurability: 150,
    requiredLevel: 25,
    rarity: 'rare'
  }
];

/**
 * Get appropriate tools for a specific harvesting category
 */
export function getToolsForCategory(category: HarvestingCategory): HarvestingToolTemplate[] {
  return HARVESTING_TOOLS.filter(tool => 
    tool.category === category || tool.category === 'universal'
  );
}

/**
 * Create an equipped tool instance from a template
 */
export function createEquippedTool(template: HarvestingToolTemplate, currentDurability?: number): EquippedTool {
  return {
    toolId: template.toolId,
    name: template.name,
    type: 'harvesting',
    bonuses: template.bonuses,
    durability: currentDurability !== undefined ? currentDurability : template.durability,
    maxDurability: template.maxDurability
  };
}

/**
 * Get the best available tools for a player based on level and inventory
 */
export function getBestAvailableTools(
  category: HarvestingCategory,
  playerLevel: number,
  playerInventory: { [toolId: string]: { durability: number } }
): EquippedTool[] {
  const availableTools = HARVESTING_TOOLS.filter(tool => 
    (tool.category === category || tool.category === 'universal') && 
    tool.requiredLevel <= playerLevel &&
    playerInventory[tool.toolId]
  );
  
  // Return up to 2 best tools (1 category-specific, 1 universal)
  const result: EquippedTool[] = [];
  
  // Get best category-specific tool
  const categoryTools = availableTools.filter(tool => tool.category === category)
    .sort((a, b) => {
      // Sort by total bonus value
      const aTotal = a.bonuses.reduce((sum, bonus) => sum + bonus.value, 0);
      const bTotal = b.bonuses.reduce((sum, bonus) => sum + bonus.value, 0);
      return bTotal - aTotal;
    });
  
  if (categoryTools.length > 0) {
    const bestCategoryTool = categoryTools[0];
    result.push(createEquippedTool(bestCategoryTool, playerInventory[bestCategoryTool.toolId].durability));
  }
  
  // Get best universal tool
  const universalTools = availableTools.filter(tool => tool.category === 'universal')
    .sort((a, b) => {
      // Sort by total bonus value
      const aTotal = a.bonuses.reduce((sum, bonus) => sum + bonus.value, 0);
      const bTotal = b.bonuses.reduce((sum, bonus) => sum + bonus.value, 0);
      return bTotal - aTotal;
    });
  
  if (universalTools.length > 0) {
    const bestUniversalTool = universalTools[0];
    result.push(createEquippedTool(bestUniversalTool, playerInventory[bestUniversalTool.toolId].durability));
  }
  
  return result;
}