import React from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { store } from './store/store';
import AuthProvider from './components/auth/AuthProvider';
import GameDashboard from './components/GameDashboard';
import AuthCallback from './components/auth/AuthCallback';
import GlobalErrorBoundary from './components/common/GlobalErrorBoundary';
import ErrorBoundary from './components/common/ErrorBoundary';
import AppHeader from './components/common/AppHeader';
import './App.css';

// Conditionally import test user setup only in development
if (process.env.NODE_ENV === 'development') {
  try {
    require('./utils/testUserSetup');
  } catch (error) {
    console.warn('Failed to load test user setup:', error);
  }
}

function App() {
  console.log('App component rendering...');
  
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