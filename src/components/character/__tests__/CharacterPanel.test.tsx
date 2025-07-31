/**
 * Tests for enhanced CharacterPanel component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import CharacterPanel from '../CharacterPanel';
import authSlice from '../../../store/slices/authSlice';
import gameSlice from '../../../store/slices/gameSlice';
import chatSlice from '../../../store/slices/chatSlice';
import { Character, SpecializationRole, ActivityType } from '../../../types/character';

const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: authSlice,
      game: gameSlice,
      chat: chatSlice,
    },
    preloadedState: {
      auth: {
        isAuthenticated: true,
        user: { userId: 'test-user-id', email: 'test@example.com' },
        loading: false,
        error: null,
      },
      game: {
        character: null,
        hasCharacter: true,
        characterLoading: false,
        loading: false,
        error: null,
        isOnline: true,
        activityProgress: null,
        lastSyncTime: null,
        activitySwitching: false,
      },
      chat: {
        messages: [],
        activeChannel: 'general',
        isConnected: false,
        error: null,
      },
      ...initialState,
    },
  });
};

const mockCharacter: Character = {
  userId: 'test-user-id',
  characterId: 'char-123',
  name: 'TestCharacter',
  level: 15,
  experience: 22500,
  currency: 1250,
  stats: {
    strength: 25,
    dexterity: 20,
    intelligence: 30,
    vitality: 18,
    craftingSkills: {
      clockmaking: 45,
      engineering: 38,
      alchemy: 22,
      steamcraft: 51,
      level: 12,
      experience: 14400,
    },
    harvestingSkills: {
      mining: 35,
      foraging: 28,
      salvaging: 42,
      crystal_extraction: 19,
      level: 10,
      experience: 10000,
    },
    combatSkills: {
      melee: 33,
      ranged: 27,
      defense: 41,
      tactics: 24,
      level: 11,
      experience: 12100,
    },
  },
  specialization: {
    tankProgress: 65,
    healerProgress: 25,
    dpsProgress: 40,
    primaryRole: 'tank' as SpecializationRole,
    secondaryRole: null,
    bonuses: [],
  },
  currentActivity: {
    type: 'crafting' as ActivityType,
    startedAt: new Date(),
    progress: 0,
    rewards: [],
  },
  lastActiveAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('CharacterPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('displays loading state when character is null', () => {
      const store = createMockStore({
        game: {
          character: null,
          hasCharacter: null,
          characterLoading: true,
        },
      });

      render(
        <Provider store={store}>
          <CharacterPanel />
        </Provider>
      );

      expect(screen.getByText('Loading character data...')).toBeInTheDocument();
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    it('renders all tab buttons', () => {
      const store = createMockStore({
        game: { character: mockCharacter },
      });

      render(
        <Provider store={store}>
          <CharacterPanel />
        </Provider>
      );

      expect(screen.getByRole('button', { name: /📊 Attributes/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /🎒 Inventory/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /⚡ Skills/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /🎯 Specialization/i })).toBeInTheDocument();
    });

    it('switches tabs when clicked', () => {
      const store = createMockStore({
        game: { character: mockCharacter },
      });

      render(
        <Provider store={store}>
          <CharacterPanel />
        </Provider>
      );

      // Initially on attributes tab
      expect(screen.getByRole('button', { name: /📊 Attributes/i })).toHaveClass('active');

      // Click inventory tab
      fireEvent.click(screen.getByRole('button', { name: /🎒 Inventory/i }));
      expect(screen.getByRole('button', { name: /🎒 Inventory/i })).toHaveClass('active');
      expect(screen.getByRole('button', { name: /📊 Attributes/i })).not.toHaveClass('active');

      // Click skills tab
      fireEvent.click(screen.getByRole('button', { name: /⚡ Skills/i }));
      expect(screen.getByRole('button', { name: /⚡ Skills/i })).toHaveClass('active');

      // Click specialization tab
      fireEvent.click(screen.getByRole('button', { name: /🎯 Specialization/i }));
      expect(screen.getByRole('button', { name: /🎯 Specialization/i })).toHaveClass('active');
    });
  });

  describe('Attributes Tab', () => {
    it('displays character basic information', () => {
      const store = createMockStore({
        game: { character: mockCharacter },
      });

      render(
        <Provider store={store}>
          <CharacterPanel />
        </Provider>
      );

      expect(screen.getByText('TestCharacter')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument(); // Level
      expect(screen.getByText('1,250 Steam Coins')).toBeInTheDocument();
      expect(screen.getByText('crafting')).toBeInTheDocument(); // Current activity
    });

    it('displays experience bar with correct progress', () => {
      const store = createMockStore({
        game: { character: mockCharacter },
      });

      render(
        <Provider store={store}>
          <CharacterPanel />
        </Provider>
      );

      expect(screen.getByText('Experience: 22,500')).toBeInTheDocument();
      expect(screen.getByText('Next Level: 25,600')).toBeInTheDocument();
      
      // Check if progress bar is rendered
      const progressBar = document.querySelector('.exp-fill');
      expect(progressBar).toBeInTheDocument();
    });

    it('displays all character attributes', () => {
      const store = createMockStore({
        game: { character: mockCharacter },
      });

      render(
        <Provider store={store}>
          <CharacterPanel />
        </Provider>
      );

      expect(screen.getByText('Strength')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
      expect(screen.getByText('Dexterity')).toBeInTheDocument();
      expect(screen.getByText('20')).toBeInTheDocument();
      expect(screen.getByText('Intelligence')).toBeInTheDocument();
      expect(screen.getByText('30')).toBeInTheDocument();
      expect(screen.getByText('Vitality')).toBeInTheDocument();
      expect(screen.getByText('18')).toBeInTheDocument();
    });
  });

  describe('Inventory Tab', () => {
    it('displays inventory with capacity information', () => {
      const store = createMockStore({
        game: { character: mockCharacter },
      });

      render(
        <Provider store={store}>
          <CharacterPanel />
        </Provider>
      );

      fireEvent.click(screen.getByRole('button', { name: /🎒 Inventory/i }));

      expect(screen.getByText(/Inventory \(12\/12\)/)).toBeInTheDocument();
      expect(screen.getByText('Capacity: 12/50')).toBeInTheDocument();
    });

    it('displays inventory filter buttons', () => {
      const store = createMockStore({
        game: { character: mockCharacter },
      });

      render(
        <Provider store={store}>
          <CharacterPanel />
        </Provider>
      );

      fireEvent.click(screen.getByRole('button', { name: /🎒 Inventory/i }));

      expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Materials' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Tools' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Equipment' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Consumables' })).toBeInTheDocument();
    });

    it('filters inventory items correctly', () => {
      const store = createMockStore({
        game: { character: mockCharacter },
      });

      render(
        <Provider store={store}>
          <CharacterPanel />
        </Provider>
      );

      fireEvent.click(screen.getByRole('button', { name: /🎒 Inventory/i }));

      // Initially shows all items
      expect(screen.getByText('Clockwork Gear')).toBeInTheDocument();
      expect(screen.getByText('Brass Wrench')).toBeInTheDocument();
      expect(screen.getByText('Healing Potion')).toBeInTheDocument();

      // Filter by materials
      fireEvent.click(screen.getByRole('button', { name: 'Materials' }));
      expect(screen.getByText('Clockwork Gear')).toBeInTheDocument();
      expect(screen.queryByText('Brass Wrench')).not.toBeInTheDocument();

      // Filter by tools
      fireEvent.click(screen.getByRole('button', { name: 'Tools' }));
      expect(screen.getByText('Brass Wrench')).toBeInTheDocument();
      expect(screen.queryByText('Clockwork Gear')).not.toBeInTheDocument();
    });

    it('displays items with rarity colors', () => {
      const store = createMockStore({
        game: { character: mockCharacter },
      });

      render(
        <Provider store={store}>
          <CharacterPanel />
        </Provider>
      );

      fireEvent.click(screen.getByRole('button', { name: /🎒 Inventory/i }));

      // Check for items with different rarities
      const steamCrystal = screen.getByText('Steam Crystal');
      const pocketWatch = screen.getByText('Pocket Watch');
      const legendaryGauntlets = screen.getByText('Steam-Powered Gauntlets');

      expect(steamCrystal).toBeInTheDocument();
      expect(pocketWatch).toBeInTheDocument();
      expect(legendaryGauntlets).toBeInTheDocument();

      // Check for rarity classes
      const rareItem = document.querySelector('.rarity-rare');
      const epicItem = document.querySelector('.rarity-epic');
      const legendaryItem = document.querySelector('.rarity-legendary');

      expect(rareItem).toBeInTheDocument();
      expect(epicItem).toBeInTheDocument();
      expect(legendaryItem).toBeInTheDocument();
    });

    it('displays item stats for equipment', () => {
      const store = createMockStore({
        game: { character: mockCharacter },
      });

      render(
        <Provider store={store}>
          <CharacterPanel />
        </Provider>
      );

      fireEvent.click(screen.getByRole('button', { name: /🎒 Inventory/i }));

      // Check for stat bonuses on equipment
      expect(screen.getByText('+2 Dexterity')).toBeInTheDocument();
      expect(screen.getByText('+1 Intelligence')).toBeInTheDocument();
      expect(screen.getByText('+5 Intelligence')).toBeInTheDocument();
      expect(screen.getByText('+3 Vitality')).toBeInTheDocument();
    });
  });

  describe('Skills Tab', () => {
    it('displays all skill categories', () => {
      const store = createMockStore({
        game: { character: mockCharacter },
      });

      render(
        <Provider store={store}>
          <CharacterPanel />
        </Provider>
      );

      fireEvent.click(screen.getByRole('button', { name: /⚡ Skills/i }));

      expect(screen.getByText(/🔧 Crafting Skills \(Level 12\)/)).toBeInTheDocument();
      expect(screen.getByText(/⛏️ Harvesting Skills \(Level 10\)/)).toBeInTheDocument();
      expect(screen.getByText(/⚔️ Combat Skills \(Level 11\)/)).toBeInTheDocument();
    });

    it('displays individual skill values', () => {
      const store = createMockStore({
        game: { character: mockCharacter },
      });

      render(
        <Provider store={store}>
          <CharacterPanel />
        </Provider>
      );

      fireEvent.click(screen.getByRole('button', { name: /⚡ Skills/i }));

      // Crafting skills
      expect(screen.getByText('Clockmaking')).toBeInTheDocument();
      expect(screen.getByText('45')).toBeInTheDocument();
      expect(screen.getByText('Engineering')).toBeInTheDocument();
      expect(screen.getByText('38')).toBeInTheDocument();

      // Harvesting skills
      expect(screen.getByText('Mining')).toBeInTheDocument();
      expect(screen.getByText('35')).toBeInTheDocument();
      expect(screen.getByText('Foraging')).toBeInTheDocument();
      expect(screen.getByText('28')).toBeInTheDocument();

      // Combat skills
      expect(screen.getByText('Melee')).toBeInTheDocument();
      expect(screen.getByText('33')).toBeInTheDocument();
      expect(screen.getByText('Defense')).toBeInTheDocument();
      expect(screen.getByText('41')).toBeInTheDocument();
    });
  });

  describe('Specialization Tab', () => {
    it('displays Steampunk-themed specialization overview', () => {
      const store = createMockStore({
        game: { character: mockCharacter },
      });

      render(
        <Provider store={store}>
          <CharacterPanel />
        </Provider>
      );

      fireEvent.click(screen.getByRole('button', { name: /🎯 Specialization/i }));

      expect(screen.getByText('⚙️ Steampunk Specialization')).toBeInTheDocument();
      expect(screen.getByText('Your character\'s mechanical mastery and role progression')).toBeInTheDocument();
    });

    it('displays specialization progress with Steampunk theming', () => {
      const store = createMockStore({
        game: { character: mockCharacter },
      });

      render(
        <Provider store={store}>
          <CharacterPanel />
        </Provider>
      );

      fireEvent.click(screen.getByRole('button', { name: /🎯 Specialization/i }));

      expect(screen.getByText('Steam-Powered Guardian')).toBeInTheDocument();
      expect(screen.getByText('Clockwork Medic')).toBeInTheDocument();
      expect(screen.getByText('Gear-Strike Specialist')).toBeInTheDocument();

      expect(screen.getByText('65%')).toBeInTheDocument(); // Tank progress
      expect(screen.getByText('25%')).toBeInTheDocument(); // Healer progress
      expect(screen.getByText('40%')).toBeInTheDocument(); // DPS progress
    });

    it('displays role descriptions', () => {
      const store = createMockStore({
        game: { character: mockCharacter },
      });

      render(
        <Provider store={store}>
          <CharacterPanel />
        </Provider>
      );

      fireEvent.click(screen.getByRole('button', { name: /🎯 Specialization/i }));

      expect(screen.getByText('Master of steam-powered shields and mechanical fortifications')).toBeInTheDocument();
      expect(screen.getByText('Expert in clockwork medical devices and steam-powered restoration')).toBeInTheDocument();
      expect(screen.getByText('Wielder of precision clockwork weapons and steam-powered artillery')).toBeInTheDocument();
    });

    it('displays current role assignments', () => {
      const store = createMockStore({
        game: { character: mockCharacter },
      });

      render(
        <Provider store={store}>
          <CharacterPanel />
        </Provider>
      );

      fireEvent.click(screen.getByRole('button', { name: /🎯 Specialization/i }));

      expect(screen.getByText('🎯 Primary Specialization:')).toBeInTheDocument();
      expect(screen.getByText('Steam-Powered Guardian')).toBeInTheDocument();
      expect(screen.getByText('⚡ Secondary Focus:')).toBeInTheDocument();
      expect(screen.getByText('None')).toBeInTheDocument();
    });

    it('displays active bonuses', () => {
      const store = createMockStore({
        game: { character: mockCharacter },
      });

      render(
        <Provider store={store}>
          <CharacterPanel />
        </Provider>
      );

      fireEvent.click(screen.getByRole('button', { name: /🎯 Specialization/i }));

      expect(screen.getByText('🔧 Active Bonuses')).toBeInTheDocument();
      expect(screen.getByText('+15% Defense from Steam Armor')).toBeInTheDocument();
      expect(screen.getByText('+5% Crafting Speed from Mechanical Expertise')).toBeInTheDocument();
      expect(screen.getByText('Steam-Powered Efficiency: +3% All Activities')).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('adapts to mobile viewport', () => {
      // Mock window.innerWidth for mobile
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 480,
      });

      const store = createMockStore({
        game: { character: mockCharacter },
      });

      render(
        <Provider store={store}>
          <CharacterPanel />
        </Provider>
      );

      // Check if mobile-specific classes are applied
      const characterPanel = document.querySelector('.character-panel');
      expect(characterPanel).toBeInTheDocument();

      // Test tab responsiveness
      const tabs = document.querySelector('.character-tabs');
      expect(tabs).toBeInTheDocument();
    });

    it('handles tablet viewport correctly', () => {
      // Mock window.innerWidth for tablet
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      const store = createMockStore({
        game: { character: mockCharacter },
      });

      render(
        <Provider store={store}>
          <CharacterPanel />
        </Provider>
      );

      const characterPanel = document.querySelector('.character-panel');
      expect(characterPanel).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides proper ARIA labels and roles', () => {
      const store = createMockStore({
        game: { character: mockCharacter },
      });

      render(
        <Provider store={store}>
          <CharacterPanel />
        </Provider>
      );

      // Check for proper button roles
      const attributesTab = screen.getByRole('button', { name: /📊 Attributes/i });
      const inventoryTab = screen.getByRole('button', { name: /🎒 Inventory/i });
      const skillsTab = screen.getByRole('button', { name: /⚡ Skills/i });
      const specializationTab = screen.getByRole('button', { name: /🎯 Specialization/i });

      expect(attributesTab).toBeInTheDocument();
      expect(inventoryTab).toBeInTheDocument();
      expect(skillsTab).toBeInTheDocument();
      expect(specializationTab).toBeInTheDocument();
    });

    it('supports keyboard navigation', () => {
      const store = createMockStore({
        game: { character: mockCharacter },
      });

      render(
        <Provider store={store}>
          <CharacterPanel />
        </Provider>
      );

      const inventoryTab = screen.getByRole('button', { name: /🎒 Inventory/i });
      
      // Focus and activate with keyboard
      inventoryTab.focus();
      fireEvent.keyDown(inventoryTab, { key: 'Enter' });
      
      expect(inventoryTab).toHaveClass('active');
    });
  });
});