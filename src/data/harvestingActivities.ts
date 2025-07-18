/**
 * Steampunk Harvesting Activities Data
 * Comprehensive list of resource gathering activities
 */

import { HarvestingActivity, HarvestingCategory } from '../types/harvesting';

export const HARVESTING_ACTIVITIES: HarvestingActivity[] = [
  // LITERARY ACTIVITIES
  {
    id: 'read_jules_verne',
    name: 'Reading Jules Verne Novels',
    description: 'Immerse yourself in the adventures of Captain Nemo and Phileas Fogg. Chance to discover rare book pages and literary treasures.',
    category: HarvestingCategory.LITERARY,
    icon: '📚',
    baseTime: 300, // 5 minutes
    energyCost: 10,
    requiredLevel: 1,
    statBonuses: {
      intelligence: 2,
      experience: 15
    },
    dropTable: {
      guaranteed: [
        { itemId: 'book_page', minQuantity: 1, maxQuantity: 3, dropRate: 1.0 }
      ],
      common: [
        { itemId: 'ink_vial', minQuantity: 1, maxQuantity: 2, dropRate: 0.4 },
        { itemId: 'parchment', minQuantity: 1, maxQuantity: 1, dropRate: 0.3 }
      ],
      uncommon: [
        { itemId: 'vintage_bookmark', minQuantity: 1, maxQuantity: 1, dropRate: 0.15 },
        { itemId: 'nautilus_sketch', minQuantity: 1, maxQuantity: 1, dropRate: 0.1 }
      ],
      rare: [
        { itemId: 'complete_novel', minQuantity: 1, maxQuantity: 1, dropRate: 0.05 },
        { itemId: 'authors_notes', minQuantity: 1, maxQuantity: 1, dropRate: 0.03 }
      ],
      legendary: [
        { itemId: 'original_manuscript', minQuantity: 1, maxQuantity: 1, dropRate: 0.01 }
      ]
    }
  },

  {
    id: 'study_technical_manuals',
    name: 'Studying Technical Manuals',
    description: 'Pore over intricate engineering diagrams and mechanical blueprints. Gain knowledge and discover technical components.',
    category: HarvestingCategory.LITERARY,
    icon: '📖',
    baseTime: 240,
    energyCost: 12,
    requiredLevel: 3,
    requiredStats: { intelligence: 15 },
    statBonuses: {
      intelligence: 3,
      perception: 1,
      experience: 20
    },
    dropTable: {
      guaranteed: [
        { itemId: 'technical_diagram', minQuantity: 1, maxQuantity: 2, dropRate: 1.0 }
      ],
      common: [
        { itemId: 'blueprint_fragment', minQuantity: 1, maxQuantity: 3, dropRate: 0.5 },
        { itemId: 'calculation_notes', minQuantity: 1, maxQuantity: 2, dropRate: 0.3 }
      ],
      uncommon: [
        { itemId: 'engineering_formula', minQuantity: 1, maxQuantity: 1, dropRate: 0.2 },
        { itemId: 'patent_document', minQuantity: 1, maxQuantity: 1, dropRate: 0.12 }
      ],
      rare: [
        { itemId: 'complete_blueprint', minQuantity: 1, maxQuantity: 1, dropRate: 0.06 },
        { itemId: 'inventors_journal', minQuantity: 1, maxQuantity: 1, dropRate: 0.04 }
      ],
      legendary: [
        { itemId: 'master_schematic', minQuantity: 1, maxQuantity: 1, dropRate: 0.015 }
      ]
    }
  },

  // MECHANICAL ACTIVITIES
  {
    id: 'tinker_clockwork',
    name: 'Tinkering with Clockwork',
    description: 'Disassemble and examine intricate clockwork mechanisms. Salvage gears, springs, and precision components.',
    category: HarvestingCategory.MECHANICAL,
    icon: '⚙️',
    baseTime: 180,
    energyCost: 15,
    requiredLevel: 2,
    statBonuses: {
      dexterity: 2,
      intelligence: 1,
      experience: 18
    },
    dropTable: {
      guaranteed: [
        { itemId: 'brass_gear', minQuantity: 2, maxQuantity: 4, dropRate: 1.0 }
      ],
      common: [
        { itemId: 'steel_spring', minQuantity: 1, maxQuantity: 3, dropRate: 0.6 },
        { itemId: 'copper_wire', minQuantity: 2, maxQuantity: 5, dropRate: 0.4 }
      ],
      uncommon: [
        { itemId: 'precision_bearing', minQuantity: 1, maxQuantity: 2, dropRate: 0.18 },
        { itemId: 'clockwork_escapement', minQuantity: 1, maxQuantity: 1, dropRate: 0.12 }
      ],
      rare: [
        { itemId: 'chronometer_core', minQuantity: 1, maxQuantity: 1, dropRate: 0.05 },
        { itemId: 'master_gear', minQuantity: 1, maxQuantity: 1, dropRate: 0.03 }
      ],
      legendary: [
        { itemId: 'temporal_mechanism', minQuantity: 1, maxQuantity: 1, dropRate: 0.008 }
      ]
    }
  },

  {
    id: 'salvage_steam_engines',
    name: 'Salvaging Steam Engines',
    description: 'Carefully dismantle old steam engines to recover valuable boiler parts, pistons, and pressure gauges.',
    category: HarvestingCategory.MECHANICAL,
    icon: '🚂',
    baseTime: 420,
    energyCost: 25,
    requiredLevel: 5,
    requiredStats: { strength: 20, dexterity: 15 },
    statBonuses: {
      strength: 2,
      dexterity: 2,
      experience: 30
    },
    dropTable: {
      guaranteed: [
        { itemId: 'iron_pipe', minQuantity: 3, maxQuantity: 6, dropRate: 1.0 }
      ],
      common: [
        { itemId: 'steam_valve', minQuantity: 1, maxQuantity: 2, dropRate: 0.5 },
        { itemId: 'pressure_gauge', minQuantity: 1, maxQuantity: 1, dropRate: 0.4 },
        { itemId: 'boiler_plate', minQuantity: 2, maxQuantity: 4, dropRate: 0.6 }
      ],
      uncommon: [
        { itemId: 'piston_assembly', minQuantity: 1, maxQuantity: 1, dropRate: 0.15 },
        { itemId: 'steam_regulator', minQuantity: 1, maxQuantity: 1, dropRate: 0.12 }
      ],
      rare: [
        { itemId: 'master_cylinder', minQuantity: 1, maxQuantity: 1, dropRate: 0.06 },
        { itemId: 'precision_boiler', minQuantity: 1, maxQuantity: 1, dropRate: 0.04 }
      ],
      legendary: [
        { itemId: 'perpetual_engine_core', minQuantity: 1, maxQuantity: 1, dropRate: 0.01 }
      ]
    }
  },

  // ALCHEMICAL ACTIVITIES
  {
    id: 'gather_rare_herbs',
    name: 'Gathering Rare Herbs',
    description: 'Search Victorian gardens and greenhouses for exotic plants with alchemical properties.',
    category: HarvestingCategory.ALCHEMICAL,
    icon: '🌿',
    baseTime: 200,
    energyCost: 12,
    requiredLevel: 2,
    statBonuses: {
      perception: 2,
      intelligence: 1,
      experience: 16
    },
    dropTable: {
      guaranteed: [
        { itemId: 'common_herb', minQuantity: 2, maxQuantity: 5, dropRate: 1.0 }
      ],
      common: [
        { itemId: 'medicinal_root', minQuantity: 1, maxQuantity: 3, dropRate: 0.4 },
        { itemId: 'aromatic_leaf', minQuantity: 2, maxQuantity: 4, dropRate: 0.5 }
      ],
      uncommon: [
        { itemId: 'luminous_moss', minQuantity: 1, maxQuantity: 2, dropRate: 0.16 },
        { itemId: 'ethereal_flower', minQuantity: 1, maxQuantity: 1, dropRate: 0.12 }
      ],
      rare: [
        { itemId: 'philosophers_sage', minQuantity: 1, maxQuantity: 1, dropRate: 0.05 },
        { itemId: 'temporal_vine', minQuantity: 1, maxQuantity: 1, dropRate: 0.03 }
      ],
      legendary: [
        { itemId: 'elixir_bloom', minQuantity: 1, maxQuantity: 1, dropRate: 0.008 }
      ]
    }
  },

  {
    id: 'distill_essences',
    name: 'Distilling Essences',
    description: 'Use elaborate alchemical apparatus to extract pure essences from various materials.',
    category: HarvestingCategory.ALCHEMICAL,
    icon: '⚗️',
    baseTime: 360,
    energyCost: 20,
    requiredLevel: 4,
    requiredStats: { intelligence: 25, perception: 15 },
    statBonuses: {
      intelligence: 3,
      perception: 2,
      experience: 25
    },
    dropTable: {
      guaranteed: [
        { itemId: 'basic_essence', minQuantity: 1, maxQuantity: 3, dropRate: 1.0 }
      ],
      common: [
        { itemId: 'purified_water', minQuantity: 2, maxQuantity: 4, dropRate: 0.6 },
        { itemId: 'alchemical_salt', minQuantity: 1, maxQuantity: 2, dropRate: 0.4 }
      ],
      uncommon: [
        { itemId: 'concentrated_essence', minQuantity: 1, maxQuantity: 1, dropRate: 0.18 },
        { itemId: 'volatile_compound', minQuantity: 1, maxQuantity: 1, dropRate: 0.14 }
      ],
      rare: [
        { itemId: 'philosophers_mercury', minQuantity: 1, maxQuantity: 1, dropRate: 0.06 },
        { itemId: 'quintessence', minQuantity: 1, maxQuantity: 1, dropRate: 0.04 }
      ],
      legendary: [
        { itemId: 'universal_solvent', minQuantity: 1, maxQuantity: 1, dropRate: 0.012 }
      ]
    }
  },

  // ARCHAEOLOGICAL ACTIVITIES
  {
    id: 'excavate_ruins',
    name: 'Excavating Ancient Ruins',
    description: 'Carefully dig through Victorian-era archaeological sites to uncover lost artifacts and treasures.',
    category: HarvestingCategory.ARCHAEOLOGICAL,
    icon: '🏛️',
    baseTime: 480,
    energyCost: 30,
    requiredLevel: 6,
    requiredStats: { strength: 25, perception: 20 },
    statBonuses: {
      strength: 2,
      perception: 3,
      experience: 35
    },
    dropTable: {
      guaranteed: [
        { itemId: 'pottery_shard', minQuantity: 3, maxQuantity: 7, dropRate: 1.0 }
      ],
      common: [
        { itemId: 'ancient_coin', minQuantity: 1, maxQuantity: 4, dropRate: 0.5 },
        { itemId: 'carved_stone', minQuantity: 1, maxQuantity: 2, dropRate: 0.3 }
      ],
      uncommon: [
        { itemId: 'ornate_jewelry', minQuantity: 1, maxQuantity: 1, dropRate: 0.15 },
        { itemId: 'ceremonial_dagger', minQuantity: 1, maxQuantity: 1, dropRate: 0.1 }
      ],
      rare: [
        { itemId: 'golden_idol', minQuantity: 1, maxQuantity: 1, dropRate: 0.05 },
        { itemId: 'ancient_tome', minQuantity: 1, maxQuantity: 1, dropRate: 0.03 }
      ],
      legendary: [
        { itemId: 'atlantean_artifact', minQuantity: 1, maxQuantity: 1, dropRate: 0.008 }
      ]
    }
  },

  // ELECTRICAL ACTIVITIES
  {
    id: 'harvest_lightning',
    name: 'Harvesting Lightning',
    description: 'Use Tesla coils and lightning rods to capture and store electrical energy during storms.',
    category: HarvestingCategory.ELECTRICAL,
    icon: '⚡',
    baseTime: 600,
    energyCost: 35,
    requiredLevel: 8,
    requiredStats: { intelligence: 35, dexterity: 25 },
    statBonuses: {
      intelligence: 4,
      dexterity: 2,
      experience: 40
    },
    dropTable: {
      guaranteed: [
        { itemId: 'electrical_charge', minQuantity: 5, maxQuantity: 10, dropRate: 1.0 }
      ],
      common: [
        { itemId: 'copper_conductor', minQuantity: 2, maxQuantity: 4, dropRate: 0.6 },
        { itemId: 'insulation_material', minQuantity: 1, maxQuantity: 3, dropRate: 0.4 }
      ],
      uncommon: [
        { itemId: 'tesla_coil_fragment', minQuantity: 1, maxQuantity: 1, dropRate: 0.16 },
        { itemId: 'static_crystal', minQuantity: 1, maxQuantity: 2, dropRate: 0.12 }
      ],
      rare: [
        { itemId: 'lightning_essence', minQuantity: 1, maxQuantity: 1, dropRate: 0.06 },
        { itemId: 'storm_core', minQuantity: 1, maxQuantity: 1, dropRate: 0.04 }
      ],
      legendary: [
        { itemId: 'zeus_fragment', minQuantity: 1, maxQuantity: 1, dropRate: 0.01 }
      ]
    }
  },

  // AERONAUTICAL ACTIVITIES
  {
    id: 'balloon_expedition',
    name: 'Hot Air Balloon Expeditions',
    description: 'Embark on aerial adventures to collect rare atmospheric specimens and sky-bound treasures.',
    category: HarvestingCategory.AERONAUTICAL,
    icon: '🎈',
    baseTime: 720,
    energyCost: 40,
    requiredLevel: 10,
    requiredStats: { perception: 30, dexterity: 25 },
    statBonuses: {
      perception: 4,
      dexterity: 2,
      experience: 50
    },
    dropTable: {
      guaranteed: [
        { itemId: 'cloud_essence', minQuantity: 2, maxQuantity: 5, dropRate: 1.0 }
      ],
      common: [
        { itemId: 'wind_crystal', minQuantity: 1, maxQuantity: 3, dropRate: 0.5 },
        { itemId: 'atmospheric_sample', minQuantity: 2, maxQuantity: 4, dropRate: 0.4 }
      ],
      uncommon: [
        { itemId: 'sky_silk', minQuantity: 1, maxQuantity: 2, dropRate: 0.18 },
        { itemId: 'floating_stone', minQuantity: 1, maxQuantity: 1, dropRate: 0.14 }
      ],
      rare: [
        { itemId: 'celestial_compass', minQuantity: 1, maxQuantity: 1, dropRate: 0.06 },
        { itemId: 'star_fragment', minQuantity: 1, maxQuantity: 1, dropRate: 0.04 }
      ],
      legendary: [
        { itemId: 'phoenix_feather', minQuantity: 1, maxQuantity: 1, dropRate: 0.01 }
      ]
    }
  },

  // METALLURGICAL ACTIVITIES
  {
    id: 'mine_rare_metals',
    name: 'Mining Rare Metals',
    description: 'Delve deep into Victorian-era mines to extract precious metals and unusual alloys.',
    category: HarvestingCategory.METALLURGICAL,
    icon: '⛏️',
    baseTime: 300,
    energyCost: 25,
    requiredLevel: 3,
    requiredStats: { strength: 20 },
    statBonuses: {
      strength: 3,
      experience: 22
    },
    dropTable: {
      guaranteed: [
        { itemId: 'iron_ore', minQuantity: 3, maxQuantity: 6, dropRate: 1.0 }
      ],
      common: [
        { itemId: 'copper_ore', minQuantity: 2, maxQuantity: 4, dropRate: 0.6 },
        { itemId: 'coal_chunk', minQuantity: 2, maxQuantity: 5, dropRate: 0.7 }
      ],
      uncommon: [
        { itemId: 'silver_nugget', minQuantity: 1, maxQuantity: 2, dropRate: 0.15 },
        { itemId: 'brass_alloy', minQuantity: 1, maxQuantity: 1, dropRate: 0.12 }
      ],
      rare: [
        { itemId: 'gold_vein', minQuantity: 1, maxQuantity: 1, dropRate: 0.05 },
        { itemId: 'platinum_ore', minQuantity: 1, maxQuantity: 1, dropRate: 0.03 }
      ],
      legendary: [
        { itemId: 'adamantine_crystal', minQuantity: 1, maxQuantity: 1, dropRate: 0.008 }
      ]
    }
  }
];