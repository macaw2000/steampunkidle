/**
 * Specialization service for calculating and managing character specialization progress
 */

import { Character, CharacterStats, Specialization, SpecializationRole, SpecializationBonus } from '../types/character';

export interface SpecializationWeights {
  tank: {
    strength: number;
    vitality: number;
    combatSkills: number;
    craftingSkills: number;
  };
  healer: {
    intelligence: number;
    vitality: number;
    craftingSkills: number;
    harvestingSkills: number;
  };
  dps: {
    strength: number;
    dexterity: number;
    combatSkills: number;
    craftingSkills: number;
  };
}

// Weights for calculating specialization progress based on stats and skills
const SPECIALIZATION_WEIGHTS: SpecializationWeights = {
  tank: {
    strength: 0.3,
    vitality: 0.4,
    combatSkills: 0.2,
    craftingSkills: 0.1, // Steampunk tanks craft defensive gear
  },
  healer: {
    intelligence: 0.3,
    vitality: 0.2,
    craftingSkills: 0.3, // Steampunk healers craft healing devices
    harvestingSkills: 0.2, // Gather healing herbs/materials
  },
  dps: {
    strength: 0.25,
    dexterity: 0.35,
    combatSkills: 0.3,
    craftingSkills: 0.1, // Craft weapons and damage items
  },
};

// Thresholds for determining primary role
const PRIMARY_ROLE_THRESHOLD = 0.4; // 40% of total progress
const MINIMUM_PROGRESS_FOR_ROLE = 50; // Minimum progress points needed

export class SpecializationService {
  /**
   * Calculate specialization progress based on character stats and skills
   */
  static calculateSpecializationProgress(stats: CharacterStats): {
    tankProgress: number;
    healerProgress: number;
    dpsProgress: number;
  } {
    // Calculate weighted contributions for each specialization
    const tankContribution = 
      stats.strength * SPECIALIZATION_WEIGHTS.tank.strength +
      stats.vitality * SPECIALIZATION_WEIGHTS.tank.vitality +
      stats.combatSkills.level * SPECIALIZATION_WEIGHTS.tank.combatSkills +
      stats.craftingSkills.level * SPECIALIZATION_WEIGHTS.tank.craftingSkills;

    const healerContribution = 
      stats.intelligence * SPECIALIZATION_WEIGHTS.healer.intelligence +
      stats.vitality * SPECIALIZATION_WEIGHTS.healer.vitality +
      stats.craftingSkills.level * SPECIALIZATION_WEIGHTS.healer.craftingSkills +
      stats.harvestingSkills.level * SPECIALIZATION_WEIGHTS.healer.harvestingSkills;

    const dpsContribution = 
      stats.strength * SPECIALIZATION_WEIGHTS.dps.strength +
      stats.dexterity * SPECIALIZATION_WEIGHTS.dps.dexterity +
      stats.combatSkills.level * SPECIALIZATION_WEIGHTS.dps.combatSkills +
      stats.craftingSkills.level * SPECIALIZATION_WEIGHTS.dps.craftingSkills;

    // Apply scaling factor based on overall character development
    const baseStatTotal = stats.strength + stats.dexterity + stats.intelligence + stats.vitality;
    const skillLevelTotal = stats.craftingSkills.level + stats.harvestingSkills.level + stats.combatSkills.level;
    const scalingFactor = Math.max(0, (baseStatTotal + skillLevelTotal - 6) / 2); // Minimum threshold

    const tankProgress = Math.floor(tankContribution * scalingFactor);
    const healerProgress = Math.floor(healerContribution * scalingFactor);
    const dpsProgress = Math.floor(dpsContribution * scalingFactor);

    return {
      tankProgress: Math.max(0, tankProgress),
      healerProgress: Math.max(0, healerProgress),
      dpsProgress: Math.max(0, dpsProgress),
    };
  }

  /**
   * Determine primary role based on specialization progress
   */
  static determinePrimaryRole(
    tankProgress: number,
    healerProgress: number,
    dpsProgress: number
  ): SpecializationRole | null {
    const totalProgress = tankProgress + healerProgress + dpsProgress;
    
    // Need minimum total progress to have a primary role
    if (totalProgress < MINIMUM_PROGRESS_FOR_ROLE) {
      return null;
    }

    // Calculate percentages
    const tankPercentage = tankProgress / totalProgress;
    const healerPercentage = healerProgress / totalProgress;
    const dpsPercentage = dpsProgress / totalProgress;

    // Determine primary role if one specialization is significantly higher
    if (tankPercentage >= PRIMARY_ROLE_THRESHOLD) {
      return 'tank';
    }
    if (healerPercentage >= PRIMARY_ROLE_THRESHOLD) {
      return 'healer';
    }
    if (dpsPercentage >= PRIMARY_ROLE_THRESHOLD) {
      return 'dps';
    }

    // No clear primary role
    return null;
  }

