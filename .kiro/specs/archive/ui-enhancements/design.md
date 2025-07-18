# Design Document

## Overview

This design implements the core game features as interactive components, transforming the static Game Features list into a fully functional game system. The implementation includes a comprehensive modal system, persistent chat interface, detailed character panel, functional leaderboards, and a reorganized dashboard layout with sidebar navigation.

## Architecture

### Implemented Layout Structure
- **Left Sidebar Navigation**: Clean game features menu for easy access
- **Persistent Chat System**: Always-visible chat interface at bottom of screen
- **Modal System**: Feature components open in responsive modal overlays
- **Dashboard Layout**: Two-column layout with sidebar and main content area

### Component Integration
- **FeatureModal**: Reusable modal component with keyboard support and responsive sizing
- **ChatInterface**: Persistent chat with multiple channels (Global, Guild, Trade, Help)
- **CharacterPanel**: Comprehensive character information with tabbed interface
- **LeaderboardHub**: Functional ranking system with multiple categories
- **Sidebar Navigation**: Clickable game features menu with hover animations

## Components and Interfaces

### Modal Management System

```typescript
interface FeatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

interface GameFeatureState {
  activeFeature: string | null;
  modalOpen: boolean;
}
```

### Guild Management Component

```typescript
interface Guild {
  guildId: string;
  name: string;
  description: string;
  leaderId: string;
  members: GuildMember[];
  level: number;
  experience: number;
  createdAt: Date;
}

interface GuildMember {
  userId: string;
  username: string;
  role: 'leader' | 'officer' | 'member';
  joinedAt: Date;
  contributionPoints: number;
}
```

### Chat System Component

```typescript
interface ChatChannel {
  channelId: string;
  name: string;
  type: 'global' | 'guild' | 'private';
  participants: string[];
}

interface ChatMessage {
  messageId: string;
  channelId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'system' | 'achievement';
}
```

### Leaderboard Component

```typescript
interface LeaderboardEntry {
  userId: string;
  username: string;
  level: number;
  experience: number;
  currency: number;
  guildName?: string;
  rank: number;
}

interface LeaderboardData {
  type: 'level' | 'experience' | 'currency' | 'guild';
  entries: LeaderboardEntry[];
  playerRank?: number;
  lastUpdated: Date;
}
```

### Crafting System Component

```typescript
interface CraftingRecipe {
  recipeId: string;
  name: string;
  description: string;
  requiredMaterials: MaterialRequirement[];
  resultItem: Item;
  craftingTime: number;
  skillRequirement: number;
  experience: number;
}

interface MaterialRequirement {
  itemId: string;
  quantity: number;
}
```

## Data Models

### Feature State Management
Each feature will have its own Redux slice:
- `guildSlice`: Guild membership, guild data, member management
- `chatSlice`: Messages, channels, online status
- `leaderboardSlice`: Rankings, player positions, filters
- `craftingSlice`: Recipes, materials, active crafting jobs
- `inventorySlice`: Items, resources, equipment

### Real-time Updates
- WebSocket integration for chat messages
- Periodic polling for leaderboard updates
- Event-driven updates for guild changes
- Progress tracking for crafting and harvesting

## Error Handling

### Component-Level Error Boundaries
- Each feature component wrapped in error boundaries
- Graceful degradation when features fail to load
- User-friendly error messages with retry options

### Service-Level Error Handling
- Network error recovery with retry logic
- Offline mode support where applicable
- Data validation and sanitization

## Testing Strategy

### Component Testing
- Unit tests for each feature component
- Integration tests for modal system
- User interaction testing with React Testing Library

### Service Testing
- Mock services for development mode
- API integration testing
- Real-time feature testing (chat, leaderboards)

## Implementation Phases

### Phase 1: Modal System and Navigation
- Implement feature modal system
- Add click handlers to Game Features list
- Create base feature component structure

### Phase 2: Core Features
- Implement Guild Management interface
- Add Chat System with basic messaging
- Create Leaderboards with ranking display

### Phase 3: Enhanced Features
- Expand Crafting System with recipe management
- Enhance Resource Harvesting interface
- Implement Combat System mechanics

### Phase 4: Integration and Polish
- Real-time updates and WebSocket integration
- Performance optimization
- UI/UX improvements and animations

### Harvesting Reward System Component

```typescript
interface HarvestReward {
  primaryMaterial: {
    itemId: string;
    quantity: number;
  };
  exoticItem?: {
    itemId: string;
    quantity: number;
    rarity: 'rare' | 'epic' | 'legendary';
  };
  skillGained: number;
}

interface ExoticItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'rare' | 'epic' | 'legendary';
  category: HarvestingCategory;
  baseDropRate: number; // Very low, < 0.01
  value: number;
}

interface HarvestingSkillData {
  categoryLevels: Record<HarvestingCategory, number>;
  categoryExperience: Record<HarvestingCategory, number>;
  totalHarvests: number;
  exoticItemsFound: number;
}
```

## Data Models

### Harvesting Reward System
- **Primary Material Mapping**: Each activity yields one specific primary material
- **Exotic Item Database**: Category-specific rare items with <1% base drop rates
- **Skill Progression**: Harvesting skill levels that slightly improve exotic discovery rates
- **Reward Calculation**: Formula combining base rates with skill bonuses

### Primary Material Categories
- Literary Pursuits → Ancient Manuscripts, Rare Books, Research Notes
- Mechanical Tinkering → Gears, Springs, Mechanical Parts
- Alchemical Studies → Chemical Compounds, Rare Reagents, Catalysts
- Archaeological Expeditions → Artifacts, Ancient Tools, Historical Items
- Botanical Research → Rare Seeds, Plant Specimens, Botanical Samples
- Metallurgical Mining → Metal Ores, Refined Metals, Alloys
- Electrical Experiments → Electrical Components, Conductors, Insulators
- Aeronautical Adventures → Flight Components, Navigation Tools, Aerodynamic Parts

### Exotic Item System
- **Base Drop Rate**: 0.5% (0.005) for all exotic items
- **Skill Bonus Formula**: `baseChance * (1 + (skillLevel * 0.02))`
- **Maximum Bonus**: 100% increase at skill level 50 (1% total chance)
- **Category-Specific Items**: Thematic exotic items matching each harvesting category

## User Experience Design

### Modal Interface
- Consistent modal design across all features
- Easy navigation between different feature sections
- Responsive design for different screen sizes

### Feature Discovery
- Clear visual indicators for available features
- Tooltips and help text for new players
- Progressive disclosure of advanced features

### Harvesting Reward Feedback
- Clear display of primary material received
- Exciting notifications for exotic item discoveries
- Skill progression indicators showing exotic chance improvements
- Statistics tracking for rare finds and skill development

### Performance Considerations
- Lazy loading of feature components
- Efficient state management to prevent unnecessary re-renders
- Optimized data fetching and caching strategies