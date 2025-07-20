import React, { useState, useEffect } from 'react';
import { initializationManager } from '../services/initializationManager';
import StartupScreen from './common/StartupScreen';
import App from '../App';

const AppInitializer: React.FC = () => {
  const [, setIsInitialized] = useState(false);
  const [showStartupScreen, setShowStartupScreen] = useState(true);

  useEffect(() => {
    // Check if already initialized
    if (initializationManager.isInitialized()) {
      setIsInitialized(true);
      setShowStartupScreen(false);
    }
  }, []);

  const handleInitializationComplete = (success: boolean) => {
    setIsInitialized(success);
    
    // Add a small delay to show completion state
    setTimeout(() => {
      setShowStartupScreen(false);
    }, 500);
  };

  if (showStartupScreen) {
    return <StartupScreen onInitializationComplete={handleInitializationComplete} />;
  }

  return <App />;
};

export default AppInitializer;