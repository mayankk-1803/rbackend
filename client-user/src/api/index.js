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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || "Spectral signal lost. Retrying...";
    
    if (error.response?.status === 401) {
      localStorage.removeItem("dizipay_user_token");
      localStorage.removeItem("dizipay_user_data");
      if (!window.location.pathname.includes('/login')) {
        window.location.href = "/login";
      }
    } else if (error.response?.status !== 404) {
      toast.error(message);
    }
    
    return Promise.reject(error);
  }
);

export default api;
