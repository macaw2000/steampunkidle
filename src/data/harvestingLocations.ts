/**
 * Steampunk Harvesting Locations Data
 * Defines locations where harvesting activities can be performed
 */

import { HarvestingLocation } from '../types/taskQueue';
import { HarvestingCategory } from '../types/harvesting';

export const HARVESTING_LOCATIONS: HarvestingLocation[] = [
  // LITERARY LOCATIONS
  {
    locationId: 'grand_library',
    name: 'Grand Library of Cogsworth',
    bonusModifiers: {
      'literary_yield': 0.15,
      'experience': 0.1,
      'rare_find': 0.05
    },
    requirements: [
      {
        type: 'level',
        requirement: 3,
        description: 'Requires level 3 to access',
        isMet: false
      }
    ]
  },
  {
    locationId: 'inventors_archive',
    name: 'Inventor\'s Archive',
    bonusModifiers: {
      'literary_yield': 0.2,
      'mechanical_yield': 0.1,
      'experience': 0.15
    },
    requirements: [
      {
        type: 'level',
        requirement: 8,
        description: 'Requires level 8 to access',
        isMet: false
      },
      {
        type: 'item',
        requirement: 'archive_key',
        description: 'Requires Archive Key to enter',
        isMet: false
      }
    ]
  },

  // MECHANICAL LOCATIONS
  {
    locationId: 'clocktower_workshop',
    name: 'Clocktower Workshop',
    bonusModifiers: {
      'mechanical_yield': 0.2,
      'clockwork_quality': 0.15,
      'rare_find': 0.03
    },
    requirements: [
      {
        type: 'level',
        requirement: 5,
        description: 'Requires level 5 to access',
        isMet: false
      }
    ]
  },
  {
    locationId: 'abandoned_factory',
    name: 'Abandoned Steam Factory',
    bonusModifiers: {
      'mechanical_yield': 0.25,
      'steam_component_quality': 0.2,
      'rare_find': 0.08
    },
    requirements: [
      {
        type: 'level',
        requirement: 12,
        description: 'Requires level 12 to access',
        isMet: false
      },
      {
        type: 'equipment',
        requirement: 'safety_gear',
        description: 'Requires Safety Gear to enter',
        isMet: false
      }
    ]
  },

  // ALCHEMICAL LOCATIONS
  {
    locationId: 'botanical_gardens',
    name: 'Royal Botanical Gardens',
    bonusModifiers: {
      'alchemical_yield': 0.15,
      'herb_quality': 0.2,
      'experience': 0.1
    },
    requirements: [
      {
        type: 'level',
        requirement: 4,
        description: 'Requires level 4 to access',
        isMet: false
      }
    ]
  },
  {
    locationId: 'alchemists_laboratory',
    name: 'Master Alchemist\'s Laboratory',
    bonusModifiers: {
      'alchemical_yield': 0.3,
      'essence_quality': 0.25,
      'rare_find': 0.1
    },
    requirements: [
      {
        type: 'level',
        requirement: 15,
        description: 'Requires level 15 to access',
        isMet: false
      },
      {
        type: 'skill',
        requirement: 'alchemy',
        value: 10,
        description: 'Requires Alchemy skill 10',
        isMet: false
      }
    ]
  },

  // ARCHAEOLOGICAL LOCATIONS
  {
    locationId: 'victorian_ruins',
    name: 'Victorian Era Ruins',
    bonusModifiers: {
      'archaeological_yield': 0.2,
      'artifact_quality': 0.1,
      'experience': 0.15
    },
    requirements: [
      {
        type: 'level',
        requirement: 6,
        description: 'Requires level 6 to access',
        isMet: false
      }
    ]
  },
  {
    locationId: 'lost_atlantean_city',
    name: 'Lost Atlantean City',
    bonusModifiers: {
      'archaeological_yield': 0.35,
      'artifact_quality': 0.3,
      'rare_find': 0.15
    },
    requirements: [
      {
        type: 'level',
        requirement: 20,
        description: 'Requires level 20 to access',
        isMet: false
      },
      {
        type: 'item',
        requirement: 'atlantean_map',
        description: 'Requires Atlantean Map',
        isMet: false
      }
    ]
  },

  // ELECTRICAL LOCATIONS
  {
    locationId: 'tesla_laboratory',
    name: 'Tesla\'s Laboratory',
    bonusModifiers: {
      'electrical_yield': 0.2,
      'component_quality': 0.15,
      'experience': 0.1
    },
    requirements: [
      {
        type: 'level',
        requirement: 10,
        description: 'Requires level 10 to access',
        isMet: false
      }
    ]
  },
  {
    locationId: 'storm_observatory',
    name: 'Storm Observatory Tower',
    bonusModifiers: {
      'electrical_yield': 0.3,
      'lightning_quality': 0.25,
      'rare_find': 0.12
    },
    requirements: [
      {
        type: 'level',
        requirement: 18,
        description: 'Requires level 18 to access',
        isMet: false
      },
      {
        type: 'equipment',
        requirement: 'insulated_gear',
        description: 'Requires Insulated Gear',
        isMet: false
      }
    ]
  },

  // AERONAUTICAL LOCATIONS
  {
    locationId: 'airship_dock',
    name: 'Imperial Airship Docks',
    bonusModifiers: {
      'aeronautical_yield': 0.15,
      'component_quality': 0.1,
      'experience': 0.15
    },
    requirements: [
      {
        type: 'level',
        requirement: 8,
        description: 'Requires level 8 to access',
        isMet: false
      }
    ]
  },
  {
    locationId: 'cloud_citadel',
    name: 'Cloud Citadel',
    bonusModifiers: {
      'aeronautical_yield': 0.3,
      'sky_material_quality': 0.25,
      'rare_find': 0.15
    },
    requirements: [
      {
        type: 'level',
        requirement: 25,
        description: 'Requires level 25 to access',
        isMet: false
      },
      {
        type: 'item',
        requirement: 'celestial_compass',
        description: 'Requires Celestial Compass',
        isMet: false
      }
    ]
  },

  // METALLURGICAL LOCATIONS
  {
    locationId: 'iron_mines',
    name: 'Ironclad Mines',
    bonusModifiers: {
      'metallurgical_yield': 0.15,
      'ore_quality': 0.1,
      'experience': 0.05
    },
    requirements: [
      {
        type: 'level',
        requirement: 2,
        description: 'Requires level 2 to access',
        isMet: false
      }
    ]
  },
  {
    locationId: 'adamantine_caverns',
    name: 'Adamantine Caverns',
    bonusModifiers: {
      'metallurgical_yield': 0.35,
      'rare_metal_quality': 0.3,
      'rare_find': 0.2
    },
    requirements: [
      {
        type: 'level',
        requirement: 30,
        description: 'Requires level 30 to access',
        isMet: false
      },
      {
        type: 'equipment',
        requirement: 'reinforced_mining_gear',
        description: 'Requires Reinforced Mining Gear',
        isMet: false
      }
    ]
  }
];

