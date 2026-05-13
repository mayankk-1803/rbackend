import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const API_URL = process.env.APIBOX_BASE_URL || "https://Apibox.co.in/Api/Service";
const API_TOKEN = process.env.APIBOX_TOKEN;
const TIMEOUT_MS = 15000;

/**
 * Normalizes Apibox response format
 * Handles Apibox typos like ERROR_MASSAGE
 */
const normalizeResponse = (raw) => {
  console.log("RAW PROVIDER RESPONSE:", raw);

  const status = Number(raw.STATUS);
  let mappedStatus = "FAILED";
  let success = false;

  if (status === 1) {
    mappedStatus = "SUCCESS";
    success = true;
  } else if (status === 2) {
    mappedStatus = "PENDING";
    success = true;
  } else if (status === 3) {
    mappedStatus = "FAILED";
    success = false;
  }

  // Handle Apibox typo: ERROR_MASSAGE
  const providerMessage = raw.ERROR_MASSAGE || raw.MESSAGE || raw.MSG || raw.ERROR || "Provider Error";
  console.log("PROVIDER MESSAGE:", providerMessage);

  return {
    success,
    status: mappedStatus,
    message: providerMessage,
    providerTxnId: raw.OPTXNID || raw.TXNID || null,
    raw
  };
};

/**
 * Executes recharge via Apibox API
 */
export const executeApiboxRecharge = async (payload) => {
  const { mobile, amount, operator, txnId } = payload;

  if (!API_TOKEN) {
    console.error("[APIBOX] Missing APIBOX_TOKEN");
    return { success: false, status: "FAILED", message: "Provider config missing" };
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

    console.log(`[APIBOX REQUEST] Txn: ${txnId} | Mobile: ${mobile} | Amount: ${amount} | Op: ${operator}`);

    const response = await axios.get(`${API_URL}/Recharge2`, {
      params,
      timeout: TIMEOUT_MS,
      headers: {
        'User-Agent': 'Dizipay-Recharge-Engine/2.0'
      }
    });

    return normalizeResponse(response.data);

  } catch (error) {
    console.error(`[APIBOX ERROR] Txn ${txnId}:`, error.message);

    // If timeout or 5xx, treat as PENDING to avoid double recharge risk
    const isNetworkError = !error.response || error.code === 'ECONNABORTED' || error.response.status >= 500;
    
    return {
      success: isNetworkError,
      status: isNetworkError ? "PENDING" : "FAILED",
      message: error.message || "Apibox connection failed",
      raw: error.response?.data || null
    };
  }
};

// Alias for controller usage
export const rechargeWithApibox = executeApiboxRecharge;
