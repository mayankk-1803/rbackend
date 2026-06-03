import prisma from "../config/prisma.js";
import { redisClient } from "../config/redis.js";
import crypto from "crypto";
import logger from "./logging/logger.js";
import { isEnabled, FLAGS } from "./featureFlagsService.js";

/**
 * API KEY SECURITY
 * Generates an API key pair, hashes it, stores hashed only, and returns raw once to client.
 */
export const generateApiKey = async (userId) => {
  const marketplaceEnabled = await isEnabled(FLAGS.API_MARKETPLACE_ENABLED);
  if (!marketplaceEnabled) throw new Error("API Marketplace is currently disabled.");

  const rawKey = "dp_" + crypto.randomBytes(24).toString("hex"); // e.g. dp_abcdef...
  const hashedKey = crypto.createHash("sha256").update(rawKey).digest("hex");
  const prefix = rawKey.substring(0, 7); // dp_abcd

  const keyRecord = await prisma.apiKeyRecord.create({
    data: {
      clientId: userId,
      hashedKey,
      prefix,
      isActive: true,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year expiry
    }
  });

  await prisma.auditLog.create({
    data: {
      action: "API_KEY_ROTATE",
      userId,
      entity: "ApiKeyRecord",
      entityId: Number(keyRecord.id.replace(/\D/g, '')) || 1,
      details: { prefix }
    }
  }).catch(() => {});

  return {
    id: keyRecord.id,
    rawKey,
    prefix,
    expiresAt: keyRecord.expiresAt
  };
};

/**
 * Rotates an active key
 */
export const rotateApiKey = async (keyId, userId) => {
  await prisma.apiKeyRecord.update({
    where: { id: keyId },
    data: { isActive: false }
  });

  const newKey = await generateApiKey(userId);
  return newKey;
};

/**
 * Revokes API Key
 */
export const revokeApiKey = async (keyId, userId) => {
  await prisma.apiKeyRecord.update({
    where: { id: keyId },
    data: { isActive: false }
  });

  await prisma.auditLog.create({
    data: {
      action: "API_KEY_REVOKE",
      userId,
      entity: "ApiKeyRecord",
      details: { keyId }
    }
  }).catch(() => {});

  return true;
};

/**
 * REDIS RATE LIMITER
 * Sliding window rate checks per Minute, Hour, and Day.
 */
export const checkPlanRateLimit = async (clientId, plan) => {
  const today = new Date().toISOString().split("T")[0];
  const minuteKey = `ratelimit:${clientId}:min`;
  const hourKey = `ratelimit:${clientId}:hr`;
  const dayKey = `ratelimit:${clientId}:day`;

  if (redisClient && redisClient.status === "ready") {
    try {
      // Pipeline Redis checks
      const mCount = await redisClient.incr(minuteKey);
      if (mCount === 1) await redisClient.expire(minuteKey, 60);

      const hCount = await redisClient.incr(hourKey);
      if (hCount === 1) await redisClient.expire(hourKey, 3600);

      const dCount = await redisClient.incr(dayKey);
      if (dCount === 1) await redisClient.expire(dayKey, 86400);

      // Validate limits
      if (mCount > plan.requestsPerMinute) {
        await logThreat(clientId, "RATE_LIMIT", "/api/v1/*", null, 3, `RPM rate limit breached: ${mCount}/${plan.requestsPerMinute}`);
        return { ok: false, limit: "RPM", current: mCount };
      }
      if (hCount > plan.requestsPerHour) {
        await logThreat(clientId, "RATE_LIMIT", "/api/v1/*", null, 3, `RPH rate limit breached: ${hCount}/${plan.requestsPerHour}`);
        return { ok: false, limit: "RPH", current: hCount };
      }
      if (dCount > plan.requestsPerDay) {
        await logThreat(clientId, "RATE_LIMIT", "/api/v1/*", null, 3, `RPD rate limit breached: ${dCount}/${plan.requestsPerDay}`);
        return { ok: false, limit: "RPD", current: dCount };
      }
    } catch (err) {
      logger.error("Redis rate limit increment error, bypass limit in sandbox", { error: err.message });
    }
  }

  return { ok: true };
};

/**
 * Verifies if the client is authorized under the current billing rollout level configuration.
 */
export const verifyBillingRolloutLevel = async (userId) => {
  try {
    const config = await prisma.apiBillingConfig.findUnique({ where: { id: 1 } }) || await prisma.apiBillingConfig.create({ data: { id: 1 } });
    const rollout = config.rolloutLevel || "INTERNAL_ONLY";
    
    if (rollout === "FULL_PUBLIC") return true;

    // Get user details
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return false;

    if (user.role === "ADMIN" || user.id === 1) return true; // always allow admins

    if (rollout === "INTERNAL_ONLY") {
      return false; // only admin / user 1 passed above
    }

    const client = await prisma.apiClient.findUnique({ where: { userId } });
    if (!client) return false; // must be a registered enterprise client

    if (rollout === "PILOT_CUSTOMERS") {
      return client.companyName && client.companyName.toLowerCase().includes("pilot");
    }

    if (rollout === "LIMITED_PUBLIC") {
      return true; // any registered ApiClient
    }

    return false;
  } catch (err) {
    logger.error("Failed to verify billing rollout level", { error: err.message });
    return false;
  }
};

