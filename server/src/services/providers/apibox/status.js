import axios from "axios";
import { normalizeResponse } from "./mapper.js";

/**
 * Checks transaction status from Apibox
 */
export const checkStatus = async (txnId) => {
  const API_URL = process.env.APIBOX_BASE_URL || "https://Apibox.co.in/Api/Service";
  const API_TOKEN = process.env.APIBOX_TOKEN;

  try {
    const params = {
      ApiToken: API_TOKEN,
      RefTxnId: txnId.toString()
    };

    const response = await axios.get(`${API_URL}/StatusCheck`, {
      params,
      timeout: 10000
    });

    return normalizeResponse(response.data);
  } catch (error) {
    console.error(`[APIBOX STATUS ERROR] Txn ${txnId}:`, error.message);
    throw error;
  }
};
