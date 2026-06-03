import AppError from "../utils/AppError.js";

const cleanClientMessage = (err) => {
  const raw = String(err?.message || err?.code || "").toLowerCase();
  if (
    raw.includes("invalid credentials") ||
    raw.includes("wrong credentials") ||
    raw.includes("invalid password") ||
    raw.includes("authentication failed") ||
    raw.includes("login failed") ||
    raw.includes("user not found") ||
    raw.includes("credential")
  ) {
    return "Invalid credentials";
  }
  if (raw.includes("no account found") || raw.includes("account not found")) {
    return "No account found with this email";
  }
  if (raw.includes("unable to send") || raw.includes("failed to send")) {
    return "Unable to send reset email";
  }
  if (raw.includes("invalid or expired reset code") || raw.includes("expired reset code")) {
    return "Invalid or expired reset code";
  }
  if (raw.includes("refund")) return "Refund processed";
  if (raw.includes("queued") || raw.includes("pending_review") || raw.includes("pending review")) return "Recharge queued";
  if (raw.includes("processing")) return "Recharge processing";
  if (raw.includes("recharge") && raw.includes("failed")) return "Recharge failed";
  if (raw.includes("recharge") && raw.includes("success")) return "Recharge Successful";
  if (raw.includes("insufficient")) return "Insufficient Wallet Balance";
  if (
    raw.includes("payment") ||
    raw.includes("gateway") ||
    raw.includes("order") ||
    raw.includes("declined")
  ) return "Payment Failed";
  return "Something went wrong";
};

/**
 * Global error handling middleware.
 */
/**
 * Global error handling middleware.
 */
export const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.code = err.code || 'INTERNAL_ERROR';

  // Production vs Development error response
  const isDev = process.env.NODE_ENV === 'development';

  console.error(`[ERROR][${err.code}] ${err.message}`, {
    path: req.originalUrl,
    method: req.method,
    stack: isDev ? err.stack : undefined,
    metadata: err.metadata
  });

  // Prisma unique constraint error
  if (err.code === 'P2002') {
    return res.status(400).json({
      success: false,
      code: 'DUPLICATE_ENTRY',
      message: "Something went wrong"
    });
  }

  // Axios/Network errors from providers
  if (err.isAxiosError) {
    return res.status(err.response?.status || 502).json({
      success: false,
      code: 'PROVIDER_ERROR',
      message: "Payment Failed"
    });
  }

  // Handle operational vs programming errors
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: cleanClientMessage(err)
    });
  }

  return res.status(err.statusCode).json({
    success: false,
    code: err.code,
    message: cleanClientMessage(err)
  });
};
