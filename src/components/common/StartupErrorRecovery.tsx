import React, { useState } from 'react';
import { initializationManager } from '../../services/initializationManager';

interface StartupErrorRecoveryProps {
  onRecoveryComplete: () => void;
  onSkipRecovery: () => void;
}

const StartupErrorRecovery: React.FC<StartupErrorRecoveryProps> = ({
  onRecoveryComplete,
  onSkipRecovery,
}) => {
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<string>('');

  const handleClearCache = async () => {
    setIsRecovering(true);
    setRecoveryStep('Clearing application cache...');

    try {
      // Clear localStorage
      if (typeof window !== 'undefined' && window.localStorage) {
        const keysToKeep = ['mockUsers', 'mockAuthSession']; // Keep auth data
        const allKeys = Object.keys(localStorage);
        
        allKeys.forEach(key => {
          if (!keysToKeep.includes(key)) {
            localStorage.removeItem(key);
          }
        });
      }

      // Clear sessionStorage
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.clear();
      }

      // Clear any cached data in memory
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }

      setRecoveryStep('Cache cleared successfully');
      setTimeout(() => {
        setIsRecovering(false);
        onRecoveryComplete();
      }, 1000);
    } catch (error) {
      console.error('Cache clearing failed:', error);
      setRecoveryStep('Cache clearing failed');
      setTimeout(() => {
        setIsRecovering(false);
      }, 2000);
    }
  };

  const handleResetInitialization = async () => {
    setIsRecovering(true);
    setRecoveryStep('Resetting initialization state...');

    try {
      // Reset the initialization manager
      initializationManager.reset();
      
      setRecoveryStep('Initialization reset complete');
      setTimeout(() => {
        setIsRecovering(false);
        onRecoveryComplete();
      }, 1000);
    } catch (error) {
      console.error('Initialization reset failed:', error);
      setRecoveryStep('Reset failed');
      setTimeout(() => {
        setIsRecovering(false);
      }, 2000);
    }
  };

  const handleFullReset = async () => {
    setIsRecovering(true);
    setRecoveryStep('Performing full application reset...');

    try {
      // Clear all storage
      if (typeof window !== 'undefined') {
        if (window.localStorage) {
          localStorage.clear();
        }
        if (window.sessionStorage) {
          sessionStorage.clear();
        }
      }

      // Clear caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }

      // Reset initialization
      initializationManager.reset();

      setRecoveryStep('Full reset complete - reloading...');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Full reset failed:', error);
      setRecoveryStep('Full reset failed');
      setTimeout(() => {
        setIsRecovering(false);
      }, 2000);
    }
  };

  const handleReloadPage = () => {
    window.location.reload();
  };

  if (isRecovering) {
    return (
      <div className="recovery-overlay">
        <div className="recovery-content">
          <div className="recovery-spinner"></div>
          <h3>Recovery in Progress</h3>
          <p>{recoveryStep}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="recovery-options">
      <h3>Recovery Options</h3>
      <p>Try these recovery methods to resolve startup issues:</p>
      
      <div className="recovery-buttons">
        <button 
          className="recovery-button safe"
          onClick={handleClearCache}
          title="Clear cached data but keep user settings"
        >
          Clear Cache
        </button>
        
        <button 
          className="recovery-button moderate"
          onClick={handleResetInitialization}
          title="Reset the initialization process"
        >
          Reset Initialization
        </button>
        
        <button 
          className="recovery-button reload"
          onClick={handleReloadPage}
          title="Reload the page"
        >
          Reload Page
        </button>
        
        <button 
          className="recovery-button destructive"
          onClick={handleFullReset}
          title="Clear all data and reset everything"
        >
          Full Reset
        </button>
      </div>

      <div className="recovery-actions">
        <button 
          className="skip-button"
          onClick={onSkipRecovery}
        >
          Skip Recovery & Continue
        </button>
      </div>

      <div className="recovery-info">
        <h4>What each option does:</h4>
        <ul>
          <li><strong>Clear Cache:</strong> Removes cached data but keeps your login and settings</li>
          <li><strong>Reset Initialization:</strong> Restarts the startup process from the beginning</li>
          <li><strong>Reload Page:</strong> Refreshes the entire application</li>
          <li><strong>Full Reset:</strong> Clears all data and returns to a fresh state</li>
        </ul>
      </div>
    </div>
  );
};

export default StartupErrorRecovery;