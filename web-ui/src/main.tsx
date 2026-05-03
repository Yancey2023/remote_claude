import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { loadConfig } from './config';

const root = document.getElementById('root');
if (!root) throw new Error('root element not found');

// Load runtime config before rendering
loadConfig().then(() => {
  ReactDOM.createRoot(root).render(
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>,
  );
});
