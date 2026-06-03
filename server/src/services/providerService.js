import prisma from "../config/prisma.js";
import { redisClient } from "../config/redis.js";
import logger from "./logging/logger.js";
import { refreshProviderFactoryCache } from "./providers/providerFactory.js";

const validateProviderUrls = (data) => {
  const { baseUrl, apiUrl, statusCheckUrl, balanceUrl, disputeUrl } = data;

  const checkUrl = (urlVal, fieldName) => {
    if (!urlVal || String(urlVal).trim() === "") return;
    try {
      const cleanUrl = String(urlVal)
        .replace("{txnId}", "123")
        .replace("{providerTxnId}", "456");
      new URL(cleanUrl);
    } catch (e) {
      throw new Error(`Invalid URL format for ${fieldName}: ${urlVal}`);
    }
  };

  checkUrl(baseUrl, "Base URL");
  checkUrl(apiUrl, "API URL");
  checkUrl(statusCheckUrl, "Status URL");
  checkUrl(balanceUrl, "Balance URL");
  checkUrl(disputeUrl, "Dispute URL");
};

// Cache Keys
const CACHE_ALL_PROVIDERS = "dizipay:providers:all";
const CACHE_ACTIVE_PROVIDERS = "dizipay:providers:active";
const CACHE_PROVIDER_PREFIX = "dizipay:provider:";
const CACHE_TTL = 300; // 5 minutes

/**
 * Generic function to call a recharge provider API (backward compatible)
 */
export const callProviderApi = async (provider, data) => {
  const { mobile, amount, operator } = data;
  
  console.log(`Calling provider: ${provider.name} (${provider.code})...`);

  // Simulate network latency
  const startTime = Date.now();
  await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));
  const duration = Date.now() - startTime;

  // Mock failure cases for testing
  if (mobile === "8888888888" && provider.code === "P1") {
    throw new Error(`${provider.name} API failed (Mocked)`);
  }
  
  if (mobile === "7777777777") {
    throw new Error("Critical API failure across all providers (Mocked)");
  }

  // Simulate random failure based on success rate for testing
  if (Math.random() * 100 > provider.successRate) {
    throw new Error(`${provider.name} random failure (Mocked)`);
  }

  return {
    success: true,
    provider: provider.code,
    providerTxnId: `${provider.code.charAt(0)}_${Date.now()}`,
    duration
  };
};

export const primaryRecharge = async (data) => {
  const provider = await getProviderByCode("P1");
  if (!provider) throw new Error("Primary provider not found");
  return callProviderApi(provider, data);
};

export const backupRecharge = async (data) => {
  const provider = await getProviderByCode("P2");
  if (!provider) throw new Error("Backup provider not found");
  return callProviderApi(provider, data);
};

/**
 * Invalidates all provider-related Redis caches
 */
export const invalidateProviderCache = async () => {
  try {
    const keys = await redisClient.keys("dizipay:provider*");
    if (keys && keys.length > 0) {
      await redisClient.del(...keys);
    }
    await redisClient.del("dizipay:telemetry_snapshot").catch(() => {});
    logger.debug("[CACHE] Invalidated all provider caches");
  } catch (err) {
    logger.error("Failed to invalidate provider cache", { error: err.message });
  }
};

/**
 * Fetch all providers (uses Redis caching)
 */
export const getAllProviders = async () => {
  try {
    const cached = await redisClient.get(CACHE_ALL_PROVIDERS);
    if (cached) {
      return JSON.parse(cached);
    }

    const providers = await prisma.provider.findMany({
      orderBy: { priority: "desc" }
    });

    await redisClient.setex(CACHE_ALL_PROVIDERS, CACHE_TTL, JSON.stringify(providers));
    return providers;
  } catch (err) {
    logger.error("Error in getAllProviders", { error: err.message });
    return prisma.provider.findMany({ orderBy: { priority: "desc" } });
  }
};

/**
 * Fetch active providers (uses Redis caching)
 */
