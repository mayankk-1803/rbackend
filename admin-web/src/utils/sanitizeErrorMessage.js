export function sanitizeErrorMessage(error, isSuccess = false) {
  if (isSuccess) return "Order Placed Successfully";

  const raw = typeof error === "string"
    ? error
    : error?.response?.data?.message || error?.response?.data?.error || error?.response?.data?.msg || error?.message || "";

  const message = String(raw).toLowerCase();

  // 1. If it's a standard HTTP status error from the backend with an explicit message, return it directly
  if (error && typeof error !== "string" && error.response) {
    const backendMessage = error.response.data?.message || error.response.data?.error || error.response.data?.msg;
    if (backendMessage) {
      return backendMessage;
    }
    
    // Handle plain text response (if not HTML)
    if (typeof error.response.data === "string" && !error.response.data.includes("<html") && !error.response.data.includes("<!doctype")) {
      return error.response.data;
    }
  }

  // 2. Credentials, passwords, auth errors
  if (
    message.includes("credential") ||
    message.includes("password") ||
    message.includes("auth")
  ) {
    return raw;
  }

  // 3. Permission, access denied, read-only errors
  if (
    message.includes("access denied") ||
    message.includes("permission") ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("read-only") ||
    message.includes("read only") ||
    message.includes("privilege")
  ) {
    return raw;
  }

  // 4. Payment, recharge, gateway, order, wallet (preserve existing sanitization behavior)
  // Ensure we don't catch generic client/network "Request failed" messages
  if (
    !message.includes("request failed") &&
    (
      message.includes("payment") ||
      message.includes("gateway") ||
      message.includes("order") ||
      message.includes("declined") ||
      (message.includes("failed") && (message.includes("recharge") || message.includes("wallet") || message.includes("transaction") || message.includes("payment") || message.includes("pay")))
    )
  ) {
    return "Payment Failed";
  }

  if (message.includes("recharge") && message.includes("success")) {
    return "Recharge Successful";
  }

  // 5. Raw response status for 400, 401, 403, 404, 409, 422 (validation/RBAC errors)
  if (
    error &&
    typeof error !== "string" &&
    error.response &&
    [400, 401, 403, 404, 409, 422].includes(error.response.status)
  ) {
    if (error.response.status === 403) return "Permission denied";
    if (error.response.status === 401) return "Unauthorized session";
    return raw;
  }

  // 6. Fallback for unexpected exceptions or network failures (where response is missing)
  return "Something went wrong";
}
