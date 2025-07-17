import React from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { store } from './store/store';
import AuthProvider from './components/auth/AuthProvider';
import GameDashboard from './components/GameDashboard';
import AuthCallback from './components/auth/AuthCallback';
import './utils/testUserSetup'; // Initialize test users in development
import './App.css';

function App() {
  return (
    <Provider store={store}>
      <AuthProvider>
        <Router>
          <div className="App">
            <header className="App-header">
              <h1>Steampunk Idle Game</h1>
            </header>
            <main>
              <Routes>
                <Route path="/" element={<GameDashboard />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
              </Routes>
            </main>
          </div>
        </Router>
      </AuthProvider>
    </Provider>
  );
}

export default App;