import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { ErrorReportingDashboard } from '../dev/ErrorReportingDashboard';
import { ErrorLoggingService } from '../../services/errorLoggingService';

const AppHeaderDebug: React.FC = () => {
  console.log('AppHeaderDebug: Component rendering...');
  
  // Hooks must be called at the top level
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const { character, hasCharacter } = useSelector((state: RootState) => state.game);
  const [showErrorDashboard, setShowErrorDashboard] = useState(false);
  
  try {
    console.log('AppHeaderDebug: Auth state:', { isAuthenticated });
    console.log('AppHeaderDebug: Game state:', { character, hasCharacter });
    
    // Get error statistics for display
    const errorStats = ErrorLoggingService.getErrorStatistics();
    
    return (
      <>
        <header style={{ 
          padding: '10px 20px', 
          backgroundColor: '#2c3e50', 
          color: 'white',
          borderBottom: '2px solid #34495e',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px' }}>Steampunk Idle Game (Debug)</h1>
            <small>Auth: {String(isAuthenticated)} | Has Character: {String(hasCharacter)}</small>
          </div>
          
          {process.env.NODE_ENV === 'development' && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                onClick={() => setShowErrorDashboard(true)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: errorStats.total > 0 ? '#e74c3c' : '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
                title={`${errorStats.total} total errors, ${errorStats.recent} recent`}
              >
                🚨 Errors: {errorStats.total}
              </button>
              
              <button
                onClick={() => {
                  // Test error for demonstration
                  try {
                    throw new Error('Test error from debug header');
                  } catch (error) {
                    ErrorLoggingService.logError(error as Error, {
                      additionalData: { source: 'debug-test' }
                    }, 'medium');
                  }
                }}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#f39c12',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
                title="Generate a test error"
              >
                🧪 Test Error
              </button>
            </div>
          )}
        </header>
        
        <ErrorReportingDashboard
          isVisible={showErrorDashboard}
          onClose={() => setShowErrorDashboard(false)}
        />
      </>
    );
  } catch (error) {
    console.error('AppHeaderDebug: Error in component:', error);
    return (
      <header style={{ 
        padding: '10px 20px', 
        backgroundColor: '#e74c3c', 
        color: 'white'
      }}>
        <h1>Header Error: {error instanceof Error ? error.message : String(error)}</h1>
      </header>
    );
  }
};

export default AppHeaderDebug;