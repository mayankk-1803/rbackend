import { normalizeResponse } from "./mapper.js";
import { apiboxRequest } from "./client.js";

/**
 * Checks transaction status from Apibox
 */
export const checkStatus = async (txnId) => {
  try {
    const params = {
      RefTxnId: txnId.toString()
    };

    const responseData = await apiboxRequest("/StatusCheck", params, false);
    return normalizeResponse(responseData);
  } catch (error) {
    console.error(`[APIBOX STATUS ERROR] Txn ${txnId}:`, error.message);
    throw error;
  }
};
