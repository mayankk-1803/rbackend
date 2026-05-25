import axios from 'axios';
import { sanitizeErrorMessage } from '../utils/sanitizeErrorMessage';

const BASE_URL = import.meta.env.VITE_API_URL || "https://rchserver.irecharge.in/api";

/**
 * Clean axios instance for Developer API testing
 * Bypasses the main app's JWT interceptors to simulate external developer requests
 */
const devClient = axios.create({
  baseURL: `${BASE_URL}/v1/dev`,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Centralized request executor for the API Tester
 */
export const executeApiRequest = async ({ method, path, data, headers }) => {
  const start = Date.now();
  try {
    const response = await devClient({
      method,
      url: path,
      data,
      headers
    });
    
    return {
      success: true,
      status: response.status,
      data: response.data,
      latency: Date.now() - start
    };
  } catch (err) {
    const safeMessage = sanitizeErrorMessage(err);
    return {
      success: false,
      status: err.response?.status || 0,
      data: { message: safeMessage },
      latency: Date.now() - start
    };
  }
};

export default devClient;
