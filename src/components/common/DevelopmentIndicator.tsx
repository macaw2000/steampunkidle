/**
 * Development mode indicator component
 * Shows when the application is running in development mode with mock data
 */

import React from 'react';
import { EnvironmentService } from '../../services/environmentService';
import './DevelopmentIndicator.css';

export interface DevelopmentIndicatorProps {
  visible?: boolean;
  features?: string[];
}

export const DevelopmentIndicator: React.FC<DevelopmentIndicatorProps> = ({ 
  visible = true, 
  features = [] 
}) => {
  const envInfo = EnvironmentService.getEnvironmentInfo();

  // Only show in development mode or when using localStorage
  if (!visible || (!envInfo.isDevelopment && !envInfo.useLocalStorage)) {
    return null;
  }

  const defaultFeatures = [];
  if (envInfo.enableMockAuth) {
    defaultFeatures.push('Mock Authentication');
  }
  if (envInfo.useLocalStorage) {
    defaultFeatures.push('Local Storage');
  }
  if (!envInfo.hasBackendAPI) {
    defaultFeatures.push('No Backend API');
  }

  const allFeatures = [...defaultFeatures, ...features];

  return (
    <div className="development-indicator">
      <div className="development-indicator-content">
        <span className="development-indicator-icon">🔧</span>
        <span className="development-indicator-text">
          Development Mode
        </span>
        {allFeatures.length > 0 && (
          <div className="development-indicator-features">
            {allFeatures.map((feature, index) => (
              <span key={index} className="development-indicator-feature">
                {feature}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DevelopmentIndicator;