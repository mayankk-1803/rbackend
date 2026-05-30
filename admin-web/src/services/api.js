import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://rchserver.irecharge.in/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor: Add Auth Token & Logging
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem("dizipay_admin_token");
    
    if (import.meta.env.DEV) {
      console.log(` [API Request] ${config.method?.toUpperCase()} ${config.url} | Auth: ${token ? "YES" : "NO"}`);
    }
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add Idempotency Key for mutation methods
    if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase())) {
      config.headers['x-idempotency-key'] = `admin_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    
    return config;

  },
  (error) => {
    if (import.meta.env.DEV) {
      console.error(" [API Request Error]", error);
    }
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle Global Errors & Logging
import toast from "react-hot-toast";
import { sanitizeErrorMessage } from "../utils/sanitizeErrorMessage";

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

api.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      console.log(` [API Response] ${response.status} ${response.config.url}`, response.data);
    }
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const message = sanitizeErrorMessage(error);

    if (status === 401) {
      sessionStorage.removeItem("dizipay_admin_token");
      sessionStorage.removeItem("dizipay_admin_data");
      localStorage.removeItem("dizipay_admin_last_activity");
      window.location.href = "/87564/admin/login";
    } else if (status === 429) {
      toast.error("Rate limit exceeded. Please slow down.");
    } else if (status !== 404) {
      toast.error(message);
    }

    if (import.meta.env.DEV) {
      console.error(` [API Response Error] ${status || 'Network Error'} ${error.config?.url}:`, message);
    }

    return Promise.reject(error);
  }
);

export default api;
