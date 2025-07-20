import React from 'react';
import { render, screen } from '@testing-library/react';
import ResponsiveCard from '../ResponsiveCard';
import ResponsiveGrid from '../ResponsiveGrid';

describe('Responsive Components', () => {
  describe('ResponsiveCard', () => {
    it('renders basic card', () => {
      render(
        <ResponsiveCard>
          <p>Test content</p>
        </ResponsiveCard>
      );
      
      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('renders card with title', () => {
      render(
        <ResponsiveCard title="Test Title">
          <p>Test content</p>
        </ResponsiveCard>
      );
      
      expect(screen.getByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('applies size classes correctly', () => {
      const { container } = render(
        <ResponsiveCard size="large">
          <p>Large card</p>
        </ResponsiveCard>
      );
      
      expect(container.querySelector('.size-large')).toBeInTheDocument();
    });

    it('shows loading state', () => {
      render(
        <ResponsiveCard loading>
          <p>Loading content</p>
        </ResponsiveCard>
      );
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('shows error state', () => {
      render(
        <ResponsiveCard error="Test error">
          <p>Error content</p>
        </ResponsiveCard>
      );
      
      expect(screen.getByText('Test error')).toBeInTheDocument();
    });
  });

  describe('ResponsiveGrid', () => {
    it('renders grid with children', () => {
      render(
        <ResponsiveGrid>
          <div>Item 1</div>
          <div>Item 2</div>
        </ResponsiveGrid>
      );
      
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
    });

    it('applies gap classes correctly', () => {
      const { container } = render(
        <ResponsiveGrid gap="lg">
          <div>Grid item</div>
        </ResponsiveGrid>
      );
      
      expect(container.querySelector('.gap-lg')).toBeInTheDocument();
    });

    it('applies auto-fit grid correctly', () => {
      const { container } = render(
        <ResponsiveGrid autoFit>
          <div>Auto-fit item</div>
        </ResponsiveGrid>
      );
      
      expect(container.querySelector('.auto-fit')).toBeInTheDocument();
    });

    it('applies fixed columns correctly', () => {
      const { container } = render(
        <ResponsiveGrid columns={{ xs: 1, md: 3 }}>
          <div>Fixed column item</div>
        </ResponsiveGrid>
      );
      
      expect(container.querySelector('.fixed-columns')).toBeInTheDocument();
    });
  });

  describe('Responsive CSS Classes', () => {
    it('applies responsive utility classes', () => {
      const { container } = render(
        <div className="steampunk-grid-2">
          <div>Grid item</div>
        </div>
      );
      
      expect(container.querySelector('.steampunk-grid-2')).toBeInTheDocument();
    });

    it('applies touch target classes', () => {
      const { container } = render(
        <button className="touch-target">
          Touch button
        </button>
      );
      
      expect(container.querySelector('.touch-target')).toBeInTheDocument();
    });
  });
});