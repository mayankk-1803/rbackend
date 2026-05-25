import { normalizeResponse } from "./mapper.js";
import { apiboxRequest } from "./client.js";

/**
 * Checks transaction status from Apibox
 */
export const checkStatus = async (txnOrId) => {
  try {
    let refTxnId;

    if (txnOrId && typeof txnOrId === "object") {
      refTxnId = txnOrId.id;
    } else {
      refTxnId = txnOrId;
    }

    console.log(
      `[STATUS_CHECK] checking status for RefTxnId: ${refTxnId}`
    );

    const params = {
      RefTxnId: refTxnId.toString()
    };

    const responseData = await apiboxRequest(
      "/StatusCheck",
      params,
      false
    );

    const normalized = normalizeResponse(responseData);

    const statusVal = responseData?.STATUS !== undefined ? Number(responseData.STATUS) : null;
    const msg = (responseData?.MESSAGE || responseData?.MSG || responseData?.ERROR_MASSAGE || "").toString().toLowerCase();

    if (statusVal === 2 || msg.includes("processing") || msg.includes("pending") || msg.includes("request is processing")) {
      normalized.status = "PROCESSING";
      normalized.success = true;
    } else if (statusVal === 1) {
      normalized.status = "SUCCESS";
      normalized.success = true;
    } else {
      const isExplicitFailure = 
        statusVal === 3 ||
        msg.includes("fail") || 
        msg.includes("reject") || 
        msg.includes("decline") || 
        msg.includes("invalid") || 
        msg.includes("error") || 
        msg.includes("down") || 
        msg.includes("timeout") ||
        responseData?.ERRORCODE !== undefined;

      if (isExplicitFailure) {
        normalized.status = "FAILED";
        normalized.success = false;
      } else {
        normalized.status = "PROCESSING";
        normalized.success = true;
      }
    }

    return normalized;
  } catch (error) {
    console.error(
      `[APIBOX STATUS ERROR]`,
      error.message
    );

    throw error;
  }
};
