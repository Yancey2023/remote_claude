import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { BASE_URL } from './config';
const root = document.getElementById('root');
if (!root) throw new Error('root element not found');

ReactDOM.createRoot(root).render(
  <ErrorBoundary>
    <BrowserRouter basename={BASE_URL}>
      <App />
    </BrowserRouter>
  </ErrorBoundary>,
);
