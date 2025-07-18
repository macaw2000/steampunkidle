/**
 * Primary Materials Mapping
 * Maps each harvesting activity to its primary material reward
 */

import { HarvestingCategory } from '../types/harvesting';

export interface PrimaryMaterial {
  activityId: string;
  itemId: string;
  baseQuantity: number; // Base amount, can be modified by skill
}

export const PRIMARY_MATERIALS: PrimaryMaterial[] = [
  // LITERARY ACTIVITIES
  {
    activityId: 'read_jules_verne',
    itemId: 'book_page',
    baseQuantity: 2
  },
  {
    activityId: 'study_technical_manuals',
    itemId: 'technical_diagram',
    baseQuantity: 1
  },

  // MECHANICAL ACTIVITIES
  {
    activityId: 'tinker_clockwork',
    itemId: 'brass_gear',
    baseQuantity: 3
  },
  {
    activityId: 'salvage_steam_engines',
    itemId: 'iron_pipe',
    baseQuantity: 4
  },

  // ALCHEMICAL ACTIVITIES
  {
    activityId: 'gather_rare_herbs',
    itemId: 'common_herb',
    baseQuantity: 3
  },
  {
    activityId: 'distill_essences',
    itemId: 'basic_essence',
    baseQuantity: 2
  },

  // ARCHAEOLOGICAL ACTIVITIES
  {
    activityId: 'excavate_ruins',
    itemId: 'pottery_shard',
    baseQuantity: 5
  },

  // ELECTRICAL ACTIVITIES
  {
    activityId: 'harvest_lightning',
    itemId: 'electrical_charge',
    baseQuantity: 7
  },

  // AERONAUTICAL ACTIVITIES
  {
    activityId: 'balloon_expedition',
    itemId: 'cloud_essence',
    baseQuantity: 3
  },

  // METALLURGICAL ACTIVITIES
  {
    activityId: 'mine_rare_metals',
    itemId: 'iron_ore',
    baseQuantity: 4
  }
];

// Helper function to get primary material for an activity
export function getPrimaryMaterialForActivity(activityId: string): PrimaryMaterial | undefined {
  return PRIMARY_MATERIALS.find(material => material.activityId === activityId);
}

// Category-based primary materials for general reference
export const CATEGORY_PRIMARY_MATERIALS = {
  [HarvestingCategory.LITERARY]: ['book_page', 'technical_diagram', 'blueprint_fragment'],
  [HarvestingCategory.MECHANICAL]: ['brass_gear', 'iron_pipe', 'steel_spring'],
  [HarvestingCategory.ALCHEMICAL]: ['common_herb', 'basic_essence', 'medicinal_root'],
  [HarvestingCategory.ARCHAEOLOGICAL]: ['pottery_shard', 'ancient_coin', 'carved_stone'],
  [HarvestingCategory.BOTANICAL]: ['common_herb', 'medicinal_root', 'aromatic_leaf'],
  [HarvestingCategory.METALLURGICAL]: ['iron_ore', 'copper_ore', 'coal_chunk'],
  [HarvestingCategory.ELECTRICAL]: ['electrical_charge', 'copper_conductor', 'insulation_material'],
  [HarvestingCategory.AERONAUTICAL]: ['cloud_essence', 'wind_crystal', 'atmospheric_sample']
};