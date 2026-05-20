/**
 * Sanitizes technical, database, provider, or network errors into clean,
 * consumer-friendly messages. Prevents brand leaks and stack trace exposure.
 *
 * @param {any} error - The caught error object, message string, or event.
 * @returns {string} - A sanitized, user-friendly error message.
 */
/**
 * Sanitizes technical, database, provider, or network errors into clean,
 * consumer-friendly messages. Prevents brand leaks and stack trace exposure.
 *
 * @param {any} error - The caught error object, message string, or event.
 * @param {boolean} [isSuccess=false] - Whether this is a success message.
 * @returns {string} - A sanitized, user-friendly error message.
 */
export function sanitizeErrorMessage(error, isSuccess = false) {
  if (!error) {
    return isSuccess ? "Action completed successfully" : "Something went wrong. Please try again.";
  }

  let message = "";

  // Extract raw error string safely
  if (typeof error === "string") {
    message = error;
  } else if (typeof error === "object") {
    if (error.response?.data?.message && typeof error.response.data.message === "string") {
      message = error.response.data.message;
    } else if (error.message && typeof error.message === "string") {
      message = error.message;
    } else if (error.data?.message && typeof error.data.message === "string") {
      message = error.data.message;
    }
  }

  message = message ? String(message).trim() : "";
  const lowerMsg = message.toLowerCase();

  // Approved success messages
  const approvedSuccess = [
    "recharge successful",
    "recharge completed successfully",
    "payment successful",
    "wallet updated successfully",
    "coins redeemed successfully",
    "cashback received",
    "action completed successfully"
  ];

  // Approved error messages
  const approvedErrors = [
    "please check your internet connection.",
    "unable to connect right now.",
    "recharge could not be processed.",
    "recharge failed. please try again.",
    "automatic detection unavailable.",
    "please select operator manually.",
    "payment could not be completed.",
    "transaction failed. please retry.",
    "unable to process rewards.",
    "unable to redeem coins.",
    "something went wrong. please try again."
  ];

  // Determine if it matches an approved success message pattern
  const isSuccessMatch = isSuccess || approvedSuccess.some(s => lowerMsg.includes(s));

  if (isSuccessMatch) {
    const match = approvedSuccess.find(s => lowerMsg.includes(s));
    if (match) {
      if (match === "recharge successful") return "Recharge successful";
      if (match === "recharge completed successfully") return "Recharge completed successfully";
      if (match === "payment successful") return "Payment successful";
      if (match === "wallet updated successfully") return "Wallet updated successfully";
      if (match === "coins redeemed successfully") return "Coins redeemed successfully";
      if (match === "cashback received") return "Cashback received";
    }
    return "Action completed successfully";
  }

  // Exact check for already approved error messages
  const exactErrorMatch = approvedErrors.find(e => lowerMsg === e || lowerMsg === e.replace(/\.$/, ""));
  if (exactErrorMatch) {
    if (exactErrorMatch.includes("internet")) return "Please check your internet connection.";
    if (exactErrorMatch.includes("connect right now")) return "Unable to connect right now.";
    if (exactErrorMatch.includes("could not be processed")) return "Recharge could not be processed.";
    if (exactErrorMatch.includes("failed. please try again")) return "Recharge failed. Please try again.";
    if (exactErrorMatch.includes("automatic detection")) return "Automatic detection unavailable.";
    if (exactErrorMatch.includes("select operator manually")) return "Please select operator manually.";
    if (exactErrorMatch.includes("payment could not")) return "Payment could not be completed.";
    if (exactErrorMatch.includes("transaction failed")) return "Transaction failed. Please retry.";
    if (exactErrorMatch.includes("process rewards")) return "Unable to process rewards.";
    if (exactErrorMatch.includes("redeem coins")) return "Unable to redeem coins.";
    return "Something went wrong. Please try again.";
  }

  // Broad categorization of raw inputs
  if (
    lowerMsg.includes("hlr") ||
    lowerMsg.includes("detect") ||
    lowerMsg.includes("operator") ||
    lowerMsg.includes("circle")
  ) {
    return "Automatic detection unavailable.";
  }

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

  if (
    lowerMsg.includes("payment") ||
    lowerMsg.includes("order") ||
    lowerMsg.includes("pay-postpaid") ||
    lowerMsg.includes("gateway") ||
    lowerMsg.includes("nextgate") ||
    lowerMsg.includes("nexgate") ||
    lowerMsg.includes("decline") ||
    lowerMsg.includes("bank") ||
    lowerMsg.includes("insufficient wallet balance") ||
    lowerMsg.includes("insufficient")
  ) {
    return "Payment could not be completed.";
  }

  if (
    lowerMsg.includes("reward") ||
    lowerMsg.includes("cashback")
  ) {
    return "Unable to process rewards.";
  }

  if (
    lowerMsg.includes("redeem") ||
    lowerMsg.includes("coin")
  ) {
    return "Unable to redeem coins.";
  }

  if (
    lowerMsg.includes("recharge") ||
    lowerMsg.includes("apibox") ||
    lowerMsg.includes("ezytm") ||
    lowerMsg.includes("process") ||
    lowerMsg.includes("fail") ||
    lowerMsg.includes("error")
  ) {
    return "Recharge failed. Please try again.";
  }

  return "Something went wrong. Please try again.";
}
