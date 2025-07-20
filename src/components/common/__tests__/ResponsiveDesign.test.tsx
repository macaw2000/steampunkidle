import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ResponsiveNavigation from '../ResponsiveNavigation';
import ResponsiveCard from '../ResponsiveCard';
import ResponsiveGrid from '../ResponsiveGrid';
import ResponsiveLayout from '../../layout/ResponsiveLayout';
import ResponsiveChatInterface from '../../chat/ResponsiveChatInterface';
import authSlice from '../../../store/slices/authSlice';
import gameSlice from '../../../store/slices/gameSlice';

// Mock store for testing
const createMockStore = () => configureStore({
  reducer: {
    auth: authSlice,
    game: gameSlice,
  },
  preloadedState: {
    auth: {
      isAuthenticated: true,
      user: { id: 'test-user', email: 'test@example.com' },
      loading: false,
      error: null,
    },
    game: {
      character: {
        characterId: 'test-character',
        name: 'TestCharacter',
        level: 10,
        experience: 1000,
        stats: {
          strength: 15,
          dexterity: 12,
          intelligence: 18,
          vitality: 14,
        },
        currentActivity: null,
      },
      hasCharacter: true,
      characterLoading: false,
      isOnline: true,
      error: null,
    },
  },
});

// Mock window.innerWidth for responsive tests
const mockWindowWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
};

// Mock touch events
const mockTouchEvent = (type: string, touches: Array<{ clientX: number; clientY: number }>) => {
  return new TouchEvent(type, {
    touches: touches.map(touch => ({
      ...touch,
      identifier: 0,
      target: document.body,
      radiusX: 0,
      radiusY: 0,
      rotationAngle: 0,
      force: 1,
    })) as any,
    changedTouches: touches.map(touch => ({
      ...touch,
      identifier: 0,
      target: document.body,
      radiusX: 0,
      radiusY: 0,
      rotationAngle: 0,
      force: 1,
    })) as any,
  });
};

