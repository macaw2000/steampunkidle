/**
 * Test user setup utility for development
 * This helps create test users with and without characters for testing the mandatory character creation flow
 */

export const setupTestUsers = () => {
  // Only run in development mode
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  const testUsers = {
    // User with character (existing user)
    'test@example.com': {
      userId: 'test-user-1',
      email: 'test@example.com',
      password: 'TestPass123',
      name: 'Test User',
      emailConfirmed: true,
      createdAt: new Date().toISOString(),
    },
    // User without character (new user)
    'newuser@example.com': {
      userId: 'test-user-2',
      email: 'newuser@example.com',
      password: 'TestPass123',
      name: 'New User',
      emailConfirmed: true,
      createdAt: new Date().toISOString(),
    },
  };

  // Store test users in localStorage for mock authentication
  localStorage.setItem('mockUsers', JSON.stringify(testUsers));

  // Create a test character for the first user only
  const testCharacter = {
    characterId: 'char-test-1',
    userId: 'test-user-1',
    name: 'Gearwright Cogsworth',
    level: 5,
    experience: 2500,
    currency: 150,
    stats: {
      strength: 12,
      dexterity: 15,
      intelligence: 18,
      vitality: 10,
      craftingSkills: {
        clockmaking: 300,
        engineering: 200,
        alchemy: 150,
        steamcraft: 100,
        level: 3,
        experience: 750,
      },
      harvestingSkills: {
        mining: 200,
        logging: 150,
        herbalism: 100,
        level: 2,
        experience: 450,
      },
      combatSkills: {
        melee: 180,
        ranged: 120,
        magic: 90,
        level: 2,
        experience: 390,
      },
    },
    specialization: {
      tankProgress: 20,
      healerProgress: 10,
      dpsProgress: 70,
      primaryRole: 'dps',
      secondaryRole: 'tank',
    },
    currentActivity: {
      type: 'crafting' as const,
      startedAt: new Date(),
      data: {
        recipeId: 'clockwork-gear-basic',
        progress: 0.3,
      },
    },
    lastActiveAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Store test character data (simulating what would come from the API)
  localStorage.setItem('testCharacter-test-user-1', JSON.stringify(testCharacter));

  console.log('Test users set up:');
  console.log('1. test@example.com / TestPass123 (HAS character)');
  console.log('2. newuser@example.com / TestPass123 (NO character - will show character creation)');
};

export const clearTestData = () => {
  localStorage.removeItem('mockUsers');
  localStorage.removeItem('testCharacter-test-user-1');
  localStorage.removeItem('mockAuthSession');
  console.log('Test data cleared');
};

// Auto-setup test users in development
if (process.env.NODE_ENV === 'development') {
  setupTestUsers();
}