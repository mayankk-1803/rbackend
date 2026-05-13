import { normalizeResponse } from "./mapper.js";

/**
 * Processes incoming webhook from Apibox
 */
export const processWebhook = (payload) => {
  // Apibox usually sends data as query params or body
  // Normalize it using our mapper
  const normalized = normalizeResponse(payload);
  
  return {
    txnId: payload.RefTxnId,
    status: normalized.status,
    providerTxnId: normalized.providerTxnId,
    message: normalized.message,
    raw: payload
  };
};
