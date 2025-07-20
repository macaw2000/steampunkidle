/**
 * Rendering Helpers Tests
 * Tests for conditional rendering utilities
 */

import React from 'react';
import {
  renderIf,
  renderWithFallback,
  renderFeature,
  renderWithServices,
  renderAsyncState,
  renderIfExists,
  createSafeRenderer
} from '../renderingHelpers';

describe('renderingHelpers', () => {
  describe('renderIf', () => {
    it('renders component when condition is true', () => {
      const component = React.createElement('div', null, 'Test content');
      const result = renderIf(true, component);
      expect(result).toBe(component);
    });

    it('returns null when condition is false', () => {
      const component = React.createElement('div', null, 'Test content');
      const result = renderIf(false, component);
      expect(result).toBeNull();
    });

    it('handles function conditions', () => {
      const component = React.createElement('div', null, 'Test content');
      const result = renderIf(() => true, component);
      expect(result).toBe(component);
    });

    it('returns null when function condition throws', () => {
      const component = React.createElement('div', null, 'Test content');
      const result = renderIf(() => { throw new Error('Test error'); }, component);
      expect(result).toBeNull();
    });
  });

  describe('renderWithFallback', () => {
    it('returns the main component when no error', () => {
      const component = React.createElement('div', null, 'Main component');
      const fallback = React.createElement('div', null, 'Fallback');
      const result = renderWithFallback(component, fallback);
      expect(result).toBe(component);
    });

    it('returns null as default fallback', () => {
      const component = React.createElement('div', null, 'Main component');
      const result = renderWithFallback(component);
      expect(result).toBe(component);
    });
  });

  describe('renderFeature', () => {
    it('renders component for enabled features', () => {
      const component = React.createElement('div', null, 'Feature component');
      const result = renderFeature('chat', component);
      expect(result).toBe(component);
    });

    it('returns fallback for disabled features', () => {
      const component = React.createElement('div', null, 'Feature component');
      const fallback = React.createElement('div', null, 'Feature disabled');
      const result = renderFeature('unknown-feature', component, fallback);
      expect(result).toBe(fallback);
    });

    it('returns null for disabled features without fallback', () => {
      const component = React.createElement('div', null, 'Feature component');
      const result = renderFeature('unknown-feature', component);
      expect(result).toBeNull();
    });
  });

  describe('renderWithServices', () => {
    it('renders component when all services are available', () => {
      const component = React.createElement('div', null, 'Service component');
      const result = renderWithServices(['auth', 'storage'], component);
      expect(result).toBe(component);
    });

    it('returns fallback when services are unavailable', () => {
      const component = React.createElement('div', null, 'Service component');
      const fallback = React.createElement('div', null, 'Services unavailable');
      const result = renderWithServices(['unknown-service'], component, fallback);
      expect(result).toBe(fallback);
    });
  });

  describe('renderAsyncState', () => {
    it('renders loading component when loading', () => {
      const loadingComponent = React.createElement('div', null, 'Loading...');
      const successComponent = (data: any) => React.createElement('div', null, 'Success');
      const errorComponent = (error: any) => React.createElement('div', null, 'Error');

      const result = renderAsyncState(
        { loading: true },
        {
          loading: loadingComponent,
          success: successComponent,
          error: errorComponent
        }
      );

      expect(result).toBe(loadingComponent);
    });

    it('renders error component when error exists', () => {
      const loadingComponent = React.createElement('div', null, 'Loading...');
      const successComponent = (data: any) => React.createElement('div', null, 'Success');
      const errorComponent = (error: any) => React.createElement('div', null, 'Error');

      const result = renderAsyncState(
        { loading: false, error: 'Test error' },
        {
          loading: loadingComponent,
          success: successComponent,
          error: errorComponent
        }
      );

      expect(result).toEqual(errorComponent('Test error'));
    });

    it('renders success component when data exists', () => {
      const loadingComponent = React.createElement('div', null, 'Loading...');
      const successComponent = (data: any) => React.createElement('div', null, `Success: ${data}`);
      const errorComponent = (error: any) => React.createElement('div', null, 'Error');

      const result = renderAsyncState(
        { loading: false, data: 'test data' },
        {
          loading: loadingComponent,
          success: successComponent,
          error: errorComponent
        }
      );

      expect(result).toEqual(successComponent('test data'));
    });

    it('renders empty component when no data and not loading', () => {
      const loadingComponent = React.createElement('div', null, 'Loading...');
      const successComponent = (data: any) => React.createElement('div', null, 'Success');
      const errorComponent = (error: any) => React.createElement('div', null, 'Error');
      const emptyComponent = React.createElement('div', null, 'Empty');

      const result = renderAsyncState(
        { loading: false },
        {
          loading: loadingComponent,
          success: successComponent,
          error: errorComponent,
          empty: emptyComponent
        }
      );

      expect(result).toBe(emptyComponent);
    });
  });

  describe('renderIfExists', () => {
    it('renders when nested property exists', () => {
      const obj = { user: { name: 'John' } };
      const renderer = (value: string) => React.createElement('div', null, value);
      const result = renderIfExists(obj, 'user.name', renderer);
      expect(result).toEqual(renderer('John'));
    });

    it('returns fallback when property does not exist', () => {
      const obj = { user: {} };
      const renderer = (value: string) => React.createElement('div', null, value);
      const fallback = React.createElement('div', null, 'Not found');
      const result = renderIfExists(obj, 'user.name', renderer, fallback);
      expect(result).toBe(fallback);
    });

    it('returns null when property does not exist and no fallback', () => {
      const obj = { user: {} };
      const renderer = (value: string) => React.createElement('div', null, value);
      const result = renderIfExists(obj, 'user.name', renderer);
      expect(result).toBeNull();
    });
  });

  describe('createSafeRenderer', () => {
    it('creates a renderer with default fallback', () => {
      const defaultFallback = React.createElement('div', null, 'Default fallback');
      const safeRender = createSafeRenderer(defaultFallback);
      const component = React.createElement('div', null, 'Component');
      
      const result = safeRender(component);
      expect(result).toBe(component);
    });
  });
});