/**
 * Get appropriate harvesting locations for a specific activity category
 */
export function getLocationsForCategory(category: HarvestingCategory): HarvestingLocation[] {
  switch (category) {
    case HarvestingCategory.LITERARY:
      return HARVESTING_LOCATIONS.filter(loc => 
        loc.locationId === 'grand_library' || 
        loc.locationId === 'inventors_archive');
    
    case HarvestingCategory.MECHANICAL:
      return HARVESTING_LOCATIONS.filter(loc => 
        loc.locationId === 'clocktower_workshop' || 
        loc.locationId === 'abandoned_factory');
    
    case HarvestingCategory.ALCHEMICAL:
      return HARVESTING_LOCATIONS.filter(loc => 
        loc.locationId === 'botanical_gardens' || 
        loc.locationId === 'alchemists_laboratory');
    
    case HarvestingCategory.ARCHAEOLOGICAL:
      return HARVESTING_LOCATIONS.filter(loc => 
        loc.locationId === 'victorian_ruins' || 
        loc.locationId === 'lost_atlantean_city');
    
    case HarvestingCategory.ELECTRICAL:
      return HARVESTING_LOCATIONS.filter(loc => 
        loc.locationId === 'tesla_laboratory' || 
        loc.locationId === 'storm_observatory');
    
    case HarvestingCategory.AERONAUTICAL:
      return HARVESTING_LOCATIONS.filter(loc => 
        loc.locationId === 'airship_dock' || 
        loc.locationId === 'cloud_citadel');
    
    case HarvestingCategory.METALLURGICAL:
      return HARVESTING_LOCATIONS.filter(loc => 
        loc.locationId === 'iron_mines' || 
        loc.locationId === 'adamantine_caverns');
    
    default:
      return [];
  }
}

/**
 * Get the best available location for a player based on level and requirements
 */
export function getBestAvailableLocation(
  category: HarvestingCategory,
  playerLevel: number,
  playerInventory: { [itemId: string]: number },
  playerEquipment: { [slot: string]: any }
): HarvestingLocation | null {
  const locations = getLocationsForCategory(category);
  
  // Filter locations by player level and requirements
  const availableLocations = locations.filter(location => {
    // Check all requirements
    for (const req of location.requirements) {
      if (req.type === 'level' && playerLevel < (req.requirement as number)) {
        return false;
      }
      
      if (req.type === 'item' && !playerInventory[req.requirement as string]) {
        return false;
      }
      
      if (req.type === 'equipment' && !playerEquipment[req.requirement as string]) {
        return false;
      }
    }
    
    return true;
  });
  
  // Return the highest bonus location available
  if (availableLocations.length === 0) {
    return null;
  }
  
  // Sort by total bonus value (sum of all modifiers)
  return availableLocations.sort((a, b) => {
    const aTotal = Object.values(a.bonusModifiers).reduce((sum, val) => sum + val, 0);
    const bTotal = Object.values(b.bonusModifiers).reduce((sum, val) => sum + val, 0);
    return bTotal - aTotal;
  })[0];
}