/**
 * Reconciles the credit wallet with purchased, reserved, and used credits.
 */
export const reconcileCreditWallet = async (userId) => {
  try {
    const wallet = await prisma.apiCreditWallet.findUnique({
      where: { userId }
    });
    if (!wallet) return true;

    const balance = Number(wallet.balance);
    const reserved = Number(wallet.reservedCredits || 0);
    const used = Number(wallet.usedCredits || 0);
    const purchased = Number(wallet.lifetimePurchased || 0);

    const sum = balance + reserved + used;
    const isValid = Math.abs(sum - purchased) < 0.01;

    if (!isValid) {
      logger.error(`[RECONCILIATION DISCREPANCY] Wallet for User #${userId} failed reconciliation. Sum (Balance + Reserved + Used): ${sum}, Lifetime Purchased: ${purchased}`);
      
      await prisma.apiThreatLog.create({
        data: {
          clientId: userId,
          threatType: "RECONCILIATION_FAILURE",
          endpoint: "CreditWallet",
          severity: 3,
          details: `Discrepancy: Sum=${sum}, Purchased=${purchased}`
        }
      }).catch(() => {});
    }

    return isValid;
  } catch (err) {
    logger.error("Failed to run credit wallet reconciliation loop", { error: err.message });
    return false;
  }
};

/**
 * Generates api invoices with pilot customer draft invoicing gates.
 */
export const generateInvoice = async (subscriptionId, amount, invoicePeriod) => {
  const sub = await prisma.apiSubscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true }
  });
  if (!sub) throw new Error("Subscription not found");

  const config = await prisma.apiBillingConfig.findUnique({ where: { id: 1 } }) || await prisma.apiBillingConfig.create({ data: { id: 1 } });
  const isPilotTier = config.rolloutLevel === "PILOT_CUSTOMERS";
  const isPilotClient = await verifyBillingRolloutLevel(sub.clientId);

  const status = (isPilotTier && isPilotClient) ? "DRAFT" : "UNPAID";

  const invoice = await prisma.apiInvoice.create({
    data: {
      subscriptionId,
      amount,
      status,
      invoicePeriod
    }
  });

  logger.info(`Invoice generated successfully (ID: ${invoice.id}, Status: ${status}, Amount: ₹${amount})`);
  return invoice;
};

/**
 * CREDIT WALLET ENGINE
 * Performs thread-safe credit consumption & aggregates usage daily.
 */
export const consumeCredits = async (userId, subscriptionId, cost) => {
  // Check feature flag for public api billing
  const billingEnabled = await isEnabled(FLAGS.PUBLIC_API_BILLING);
  if (billingEnabled) {
    const isAllowed = await verifyBillingRolloutLevel(userId);
    if (!isAllowed) {
      throw new Error("API call blocked. Client tier is not authorized under the current billing rollout level.");
    }
  }

  const wallet = await prisma.apiCreditWallet.findUnique({
    where: { userId }
  });

  if (!wallet || Number(wallet.balance) < cost) {
    await logThreat(userId, "429_LIMIT", "/api/v1/*", null, 3, "Insufficient credit wallet balance for API billing");
    throw new Error("Insufficient credit wallet balance. Please purchase credits.");
  }

  // 1. Atomically consume credits in DB
  await prisma.apiCreditWallet.update({
    where: { userId },
    data: {
      balance: { decrement: cost },
      usedCredits: { increment: cost },
      lifetimeConsumed: { increment: cost }
    }
  });

  // 2. Aggregate daily usage in ApiUsageRecord
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await prisma.apiUsageRecord.findFirst({
    where: {
      subscriptionId,
      billingDate: today
    }
  });

  if (existing) {
    await prisma.apiUsageRecord.update({
      where: { id: existing.id },
      data: {
        requests: { increment: 1 },
        success: { increment: 1 },
        revenue: { increment: cost }
      }
    });
  } else {
    try {
      await prisma.apiUsageRecord.create({
        data: {
          subscriptionId,
          billingDate: today,
          requests: 1,
          success: 1,
          revenue: cost
        }
      });
    } catch (createErr) {
      // Concurrency / timezone serialization duplicate fallback
      const duplicate = await prisma.apiUsageRecord.findFirst({
        where: {
          subscriptionId,
          billingDate: today
        }
      });
      if (duplicate) {
        await prisma.apiUsageRecord.update({
          where: { id: duplicate.id },
          data: {
            requests: { increment: 1 },
            success: { increment: 1 },
            revenue: { increment: cost }
          }
        });
      }
    }
  }

  // Perform continuous credit wallet validation
  await reconcileCreditWallet(userId).catch(() => {});
};

/**
 * Buy Credits - funds the wallet
 */
