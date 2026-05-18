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
    const token = localStorage.getItem("dizipay_admin_token");
    
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

const lastToast = { message: "", time: 0 };
const showToastOnce = (message, type = "error") => {
  const now = Date.now();
  if (lastToast.message === message && now - lastToast.time < 3000) return;
  lastToast.message = message;
  lastToast.time = now;
  toast[type](message);
};

api.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      console.log(` [API Response] ${response.status} ${response.config.url}`, response.data);
    }
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || "Something went wrong";

    if (status === 401) {
      localStorage.removeItem("dizipay_admin_token");
      localStorage.removeItem("dizipay_admin_data");
      window.location.href = "/admin/login";
    } else if (status === 429) {
      showToastOnce("Rate limit exceeded. Please slow down.", "error");
    } else if (status !== 404) {
      showToastOnce(message, "error");
    }

    if (import.meta.env.DEV) {
      console.error(` [API Response Error] ${status || 'Network Error'} ${error.config?.url}:`, message);
    }

    return Promise.reject(error);
  }
);

export default api;
