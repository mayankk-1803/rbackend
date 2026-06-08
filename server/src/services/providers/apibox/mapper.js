/**
 * Normalizes Apibox response format
 * Handles Apibox typos like ERROR_MASSAGE
 */
export const normalizeResponse = (raw) => {
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
    providerTxnId: raw.operator_ref || raw.operatorTxnId || raw.OPTXNID || raw.TXNID || null,
    raw
  };
};
