/**
 * Tests for SpecializationService
 */

import { SpecializationService } from '../specializationService';
import { CharacterStats, Character, CraftingSkillSet, HarvestingSkillSet, CombatSkillSet } from '../../types/character';

describe('SpecializationService', () => {
  const createMockCraftingSkillSet = (level: number = 1, experience: number = 0): CraftingSkillSet => ({
    clockmaking: level,
    engineering: level,
    alchemy: level,
    steamcraft: level,
    level,
    experience,
  });

  const createMockHarvestingSkillSet = (level: number = 1, experience: number = 0): HarvestingSkillSet => ({
    mining: level,
    foraging: level,
    salvaging: level,
    crystal_extraction: level,
    level,
    experience,
  });

  const createMockCombatSkillSet = (level: number = 1, experience: number = 0): CombatSkillSet => ({
    melee: level,
    ranged: level,
    defense: level,
    tactics: level,
    level,
    experience,
  });

  const createMockStats = (overrides: Partial<CharacterStats> = {}): CharacterStats => ({
    strength: 10,
    dexterity: 10,
    intelligence: 10,
    vitality: 10,
    craftingSkills: createMockCraftingSkillSet(1, 0),
    harvestingSkills: createMockHarvestingSkillSet(1, 0),
    combatSkills: createMockCombatSkillSet(1, 0),
    ...overrides,
  });

  const createMockCharacter = (statsOverrides: Partial<CharacterStats> = {}): Character => ({
    userId: 'test-user',
    characterId: 'test-character',
    name: 'TestCharacter',
    level: 1,
    experience: 0,
    currency: 100,
    stats: createMockStats(statsOverrides),
    specialization: {
      tankProgress: 0,
      healerProgress: 0,
      dpsProgress: 0,
      bonuses: [],
    },
    currentActivity: {
      type: 'crafting',
      startedAt: new Date(),
      progress: 0,
      rewards: [],
    },
    lastActiveAt: new Date(),
    createdAt: new Date(),
  });

  describe('calculateSpecializationProgress', () => {
    it('should calculate basic specialization progress', () => {
      const stats = createMockStats();
      const progress = SpecializationService.calculateSpecializationProgress(stats);

      expect(progress.tankProgress).toBeGreaterThanOrEqual(0);
      expect(progress.healerProgress).toBeGreaterThanOrEqual(0);
      expect(progress.dpsProgress).toBeGreaterThanOrEqual(0);
    });

    it('should favor tank specialization for high strength and vitality', () => {
      const stats = createMockStats({
        strength: 25,
        vitality: 30,
        combatSkills: createMockCombatSkillSet(10, 500),
      });

      const progress = SpecializationService.calculateSpecializationProgress(stats);

      expect(progress.tankProgress).toBeGreaterThan(progress.healerProgress);
      expect(progress.tankProgress).toBeGreaterThan(progress.dpsProgress);
    });

    it('should favor healer specialization for high intelligence and crafting skills', () => {
      const stats = createMockStats({
        intelligence: 25,
        vitality: 20,
        craftingSkills: createMockCraftingSkillSet(10, 500),
        harvestingSkills: createMockHarvestingSkillSet(8, 320),
      });

      const progress = SpecializationService.calculateSpecializationProgress(stats);

      expect(progress.healerProgress).toBeGreaterThan(progress.tankProgress);
      expect(progress.healerProgress).toBeGreaterThan(progress.dpsProgress);
    });

    it('should favor DPS specialization for high strength and dexterity', () => {
      const stats = createMockStats({
        strength: 20,
        dexterity: 30,
        combatSkills: createMockCombatSkillSet(10, 500),
      });

      const progress = SpecializationService.calculateSpecializationProgress(stats);

      expect(progress.dpsProgress).toBeGreaterThan(progress.tankProgress);
      expect(progress.dpsProgress).toBeGreaterThan(progress.healerProgress);
    });

    it('should return zero progress for minimal stats', () => {
      const stats = createMockStats({
        strength: 1,
        dexterity: 1,
        intelligence: 1,
        vitality: 1,
        craftingSkills: createMockCraftingSkillSet(1, 0),
        harvestingSkills: createMockHarvestingSkillSet(1, 0),
        combatSkills: createMockCombatSkillSet(1, 0),
      });

      const progress = SpecializationService.calculateSpecializationProgress(stats);

      expect(progress.tankProgress).toBe(0);
      expect(progress.healerProgress).toBe(0);
      expect(progress.dpsProgress).toBe(0);
    });
  });

  describe('determinePrimaryRole', () => {
    it('should return null for low total progress', () => {
      const role = SpecializationService.determinePrimaryRole(10, 15, 20);
      expect(role).toBeNull();
    });

    it('should return tank for high tank progress', () => {
      const role = SpecializationService.determinePrimaryRole(100, 50, 50);
      expect(role).toBe('tank');
    });

    it('should return healer for high healer progress', () => {
      const role = SpecializationService.determinePrimaryRole(50, 100, 50);
      expect(role).toBe('healer');
    });

    it('should return dps for high DPS progress', () => {
      const role = SpecializationService.determinePrimaryRole(50, 50, 100);
      expect(role).toBe('dps');
    });

    it('should return null when no role dominates', () => {
      const role = SpecializationService.determinePrimaryRole(60, 60, 60);
      expect(role).toBeNull();
    });

    it('should require 40% threshold for primary role', () => {
      // 39% tank, should not be primary
      const role1 = SpecializationService.determinePrimaryRole(39, 39, 39);
      expect(role1).toBeNull(); // All equal, no primary role

      // 42% tank, should be primary
      const role2 = SpecializationService.determinePrimaryRole(120, 70, 70);
      expect(role2).toBe('tank'); // 120/260 = 46.2%
    });
  });

  describe('calculateSpecializationBonuses', () => {
    it('should return empty bonuses for low progress', () => {
      const bonuses = SpecializationService.calculateSpecializationBonuses(50, 50, 50);
      expect(bonuses).toHaveLength(0);
    });

    it('should add stat bonuses for progress milestones', () => {
      const bonuses = SpecializationService.calculateSpecializationBonuses(150, 200, 100);
      
      const fortificationBonus = bonuses.find(b => b.name === 'Fortification');
      const wisdomBonus = bonuses.find(b => b.name === 'Wisdom');
      
      expect(fortificationBonus).toBeDefined();
      expect(fortificationBonus?.value).toBe(3); // floor(150/50)
      expect(wisdomBonus).toBeDefined();
      expect(wisdomBonus?.value).toBe(4); // floor(200/50)
    });

    it('should add primary role ability bonuses', () => {
      const tankBonuses = SpecializationService.calculateSpecializationBonuses(100, 50, 50, 'tank');
      const healerBonuses = SpecializationService.calculateSpecializationBonuses(50, 100, 50, 'healer');
      const dpsBonuses = SpecializationService.calculateSpecializationBonuses(50, 50, 100, 'dps');

      expect(tankBonuses.find(b => b.name === 'Steampunk Aegis')).toBeDefined();
      expect(healerBonuses.find(b => b.name === 'Alchemical Restoration')).toBeDefined();
      expect(dpsBonuses.find(b => b.name === 'Clockwork Precision')).toBeDefined();
    });

    it('should combine stat and ability bonuses', () => {
      const bonuses = SpecializationService.calculateSpecializationBonuses(150, 100, 100, 'tank');
      
      expect(bonuses.find(b => b.name === 'Fortification')).toBeDefined();
      expect(bonuses.find(b => b.name === 'Steampunk Aegis')).toBeDefined();
      expect(bonuses.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('updateCharacterSpecialization', () => {
    it('should update character specialization based on stats', () => {
      const character = createMockCharacter({
        strength: 20,
        vitality: 25,
        combatSkills: createMockCombatSkillSet(5, 125),
      });

      const specialization = SpecializationService.updateCharacterSpecialization(character);

      expect(specialization.tankProgress).toBeGreaterThan(0);
      expect(specialization.healerProgress).toBeGreaterThanOrEqual(0);
      expect(specialization.dpsProgress).toBeGreaterThanOrEqual(0);
      expect(specialization.bonuses).toBeDefined();
    });

    it('should determine primary role for high specialization', () => {
      const character = createMockCharacter({
        strength: 30,
        vitality: 35,
        combatSkills: createMockCombatSkillSet(15, 1125),
        craftingSkills: createMockCraftingSkillSet(10, 500),
      });

      const specialization = SpecializationService.updateCharacterSpecialization(character);

      expect(specialization.primaryRole).toBe('tank');
    });
  });

  describe('getSpecializationDisplay', () => {
    it('should return display information for specialization', () => {
      const specialization = {
        tankProgress: 100,
        healerProgress: 150,
        dpsProgress: 50,
        primaryRole: 'healer' as const,
        bonuses: [],
      };

      const display = SpecializationService.getSpecializationDisplay(specialization);

      expect(display.totalProgress).toBe(300);
      expect(display.percentages.tank).toBe(33); // 100/300 * 100, rounded
      expect(display.percentages.healer).toBe(50); // 150/300 * 100
      expect(display.percentages.dps).toBe(17); // 50/300 * 100, rounded
      expect(display.primaryRoleDisplay).toBe('Gear Medic');
      expect(display.roleNames.tank).toBe('Steam Guardian');
      expect(display.roleNames.healer).toBe('Gear Medic');
      expect(display.roleNames.dps).toBe('Clockwork Striker');
    });

    it('should handle zero progress', () => {
      const specialization = {
        tankProgress: 0,
        healerProgress: 0,
        dpsProgress: 0,
        bonuses: [],
      };

      const display = SpecializationService.getSpecializationDisplay(specialization);

      expect(display.totalProgress).toBe(0);
      expect(display.percentages.tank).toBe(0);
      expect(display.percentages.healer).toBe(0);
      expect(display.percentages.dps).toBe(0);
      expect(display.primaryRoleDisplay).toBeUndefined();
    });
  });

  describe('applySpecializationBonuses', () => {
    it('should apply stat bonuses to character stats', () => {
      const baseStats = createMockStats();
      const bonuses = [
        {
          type: 'stat' as const,
          name: 'Fortification',
          value: 5,
          description: '+5 Vitality from tank specialization',
        },
        {
          type: 'stat' as const,
          name: 'Wisdom',
          value: 3,
          description: '+3 Intelligence from healer specialization',
        },
        {
          type: 'stat' as const,
          name: 'Precision',
          value: 4,
          description: '+4 Dexterity from DPS specialization',
        },
      ];

      const modifiedStats = SpecializationService.applySpecializationBonuses(baseStats, bonuses);

      expect(modifiedStats.vitality).toBe(baseStats.vitality + 5);
      expect(modifiedStats.intelligence).toBe(baseStats.intelligence + 3);
      expect(modifiedStats.dexterity).toBe(baseStats.dexterity + 4);
      expect(modifiedStats.strength).toBe(baseStats.strength); // unchanged
    });

    it('should not modify stats for ability bonuses', () => {
      const baseStats = createMockStats();
      const bonuses = [
        {
          type: 'ability' as const,
          name: 'Steampunk Aegis',
          value: 1,
          description: 'Craft enhanced defensive gear',
        },
      ];

      const modifiedStats = SpecializationService.applySpecializationBonuses(baseStats, bonuses);

      expect(modifiedStats).toEqual(baseStats);
    });

    it('should handle empty bonuses array', () => {
      const baseStats = createMockStats();
      const modifiedStats = SpecializationService.applySpecializationBonuses(baseStats, []);

      expect(modifiedStats).toEqual(baseStats);
    });
  });

  describe('getNextMilestone', () => {
    it('should return next milestone for character with progress', () => {
      const specialization = {
        tankProgress: 150,
        healerProgress: 80,
        dpsProgress: 60,
        bonuses: [],
      };

      const milestone = SpecializationService.getNextMilestone(specialization);

      expect(milestone).toBeDefined();
      expect(milestone?.role).toBe('tank');
      expect(milestone?.currentProgress).toBe(150);
      expect(milestone?.nextMilestone).toBe(200);
      expect(milestone?.progressToNext).toBe(50);
    });

    it('should return null when at maximum milestone', () => {
      const specialization = {
        tankProgress: 1500,
        healerProgress: 800,
        dpsProgress: 600,
        bonuses: [],
      };

      const milestone = SpecializationService.getNextMilestone(specialization);

      expect(milestone).toBeNull();
    });

    it('should find highest progress role', () => {
      const specialization = {
        tankProgress: 50,
        healerProgress: 250,
        dpsProgress: 100,
        bonuses: [],
      };

      const milestone = SpecializationService.getNextMilestone(specialization);

      expect(milestone?.role).toBe('healer');
      expect(milestone?.currentProgress).toBe(250);
      expect(milestone?.nextMilestone).toBe(300);
    });
  });

  describe('integration tests', () => {
    it('should handle complete specialization workflow', () => {
      // Create a character with very high tank-focused stats to ensure primary role
      const character = createMockCharacter({
        strength: 40,
        vitality: 45,
        dexterity: 15,
        intelligence: 15,
        combatSkills: createMockCombatSkillSet(20, 2000),
        craftingSkills: createMockCraftingSkillSet(15, 1125),
        harvestingSkills: createMockHarvestingSkillSet(5, 125),
      });

      // Update specialization
      const specialization = SpecializationService.updateCharacterSpecialization(character);

      // Should have tank as primary role
      expect(specialization.primaryRole).toBe('tank');
      expect(specialization.tankProgress).toBeGreaterThan(specialization.healerProgress);
      expect(specialization.tankProgress).toBeGreaterThan(specialization.dpsProgress);

      // Should have bonuses
      expect(specialization.bonuses.length).toBeGreaterThan(0);
      expect(specialization.bonuses.find(b => b.name === 'Steampunk Aegis')).toBeDefined();

      // Get display information
      const display = SpecializationService.getSpecializationDisplay(specialization);
      expect(display.primaryRoleDisplay).toBe('Steam Guardian');
      expect(display.totalProgress).toBeGreaterThan(0);

      // Get next milestone - should be for the highest progress role
      const milestone = SpecializationService.getNextMilestone(specialization);
      if (milestone) {
        // The role should be whichever has the highest progress
        expect(['tank', 'healer', 'dps']).toContain(milestone.role);
      } else {
        // If no milestone, it means all progress is at max level
        expect(specialization.tankProgress).toBeGreaterThanOrEqual(1000);
      }
    });
  });
});