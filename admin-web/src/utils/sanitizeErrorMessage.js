export function sanitizeErrorMessage(error, isSuccess = false) {
  if (isSuccess) return "Order Placed Successfully";

  const raw = typeof error === "string"
    ? error
    : error?.response?.data?.message || error?.message || "";

  const message = String(raw).toLowerCase();

  if (
    message.includes("credential") ||
    message.includes("password") ||
    message.includes("auth")
  ) {
    return raw;
  }

  if (
    message.includes("payment") ||
    message.includes("gateway") ||
    message.includes("order") ||
    message.includes("declined") ||
    message.includes("failed")
  ) {
    return "Payment Failed";
  }

  if (message.includes("recharge") && message.includes("success")) {
    return "Recharge Successful";
  }

  return "Something went wrong";
}
