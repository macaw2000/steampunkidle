import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import AppInitializer from './components/AppInitializer';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <AppInitializer />
  </React.StrictMode>
);