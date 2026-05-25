import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import toast from "react-hot-toast";
import { sanitizeErrorMessage } from "./utils/sanitizeErrorMessage";

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

// Monkeypatch Toast functions to enforce absolute zero-trust UI message sanitization
if (toast && !toast.__patched) {
  const originalSuccess = toast.success;
  const originalError = toast.error;

  toast.success = (message, options) => {
    return originalSuccess(sanitizeErrorMessage(message, true), options);
  };

  toast.error = (message, options) => {
    return originalError(sanitizeErrorMessage(message, false), options);
  };

  toast.__patched = true;
}

import { ThemeProvider } from "./context/ThemeContext";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
