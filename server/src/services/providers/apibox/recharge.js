import axios from "axios";
import { normalizeResponse } from "./mapper.js";

const TIMEOUT_MS = 15000;

/**
 * Executes recharge via Apibox API
 */
export const executeRecharge = async (payload) => {
  const { mobile, amount, operator, txnId } = payload;
  const API_URL = process.env.APIBOX_BASE_URL || "https://Apibox.co.in/Api/Service";
  const API_TOKEN = process.env.APIBOX_TOKEN;

  if (!API_TOKEN) {
    throw new Error("Provider config missing: APIBOX_TOKEN");
  }

  try {
    const params = {
      ApiToken: API_TOKEN,
      MobileNo: mobile,
      Amount: amount,
      OpId: operator,
      RefTxnId: txnId.toString(),
      P2A: "true"
    };

    console.log(`[APIBOX RECHARGE] Txn: ${txnId} | Mobile: ${mobile}`);

    const response = await axios.get(`${API_URL}/Recharge2`, {
      params,
      timeout: TIMEOUT_MS,
      headers: { 'User-Agent': 'Dizipay-Admin-Engine/1.0' }
    });

    return normalizeResponse(response.data);

  } catch (error) {
    console.error(`[APIBOX RECHARGE ERROR] Txn ${txnId}:`, error.message);
    
    // Check if it's a network/timeout error - mark as PENDING to be safe
    const isNetworkError = !error.response || error.code === 'ECONNABORTED' || error.response.status >= 500;
    
    return {
      success: isNetworkError,
      status: isNetworkError ? "PENDING" : "FAILED",
      message: error.message || "Apibox connection failed",
      raw: error.response?.data || null
    };
  }
};
