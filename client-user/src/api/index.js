import axios from "axios";
import toast from "react-hot-toast";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://rchserver.irecharge.in/api",
});

// Toast deduplication global setup
try {
  const originalError = toast.error;
  const originalSuccess = toast.success;
  const toastIdMap = new Map();
  const DEDUPE_TIME = 3000;

  toast.error = (message, options) => {
    const now = Date.now();
    const key = typeof message === 'string' ? message : JSON.stringify(message);
    const lastTime = toastIdMap.get(key);
    if (lastTime && now - lastTime < DEDUPE_TIME) return null;
    toastIdMap.set(key, now);
    return originalError(message, options);
  };

  toast.success = (message, options) => {
    const now = Date.now();
    const key = typeof message === 'string' ? message : JSON.stringify(message);
    const lastTime = toastIdMap.get(key);
    if (lastTime && now - lastTime < DEDUPE_TIME) return null;
    toastIdMap.set(key, now);
    return originalSuccess(message, options);
  };
} catch (e) {
  console.warn("Failed to patch toast error deduplication:", e.message);
}

// Request deduplication system
const pendingRequestsMap = new Map();

const getRequestKey = (config) => {
  const method = config.method?.toLowerCase() || 'get';
  const url = config.url || '';
  const params = typeof config.params === 'object' ? JSON.stringify(config.params) : '';
  const data = typeof config.data === 'object' ? JSON.stringify(config.data) : '';
  return `${method}:${url}:${params}:${data}`;
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("dizipay_user_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const devToken = sessionStorage.getItem("dizipay_developer_token");
  if (devToken) {
    config.headers["x-developer-token"] = devToken;
  }

  // Add Idempotency Key for mutation methods
  if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase())) {
    config.headers['x-idempotency-key'] = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  // Request deduplication
  const key = getRequestKey(config);
  if (pendingRequestsMap.has(key)) {
    const source = axios.CancelToken.source();
    config.cancelToken = source.token;
    config.__isDuplicate = true;
    config.__duplicateKey = key;
  } else {
    pendingRequestsMap.set(key, { resolves: [], rejects: [] });
  }

  return config;
});

import { getErrorContext, sanitizeErrorMessage } from "../utils/sanitizeErrorMessage";

api.interceptors.response.use(
  (response) => {
    const key = getRequestKey(response.config);
    const waiters = pendingRequestsMap.get(key);
    if (waiters) {
      waiters.resolves.forEach(resolve => resolve(response));
      pendingRequestsMap.delete(key);
    }
    return response;
  },
  (error) => {
    // Handle duplicated cancelled requests
    if (axios.isCancel(error) && error.config?.__isDuplicate) {
      const key = error.config.__duplicateKey;
      return new Promise((resolve, reject) => {
        const waiters = pendingRequestsMap.get(key);
        if (waiters) {
          waiters.resolves.push(resolve);
          waiters.rejects.push(reject);
        } else {
          reject(error);
        }
      });
    }

    const key = error.config ? getRequestKey(error.config) : null;
    if (key) {
      const waiters = pendingRequestsMap.get(key);
      if (waiters) {
        waiters.rejects.forEach(reject => reject(error));
        pendingRequestsMap.delete(key);
      }
    }

    const errorContext = getErrorContext(error);
    const sanitizedMessage = sanitizeErrorMessage(error, { context: errorContext });
    
    // Decorate the error object with safeMessage for backward-compatible error reads
    if (error && typeof error === "object") {
      try {
        error.safeMessage = sanitizedMessage;
      } catch (e) {
        error = { ...error, safeMessage: sanitizedMessage };
      }
    } else {
      error = { safeMessage: sanitizedMessage };
    }

    const status = error.response?.status;
    const errCode = error.response?.data?.code;

    // Automatically clear token/caches on 401 or 403
    if (status === 401 || status === 403) {
      sessionStorage.removeItem("dizipay_developer_token");
      localStorage.removeItem("developer_verified");
      localStorage.removeItem("developer_token");
      sessionStorage.removeItem("developer_verified");
      sessionStorage.removeItem("developer_session");
      localStorage.removeItem("developer_session");
      sessionStorage.removeItem("developer_auth_cache");
      localStorage.removeItem("developer_auth_cache");
      
      for (let k in localStorage) {
        if (k.includes("developer")) localStorage.removeItem(k);
      }
      for (let k in sessionStorage) {
        if (k.includes("developer")) sessionStorage.removeItem(k);
      }
      
      window.dispatchEvent(new Event("developer_session_expired"));
    }

    if (status === 401) {
      localStorage.removeItem("dizipay_user_token");
      localStorage.removeItem("dizipay_user_data");
      
      for (let k in localStorage) {
        if (k.includes("user")) localStorage.removeItem(k);
      }
      for (let k in sessionStorage) {
        if (k.includes("user")) sessionStorage.removeItem(k);
      }
      
      if (!window.location.pathname.includes('/login')) {
        window.location.href = "/login";
      }
    } else if (status === 403 && errCode === "DEVELOPER_AUTH_REQUIRED") {
      // Silent handling: do NOT toast for DEVELOPER_AUTH_REQUIRED
      return Promise.reject(error);
    } else if (status === 403 && 
               (error.response?.data?.message?.toLowerCase().includes("developer") || 
                error.config?.url?.includes("/developer") || 
                error.config?.url?.includes("/manifest"))) {
      // Also silent handling
      return Promise.reject(error);
    } else if (status !== 404 && !["login", "otp", "register"].includes(errorContext)) {
      toast.error(sanitizedMessage);
    }
    
    return Promise.reject(error);
  }
);

export default api;
