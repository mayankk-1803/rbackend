import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import toast from "react-hot-toast";
import { sanitizeErrorMessage } from "./utils/sanitizeErrorMessage";
import { APP_MESSAGES } from "./constants/messages";

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

const stringToMessageMap = {
  "profile updated successfully": APP_MESSAGES.PROFILE_UPDATED,
  "insufficient wallet balance": APP_MESSAGES.INSUFFICIENT_BALANCE,
  "password changed successfully": APP_MESSAGES.PASSWORD_CHANGED,
  "login successful": APP_MESSAGES.LOGIN_SUCCESS,
  "order placed successfully": APP_MESSAGES.ORDER_PLACED,
  "recharge successful": APP_MESSAGES.RECHARGE_SUCCESS,
};

const resolveMessage = (message, isSuccess = false) => {
  if (typeof message === "object" && message !== null && message.title) {
    return message;
  }
  const sanitized = sanitizeErrorMessage(message, isSuccess);
  if (typeof sanitized === "string") {
    const lower = sanitized.trim().toLowerCase();
    if (stringToMessageMap[lower]) {
      return stringToMessageMap[lower];
    }
    return sanitized;
  }
  return sanitized;
};

const renderToastContent = (msgObj) => {
  if (typeof msgObj === 'object' && msgObj !== null && msgObj.title) {
    return React.createElement(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "2px" } },
      React.createElement(
        "div",
        { style: { fontWeight: "800", fontSize: "13px", color: "inherit" } },
        msgObj.title
      ),
      msgObj.description
        ? React.createElement(
            "div",
            { style: { fontSize: "11px", opacity: 0.8, fontWeight: "500", lineHeight: "1.4" } },
            msgObj.description
          )
        : null
    );
  }
  return msgObj;
};

// Monkeypatch Toast functions to enforce absolute zero-trust UI message sanitization
if (toast && !toast.__patched) {
  const originalSuccess = toast.success;
  const originalError = toast.error;

  toast.success = (message, options) => {
    if (import.meta.env.DEV) console.log("TOAST SUCCESS", message);
    return originalSuccess(renderToastContent(resolveMessage(message, true)), options);
  };

  toast.error = (message, options) => {
    if (import.meta.env.DEV) console.log("TOAST ERROR", message);
    return originalError(renderToastContent(resolveMessage(message, false)), options);
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
