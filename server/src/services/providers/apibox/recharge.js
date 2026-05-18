import { normalizeResponse } from "./mapper.js";
import { apiboxRequest } from "./client.js";

/**
 * Executes recharge via Apibox API
 */
export const executeRecharge = async (payload) => {
  const { mobile, amount, operator, txnId } = payload;

  try {
    const params = {
      MobileNo: mobile,
      Amount: amount,
      OpId: operator,
      RefTxnId: txnId.toString(),
      P2A: "true"
    };

    console.log(`[APIBOX RECHARGE] Txn: ${txnId} | Mobile: ${mobile}`);

    const responseData = await apiboxRequest("/Recharge2", params, false);

    return normalizeResponse(responseData);

  } catch (error) {
    console.error(`[APIBOX RECHARGE ERROR] Txn ${txnId}:`, error.message);
    
    // Check if it's a network/timeout error - mark as PENDING to be safe
    const isNetworkError = !error.status || error.code === 'ECONNABORTED' || error.status >= 500;
    
    return {
      success: isNetworkError,
      status: isNetworkError ? "PENDING" : "FAILED",
      message: error.message || "Apibox connection failed",
      raw: error.raw || null
    };
  }
};
