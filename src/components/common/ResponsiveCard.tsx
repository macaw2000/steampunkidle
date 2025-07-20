import React, { ReactNode } from 'react';
import './ResponsiveCard.css';

interface ResponsiveCardProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  icon?: string;
  className?: string;
  size?: 'small' | 'medium' | 'large' | 'full';
  elevated?: boolean;
  interactive?: boolean;
  onClick?: () => void;
  loading?: boolean;
  error?: string;
}

const ResponsiveCard: React.FC<ResponsiveCardProps> = ({
  children,
  title,
  subtitle,
  icon,
  className = '',
  size = 'medium',
  elevated = false,
  interactive = false,
  onClick,
  loading = false,
  error
}) => {
  const cardClasses = [
    'responsive-card',
    `size-${size}`,
    elevated ? 'elevated' : '',
    interactive ? 'interactive' : '',
    loading ? 'loading' : '',
    error ? 'error' : '',
    className
  ].filter(Boolean).join(' ');

  const handleClick = () => {
    if (interactive && onClick && !loading) {
      onClick();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (interactive && onClick && !loading && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={cardClasses}
      onClick={handleClick}
      onKeyPress={handleKeyPress}
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? 'button' : undefined}
      aria-disabled={loading}
    >
      {/* Loading Overlay */}
      {loading && (
        <div className="card-loading-overlay">
          <div className="loading-spinner">⚙️</div>
          <span className="loading-text">Loading...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="card-error">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{error}</span>
        </div>
      )}

      {/* Card Header */}
      {(title || subtitle || icon) && (
        <div className="card-header">
          {icon && <span className="card-icon">{icon}</span>}
          <div className="card-title-group">
            {title && <h3 className="card-title">{title}</h3>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
        </div>
      )}

      {/* Card Content */}
      <div className="card-content">
        {children}
      </div>

      {/* Interactive Indicator */}
      {interactive && (
        <div className="interactive-indicator">
          <span className="indicator-arrow">→</span>
        </div>
      )}
    </div>
  );
};

export default ResponsiveCard;