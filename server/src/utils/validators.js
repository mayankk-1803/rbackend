export const isValidIndianMobile = (mobile) => {
  if (!mobile) return false;
  
  // Convert to string to safely use string methods
  const mobileStr = String(mobile).trim();
  
  // Must be exactly 10 digits starting with 6, 7, 8, or 9
  const patternRegex = /^[6-9]\d{9}$/;
  if (!patternRegex.test(mobileStr)) {
    return false;
  }
  
  // Reject repetitive numbers (e.g. 9999999999)
  const repetitiveRegex = /^(\d)\1{9}$/;
  if (repetitiveRegex.test(mobileStr)) {
    return false;
  }
  
  return true;
};

export const isValidOperatorRef = (ref, transaction = {}) => {
  if (ref === null || ref === undefined) return false;
  const strRef = String(ref).trim();
  if (strRef === "") return false;

  const upperRef = strRef.toUpperCase();
  const invalidPlaceholders = [
    "PENDING",
    "TEST_OP_ID",
    "TEST_REF",
    "OP_SUCCESS",
    "UNKNOWN",
    "N/A",
    "NULL",
    "UNDEFINED"
  ];
  
  if (invalidPlaceholders.includes(upperRef)) return false;

  if (transaction) {
    if (transaction.id && strRef === String(transaction.id)) return false;
    if (transaction.paymentId && strRef === String(transaction.paymentId)) return false;
    if (transaction.orderId && strRef === String(transaction.orderId)) return false;
  }

  // Check general formats of fake references
  if (
    upperRef.startsWith("TEST_OP_ID") ||
    upperRef.startsWith("OP_SUCCESS") ||
    upperRef.startsWith("OP_FAIL") ||
    upperRef.startsWith("OP_FAKE") ||
    upperRef.startsWith("RECON_") ||
    upperRef.startsWith("NEXGATE_")
  ) {
    return false;
  }

  return true;
};