export const getActiveProviders = async () => {
  try {
    const cached = await redisClient.get(CACHE_ACTIVE_PROVIDERS);
    if (cached) {
      return JSON.parse(cached);
    }

    const providers = await prisma.provider.findMany({
      where: {
        isActive: true,
        maintenanceMode: false
      },
      orderBy: { priority: "desc" }
    });

    await redisClient.setex(CACHE_ACTIVE_PROVIDERS, CACHE_TTL, JSON.stringify(providers));
    return providers;
  } catch (err) {
    logger.error("Error in getActiveProviders", { error: err.message });
    return prisma.provider.findMany({
      where: { isActive: true, maintenanceMode: false },
      orderBy: { priority: "desc" }
    });
  }
};

/**
 * Fetch a provider by ID (uses Redis caching)
 */
export const getProviderById = async (id) => {
  const cacheKey = `${CACHE_PROVIDER_PREFIX}id:${id}`;
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const provider = await prisma.provider.findUnique({
      where: { id: Number(id) }
    });

    if (provider) {
      await redisClient.setex(cacheKey, CACHE_TTL, JSON.stringify(provider));
    }
    return provider;
  } catch (err) {
    logger.error("Error in getProviderById", { error: err.message, id });
    return prisma.provider.findUnique({ where: { id: Number(id) } });
  }
};

/**
 * Fetch a provider by Code (uses Redis caching)
 */
export const getProviderByCode = async (code) => {
  const cacheKey = `${CACHE_PROVIDER_PREFIX}code:${code}`;
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const provider = await prisma.provider.findUnique({
      where: { code }
    });

    if (provider) {
      await redisClient.setex(cacheKey, CACHE_TTL, JSON.stringify(provider));
    }
    return provider;
  } catch (err) {
    logger.error("Error in getProviderByCode", { error: err.message, code });
    return prisma.provider.findUnique({ where: { code } });
  }
};

/**
 * Create a new provider configuration
 */
export const createProvider = async (providerData) => {
  const {
    name,
    code,
    providerType = "RECHARGE",
    baseUrl,
    apiKey,
    priority = 0,
    callbackId,
    routeType = "Both",
    apiUrl,
    statusCheckUrl,
    balanceUrl,
    disputeUrl,
    maintenanceMode = false
  } = providerData;

  // Verify Required Fields
  if (!name || !name.trim()) throw new Error("Provider Name is required.");
  if (!code || !code.trim()) throw new Error("Provider Code is required.");
  if (!baseUrl || !baseUrl.trim()) throw new Error("Base URL is required.");
  if (!apiKey || !apiKey.trim()) throw new Error("API Key is required.");

  // Verify URLs validity
  validateProviderUrls(providerData);

  const normalizedCode = String(code).toUpperCase().trim();

  // Enforce unique provider code validation
  const existing = await prisma.provider.findUnique({
    where: { code: normalizedCode }
  });
  if (existing) {
    throw new Error(`Provider Code '${normalizedCode}' is already registered.`);
  }

  const provider = await prisma.provider.create({
    data: {
      name,
      code: normalizedCode,
      providerType: String(providerType).toUpperCase().trim(),
      baseUrl,
      apiKey,
      priority: Number(priority),
      isActive: false, // Strict safety rule: created disabled
      inSwitch: false, // Strict safety rule: created out of switch
      healthStatus: "UNKNOWN", // Strict safety rule: created as UNKNOWN
      callbackId: callbackId || null,
      routeType,
      apiUrl: apiUrl || null,
      statusCheckUrl: statusCheckUrl || null,
      balanceUrl: balanceUrl || null,
      disputeUrl: disputeUrl || null,
      maintenanceMode: Boolean(maintenanceMode),
      version: 1
    }
  });

  // Auto-initialize ProviderHealthMetrics
  await prisma.providerHealthMetrics.create({
    data: {
      providerId: provider.id,
      latency: 0.0,
      successRate: 100.0,
      failureRate: 0.0,
      healthScore: 100.0
    }
  }).catch(() => {});

  // Auto-initialize ProviderCost
  await prisma.providerCost.create({
    data: {
      providerId: provider.id,
      costPerTxn: 0.00,
      priorityWeight: 1,
      isActive: true
    }
  }).catch(() => {});

  // Auto-initialize ProviderHealthLog
  await prisma.providerHealthLog.create({
    data: {
      providerCode: normalizedCode,
      status: "HEALTHY",
      latency: 0,
      message: "Gateway provider node registered in administrative shadow mode with default telemetry profile."
    }
  }).catch(() => {});

  // Mock ProviderTelemetryProfile logs for compatibility
  logger.info(`[TELEMETRY] ProviderTelemetryProfile auto-registered for ${normalizedCode} with initial default state.`);

  // Refresh factory cache with new code
  await refreshProviderFactoryCache();

  await invalidateProviderCache();
  return provider;
};

