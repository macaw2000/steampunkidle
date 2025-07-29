import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { store } from './store/store';
import AuthProvider from './components/auth/AuthProvider';
import GameDashboard from './components/GameDashboard';
import AuthCallback from './components/auth/AuthCallback';
import GlobalErrorBoundary from './components/common/GlobalErrorBoundary';
import ErrorBoundary from './components/common/ErrorBoundary';
import AppHeader from './components/common/AppHeader';
import { ErrorLoggingService } from './services/errorLoggingService';
import './App.css';

// Test user setup disabled in AWS-only mode

function App() {
  console.log('App component rendering...');
  
  useEffect(() => {
    // Initialize error logging service
    console.log('[App] Initializing ErrorLoggingService...');
    ErrorLoggingService.initialize({
      enabled: true,
      logToConsole: true,
      logToLocalStorage: true,
      logToRemote: false, // Disabled for local development
      maxLocalStorageEntries: 100,
      maxBreadcrumbs: 50,
    });

    // AWS-only initialization - no local development services needed
  }, []);
  
  return (
    <GlobalErrorBoundary>
      <Provider store={store}>
        <ErrorBoundary fallback={<div>Authentication system failed to load</div>}>
          <AuthProvider>
            <Router>
              <div className="App">
                <ErrorBoundary fallback={<div>Header failed to load</div>}>
                  <AppHeader />
                </ErrorBoundary>
                <main>
                  <Routes>
                    <Route 
                      path="/" 
                      element={
                        <ErrorBoundary fallback={<div>Game dashboard failed to load</div>}>
                          <GameDashboard />
                        </ErrorBoundary>
                      } 
                    />
                    <Route 
                      path="/auth/callback" 
                      element={
                        <ErrorBoundary fallback={<div>Authentication callback failed</div>}>
                          <AuthCallback />
                        </ErrorBoundary>
                      } 
                    />
                  </Routes>
                </main>


              </div>
            </Router>
          </AuthProvider>
        </ErrorBoundary>
      </Provider>
    </GlobalErrorBoundary>
  );
}

export default App;