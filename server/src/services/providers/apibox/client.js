import axios from "axios";

const API_URL = process.env.APIBOX_BASE_URL || "https://Apibox.co.in/Api/Service";
const TIMEOUT_MS = 15000;

// Startup validation of environment variables
const validateConfig = () => {
  const token = process.env.APIBOX_TOKEN;
  const baseUrl = process.env.APIBOX_BASE_URL;

  if (!token || !token.trim()) {
    console.error("[APIBOX][CONFIG_INVALID] Missing APIBOX_TOKEN");
    return false;
  }
  if (!baseUrl || !baseUrl.trim()) {
    console.error("[APIBOX][CONFIG_INVALID] Missing APIBOX_BASE_URL");
    return false;
  }
  console.log("[APIBOX][CONFIG_VALID]");
  return true;
};

validateConfig();

export const apiboxRequest = async (endpoint, payload, isPost = false) => {
  const API_TOKEN = process.env.APIBOX_TOKEN?.trim();
  if (!API_TOKEN) {
    throw new Error("Provider config missing: APIBOX_TOKEN");
  }

  // Apibox official documentation specifies 'at' for Balance check, 'ApiToken' for Recharge/Status
  const authKey = endpoint.includes("/Balance") ? "at" : "ApiToken";
  const params = { [authKey]: API_TOKEN, ...payload };
  const url = `${API_URL}${endpoint}`;

  const maskedToken = `***${API_TOKEN.slice(-4)}`;
  const payloadKeys = Object.keys(params).join(", ");
  const logPrefix = endpoint.includes("/Balance") ? "[APIBOX][BALANCE_REQUEST]" : "[APIBOX][REQUEST]";

  console.log(`${logPrefix}\nEndpoint: ${endpoint}\nPayload Keys: ${payloadKeys}\nAuth: ${maskedToken}`);

  try {
    let response;
    if (isPost) {
      const formData = new URLSearchParams(params);
      response = await axios.post(url, formData, {
        headers: { 
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json"
        },
        timeout: TIMEOUT_MS
      });
    } else {
      response = await axios.get(url, {
        params,
        headers: { 
          "User-Agent": "Dizipay-Admin-Engine/1.0",
          "Accept": "application/json"
        },
        timeout: TIMEOUT_MS
      });
    }
    
    console.log(`[APIBOX][RESPONSE_SUCCESS]\nEndpoint: ${endpoint}\nStatus: ${response.status}\nBody:`, JSON.stringify(response.data));
    return response.data;
  } catch (error) {
    console.error(`[APIBOX][RESPONSE_ERROR]\nEndpoint: ${endpoint}\nStatus: ${error.response?.status || "N/A"}\nMessage: ${error.message}`);
    if (error.response) {
      error.raw = error.response.data;
      error.status = error.response.status;
    }
    throw error;
  }
};