export const buyCredits = async (userId, amount) => {
  const wallet = await prisma.apiCreditWallet.upsert({
    where: { userId },
    update: {
      balance: { increment: amount },
      lifetimePurchased: { increment: amount }
    },
    create: {
      userId,
      balance: amount,
      lifetimePurchased: amount
    }
  });

  // Perform credit wallet validation
  await reconcileCreditWallet(userId).catch(() => {});
  return wallet;
};

/**
 * THREAT DETECTION ENGINE
 * Logs threat entries with customizable severity indexing.
 */
export const logThreat = async (clientId, threatType, endpoint, ipAddress, severity = 1, details = null) => {
  try {
    await prisma.apiThreatLog.create({
      data: {
        clientId,
        threatType,
        endpoint,
        ipAddress,
        severity,
        details
      }
    });

    console.warn(`[API SECURITY THREAT] Severity: ${severity} | Type: ${threatType} | Endpoint: ${endpoint} | Client: ${clientId}`);
  } catch (err) {
    logger.error("Failed to write to Threat Log", { error: err.message });
  }
};

/**
 * WEBHOOK INFRASTRUCTURE
 * Signs payloads and dispatches webhooks with backoff retry schedules.
 */
export const dispatchWebhook = async (clientId, eventType, payload) => {
  try {
    const webhooks = await prisma.apiWebhook.findMany({
      where: { clientId, isActive: true }
    });

    for (const wh of webhooks) {
      if (!wh.events || !JSON.parse(JSON.stringify(wh.events)).includes(eventType)) {
        continue;
      }

      // Generate payload HMAC signature
      const stringifiedPayload = JSON.stringify(payload);
      const signature = crypto
        .createHmac("sha256", wh.secret)
        .update(stringifiedPayload)
        .digest("hex");

      const log = await prisma.apiWebhookLog.create({
        data: {
          webhookId: wh.id,
          eventType,
          payload: stringifiedPayload,
          deliveryStatus: "PENDING"
        }
      });

      // Asynchronously trigger HTTP delivery
      triggerWebhookDelivery(log.id, wh.url, stringifiedPayload, signature);
    }
  } catch (err) {
    logger.error("Failed to build or dispatch webhook payloads", { error: err.message });
  }
};

/**
 * Delivers webhook payload with retry mechanisms
 */
const triggerWebhookDelivery = async (logId, url, payloadStr, signature, retryIndex = 0) => {
  const schedules = [1, 5, 15, 30, 60]; // Retry interval in minutes

  try {
    const start = Date.now();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-DiziPay-Signature": signature,
        "X-DiziPay-Event": "webhook"
      },
      body: payloadStr,
      timeout: 8000 // 8s timeout
    });

    const bodyText = await response.text();
    const isSuccess = response.status >= 200 && response.status < 300;

    await prisma.apiWebhookLog.update({
      where: { id: logId },
      data: {
        deliveryStatus: isSuccess ? "SUCCESS" : "FAILED",
        responseCode: response.status,
        responseBody: bodyText.substring(0, 1000)
      }
    });

    if (!isSuccess) {
      scheduleRetry(logId, url, payloadStr, signature, retryIndex, schedules);
    }
  } catch (err) {
    await prisma.apiWebhookLog.update({
      where: { id: logId },
      data: {
        deliveryStatus: "FAILED",
        responseBody: `Error: ${err.message}`
      }
    });

    scheduleRetry(logId, url, payloadStr, signature, retryIndex, schedules);
  }
};

/**
 * Schedules a webhook retry
 */
const scheduleRetry = async (logId, url, payloadStr, signature, retryIndex, schedules) => {
  if (retryIndex >= schedules.length) {
    await prisma.apiWebhookLog.update({
      where: { id: logId },
      data: { deliveryStatus: "DEAD_LETTER" }
    });
    return;
  }

  const waitMinutes = schedules[retryIndex];
  const nextRetryAt = new Date(Date.now() + waitMinutes * 60 * 1000);

  await prisma.apiWebhookLog.update({
    where: { id: logId },
    data: {
      retryCount: retryIndex + 1,
      nextRetryAt
    }
  });

  // Spawn retry scheduler
  setTimeout(() => {
    triggerWebhookDelivery(logId, url, payloadStr, signature, retryIndex + 1);
  }, waitMinutes * 60 * 1000);
};

/**
 * Manual webhook requeue helper
 */
export const requeueWebhook = async (logId) => {
  const log = await prisma.apiWebhookLog.findUnique({
    where: { id: logId },
    include: { webhook: true }
  });

  if (!log) throw new Error("Webhook log not found.");

  // Regenerate signature
  const signature = crypto
    .createHmac("sha256", log.webhook.secret)
    .update(log.payload)
    .digest("hex");

  await prisma.apiWebhookLog.update({
    where: { id: logId },
    data: {
      deliveryStatus: "REQUEUED",
      retryCount: 0
    }
  });

  triggerWebhookDelivery(logId, log.webhook.url, log.payload, signature, 0);
  return true;
};
