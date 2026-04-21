import axios from 'axios';

const baseURL = 'http://192.168.0.228:5000';
// Placeholder token - in a real app this would be fetched from SecureStore/AsyncStorage
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5ZTQ2NDIxMThlOTQ2MGI2YmQyODFjZiIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc3NjYwNTE0NiwiZXhwIjoxNzc3MjA5OTQ2fQ.RDxAunTSJ5B7yZi5IZTvfzTE5UICf7FmoWeqP_D1qck';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    config.headers.Authorization = `Bearer ${JWT_TOKEN}`;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
