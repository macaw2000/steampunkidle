# Steampunk Theme Component Library

This document provides examples and guidelines for using the Steampunk theme system in the idle game.

## Color Palette

The theme uses CSS custom properties (variables) for consistent theming:

### Primary Colors
- `--steampunk-primary`: #8b4513 (Saddle Brown)
- `--steampunk-primary-light`: #cd853f (Peru)
- `--steampunk-primary-dark`: #654321 (Dark Brown)

### Secondary Colors
- `--steampunk-secondary`: #daa520 (Goldenrod)
- `--steampunk-secondary-light`: #ffd700 (Gold)
- `--steampunk-secondary-dark`: #b8860b (Dark Goldenrod)

### Text Colors
- `--steampunk-text-primary`: #f4e4bc (Cream)
- `--steampunk-text-secondary`: #deb887 (Burlywood)
- `--steampunk-text-muted`: #d4c4a8 (Light Tan)

## Component Classes

### Cards and Containers

#### Basic Card
```html
<div class="steampunk-card">
  <h3 class="steampunk-heading primary">Card Title</h3>
  <p class="steampunk-text">Card content goes here.</p>
</div>
```

#### Elevated Card (with glow effect)
```html
<div class="steampunk-card steampunk-card-elevated">
  <h3 class="steampunk-heading secondary">Important Card</h3>
  <p class="steampunk-text">This card has enhanced visual emphasis.</p>
</div>
```

#### Panel (lighter container)
```html
<div class="steampunk-panel">
  <h4 class="steampunk-heading">Panel Title</h4>
  <p class="steampunk-text muted">Panel content with muted text.</p>
</div>
```

#### Section (minimal container)
```html
<div class="steampunk-section">
  <p class="steampunk-text">Section content</p>
</div>
```

### Buttons

#### Primary Button
```html
<button class="steampunk-btn primary">Primary Action</button>
```

#### Secondary Button
```html
<button class="steampunk-btn secondary">Secondary Action</button>
```

#### Status Buttons
```html
<button class="steampunk-btn success">Success Action</button>
<button class="steampunk-btn warning">Warning Action</button>
<button class="steampunk-btn error">Error Action</button>
```

#### Basic Button
```html
<button class="steampunk-btn">Default Button</button>
```

### Form Elements

#### Input Field
```html
<input type="text" class="steampunk-input" placeholder="Enter text here">
```

#### Select Dropdown
```html
<select class="steampunk-select">
  <option>Option 1</option>
  <option>Option 2</option>
</select>
```

### Progress Bars

#### Basic Progress Bar
```html
<div class="steampunk-progress">
  <div class="steampunk-progress-fill" style="width: 75%"></div>
</div>
```

#### Specialization Progress Bars
```html
<!-- Tank Progress -->
<div class="steampunk-progress">
  <div class="steampunk-progress-fill tank" style="width: 60%"></div>
</div>

<!-- Healer Progress -->
<div class="steampunk-progress">
  <div class="steampunk-progress-fill healer" style="width: 45%"></div>
</div>

<!-- DPS Progress -->
<div class="steampunk-progress">
  <div class="steampunk-progress-fill dps" style="width: 80%"></div>
</div>
```

### Typography

#### Headings
```html
<h1 class="steampunk-heading primary">Primary Heading</h1>
<h2 class="steampunk-heading secondary">Secondary Heading</h2>
<h3 class="steampunk-heading">Default Heading</h3>
```

#### Text Variants
```html
<p class="steampunk-text">Default text</p>
<p class="steampunk-text muted">Muted text</p>
<p class="steampunk-text secondary">Secondary text</p>
<p class="steampunk-text accent">Accent text</p>
```

### Status Indicators

#### Badges
```html
<span class="steampunk-badge success">Online</span>
<span class="steampunk-badge warning">Away</span>
<span class="steampunk-badge error">Offline</span>
<span class="steampunk-badge info">Info</span>
<span class="steampunk-badge primary">Primary</span>
<span class="steampunk-badge secondary">Secondary</span>
```

### Icons and Graphics

#### Character Class Icons
```html
<div class="steampunk-icon medium icon-tank"></div>
<div class="steampunk-icon medium icon-healer"></div>
<div class="steampunk-icon medium icon-dps"></div>
```

#### Activity Icons
```html
<div class="steampunk-icon medium icon-crafting"></div>
<div class="steampunk-icon medium icon-harvesting"></div>
<div class="steampunk-icon medium icon-combat"></div>
```

#### Currency Icon
```html
<div class="steampunk-icon small icon-currency"></div>
```

#### Navigation Icons
```html
<div class="steampunk-icon medium icon-chat"></div>
<div class="steampunk-icon medium icon-marketplace"></div>
<div class="steampunk-icon medium icon-leaderboard"></div>
<div class="steampunk-icon medium icon-group"></div>
```

### Item Placeholders

#### Basic Item Placeholder
```html
<div class="item-placeholder weapon-placeholder sword"></div>
<div class="item-placeholder armor-placeholder helmet"></div>
<div class="item-placeholder trinket-placeholder ring"></div>
<div class="item-placeholder material-placeholder metal"></div>
```

#### Item with Rarity
```html
<div class="item-placeholder weapon-placeholder sword common"></div>
<div class="item-placeholder armor-placeholder helmet rare"></div>
<div class="item-placeholder trinket-placeholder ring epic"></div>
<div class="item-placeholder material-placeholder crystal legendary"></div>
```

### Character Class Representations

```html
<div class="class-representation class-tank"></div>
<div class="class-representation class-healer"></div>
<div class="class-representation class-dps"></div>
```

