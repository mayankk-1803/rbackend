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
    const token = localStorage.getItem("token");
    
    if (import.meta.env.DEV) {
      console.log(` [API Request] ${config.method?.toUpperCase()} ${config.url} | Auth: ${token ? "YES" : "NO"}`);
    }
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
      if (import.meta.env.DEV) {
        console.error(" [Unauthorized] Session expired or invalid. Redirecting to login...");
      }
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/admin/login";
    }

    if (import.meta.env.DEV) {
      console.error(` [API Response Error] ${status || 'Network Error'} ${error.config?.url}:`, message);
    }

    return Promise.reject(error);
  }
);

export default api;
