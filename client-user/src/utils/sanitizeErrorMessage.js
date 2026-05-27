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
const extractMessage = (error) => {
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return "";

  if (error.response?.data?.message && typeof error.response.data.message === "string") {
    return error.response.data.message;
  }
  if (error.message && typeof error.message === "string") {
    return error.message;
  }
  if (error.data?.message && typeof error.data.message === "string") {
    return error.data.message;
  }
  return "";
};

const parseConfigData = (data) => {
  if (!data) return {};
  if (typeof data === "object") return data;
  if (typeof data !== "string") return {};

  try {
    return JSON.parse(data);
  } catch {
    return {};
  }
};

export function getErrorContext(error) {
  const config = error?.config || {};
  const url = String(config.url || "").toLowerCase();
  const method = String(config.method || "").toLowerCase();
  const payload = parseConfigData(config.data);

  if (url.includes("/auth/login-email")) return "login";
  if (url.includes("/auth/register-email")) return "register";
  if (url.includes("/auth/send-otp")) return "otp";
  if (url.includes("/auth/verify-otp")) {
    return payload.name || payload.email || payload.referralCode ? "register" : "otp";
  }

  if (url.includes("/payment/") || url.includes("/imart/checkout")) return "payment";
  if (url.includes("/recharge") || url.includes("operator") || url.includes("plans")) return "recharge";
  if (method === "post" && url.includes("/wallet")) return "payment";

  return "";
}

export function sanitizeErrorMessage(error, isSuccessOrOptions = false) {
  const options = typeof isSuccessOrOptions === "object" && isSuccessOrOptions !== null
    ? isSuccessOrOptions
    : { isSuccess: Boolean(isSuccessOrOptions) };
  const isSuccess = Boolean(options.isSuccess);
  const context = options.context || getErrorContext(error);

  if (!error) {
    return isSuccess ? "Order Placed Successfully" : "Something went wrong";
  }

  const message = String(extractMessage(error) || "").trim();
  const lowerMsg = message.toLowerCase();

  if (lowerMsg.includes("password") || lowerMsg.includes("mustchangepassword")) {
    return message;
  }

  const friendlyMessages = new Map([
    ["login failed", "Login failed"],
    ["invalid credentials", "Invalid credentials"],
    ["invalid email or password", "Invalid credentials"],
    ["incorrect password", "Incorrect password"],
    ["account not found", "Account not found"],
    ["enter valid phone number", "Enter valid phone number"],
    ["email and password required", "Email and password required"],
    ["otp verification failed", "OTP verification failed"],
    ["invalid otp", "OTP verification failed"],
    ["verification failed", "OTP verification failed"],
    ["enter 6-digit otp", "Enter 6-digit OTP"],
    ["otp sent successfully", "OTP sent successfully"],
    ["registration failed", "Registration failed"],
    ["please fill all required fields", "Please fill all required fields"],
    ["passwords do not match", "Passwords do not match"],
    ["password must be at least 8 characters", "Password must be at least 8 characters"],
    ["account created successfully!", "Account created successfully!"],
    ["welcome back!", "Welcome back!"],
    ["recharge failed", "Recharge failed"],
    ["recharge could not be processed.", "Recharge failed"],
    ["payment failed", "Payment failed"],
    ["payment could not be completed.", "Payment failed"],
    ["something went wrong", "Something went wrong"],
    ["something went wrong. please try again.", "Something went wrong"],
  ]);

  if (friendlyMessages.has(lowerMsg)) {
    return friendlyMessages.get(lowerMsg);
  }

  if (context === "login") {
    if (lowerMsg.includes("invalid credentials") || lowerMsg.includes("invalid email") || lowerMsg.includes("invalid login")) {
      return "Invalid credentials";
    }
    if (lowerMsg.includes("incorrect password") || lowerMsg.includes("wrong password") || lowerMsg.includes("password")) {
      return "Incorrect password";
    }
    if (lowerMsg.includes("not found") || lowerMsg.includes("no user") || lowerMsg.includes("account")) {
      return "Account not found";
    }
    return "Login failed";
  }

  if (context === "otp") {
    return "OTP verification failed";
  }

  if (context === "register") {
    return "Registration failed";
  }

  if (lowerMsg.includes("refund")) return "Refund processed";
  if (lowerMsg.includes("queued") || lowerMsg.includes("pending review")) return "Recharge queued";
  if (lowerMsg.includes("processing")) return "Recharge processing";

  if (isSuccess || lowerMsg.includes("success") || lowerMsg.includes("approved") || lowerMsg.includes("placed")) {
    if (lowerMsg.includes("recharge")) return "Recharge Successful";
    return "Order Placed Successfully";
  }

  // Broad categorization of raw inputs
  if (
    lowerMsg.includes("hlr") ||
    lowerMsg.includes("detect") ||
    lowerMsg.includes("operator") ||
    lowerMsg.includes("circle")
  ) {
    return "Something went wrong";
  }

  if (
    lowerMsg.includes("network") ||
    lowerMsg.includes("conn") ||
    lowerMsg.includes("offline") ||
    lowerMsg.includes("internet")
  ) {
    return "Something went wrong";
  }

  if (
    lowerMsg.includes("timeout") ||
    lowerMsg.includes("exceeded") ||
    lowerMsg.includes("socket")
  ) {
    return "Something went wrong";
  }

  if (context === "payment" || (
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
  )) {
    return "Payment failed";
  }

  if (
    lowerMsg.includes("reward") ||
    lowerMsg.includes("cashback")
  ) {
    return "Something went wrong";
  }

  if (
    lowerMsg.includes("redeem") ||
    lowerMsg.includes("coin")
  ) {
    return "Something went wrong";
  }

  if (context === "recharge" || (
    lowerMsg.includes("recharge") ||
    lowerMsg.includes("apibox") ||
    lowerMsg.includes("ezytm") ||
    lowerMsg.includes("process") ||
    lowerMsg.includes("fail") ||
    lowerMsg.includes("error")
  )) {
    return "Recharge failed";
  }

  return "Something went wrong";
}
