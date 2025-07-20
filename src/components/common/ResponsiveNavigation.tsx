import React, { useState, useEffect } from 'react';
import './ResponsiveNavigation.css';

interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  onClick: () => void;
  badge?: number;
}

interface ResponsiveNavigationProps {
  items: NavigationItem[];
  activeItem?: string;
  className?: string;
}

const ResponsiveNavigation: React.FC<ResponsiveNavigationProps> = ({
  items,
  activeItem,
  className = ''
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [, setIsMobile] = useState(false);

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.responsive-navigation')) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isMobileMenuOpen]);

  const handleItemClick = (item: NavigationItem) => {
    item.onClick();
    setIsMobileMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <nav className={`responsive-navigation ${className}`}>
      {/* Desktop Horizontal Navigation */}
      <div className="desktop-nav">
        <ul className="nav-list horizontal">
          {items.map((item) => (
            <li key={item.id} className="nav-item">
              <button
                className={`nav-button ${activeItem === item.id ? 'active' : ''}`}
                onClick={() => handleItemClick(item)}
                title={item.label}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {item.badge && item.badge > 0 && (
                  <span className="nav-badge">{item.badge}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Mobile Navigation */}
      <div className="mobile-nav">
        {/* Hamburger Menu Button */}
        <button
          className={`hamburger-button ${isMobileMenuOpen ? 'open' : ''}`}
          onClick={toggleMobileMenu}
          aria-label="Toggle navigation menu"
        >
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
        </button>

        {/* Mobile Menu Overlay */}
        <div className={`mobile-menu-overlay ${isMobileMenuOpen ? 'open' : ''}`}>
          <div className="mobile-menu">
            <div className="mobile-menu-header">
              <h3>Navigation</h3>
              <button
                className="close-button"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>
            <ul className="nav-list vertical">
              {items.map((item) => (
                <li key={item.id} className="nav-item">
                  <button
                    className={`nav-button ${activeItem === item.id ? 'active' : ''}`}
                    onClick={() => handleItemClick(item)}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                    {item.badge && item.badge > 0 && (
                      <span className="nav-badge">{item.badge}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Navigation for Mobile */}
        <div className="bottom-nav">
          <ul className="nav-list bottom">
            {items.slice(0, 5).map((item) => (
              <li key={item.id} className="nav-item">
                <button
                  className={`nav-button ${activeItem === item.id ? 'active' : ''}`}
                  onClick={() => handleItemClick(item)}
                  title={item.label}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <span className="nav-badge">{item.badge}</span>
                  )}
                </button>
              </li>
            ))}
            {items.length > 5 && (
              <li className="nav-item">
                <button
                  className="nav-button more-button"
                  onClick={toggleMobileMenu}
                  title="More options"
                >
                  <span className="nav-icon">⋯</span>
                  <span className="nav-label">More</span>
                </button>
              </li>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default ResponsiveNavigation;