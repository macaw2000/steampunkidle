import React, { useState, useEffect, ReactNode } from 'react';
import ResponsiveNavigation from '../common/ResponsiveNavigation';
import './ResponsiveLayout.css';

interface ResponsiveLayoutProps {
  children: ReactNode;
  sidebar?: ReactNode;
  navigation?: {
    items: Array<{
      id: string;
      label: string;
      icon: string;
      onClick: () => void;
      badge?: number;
    }>;
    activeItem?: string;
  };
  className?: string;
}

const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  sidebar,
  navigation,
  className = ''
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Check device type
  useEffect(() => {
    const checkDeviceType = () => {
      const width = window.innerWidth;
      const mobile = width < 768;
      const tablet = width >= 768 && width < 1024;
      
      setIsMobile(mobile);
      setIsTablet(tablet);
      
      // Auto-collapse sidebar on mobile and tablet
      if (mobile || tablet) {
        setSidebarCollapsed(true);
      } else {
        setSidebarCollapsed(false);
      }
    };

    checkDeviceType();
    window.addEventListener('resize', checkDeviceType);
    return () => window.removeEventListener('resize', checkDeviceType);
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div className={`responsive-layout ${className} ${isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop'}`}>
      {/* Navigation */}
      {navigation && (
        <div className="layout-navigation">
          <ResponsiveNavigation
            items={navigation.items}
            activeItem={navigation.activeItem}
          />
        </div>
      )}

      {/* Main Layout Container */}
      <div className="layout-container">
        {/* Sidebar */}
        {sidebar && (
          <>
            {/* Sidebar Toggle Button (Mobile/Tablet) */}
            {(isMobile || isTablet) && (
              <button
                className="sidebar-toggle"
                onClick={toggleSidebar}
                aria-label={sidebarCollapsed ? 'Open sidebar' : 'Close sidebar'}
              >
                <span className="toggle-icon">
                  {sidebarCollapsed ? '☰' : '✕'}
                </span>
              </button>
            )}

            {/* Sidebar Overlay (Mobile) */}
            {isMobile && !sidebarCollapsed && (
              <div 
                className="sidebar-overlay"
                onClick={() => setSidebarCollapsed(true)}
              />
            )}

            {/* Sidebar */}
            <aside className={`layout-sidebar ${sidebarCollapsed ? 'collapsed' : 'expanded'}`}>
              <div className="sidebar-content">
                {sidebar}
              </div>
            </aside>
          </>
        )}

        {/* Main Content */}
        <main className={`layout-main ${sidebar ? 'with-sidebar' : 'full-width'} ${sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}>
          <div className="main-content">
            {children}
          </div>
        </main>
      </div>

      {/* Bottom spacing for mobile navigation */}
      {isMobile && <div className="mobile-nav-spacer" />}
    </div>
  );
};

export default ResponsiveLayout;