import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// Zero-Trust Production Hardening: Strip DevTools, Logs, and detailed traces
if (!import.meta.env.DEV) {
  window.console.log = () => {};
  window.console.warn = () => {};
  window.console.error = () => {};
  window.onerror = () => true;
  window.onunhandledrejection = () => true;

  if (typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ === "object") {
    for (const [key, value] of Object.entries(window.__REACT_DEVTOOLS_GLOBAL_HOOK__)) {
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__[key] = typeof value === "function" ? () => {} : null;
    }
  }
}

import { ThemeProvider } from './context/ThemeContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter basename="/87564/admin">
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
);