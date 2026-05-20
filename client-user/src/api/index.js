import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://rchserver.irecharge.in/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("dizipay_user_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Add Idempotency Key for mutation methods
  if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase())) {
    config.headers['x-idempotency-key'] = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  return config;
});

import toast from "react-hot-toast";
import { sanitizeErrorMessage } from "../utils/sanitizeErrorMessage";

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const sanitizedMessage = sanitizeErrorMessage(error);
    
    // Decorate the error object with safeMessage for backward-compatible error reads
    if (error && typeof error === "object") {
      try {
        error.safeMessage = sanitizedMessage;
      } catch (e) {
        // Fallback decoration if the error object is frozen
        error = { ...error, safeMessage: sanitizedMessage };
      }
    } else {
      error = { safeMessage: sanitizedMessage };
    }

    // Keep auth redirect flow intact, but use safeMessage if displayed anywhere
    if (error.response?.status === 401) {
      localStorage.removeItem("dizipay_user_token");
      localStorage.removeItem("dizipay_user_data");
      if (!window.location.pathname.includes('/login')) {
        window.location.href = "/login";
      }
    } else if (error.response?.status !== 404) {
      toast.error(sanitizedMessage);
    }
    
    return Promise.reject(error);
  }
);

export default api;

