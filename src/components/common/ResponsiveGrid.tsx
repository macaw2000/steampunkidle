import React, { ReactNode } from 'react';
import './ResponsiveGrid.css';

interface ResponsiveGridProps {
  children: ReactNode;
  columns?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  autoFit?: boolean;
  minItemWidth?: string;
  className?: string;
  equalHeight?: boolean;
}

const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  columns = { xs: 1, sm: 2, md: 3, lg: 4, xl: 5 },
  gap = 'md',
  autoFit = false,
  minItemWidth = '250px',
  className = '',
  equalHeight = false
}) => {
  const gridClasses = [
    'responsive-grid',
    `gap-${gap}`,
    autoFit ? 'auto-fit' : 'fixed-columns',
    equalHeight ? 'equal-height' : '',
    className
  ].filter(Boolean).join(' ');

  const gridStyle: React.CSSProperties = autoFit
    ? ({
        '--min-item-width': minItemWidth,
      } as React.CSSProperties)
    : ({
        '--columns-xs': columns.xs || 1,
        '--columns-sm': columns.sm || 2,
        '--columns-md': columns.md || 3,
        '--columns-lg': columns.lg || 4,
        '--columns-xl': columns.xl || 5,
      } as React.CSSProperties);

  return (
    <div className={gridClasses} style={gridStyle}>
      {children}
    </div>
  );
};

export default ResponsiveGrid;