/**
 * Update an existing provider configuration with optimistic locking concurrency protection
 */
export const updateProvider = async (id, updateData) => {
  const providerId = Number(id);

  // Validate URLs if provided during update
  validateProviderUrls(updateData);

  // Fetch the current record first to perform safety validations and optimistic concurrency checking
  const currentProvider = await prisma.provider.findUnique({
    where: { id: providerId }
  });

  if (!currentProvider) {
    throw new Error("Provider not found");
  }

  // 1. Optimistic Concurrency Checking
  if (updateData.version !== undefined && Number(updateData.version) !== currentProvider.version) {
    throw new Error("Conflict: Stale operations config. Stale admin overwrite prevented.");
  }

  // 2. Safety Rule: Ensure we never disable the last active / inSwitch provider in single provider mode
  const targetIsActive = updateData.isActive !== undefined ? Boolean(updateData.isActive) : currentProvider.isActive;
  const targetInSwitch = updateData.inSwitch !== undefined ? Boolean(updateData.inSwitch) : currentProvider.inSwitch;

  if (!targetIsActive || !targetInSwitch) {
    const activeProviders = await prisma.provider.findMany({
      where: { isActive: true, inSwitch: true }
    });

    // If there is only one provider that is active + inSwitch and it matches the target being disabled
    if (activeProviders.length === 1 && activeProviders[0].id === providerId) {
      throw new Error("Operation blocked: At least one active gateway provider must remain active and in-switch.");
    }
  }

  // 3. Build Update Object
  const dataToUpdate = {
    ...(updateData.name !== undefined && { name: updateData.name }),
    ...(updateData.code !== undefined && { code: String(updateData.code).toUpperCase().trim() }),
    ...(updateData.providerType !== undefined && { providerType: String(updateData.providerType).toUpperCase().trim() }),
    ...(updateData.baseUrl !== undefined && { baseUrl: updateData.baseUrl }),
    ...(updateData.apiKey !== undefined && { apiKey: updateData.apiKey }),
    ...(updateData.isActive !== undefined && { isActive: Boolean(updateData.isActive) }),
    ...(updateData.inSwitch !== undefined && { inSwitch: Boolean(updateData.inSwitch) }),
    ...(updateData.routeType !== undefined && { routeType: updateData.routeType }),
    ...(updateData.priority !== undefined && { priority: Number(updateData.priority) }),
    ...(updateData.apiUrl !== undefined && { apiUrl: updateData.apiUrl || null }),
    ...(updateData.statusCheckUrl !== undefined && { statusCheckUrl: updateData.statusCheckUrl || null }),
    ...(updateData.balanceUrl !== undefined && { balanceUrl: updateData.balanceUrl || null }),
    ...(updateData.disputeUrl !== undefined && { disputeUrl: updateData.disputeUrl || null }),
    ...(updateData.maintenanceMode !== undefined && { maintenanceMode: Boolean(updateData.maintenanceMode) }),
    ...(updateData.callbackId !== undefined && { callbackId: updateData.callbackId || null }),
    version: currentProvider.version + 1 // Auto-increment the version
  };

  const updated = await prisma.provider.update({
    where: { id: providerId },
    data: dataToUpdate
  });

  // Refresh factory cache in case code was updated
  await refreshProviderFactoryCache();

  // 4. Invalidate the Cache
  await invalidateProviderCache();

  return {
    oldState: currentProvider,
    newState: updated
  };
};

export default {
  callProviderApi,
  primaryRecharge,
  backupRecharge,
  invalidateProviderCache,
  getAllProviders,
  getActiveProviders,
  getProviderById,
  getProviderByCode,
  createProvider,
  updateProvider
};
