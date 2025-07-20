import React, { useEffect, useState } from 'react';
import { initializationManager, InitializationStatus } from '../../services/initializationManager';
import StartupErrorRecovery from './StartupErrorRecovery';
import './StartupScreen.css';

interface StartupScreenProps {
  onInitializationComplete: (success: boolean) => void;
}

const StartupScreen: React.FC<StartupScreenProps> = ({ onInitializationComplete }) => {
  const [status, setStatus] = useState<InitializationStatus>(initializationManager.getStatus());
  const [showDetails, setShowDetails] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const unsubscribe = initializationManager.addListener(setStatus);
    
    // Start initialization if not already started
    if (!status.isInitializing && !status.isInitialized) {
      initializationManager.initialize().then((finalStatus) => {
        // Wait a moment to show completion before transitioning
        setTimeout(() => {
          onInitializationComplete(finalStatus.isInitialized);
        }, 1000);
      });
    }

    return unsubscribe;
  }, [onInitializationComplete, status.isInitializing, status.isInitialized]);

  const handleRetry = async () => {
    setRetryCount(prev => prev + 1);
    try {
      await initializationManager.retryFailedSteps();
      const finalStatus = initializationManager.getStatus();
      if (finalStatus.isInitialized) {
        setTimeout(() => {
          onInitializationComplete(true);
        }, 1000);
      }
    } catch (error) {
      console.error('Retry failed:', error);
    }
  };

  const handleSkipAndContinue = () => {
    // Continue with partial initialization
    onInitializationComplete(true);
  };

  const handleRecoveryComplete = () => {
    setShowRecovery(false);
    setRetryCount(0);
    // Restart initialization
    initializationManager.initialize().then((finalStatus) => {
      setTimeout(() => {
        onInitializationComplete(finalStatus.isInitialized);
      }, 1000);
    });
  };

  const handleSkipRecovery = () => {
    setShowRecovery(false);
  };

  const criticalErrors = status.errors.filter(error => !error.recoverable);
  const hasRecoverableErrors = status.errors.some(error => error.recoverable);
  const hasCriticalErrors = criticalErrors.length > 0;

  if (status.isInitialized && status.errors.length === 0) {
    return (
      <div className="startup-screen startup-success">
        <div className="startup-content">
          <div className="startup-icon success">✓</div>
          <h2>Ready to Play!</h2>
          <p>Application initialized successfully</p>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: '100%' }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (!status.isInitializing && hasCriticalErrors) {
    return (
      <div className="startup-screen startup-error">
        <div className="startup-content">
          <div className="startup-icon error">⚠</div>
          <h2>Startup Failed</h2>
          <p>Critical errors prevented the application from starting properly.</p>
          
          <div className="error-summary">
            {criticalErrors.map((error, index) => (
              <div key={index} className="error-item critical">
                <strong>{error.step}:</strong> {error.error}
              </div>
            ))}
          </div>

          <div className="startup-actions">
            <button 
              className="retry-button"
              onClick={handleRetry}
              disabled={retryCount >= 3}
            >
              {retryCount >= 3 ? 'Max Retries Reached' : `Retry (${retryCount}/3)`}
            </button>
            <button 
              className="details-button"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
            {retryCount >= 2 && (
              <button 
                className="recovery-button"
                onClick={() => setShowRecovery(true)}
              >
                Advanced Recovery
              </button>
            )}
          </div>

          {showDetails && (
            <div className="startup-details">
              <h3>Initialization Steps</h3>
              <div className="steps-list">
                {status.completedSteps.map(stepId => (
                  <div key={stepId} className="step-item completed">
                    ✓ {stepId}
                  </div>
                ))}
                {status.failedSteps.map(stepId => (
                  <div key={stepId} className="step-item failed">
                    ✗ {stepId}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!status.isInitializing && hasRecoverableErrors) {
    return (
      <div className="startup-screen startup-warning">
        <div className="startup-content">
          <div className="startup-icon warning">⚠</div>
          <h2>Partial Initialization</h2>
          <p>Some features may not be available, but you can continue using the application.</p>
          
          <div className="error-summary">
            {status.errors.filter(error => error.recoverable).map((error, index) => (
              <div key={index} className="error-item recoverable">
                <strong>{error.step}:</strong> {error.error}
              </div>
            ))}
          </div>

          <div className="startup-actions">
            <button 
              className="continue-button primary"
              onClick={handleSkipAndContinue}
            >
              Continue Anyway
            </button>
            <button 
              className="retry-button"
              onClick={handleRetry}
              disabled={retryCount >= 3}
            >
              {retryCount >= 3 ? 'Max Retries Reached' : `Retry Failed Steps (${retryCount}/3)`}
            </button>
          </div>

          {showDetails && (
            <div className="startup-details">
              <h3>Initialization Status</h3>
              <div className="steps-list">
                {status.completedSteps.map(stepId => (
                  <div key={stepId} className="step-item completed">
                    ✓ {stepId}
                  </div>
                ))}
                {status.failedSteps.map(stepId => (
                  <div key={stepId} className="step-item failed">
                    ✗ {stepId}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Initialization in progress
  return (
    <div className="startup-screen startup-loading">
      <div className="startup-content">
        <div className="startup-icon loading">
          <div className="spinner"></div>
        </div>
        <h2>Starting Steampunk Idle Game</h2>
        <p>
          {status.currentStep 
            ? `${status.currentStep.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}...`
            : 'Preparing application...'
          }
        </p>
        
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${Math.round(status.progress)}%` }}
          ></div>
        </div>
        <div className="progress-text">{Math.round(status.progress)}%</div>

        <div className="startup-steps">
          <div className="steps-grid">
            {['store-validation', 'network-check', 'auth-initialization', 'service-health', 'local-storage', 'feature-flags'].map(stepId => {
              const isCompleted = status.completedSteps.includes(stepId);
              const isCurrent = status.currentStep === stepId;
              const isFailed = status.failedSteps.includes(stepId);
              
              return (
                <div 
                  key={stepId} 
                  className={`step-indicator ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''} ${isFailed ? 'failed' : ''}`}
                >
                  <div className="step-icon">
                    {isCompleted ? '✓' : isFailed ? '✗' : isCurrent ? '⟳' : '○'}
                  </div>
                  <div className="step-name">
                    {stepId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button 
          className="details-button"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>

        {showDetails && (
          <div className="startup-details">
            <h3>Initialization Progress</h3>
            <div className="steps-list">
              {status.completedSteps.map(stepId => (
                <div key={stepId} className="step-item completed">
                  ✓ {stepId}
                </div>
              ))}
              {status.currentStep && (
                <div className="step-item current">
                  ⟳ {status.currentStep}
                </div>
              )}
              {status.failedSteps.map(stepId => (
                <div key={stepId} className="step-item failed">
                  ✗ {stepId}
                </div>
              ))}
            </div>
            
            {status.errors.length > 0 && (
              <div className="error-log">
                <h4>Errors</h4>
                {status.errors.map((error, index) => (
                  <div key={index} className={`error-item ${error.recoverable ? 'recoverable' : 'critical'}`}>
                    <div className="error-step">{error.step}</div>
                    <div className="error-message">{error.error}</div>
                    <div className="error-time">{error.timestamp.toLocaleTimeString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showRecovery && (
          <StartupErrorRecovery
            onRecoveryComplete={handleRecoveryComplete}
            onSkipRecovery={handleSkipRecovery}
          />
        )}
      </div>
    </div>
  );
};

export default StartupScreen;