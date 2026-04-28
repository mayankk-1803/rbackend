import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor: Add Auth Token & Logging
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("adminToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    console.log("API CALL:", config.baseURL + config.url);
    
    // Log request in development
    if (import.meta.env.DEV) {
      console.log(`🚀 [API Request] ${config.method?.toUpperCase()} ${config.url}`, config.data || "");
    }
    
    return config;
  },
  (error) => {
    console.error("❌ [API Request Error]", error);
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle Global Errors & Logging
api.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      console.log(`✅ [API Response] ${response.status} ${response.config.url}`, response.data);
    }
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || "Something went wrong";

    if (status === 401) {
      console.error("🔒 [Unauthorized] Redirecting to login...");
      localStorage.removeItem("adminToken");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }

    if (import.meta.env.DEV) {
      console.error(`❌ [API Response Error] ${status || 'Network Error'} ${error.config?.url}:`, message);
    }

    return Promise.reject(error);
  }
);

export default api;
