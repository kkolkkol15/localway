import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { AdminProvider } from './state/AdminContext.jsx';
import App from './App.jsx';
import './styles.css';

const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <AdminProvider>
        <App />
      </AdminProvider>
    </Router>
  </React.StrictMode>
);
