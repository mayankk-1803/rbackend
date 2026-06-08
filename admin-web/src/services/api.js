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

    // Attach Master Key Session token if active and valid
    if (window.masterKeySession && window.masterKeySessionExpiry && window.masterKeySessionExpiry > Date.now()) {
      config.headers["x-master-key-session"] = window.masterKeySession;
    } else {
      window.masterKeySession = null;
      window.masterKeySessionExpiry = null;
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
    const config = error.config;

    // Phase 3 - Normalize message and code extraction
    const msg =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      "";

    const code =
      error?.response?.data?.code || "";

    // Phase 7 - Console Trace Logging
    console.log(
      "[MASTER KEY]",
      {
        status,
        code,
        msg
      }
    );

    const isMasterKeyReq = status === 403 && (
      code === "MASTER_KEY_REQUIRED" ||
      code === "MASTER_KEY_EXPIRED" ||
      msg.includes("Master Key")
    );

    const message = sanitizeErrorMessage(error);

    if (status === 401) {
      sessionStorage.removeItem("dizipay_admin_token");
      sessionStorage.removeItem("dizipay_admin_data");
      localStorage.removeItem("dizipay_admin_last_activity");
      window.location.href = "/87564/admin/login";
    } else if (status === 429) {
      toast.error("Rate limit exceeded. Please slow down.");
    } else if (isMasterKeyReq) {
      if (config && config._masterKeyRetried) {
        return Promise.reject(error);
      }

      return new Promise((resolve, reject) => {
        // Phase 7 - Console Replay Trace
        console.log(
          "[MASTER KEY REPLAY]",
          config.url
        );

        const event = new CustomEvent("TRIGGER_MASTER_KEY_PROMPT", {
          detail: {
            requestConfig: error.config,
            resolve: (sessionToken) => {
              if (config) {
                config.headers["x-master-key-session"] = sessionToken;
                config._masterKeyRetried = true;
                api(config).then(resolve).catch(reject);
              } else {
                reject(error);
              }
            },
            reject: (err) => {
              // Phase 6 - Toast specific error message instead of generic fallback
              const errorText = err?.message || sanitizeErrorMessage(err || error) || "Master Key authorization required.";
              toast.error(errorText);
              reject(err || error);
            }
          }
        });
        window.dispatchEvent(event);
      });
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