### Zone and Dungeon Placeholders

```html
<div class="zone-placeholder"></div>
<div class="dungeon-placeholder"></div>
```

### Avatars

```html
<div class="steampunk-avatar small">JD</div>
<div class="steampunk-avatar">AB</div>
<div class="steampunk-avatar large">XY</div>
```

### Guild Emblem

```html
<div class="guild-emblem"></div>
```

### Decorative Elements

#### Animated Gears
```html
<div class="steampunk-gear"></div>
<div class="steampunk-gear fast"></div>
<div class="steampunk-gear slow"></div>
```

#### Loading Spinner
```html
<div class="steampunk-spinner"></div>
```

#### Divider
```html
<hr class="steampunk-divider">
```

### Layout Utilities

#### Grid Layouts
```html
<div class="steampunk-grid steampunk-grid-2">
  <div class="steampunk-card">Card 1</div>
  <div class="steampunk-card">Card 2</div>
  <div class="steampunk-card">Card 3</div>
</div>

<div class="steampunk-grid steampunk-grid-3">
  <div class="steampunk-panel">Panel 1</div>
  <div class="steampunk-panel">Panel 2</div>
  <div class="steampunk-panel">Panel 3</div>
</div>
```

#### Flex Layouts
```html
<div class="steampunk-flex">
  <div class="steampunk-card">Item 1</div>
  <div class="steampunk-card">Item 2</div>
</div>

<div class="steampunk-flex-between">
  <span class="steampunk-text">Left Content</span>
  <span class="steampunk-text accent">Right Content</span>
</div>

<div class="steampunk-flex-center">
  <div class="steampunk-spinner"></div>
  <span class="steampunk-text">Loading...</span>
</div>
```

### Animation Classes

#### Hover Effects
```html
<div class="steampunk-card steampunk-hover-lift">
  <p>This card lifts on hover</p>
</div>
```

#### Pulse Animation
```html
<button class="steampunk-btn primary steampunk-pulse">
  Attention Button
</button>
```

#### Fade In Animation
```html
<div class="steampunk-card steampunk-fade-in">
  <p>This card fades in</p>
</div>
```

### Loading Placeholders

```html
<div class="loading-placeholder text-placeholder short"></div>
<div class="loading-placeholder text-placeholder medium"></div>
<div class="loading-placeholder text-placeholder long"></div>
```

### Decorative Borders

```html
<div class="steampunk-card steampunk-border">
  <p>Card with decorative border</p>
</div>

<div class="steampunk-card steampunk-border ornate">
  <p>Card with ornate border and gear decoration</p>
</div>
```

## Usage Guidelines

### Color Usage
- Use primary colors for main UI elements and navigation
- Use secondary colors for highlights, currency, and important information
- Use text colors consistently for hierarchy (primary > secondary > muted)

### Component Combinations
- Combine base classes with modifier classes for variations
- Use layout utilities to create consistent spacing and alignment
- Apply animation classes sparingly for emphasis

### Responsive Design
- All components are responsive by default
- Use grid and flex utilities for responsive layouts
- Test on different screen sizes to ensure proper scaling

### Accessibility
- Maintain sufficient color contrast for text readability
- Use semantic HTML elements with theme classes
- Ensure interactive elements have proper focus states

### Performance
- CSS variables allow for efficient theme switching
- Animations use CSS transforms for optimal performance
- Icons use CSS-based graphics to reduce image requests

## Examples in Context

### Character Profile Card
```html
<div class="steampunk-card steampunk-card-elevated">
  <div class="steampunk-flex-between">
    <div class="steampunk-flex">
      <div class="steampunk-avatar large">JD</div>
      <div>
        <h3 class="steampunk-heading primary">John Doe</h3>
        <p class="steampunk-text muted">Level 25 Engineer</p>
      </div>
    </div>
    <div class="steampunk-badge success">Online</div>
  </div>
  
  <hr class="steampunk-divider">
  
  <div class="steampunk-grid steampunk-grid-3">
    <div class="steampunk-section">
      <div class="steampunk-icon medium icon-tank"></div>
      <div class="steampunk-progress">
        <div class="steampunk-progress-fill tank" style="width: 60%"></div>
      </div>
    </div>
    <div class="steampunk-section">
      <div class="steampunk-icon medium icon-healer"></div>
      <div class="steampunk-progress">
        <div class="steampunk-progress-fill healer" style="width: 30%"></div>
      </div>
    </div>
    <div class="steampunk-section">
      <div class="steampunk-icon medium icon-dps"></div>
      <div class="steampunk-progress">
        <div class="steampunk-progress-fill dps" style="width: 80%"></div>
      </div>
    </div>
  </div>
</div>
```

### Marketplace Item Card
```html
<div class="steampunk-card steampunk-hover-lift">
  <div class="steampunk-flex-between">
    <div class="steampunk-flex">
      <div class="item-placeholder weapon-placeholder sword epic"></div>
      <div>
        <h4 class="steampunk-heading">Clockwork Blade</h4>
        <span class="steampunk-text rarity-epic">Epic Weapon</span>
      </div>
    </div>
    <div class="steampunk-badge primary">Active</div>
  </div>
  
  <div class="steampunk-flex-between">
    <span class="steampunk-text muted">Current Bid:</span>
    <span class="steampunk-text accent">
      <div class="steampunk-icon small icon-currency"></div>
      1,250
    </span>
  </div>
  
  <div class="steampunk-flex">
    <button class="steampunk-btn primary">Place Bid</button>
    <button class="steampunk-btn success">Buy Now</button>
  </div>
</div>
```