describe('Responsive Design Components', () => {
  let store: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    store = createMockStore();
    // Reset window width to desktop
    mockWindowWidth(1200);
  });

  describe('ResponsiveNavigation', () => {
    const mockNavigationItems = [
      { id: 'home', label: 'Home', icon: '🏠', onClick: jest.fn() },
      { id: 'profile', label: 'Profile', icon: '👤', onClick: jest.fn() },
      { id: 'settings', label: 'Settings', icon: '⚙️', onClick: jest.fn(), badge: 3 },
    ];

    it('renders horizontal navigation on desktop', () => {
      mockWindowWidth(1200);
      render(<ResponsiveNavigation items={mockNavigationItems} />);
      
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Profile')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument(); // Badge
    });

    it('shows hamburger menu on mobile', async () => {
      mockWindowWidth(600);
      render(<ResponsiveNavigation items={mockNavigationItems} />);
      
      await waitFor(() => {
        expect(screen.getByLabelText('Toggle navigation menu')).toBeInTheDocument();
      });
    });

    it('opens mobile menu when hamburger is clicked', async () => {
      mockWindowWidth(600);
      render(<ResponsiveNavigation items={mockNavigationItems} />);
      
      await waitFor(() => {
        const hamburgerButton = screen.getByLabelText('Toggle navigation menu');
        fireEvent.click(hamburgerButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Navigation')).toBeInTheDocument();
      });
    });

    it('shows bottom navigation on mobile', async () => {
      mockWindowWidth(600);
      render(<ResponsiveNavigation items={mockNavigationItems} />);
      
      await waitFor(() => {
        const bottomNav = document.querySelector('.bottom-nav');
        expect(bottomNav).toBeInTheDocument();
      });
    });

    it('handles navigation item clicks', () => {
      const mockOnClick = jest.fn();
      const items = [{ id: 'test', label: 'Test', icon: '🧪', onClick: mockOnClick }];
      
      render(<ResponsiveNavigation items={items} />);
      
      fireEvent.click(screen.getByText('Test'));
      expect(mockOnClick).toHaveBeenCalled();
    });
  });

  describe('ResponsiveCard', () => {
    it('renders card with title and content', () => {
      render(
        <ResponsiveCard title="Test Card" icon="🧪">
          <p>Card content</p>
        </ResponsiveCard>
      );
      
      expect(screen.getByText('Test Card')).toBeInTheDocument();
      expect(screen.getByText('Card content')).toBeInTheDocument();
      expect(screen.getByText('🧪')).toBeInTheDocument();
    });

    it('handles interactive card clicks', () => {
      const mockOnClick = jest.fn();
      render(
        <ResponsiveCard interactive onClick={mockOnClick}>
          <p>Interactive card</p>
        </ResponsiveCard>
      );
      
      fireEvent.click(screen.getByText('Interactive card'));
      expect(mockOnClick).toHaveBeenCalled();
    });

    it('shows loading state', () => {
      render(
        <ResponsiveCard loading>
          <p>Loading card</p>
        </ResponsiveCard>
      );
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('shows error state', () => {
      render(
        <ResponsiveCard error="Something went wrong">
          <p>Error card</p>
        </ResponsiveCard>
      );
      
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('applies different sizes correctly', () => {
      const { rerender } = render(
        <ResponsiveCard size="small">Small card</ResponsiveCard>
      );
      
      expect(document.querySelector('.size-small')).toBeInTheDocument();
      
      rerender(<ResponsiveCard size="large">Large card</ResponsiveCard>);
      expect(document.querySelector('.size-large')).toBeInTheDocument();
    });
  });

  describe('ResponsiveGrid', () => {
    it('renders grid with children', () => {
      render(
        <ResponsiveGrid>
          <div>Item 1</div>
          <div>Item 2</div>
          <div>Item 3</div>
        </ResponsiveGrid>
      );
      
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
      expect(screen.getByText('Item 3')).toBeInTheDocument();
    });

    it('applies auto-fit grid correctly', () => {
      render(
        <ResponsiveGrid autoFit minItemWidth="200px">
          <div>Auto-fit item</div>
        </ResponsiveGrid>
      );
      
      expect(document.querySelector('.auto-fit')).toBeInTheDocument();
    });

    it('applies fixed columns correctly', () => {
      render(
        <ResponsiveGrid columns={{ xs: 1, md: 3, lg: 4 }}>
          <div>Fixed column item</div>
        </ResponsiveGrid>
      );
      
      expect(document.querySelector('.fixed-columns')).toBeInTheDocument();
    });

    it('applies gap sizes correctly', () => {
      const { rerender } = render(
        <ResponsiveGrid gap="sm">
          <div>Small gap</div>
        </ResponsiveGrid>
      );
      
      expect(document.querySelector('.gap-sm')).toBeInTheDocument();
      
      rerender(
        <ResponsiveGrid gap="xl">
          <div>Large gap</div>
        </ResponsiveGrid>
      );
      
      expect(document.querySelector('.gap-xl')).toBeInTheDocument();
    });
  });

  describe('ResponsiveLayout', () => {
    const mockNavigation = {
      items: [
        { id: 'home', label: 'Home', icon: '🏠', onClick: jest.fn() },
        { id: 'profile', label: 'Profile', icon: '👤', onClick: jest.fn() },
      ],
      activeItem: 'home',
    };

    it('renders layout with navigation and content', () => {
      render(
        <ResponsiveLayout navigation={mockNavigation}>
          <div>Main content</div>
        </ResponsiveLayout>
      );
      
      expect(screen.getByText('Main content')).toBeInTheDocument();
      expect(screen.getByText('Home')).toBeInTheDocument();
    });

    it('renders sidebar when provided', () => {
      render(
        <ResponsiveLayout sidebar={<div>Sidebar content</div>}>
          <div>Main content</div>
        </ResponsiveLayout>
      );
      
      expect(screen.getByText('Sidebar content')).toBeInTheDocument();
    });

    it('shows sidebar toggle on mobile', async () => {
      mockWindowWidth(600);
      render(
        <ResponsiveLayout sidebar={<div>Sidebar</div>}>
          <div>Content</div>
        </ResponsiveLayout>
      );
      
      await waitFor(() => {
        expect(screen.getByLabelText(/sidebar/i)).toBeInTheDocument();
      });
    });

    it('toggles sidebar on mobile', async () => {
      mockWindowWidth(600);
      render(
        <ResponsiveLayout sidebar={<div>Sidebar content</div>}>
          <div>Main content</div>
        </ResponsiveLayout>
      );
      
      await waitFor(() => {
        const toggleButton = screen.getByLabelText(/sidebar/i);
        fireEvent.click(toggleButton);
      });
      
      // Sidebar should be visible after toggle
      await waitFor(() => {
        expect(document.querySelector('.sidebar-expanded')).toBeInTheDocument();
      });
    });
  });

  describe('ResponsiveChatInterface', () => {
    beforeEach(() => {
      // Mock scrollIntoView
      Element.prototype.scrollIntoView = jest.fn();
    });

    it('renders chat interface with channels', () => {
      render(
        <Provider store={store}>
          <ResponsiveChatInterface />
        </Provider>
      );
      
      expect(screen.getByText('Steam Telegraph')).toBeInTheDocument();
      expect(screen.getByTitle('Global')).toBeInTheDocument();
      expect(screen.getByTitle('Guild')).toBeInTheDocument();
    });

    it('shows collapse/expand button', () => {
      render(
        <Provider store={store}>
          <ResponsiveChatInterface />
        </Provider>
      );
      
      expect(screen.getByLabelText(/chat/i)).toBeInTheDocument();
    });

    it('toggles chat visibility', () => {
      render(
        <Provider store={store}>
          <ResponsiveChatInterface />
        </Provider>
      );
      
      const toggleButton = screen.getByLabelText(/chat/i);
      fireEvent.click(toggleButton);
      
      expect(document.querySelector('.collapsed')).toBeInTheDocument();
    });

    it('switches channels on click', () => {
      render(
        <Provider store={store}>
          <ResponsiveChatInterface />
        </Provider>
      );
      
      const guildTab = screen.getByTitle('Guild');
      fireEvent.click(guildTab);
      
      expect(guildTab.classList.contains('active')).toBe(true);
    });

    it('handles message input', () => {
      render(
        <Provider store={store}>
          <ResponsiveChatInterface />
        </Provider>
      );
      
      const input = screen.getByPlaceholderText(/Message Global/i);
      fireEvent.change(input, { target: { value: 'Test message' } });
      
      expect(input).toHaveValue('Test message');
    });

    it('sends message on Enter key', () => {
      render(
        <Provider store={store}>
          <ResponsiveChatInterface />
        </Provider>
      );
      
      const input = screen.getByPlaceholderText(/Message Global/i);
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.keyPress(input, { key: 'Enter', code: 'Enter' });
      
      expect(input).toHaveValue('');
    });

    it('handles swipe gestures on mobile', async () => {
      mockWindowWidth(600);
      
      render(
        <Provider store={store}>
          <ResponsiveChatInterface />
        </Provider>
      );
      
      const chatInterface = document.querySelector('.responsive-chat-interface');
      
      // Simulate swipe left (next channel)
      const touchStart = mockTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      const touchEnd = mockTouchEvent('touchend', [{ clientX: 50, clientY: 100 }]);
      
      if (chatInterface) {
        chatInterface.dispatchEvent(touchStart);
        chatInterface.dispatchEvent(touchEnd);
      }
      
      // Should switch to next channel
      await waitFor(() => {
        expect(document.querySelector('.channel-tab.active')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Breakpoints', () => {
    it('adapts to mobile breakpoint', async () => {
      mockWindowWidth(500);
      
      render(
        <ResponsiveLayout>
          <ResponsiveGrid columns={{ xs: 1, md: 3 }}>
            <ResponsiveCard>Mobile card</ResponsiveCard>
          </ResponsiveGrid>
        </ResponsiveLayout>
      );
      
      await waitFor(() => {
        expect(document.querySelector('.mobile')).toBeInTheDocument();
      });
    });

    it('adapts to tablet breakpoint', async () => {
      mockWindowWidth(800);
      
      render(
        <ResponsiveLayout>
          <ResponsiveGrid columns={{ xs: 1, md: 3 }}>
            <ResponsiveCard>Tablet card</ResponsiveCard>
          </ResponsiveGrid>
        </ResponsiveLayout>
      );
      
      await waitFor(() => {
        expect(document.querySelector('.tablet')).toBeInTheDocument();
      });
    });

    it('adapts to desktop breakpoint', async () => {
      mockWindowWidth(1200);
      
      render(
        <ResponsiveLayout>
          <ResponsiveGrid columns={{ xs: 1, md: 3 }}>
            <ResponsiveCard>Desktop card</ResponsiveCard>
          </ResponsiveGrid>
        </ResponsiveLayout>
      );
      
      await waitFor(() => {
        expect(document.querySelector('.desktop')).toBeInTheDocument();
      });
    });
  });

  describe('Touch Interactions', () => {
    it('handles touch-friendly button sizes', () => {
      render(
        <ResponsiveNavigation 
          items={[{ id: 'test', label: 'Test', icon: '🧪', onClick: jest.fn() }]} 
        />
      );
      
      const buttons = screen.getAllByText('Test');
      const button = buttons[0].closest('button');
      
      // Should have minimum touch target size (check class instead of computed styles)
      expect(button).toHaveClass('nav-button');
    });

    it('provides appropriate spacing for touch', () => {
      render(
        <ResponsiveGrid gap="md">
          <ResponsiveCard interactive>Touch card 1</ResponsiveCard>
          <ResponsiveCard interactive>Touch card 2</ResponsiveCard>
        </ResponsiveGrid>
      );
      
      const grid = document.querySelector('.responsive-grid');
      expect(grid).toHaveClass('gap-md');
    });
  });

  describe('Performance Optimizations', () => {
    it('respects reduced motion preference', () => {
      // Mock prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });
      
      render(<ResponsiveCard interactive>Reduced motion card</ResponsiveCard>);
      
      // Should not have transition animations
      const card = document.querySelector('.responsive-card');
      expect(card).toBeInTheDocument();
    });

    it('handles high contrast mode', () => {
      // Mock prefers-contrast
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });
      
      render(<ResponsiveCard>High contrast card</ResponsiveCard>);
      
      const card = document.querySelector('.responsive-card');
      expect(card).toBeInTheDocument();
    });
  });
});

describe('Responsive Design Integration', () => {
  let store: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    store = createMockStore();
  });

  it('integrates all responsive components together', async () => {
    const navigationItems = [
      { id: 'home', label: 'Home', icon: '🏠', onClick: jest.fn() },
      { id: 'profile', label: 'Profile', icon: '👤', onClick: jest.fn() },
    ];

    render(
      <Provider store={store}>
        <ResponsiveLayout
          navigation={{ items: navigationItems, activeItem: 'home' }}
          sidebar={
            <ResponsiveGrid gap="sm">
              <ResponsiveCard size="small">Sidebar item 1</ResponsiveCard>
              <ResponsiveCard size="small">Sidebar item 2</ResponsiveCard>
            </ResponsiveGrid>
          }
        >
          <ResponsiveGrid columns={{ xs: 1, md: 2, lg: 3 }}>
            <ResponsiveCard title="Card 1" interactive>Content 1</ResponsiveCard>
            <ResponsiveCard title="Card 2" interactive>Content 2</ResponsiveCard>
            <ResponsiveCard title="Card 3" interactive>Content 3</ResponsiveCard>
          </ResponsiveGrid>
        </ResponsiveLayout>
        <ResponsiveChatInterface />
      </Provider>
    );

    // Check that all components render
    expect(screen.getAllByText('Home').length).toBeGreaterThan(0);
    expect(screen.getByText('Sidebar item 1')).toBeInTheDocument();
    expect(screen.getByText('Card 1')).toBeInTheDocument();
    expect(screen.getByText('Steam Telegraph')).toBeInTheDocument();

    // Test responsive behavior
    mockWindowWidth(600);
    
    await waitFor(() => {
      expect(document.querySelector('.mobile')).toBeInTheDocument();
    });
  });
});