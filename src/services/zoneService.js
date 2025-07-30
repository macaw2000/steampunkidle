"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZoneService = void 0;
class ZoneService {
    static async startZoneInstance(partyId) {
        const response = await fetch('/api/zone/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ partyId }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to start zone instance');
        }
        const result = await response.json();
        return result.instance;
    }
    static async getZoneInstance(instanceId) {
        try {
            const response = await fetch(`/api/zone/instance/${instanceId}`);
            if (response.status === 404) {
                return null;
            }
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to get zone instance');
            }
            const result = await response.json();
            return result.instance;
        }
        catch (error) {
            console.error('Error getting zone instance:', error);
            throw error;
        }
    }
    static async attackMonster(instanceId, monsterId, userId) {
        const response = await fetch(`/api/zone/instance/${instanceId}/attack`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ monsterId, userId }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to attack monster');
        }
        const result = await response.json();
        return result;
    }
    static async completeZoneInstance(instanceId) {
        const response = await fetch(`/api/zone/instance/${instanceId}/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to complete zone instance');
        }
        const result = await response.json();
        return result.rewards;
    }
    static async leaveZoneInstance(instanceId, userId) {
        const response = await fetch(`/api/zone/instance/${instanceId}/leave`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to leave zone instance');
        }
    }
    static getAvailableZoneTypes(party) {
        const zoneTypes = [];
        if (party.type === 'zone') {
            zoneTypes.push('steam-caverns', 'clockwork-ruins', 'alchemical-gardens');
        }
        else if (party.type === 'dungeon') {
            zoneTypes.push('gear-fortress', 'steam-cathedral', 'mechanized-depths');
        }
        return zoneTypes;
    }
    static calculateDifficulty(party) {
        const avgLevel = party.members.reduce((sum, member) => sum + member.level, 0) / party.members.length;
        const memberCount = party.members.length;
        let difficulty = Math.floor(avgLevel / 10) + 1;
        if (party.type === 'zone') {
            difficulty += Math.max(0, 3 - memberCount);
        }
        else {
            difficulty += Math.max(0, 8 - memberCount) * 0.5;
        }
        return Math.max(1, Math.min(10, difficulty));
    }
    static generateMonsters(zoneType, difficulty, partySize) {
        const monsters = [];
        const monsterCount = partySize + Math.floor(difficulty / 2);
        const monsterTemplates = this.getMonsterTemplates(zoneType);
        for (let i = 0; i < monsterCount; i++) {
            const template = monsterTemplates[Math.floor(Math.random() * monsterTemplates.length)];
            const monster = this.createMonsterFromTemplate(template, difficulty);
            monsters.push(monster);
        }
        return monsters;
    }
    static getMonsterTemplates(zoneType) {
        const templates = {
            'steam-caverns': [
                { name: 'Steam Wraith', type: 'steam', baseStats: { attack: 15, defense: 10, speed: 12 } },
                { name: 'Pressure Golem', type: 'steam', baseStats: { attack: 20, defense: 18, speed: 8 } },
                { name: 'Vapor Sprite', type: 'steam', baseStats: { attack: 12, defense: 8, speed: 16 } }
            ],
            'clockwork-ruins': [
                { name: 'Clockwork Sentinel', type: 'clockwork', baseStats: { attack: 18, defense: 15, speed: 10 } },
                { name: 'Gear Spider', type: 'mechanical', baseStats: { attack: 14, defense: 12, speed: 14 } },
                { name: 'Automaton Guard', type: 'clockwork', baseStats: { attack: 22, defense: 20, speed: 6 } }
            ],
            'alchemical-gardens': [
                { name: 'Toxic Bloom', type: 'alchemical', baseStats: { attack: 16, defense: 8, speed: 11 } },
                { name: 'Mutant Vine', type: 'alchemical', baseStats: { attack: 13, defense: 14, speed: 9 } },
                { name: 'Chemical Elemental', type: 'alchemical', baseStats: { attack: 19, defense: 11, speed: 13 } }
            ],
            'gear-fortress': [
                { name: 'Fortress Guardian', type: 'mechanical', baseStats: { attack: 25, defense: 22, speed: 8 } },
                { name: 'Siege Engine', type: 'mechanical', baseStats: { attack: 30, defense: 25, speed: 5 } },
                { name: 'Gear Warden', type: 'clockwork', baseStats: { attack: 22, defense: 18, speed: 12 } }
            ],
            'steam-cathedral': [
                { name: 'Steam Priest', type: 'steam', baseStats: { attack: 20, defense: 16, speed: 14 } },
                { name: 'Holy Automaton', type: 'clockwork', baseStats: { attack: 24, defense: 20, speed: 10 } },
                { name: 'Divine Mechanism', type: 'mechanical', baseStats: { attack: 28, defense: 24, speed: 8 } }
            ],
            'mechanized-depths': [
                { name: 'Deep Crawler', type: 'mechanical', baseStats: { attack: 26, defense: 19, speed: 11 } },
                { name: 'Abyssal Engine', type: 'steam', baseStats: { attack: 32, defense: 28, speed: 6 } },
                { name: 'Void Construct', type: 'alchemical', baseStats: { attack: 29, defense: 22, speed: 9 } }
            ]
        };
        return templates[zoneType] || templates['steam-caverns'];
    }
    static createMonsterFromTemplate(template, difficulty) {
        const levelMultiplier = 1 + (difficulty - 1) * 0.3;
        const baseLevel = 5 + difficulty * 3;
        const scaledStats = {
            attack: Math.floor(template.baseStats.attack * levelMultiplier),
            defense: Math.floor(template.baseStats.defense * levelMultiplier),
            speed: Math.floor(template.baseStats.speed * levelMultiplier)
        };
        const maxHealth = Math.floor((100 + baseLevel * 15) * levelMultiplier);
        return {
            monsterId: `${template.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: template.name,
            level: baseLevel,
            health: maxHealth,
            maxHealth,
            stats: scaledStats,
            lootTable: this.generateLootTable(difficulty),
            steampunkTheme: {
                type: template.type,
                description: this.getMonsterDescription(template.name, template.type)
            }
        };
    }
    static generateLootTable(difficulty) {
        const loot = [];
        loot.push({
            itemId: 'steam-coins',
            dropChance: 1.0,
            quantity: Math.floor(10 + difficulty * 5 + Math.random() * 20)
        });
        const materialChance = 0.6 + (difficulty * 0.05);
        if (Math.random() < materialChance) {
            loot.push({
                itemId: 'scrap-metal',
                dropChance: materialChance,
                quantity: Math.floor(1 + difficulty * 0.5 + Math.random() * 3)
            });
        }
        const equipmentChance = 0.1 + (difficulty * 0.03);
        if (Math.random() < equipmentChance) {
            const equipmentTypes = ['steam-weapon', 'clockwork-armor', 'alchemical-trinket'];
            const randomEquipment = equipmentTypes[Math.floor(Math.random() * equipmentTypes.length)];
            loot.push({
                itemId: `${randomEquipment}-tier-${Math.min(5, Math.floor(difficulty / 2) + 1)}`,
                dropChance: equipmentChance,
                quantity: 1
            });
        }
        return loot;
    }
    static getMonsterDescription(name, type) {
        const descriptions = {
            'Steam Wraith': 'A ghostly figure wreathed in scalding steam, its form shifting between solid and vapor.',
            'Pressure Golem': 'A massive construct powered by compressed steam, with pipes and gauges covering its body.',
            'Vapor Sprite': 'A small, quick creature made of condensed steam that darts through the air.',
            'Clockwork Sentinel': 'A mechanical guardian with intricate gears and springs, eternally vigilant.',
            'Gear Spider': 'An arachnid automaton with spinning gears for joints and razor-sharp metal legs.',
            'Automaton Guard': 'A heavily armored mechanical soldier with a steam-powered core.',
            'Toxic Bloom': 'A mutated flower that releases poisonous spores and acidic nectar.',
            'Mutant Vine': 'Twisted plant matter enhanced with alchemical compounds, reaching with thorny tendrils.',
            'Chemical Elemental': 'A being of pure alchemical energy, constantly shifting between different compounds.',
            'Fortress Guardian': 'A massive mechanical defender built into the very walls of the fortress.',
            'Siege Engine': 'A mobile war machine bristling with steam-powered weapons and armor plating.',
            'Gear Warden': 'An elite clockwork construct tasked with protecting the fortress\'s most valuable secrets.',
            'Steam Priest': 'A robed figure channeling divine power through steam-powered religious artifacts.',
            'Holy Automaton': 'A sacred mechanical being blessed with divine purpose and righteous fury.',
            'Divine Mechanism': 'A complex machine that serves as a conduit for divine energy and holy steam.',
            'Deep Crawler': 'A multi-legged mechanical beast adapted for navigating the deepest tunnels.',
            'Abyssal Engine': 'A massive steam-powered entity that has dwelt in the depths for centuries.',
            'Void Construct': 'A being of dark alchemical energy, touched by the void between worlds.'
        };
        return descriptions[name] || `A ${type} creature of unknown origin.`;
    }
    static calculateDamage(attackerLevel, attackerStats, monster) {
        const baseAttack = attackerStats.strength || 10;
        const levelBonus = attackerLevel * 2;
        const totalAttack = baseAttack + levelBonus;
        const defense = monster.stats.defense;
        const damage = Math.max(1, totalAttack - Math.floor(defense / 2));
        const variance = Math.floor(damage * 0.2);
        return damage + Math.floor(Math.random() * variance) - Math.floor(variance / 2);
    }
    static generateCompletionRewards(zoneType, difficulty, partyMembers) {
        const rewards = [];
        const baseExp = 50 + difficulty * 25;
        partyMembers.forEach(memberId => {
            rewards.push({
                type: 'experience',
                amount: baseExp + Math.floor(Math.random() * 20),
                recipientId: memberId
            });
        });
        const baseCurrency = 100 + difficulty * 50;
        partyMembers.forEach(memberId => {
            rewards.push({
                type: 'currency',
                amount: baseCurrency + Math.floor(Math.random() * 50),
                recipientId: memberId
            });
        });
        const bonusChance = 0.3 + (difficulty * 0.1);
        partyMembers.forEach(memberId => {
            if (Math.random() < bonusChance) {
                const bonusItems = [
                    'rare-steam-component',
                    'clockwork-blueprint',
                    'alchemical-formula',
                    'mechanical-core'
                ];
                rewards.push({
                    type: 'item',
                    amount: 1,
                    itemId: bonusItems[Math.floor(Math.random() * bonusItems.length)],
                    recipientId: memberId
                });
            }
        });
        return rewards;
    }
}
exports.ZoneService = ZoneService;
exports.default = ZoneService;