  /**
   * Calculate specialization bonuses based on progress and primary role
   */
  static calculateSpecializationBonuses(
    tankProgress: number,
    healerProgress: number,
    dpsProgress: number,
    primaryRole?: SpecializationRole
  ): SpecializationBonus[] {
    const bonuses: SpecializationBonus[] = [];

    // Add bonuses based on progress milestones
    if (tankProgress >= 100) {
      bonuses.push({
        type: 'stat',
        name: 'Fortification',
        value: Math.floor(tankProgress / 50),
        description: `+${Math.floor(tankProgress / 50)} Vitality from tank specialization`,
      });
    }

    if (healerProgress >= 100) {
      bonuses.push({
        type: 'stat',
        name: 'Wisdom',
        value: Math.floor(healerProgress / 50),
        description: `+${Math.floor(healerProgress / 50)} Intelligence from healer specialization`,
      });
    }

    if (dpsProgress >= 100) {
      bonuses.push({
        type: 'stat',
        name: 'Precision',
        value: Math.floor(dpsProgress / 50),
        description: `+${Math.floor(dpsProgress / 50)} Dexterity from DPS specialization`,
      });
    }

    // Add primary role bonuses
    if (primaryRole) {
      switch (primaryRole) {
        case 'tank':
          bonuses.push({
            type: 'ability',
            name: 'Steampunk Aegis',
            value: 1,
            description: 'Craft enhanced defensive gear with steam-powered protection',
          });
          break;
        case 'healer':
          bonuses.push({
            type: 'ability',
            name: 'Alchemical Restoration',
            value: 1,
            description: 'Brew powerful healing elixirs and steam-powered medical devices',
          });
          break;
        case 'dps':
          bonuses.push({
            type: 'ability',
            name: 'Clockwork Precision',
            value: 1,
            description: 'Craft precision weapons and explosive steam-powered devices',
          });
          break;
      }
    }

    return bonuses;
  }

  /**
   * Update character specialization based on current stats
   */
  static updateCharacterSpecialization(character: Character): Specialization {
    const progress = this.calculateSpecializationProgress(character.stats);
    const primaryRole = this.determinePrimaryRole(
      progress.tankProgress,
      progress.healerProgress,
      progress.dpsProgress
    );
    const bonuses = this.calculateSpecializationBonuses(
      progress.tankProgress,
      progress.healerProgress,
      progress.dpsProgress,
      primaryRole || undefined
    );

    return {
      tankProgress: progress.tankProgress,
      healerProgress: progress.healerProgress,
      dpsProgress: progress.dpsProgress,
      primaryRole,
      secondaryRole: null, // TODO: Implement secondary role logic
      bonuses,
    };
  }

  /**
   * Get specialization display information
   */
  static getSpecializationDisplay(specialization: Specialization): {
    totalProgress: number;
    percentages: { tank: number; healer: number; dps: number };
    roleNames: { tank: string; healer: string; dps: string };
    primaryRoleDisplay?: string;
  } {
    const totalProgress = specialization.tankProgress + specialization.healerProgress + specialization.dpsProgress;
    
    const percentages = {
      tank: totalProgress > 0 ? Math.round((specialization.tankProgress / totalProgress) * 100) : 0,
      healer: totalProgress > 0 ? Math.round((specialization.healerProgress / totalProgress) * 100) : 0,
      dps: totalProgress > 0 ? Math.round((specialization.dpsProgress / totalProgress) * 100) : 0,
    };

    // Steampunk-themed role names
    const roleNames = {
      tank: 'Steam Guardian',
      healer: 'Gear Medic',
      dps: 'Clockwork Striker',
    };

    const primaryRoleDisplay = specialization.primaryRole 
      ? roleNames[specialization.primaryRole]
      : undefined;

    return {
      totalProgress,
      percentages,
      roleNames,
      primaryRoleDisplay,
    };
  }

  /**
   * Apply specialization bonuses to character stats
   */
  static applySpecializationBonuses(baseStats: CharacterStats, bonuses: SpecializationBonus[]): CharacterStats {
    const modifiedStats = { ...baseStats };

    bonuses.forEach(bonus => {
      if (bonus.type === 'stat') {
        switch (bonus.name) {
          case 'Fortification':
            modifiedStats.vitality += bonus.value;
            break;
          case 'Wisdom':
            modifiedStats.intelligence += bonus.value;
            break;
          case 'Precision':
            modifiedStats.dexterity += bonus.value;
            break;
        }
      }
    });

    return modifiedStats;
  }

  /**
   * Get next specialization milestone information
   */
  static getNextMilestone(specialization: Specialization): {
    role: SpecializationRole;
    currentProgress: number;
    nextMilestone: number;
    progressToNext: number;
  } | null {
    const milestones = [100, 200, 300, 500, 750, 1000];
    
    // Find the role with the highest progress
    let highestRole: SpecializationRole = 'tank';
    let highestProgress = specialization.tankProgress;
    
    if (specialization.healerProgress > highestProgress) {
      highestRole = 'healer';
      highestProgress = specialization.healerProgress;
    }
    
    if (specialization.dpsProgress > highestProgress) {
      highestRole = 'dps';
      highestProgress = specialization.dpsProgress;
    }

    // Find next milestone
    const nextMilestone = milestones.find(milestone => milestone > highestProgress);
    
    if (!nextMilestone) {
      return null; // Already at max milestone
    }

    return {
      role: highestRole,
      currentProgress: highestProgress,
      nextMilestone,
      progressToNext: nextMilestone - highestProgress,
    };
  }
}

export default SpecializationService;