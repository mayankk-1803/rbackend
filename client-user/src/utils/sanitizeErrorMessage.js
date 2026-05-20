/**
 * Sanitizes technical, database, provider, or network errors into clean,
 * consumer-friendly messages. Prevents brand leaks and stack trace exposure.
 *
 * @param {any} error - The caught error object, message string, or event.
 * @returns {string} - A sanitized, user-friendly error message.
 */
export function sanitizeErrorMessage(error) {
  if (!error) {
    return "Something went wrong. Please try again.";
  }

  let message = "";

  // Extract raw error string safely
  if (typeof error === "string") {
    message = error;
  } else if (typeof error === "object") {
    // Check common Axios / Fetch error structures
    if (error.response?.data?.message && typeof error.response.data.message === "string") {
      message = error.response.data.message;
    } else if (error.message && typeof error.message === "string") {
      message = error.message;
    } else if (error.data?.message && typeof error.data.message === "string") {
      message = error.data.message;
    }
  }

  // Trim and convert message, if none resolved, fallback immediately
  message = message ? String(message).trim() : "";
  if (!message) {
    return "Something went wrong. Please try again.";
  }

  const lowerMsg = message.toLowerCase();

  // 1. Whitelist safe, non-technical validation messages (Case Insensitive)
  const whitelist = [
    "please enter a valid mobile number",
    "please enter a valid 10-digit mobile number",
    "please select an operator",
    "please select operator",
    "amount is required",
    "please enter a valid amount",
    "please enter a valid bill amount",
    "insufficient wallet balance",
    "duplicate recharge attempt. please wait 5 minutes.",
    "automatic detection unavailable.",
    "please select operator manually.",
    "unable to load recharge plans.",
    "payment could not be completed.",
    "transaction failed. please retry.",
    "recharge could not be processed.",
    "please check your internet connection.",
    "unable to connect right now."
  ];

  if (whitelist.includes(lowerMsg)) {
    return message;
  }

  // 2. Regex checks for technical details, stack traces, database terms, tokens, and HTML/JSON structure
  const hasUrl = /http[s]?:\/\/[^\s]+/i.test(message);
  const hasIp = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/.test(message);
  const hasBearerToken = /bearer\s+[a-z0-9\-._~+/]+=*/i.test(message);
  const hasJwtToken = /ey[a-zA-Z0-9-_]+\.ey[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+/i.test(message);
  const hasSql = /(?:select|insert|update|delete|create|drop|alter|where|from|join|prisma|dbClient)/i.test(message);
  const hasHtml = /<[a-z][\s\S]*>/i.test(message);
  const hasJsonBlob = /\{[\s\S]*\}/.test(message);
  const hasStackOrTrace = /(?:stack|at\s+[\w\d_]+\.js|line\s+\d+|axioserror|exception|unhandled|referenceerror|typeerror)/i.test(message);

  if (hasUrl || hasIp || hasBearerToken || hasJwtToken || hasSql || hasHtml || hasJsonBlob || hasStackOrTrace) {
    return "Something went wrong. Please try again.";
  }

  // 3. Category Mapping & Stripping for Provider names/Gateway details
  // HLR / Operator Detection Failures
  if (
    lowerMsg.includes("hlr") ||
    lowerMsg.includes("detect") ||
    lowerMsg.includes("operator") ||
    lowerMsg.includes("circle")
  ) {
    return "Automatic detection unavailable.";
  }

  // Network / Connection Issues
  if (
    lowerMsg.includes("network") ||
    lowerMsg.includes("conn") ||
    lowerMsg.includes("offline") ||
    lowerMsg.includes("internet")
  ) {
    return "Please check your internet connection.";
  }

  if (
    lowerMsg.includes("timeout") ||
    lowerMsg.includes("exceeded") ||
    lowerMsg.includes("socket")
  ) {
    return "Unable to connect right now.";
  }

  // Plan loading failures
  if (
    lowerMsg.includes("plan") ||
    lowerMsg.includes("mplan")
  ) {
    return "Unable to load recharge plans.";
  }

  // Payment / Gateway / Bank failures
  if (
    lowerMsg.includes("payment") ||
    lowerMsg.includes("order") ||
    lowerMsg.includes("pay-postpaid") ||
    lowerMsg.includes("gateway") ||
    lowerMsg.includes("nextgate") ||
    lowerMsg.includes("ip_mismatch") ||
    lowerMsg.includes("decline") ||
    lowerMsg.includes("bank")
  ) {
    return "Payment could not be completed.";
  }

  // Recharge / Processing Failures
  if (
    lowerMsg.includes("recharge") ||
    lowerMsg.includes("apibox") ||
    lowerMsg.includes("ezytm") ||
    lowerMsg.includes("process")
  ) {
    return "Recharge could not be processed.";
  }

  // 4. Confidential Brand/Word Protection (Final filter check)
  const confidentialBrands = ["mplan", "ezytm", "hlr", "nextgate", "apibox", "redis", "prisma", "gateway", "vendor", "provider"];
  for (const brand of confidentialBrands) {
    if (lowerMsg.includes(brand)) {
      return "Something went wrong. Please try again.";
    }
  }

  // If the error message is generic, consumer-safe (short, no tech keywords), we can show it
  const isTooLong = message.length > 80;
  const hasTechKeywords = /(?:error|fail|reject|abort|invalid|bad|status|code|db|sql|redis|unauthorized|jwt)/i.test(message);

  if (!isTooLong && !hasTechKeywords) {
    return message;
  }

  return "Something went wrong. Please try again.";
}
