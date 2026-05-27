import crypto from "crypto";

// In-memory alert cache to prevent log spamming of duplicate alerts within a 1-minute window
const alertCache = new Map();

/**
 * Recursively masks sensitive fields such as secrets, tokens, signatures, api keys, and passwords.
 */
export const maskSensitive = (data) => {
  if (!data) return data;
  if (typeof data !== "object") return data;

  const sensitiveKeys = [
    "apikey", "api_key", "secret", "token", "signature", 
    "x-webhook-signature", "x-webhook-secret", "authorization", 
    "password", "cvv", "pin", "credential"
  ];

  const masked = Array.isArray(data) ? [] : {};

  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const val = data[key];
      const lowerKey = key.toLowerCase();
      
      if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
        masked[key] = "[REDACTED]";
      } else if (typeof val === "object" && val !== null) {
        masked[key] = maskSensitive(val);
      } else {
        masked[key] = val;
      }
    }
  }
  return masked;
};

/**
 * Outputs a machine-searchable, JSON-safe structured log line.
 */
export const structuredLog = ({
  level = "info",
  eventType,
  correlationId,
  paymentId,
  adminId,
  targetUserId,
  message,
  metadata = {}
}) => {
  const logPayload = {
    timestamp: new Date().toISOString(),
    level: level.toLowerCase(),
    eventType: eventType ? eventType.toUpperCase() : "UNKNOWN",
    correlationId: correlationId || "N/A",
    paymentId: paymentId ? Number(paymentId) : null,
    adminId: adminId ? Number(adminId) : null,
    targetUserId: targetUserId ? Number(targetUserId) : null,
    message,
    metadata: maskSensitive(metadata)
  };

  const output = JSON.stringify(logPayload);

  if (level.toLowerCase() === "error") {
    console.error(output);
  } else if (level.toLowerCase() === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
};

/**
 * Logs a high-priority alert, throttled to at most once per 60 seconds per key to avoid spam.
 */
export const structuredAlert = (params) => {
  const alertKey = `${params.eventType}:${params.message}`;
  const now = Date.now();
  const lastLogged = alertCache.get(alertKey);

  if (lastLogged && (now - lastLogged < 60000)) {
    // Throttled: suppress to prevent log flood
    return;
  }

  alertCache.set(alertKey, now);
  structuredLog({ ...params, level: params.level || "warn" });
};
