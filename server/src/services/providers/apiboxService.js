import axios from "axios";
import dotenv from "dotenv";
import { redisClient } from "../../config/redis.js";

dotenv.config();

const API_URL = process.env.APIBOX_BASE_URL || "https://Apibox.co.in/Api/Service";
const API_TOKEN = process.env.APIBOX_TOKEN;
const TIMEOUT_MS = 20000;
const BREAKER_KEY = "provider:apibox:breaker";

/**
 * Normalizes Apibox response format
 * Handles Apibox typos like ERROR_MASSAGE
 */
const normalizeResponse = (raw) => {
  if (!raw) return { success: false, status: "FAILED", message: "Empty provider response" };

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

  try {
    // 1. Check Circuit Breaker
    const isBroken = await redisClient.get(BREAKER_KEY);
    if (isBroken) {
      console.warn(`[APIBOX][BREAKER_ACTIVE] Skipping request for Txn ${txnId}`);
      return { 
        success: true,
        status: "PENDING", 
        message: "Provider is currently unavailable. Please check status later.",
        isBreakerTriggered: true
      };
    }

    if (!API_TOKEN) {
      console.error("[APIBOX] Missing APIBOX_TOKEN");
      return { success: false, status: "FAILED", message: "Provider configuration missing" };
    }

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

    // Reset failure count on successful response (even if status is 3)
    await redisClient.del(`${BREAKER_KEY}:failures`);

    return normalizeResponse(response.data);

  } catch (error) {
    console.error(`[APIBOX ERROR] Txn ${txnId}:`, error.message);

    // Increment Failure Count for Breaker
    const failureCount = await redisClient.incr(`${BREAKER_KEY}:failures`);
    if (failureCount === 1) await redisClient.expire(`${BREAKER_KEY}:failures`, 300);
    
    if (failureCount >= 5) { // Recharges get 5 failures before tripping
      console.warn(`[APIBOX][CIRCUIT_BREAKER] Tripping breaker for 2 minutes`);
      await redisClient.setex(BREAKER_KEY, 120, "broken");
    }

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
