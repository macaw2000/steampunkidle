"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CraftingService = void 0;
const craftingRecipes_1 = require("../data/craftingRecipes");
class CraftingService {
    static calculateSkillLevel(experience) {
        return Math.floor(Math.sqrt(experience / 75)) + 1;
    }
    static calculateExperienceForSkillLevel(level) {
        return Math.pow(level - 1, 2) * 75;
    }
    static calculateQualityModifier(skillLevel, requiredLevel, workstationBonus = 0) {
        const skillAdvantage = Math.max(0, skillLevel - requiredLevel);
        const baseQuality = 0.8 + (skillAdvantage * 0.05);
        const workstationMultiplier = 1 + (workstationBonus / 100);
        return Math.min(1.5, Math.max(0.8, baseQuality * workstationMultiplier));
    }
    static calculateCraftingTime(baseTime, skillLevel, speedBonus = 0) {
        const skillSpeedBonus = Math.min(0.5, skillLevel * 0.02);
        const totalSpeedBonus = skillSpeedBonus + (speedBonus / 100);
        return Math.max(5, Math.floor(baseTime * (1 - totalSpeedBonus)));
    }
    static checkMaterialRequirements(recipe, playerMaterials) {
        const missingMaterials = [];
        for (const material of recipe.materials) {
            const playerQuantity = playerMaterials[material.materialId] || 0;
            if (playerQuantity < material.quantity) {
                missingMaterials.push(`${material.name} (need ${material.quantity}, have ${playerQuantity})`);
            }
        }
        return {
            hasAllMaterials: missingMaterials.length === 0,
            missingMaterials
        };
    }
    static getAvailableRecipes(character) {
        const availableRecipes = [];
        for (const recipe of craftingRecipes_1.CRAFTING_RECIPES) {
            const skillSet = character.stats.craftingSkills;
            const skillLevel = skillSet[recipe.requiredSkill];
            if (skillLevel >= recipe.requiredLevel) {
                availableRecipes.push(recipe);
            }
        }
        return availableRecipes;
    }
    static getUnlockedWorkstations(character) {
        const unlockedWorkstations = [];
        for (const workstation of craftingRecipes_1.CRAFTING_WORKSTATIONS) {
            let canUnlock = true;
            for (const requirement of workstation.requiredSkills) {
                const skillLevel = character.stats.craftingSkills[requirement.skill];
                if (skillLevel < requirement.level) {
                    canUnlock = false;
                    break;
                }
            }
            if (canUnlock) {
                unlockedWorkstations.push(workstation);
            }
        }
        return unlockedWorkstations;
    }
    static async startCrafting(request) {
        try {
            const response = await fetch('/api/crafting/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to start crafting');
            }
            const result = await response.json();
            return result;
        }
        catch (error) {
            console.error('Error starting crafting:', error);
            throw error;
        }
    }
    static async completeCrafting(request) {
        try {
            const response = await fetch('/api/crafting/complete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to complete crafting');
            }
            const result = await response.json();
            return result;
        }
        catch (error) {
            console.error('Error completing crafting:', error);
            throw error;
        }
    }
    static async getCraftingData(request) {
        try {
            const response = await fetch(`/api/crafting/${request.userId}`);
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to get crafting data');
            }
            const result = await response.json();
            return result;
        }
        catch (error) {
            console.error('Error getting crafting data:', error);
            throw error;
        }
    }
    static calculateSkillProgression(currentSkillTree, experienceGain) {
        const newExperience = currentSkillTree.experience + experienceGain;
        const newLevel = this.calculateSkillLevel(newExperience);
        const leveledUp = newLevel > currentSkillTree.level;
        let newRecipesUnlocked = [];
        let updatedUnlockedRecipes = [...currentSkillTree.unlockedRecipes];
        if (leveledUp) {
            const availableRecipes = craftingRecipes_1.CRAFTING_RECIPES.filter(recipe => recipe.requiredSkill === currentSkillTree.skillType &&
                recipe.requiredLevel <= newLevel &&
                !currentSkillTree.unlockedRecipes.includes(recipe.recipeId));
            newRecipesUnlocked = availableRecipes;
            updatedUnlockedRecipes = [
                ...currentSkillTree.unlockedRecipes,
                ...availableRecipes.map(recipe => recipe.recipeId)
            ];
        }
        const newSkillTree = {
            ...currentSkillTree,
            level: newLevel,
            experience: newExperience,
            unlockedRecipes: updatedUnlockedRecipes
        };
        return {
            newSkillTree,
            leveledUp,
            newRecipesUnlocked
        };
    }
    static getCraftingSpecializations(skillType, skillLevel) {
        const specializations = {
            clockmaking: [
                {
                    specializationId: 'precision-clockwork',
                    name: 'Precision Clockwork',
                    description: 'Master of intricate mechanisms and precise timing',
                    requiredLevel: 5,
                    bonuses: [
                        { type: 'quality', value: 15, description: '+15% quality for clockwork items' },
                        { type: 'experience', value: 10, description: '+10% experience from clockmaking' }
                    ],
                    isUnlocked: skillLevel >= 5
                },
                {
                    specializationId: 'automaton-creator',
                    name: 'Automaton Creator',
                    description: 'Specializes in creating mechanical servants and companions',
                    requiredLevel: 12,
                    bonuses: [
                        { type: 'material_efficiency', value: 20, description: '20% chance to save materials on automaton recipes' },
                        { type: 'speed', value: 25, description: '+25% speed for automaton crafting' }
                    ],
                    isUnlocked: skillLevel >= 12
                }
            ],
            engineering: [
                {
                    specializationId: 'steam-engineer',
                    name: 'Steam Engineer',
                    description: 'Expert in steam-powered machinery and pressure systems',
                    requiredLevel: 6,
                    bonuses: [
                        { type: 'quality', value: 12, description: '+12% quality for steam-powered items' },
                        { type: 'speed', value: 20, description: '+20% speed for engineering recipes' }
                    ],
                    isUnlocked: skillLevel >= 6
                },
                {
                    specializationId: 'weapon-smith',
                    name: 'Weapon Smith',
                    description: 'Master of crafting steam-powered weapons and armor',
                    requiredLevel: 10,
                    bonuses: [
                        { type: 'quality', value: 20, description: '+20% quality for weapons and armor' },
                        { type: 'material_efficiency', value: 15, description: '15% chance to save materials on weapons' }
                    ],
                    isUnlocked: skillLevel >= 10
                }
            ],
            alchemy: [
                {
                    specializationId: 'steam-alchemist',
                    name: 'Steam Alchemist',
                    description: 'Combines traditional alchemy with steam-powered processes',
                    requiredLevel: 4,
                    bonuses: [
                        { type: 'material_efficiency', value: 25, description: '25% chance to save materials in alchemy' },
                        { type: 'experience', value: 15, description: '+15% experience from alchemy' }
                    ],
                    isUnlocked: skillLevel >= 4
                },
                {
                    specializationId: 'enhancement-master',
                    name: 'Enhancement Master',
                    description: 'Creates powerful enhancement serums and elixirs',
                    requiredLevel: 15,
                    bonuses: [
                        { type: 'quality', value: 30, description: '+30% quality for enhancement items' },
                        { type: 'speed', value: 15, description: '+15% speed for complex alchemy' }
                    ],
                    isUnlocked: skillLevel >= 15
                }
            ],
            steamcraft: [
                {
                    specializationId: 'engine-master',
                    name: 'Engine Master',
                    description: 'Specializes in creating powerful steam engines and cores',
                    requiredLevel: 8,
                    bonuses: [
                        { type: 'quality', value: 18, description: '+18% quality for engine components' },
                        { type: 'material_efficiency', value: 20, description: '20% chance to save materials on engines' }
                    ],
                    isUnlocked: skillLevel >= 8
                },
                {
                    specializationId: 'innovation-pioneer',
                    name: 'Innovation Pioneer',
                    description: 'Pushes the boundaries of steam technology',
                    requiredLevel: 18,
                    bonuses: [
                        { type: 'experience', value: 25, description: '+25% experience from steamcraft' },
                        { type: 'speed', value: 30, description: '+30% speed for all steamcraft recipes' }
                    ],
                    isUnlocked: skillLevel >= 18
                }
            ]
        };
        return specializations[skillType] || [];
    }
    static getRecipeById(recipeId) {
        return craftingRecipes_1.CRAFTING_RECIPES.find(recipe => recipe.recipeId === recipeId) || null;
    }
    static getWorkstationById(workstationId) {
        return craftingRecipes_1.CRAFTING_WORKSTATIONS.find(workstation => workstation.workstationId === workstationId) || null;
    }
    static formatCraftingTime(seconds) {
        if (seconds < 60) {
            return `${seconds}s`;
        }
        else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
        }
        else {
            const hours = Math.floor(seconds / 3600);
            const remainingMinutes = Math.floor((seconds % 3600) / 60);
            return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
        }
    }
    static getSkillTreeDisplay(skillType) {
        const skillInfo = {
            clockmaking: {
                name: 'Clockmaking',
                description: 'The art of creating intricate clockwork mechanisms and timepieces',
                icon: '⚙️',
                color: '#d4af37'
            },
            engineering: {
                name: 'Engineering',
                description: 'Mastery of steam-powered machinery and mechanical systems',
                icon: '🔧',
                color: '#8b6914'
            },
            alchemy: {
                name: 'Alchemy',
                description: 'The science of transmutation and enhancement through steam-infused processes',
                icon: '⚗️',
                color: '#9370db'
            },
            steamcraft: {
                name: 'Steamcraft',
                description: 'Advanced steam technology and engine construction',
                icon: '🚂',
                color: '#cd853f'
            }
        };
        return skillInfo[skillType];
    }
}
exports.CraftingService = CraftingService;
exports.default = CraftingService;
