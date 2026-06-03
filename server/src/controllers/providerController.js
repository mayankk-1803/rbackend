import providerService from "../services/providerService.js";
import telemetryService, { getDynamicTelemetry } from "../services/telemetryService.js";
import { logAction, AUDIT_ACTIONS } from "../services/auditService.js";
import logger from "../services/logging/logger.js";
import { enterpriseFeatures } from "../services/routingEngine/routingEngine.js";
import { mapProviderToAlias, mapAliasToReal } from "../config/providerAliases.js";
import { getProvider } from "../services/providers/providerFactory.js";
import axios from "axios";

/**
 * GET: Fetch list of all providers with dynamic health status and queue metrics
 * Endpoint: GET /api/admin/enterprise/providers
 */
export const getProvidersList = async (req, res) => {
  if (!enterpriseFeatures.enterpriseProviderManager) {
    return res.status(403).json({ success: false, message: "Enterprise Provider Manager feature is disabled" });
  }
  try {
    const allProviders = await providerService.getAllProviders();
    const providers = allProviders.filter(p => p.providerType !== "PAYMENT" && p.code !== "NEXGATE");
    const queueStatus = await telemetryService.getLiveQueueStatus();

    // Map dynamic health classifications to each provider
    const enrichedProviders = await Promise.all(providers.map(async (p) => {
      const dynamic = await getDynamicTelemetry(p.code);
      const aliased = mapProviderToAlias(p);
      return {
        ...aliased,
        successRate: dynamic.successRate,
        avgResponseTime: dynamic.avgResponseTime,
        healthStatus: dynamic.healthStatus,
        currentQueue: queueStatus.activeJobs + queueStatus.waitingJobs // Dynamic queue count
      };
    }));

    return res.json({
      success: true,
      data: enrichedProviders,
      queueStatus
    });
  } catch (error) {
    logger.error("Failed to load enterprise providers list", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST: Create a new provider configuration safely
 * Endpoint: POST /api/admin/enterprise/providers
 */
export const createProvider = async (req, res) => {
  if (!enterpriseFeatures.enterpriseProviderManager) {
    return res.status(403).json({ success: false, message: "Enterprise Provider Manager feature is disabled" });
  }
  const adminId = req.user?.id;
  const {
    name,
    code,
    providerType,
    baseUrl,
    apiKey,
    priority,
    isActive,
    callbackId,
    inSwitch,
    routeType,
    apiUrl,
    statusCheckUrl,
    balanceUrl,
    disputeUrl,
    maintenanceMode
  } = req.body;

  if (!name || !code || !baseUrl || !apiKey) {
    return res.status(400).json({ success: false, message: "Missing core provider registration fields (name, code, baseUrl, apiKey)" });
  }

  try {
    const realData = mapAliasToReal({
      name,
      code,
      providerType,
      baseUrl,
      apiKey,
      priority,
      isActive,
      callbackId,
      inSwitch,
      routeType,
      apiUrl,
      statusCheckUrl,
      balanceUrl,
      disputeUrl,
      maintenanceMode
    });

    const provider = await providerService.createProvider(realData);
    const aliased = mapProviderToAlias(provider);

    // Write immutable audit log
    await logAction({
      action: AUDIT_ACTIONS.PROVIDER_UPDATE,
      adminId,
      entity: "provider",
      entityId: provider.id,
      details: {
        actionType: "CREATE",
        newState: aliased,
        timestamp: Date.now()
      },
      req
    });

    return res.status(201).json({
      success: true,
      message: "Recharge provider registered successfully",
      data: aliased
    });
  } catch (error) {
    logger.error("Failed to register new recharge provider", { error: error.message });
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};

/**
 * PATCH: Granularly update a provider configuration with optimistic concurrency locking
 * Endpoint: PATCH /api/admin/enterprise/providers/:id
 */
export const updateProvider = async (req, res) => {
  if (!enterpriseFeatures.enterpriseProviderManager) {
    return res.status(403).json({ success: false, message: "Enterprise Provider Manager feature is disabled" });
  }
  const { id } = req.params;
  const adminId = req.user?.id;

  try {
    const realData = mapAliasToReal(req.body);
    const result = await providerService.updateProvider(id, realData);
    const aliasedNewState = mapProviderToAlias(result.newState);
    const aliasedOldState = mapProviderToAlias(result.oldState);

    // Write immutable audit log
    await logAction({
      action: AUDIT_ACTIONS.PROVIDER_UPDATE,
      adminId,
      entity: "provider",
      entityId: Number(id),
      details: {
        actionType: "UPDATE",
        oldState: aliasedOldState,
        newState: aliasedNewState,
        timestamp: Date.now()
      },
      req
    });

    return res.json({
      success: true,
      message: "Provider operational config updated successfully",
      data: aliasedNewState
    });
  } catch (error) {
    logger.error("Failed to update provider operational config", { error: error.message, id });
    
    // Stale overwrite check
    if (error.message.includes("Stale admin overwrite prevented") || error.message.includes("Conflict")) {
      return res.status(409).json({
        success: false,
        message: "Stale Operations Update Detected: Another administrator has updated this configuration. Please refresh to fetch the latest state.",
        code: "CONCURRENCY_ERROR"
      });
    }

    // Safety rules block check
    if (error.message.includes("At least one active gateway provider")) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};

/**
 * POST: Safe diagnostics check endpoint ( Ping / Balance / Status )
 * Endpoint: POST /api/admin/enterprise/providers/:id/test
 */
export const testProviderApi = async (req, res) => {
  if (!enterpriseFeatures.enterpriseProviderManager) {
    return res.status(403).json({ success: false, message: "Enterprise Provider Manager feature is disabled" });
  }
  const { id } = req.params;
  const { testType } = req.body; // "ping", "balance", "status_check"

  try {
    const provider = await providerService.getProviderById(id);
    if (!provider) {
      return res.status(404).json({ success: false, message: "Provider not found" });
    }

    const adapter = getProvider(provider.code);
    let responseData = {};
    const startTime = Date.now();

    if (testType === "ping") {
      if (typeof adapter.ping === "function") {
        responseData = await adapter.ping();
      } else {
        const targetUrl = provider.apiUrl || provider.baseUrl;
        if (!targetUrl) {
          return res.status(400).json({ success: false, message: "No API URL or Base URL configured for this provider." });
        }
        try {
          const response = await axios.get(targetUrl, { timeout: 4000 });
          responseData = {
            statusCode: response.status,
            latency: Date.now() - startTime,
            statusText: response.statusText,
            message: "Ping Check Successful"
          };
        } catch (axiosErr) {
          responseData = {
            statusCode: axiosErr.response?.status || 500,
            latency: Date.now() - startTime,
            error: axiosErr.message,
            message: "Ping Check Failed: Destination unreachable"
          };
        }
      }
    } else if (testType === "balance") {
      if (typeof adapter.balance === "function") {
        responseData = await adapter.balance();
      } else {
        const targetUrl = provider.balanceUrl;
        if (!targetUrl) {
          return res.status(400).json({ success: false, message: "No Balance URL configured for this provider." });
        }
        try {
          const response = await axios.get(targetUrl, {
            headers: { Authorization: `Bearer ${provider.apiKey}` },
            timeout: 4000
          });
          responseData = {
            statusCode: response.status,
            latency: Date.now() - startTime,
            data: response.data,
            message: "Balance Check query completed successfully."
          };
        } catch (axiosErr) {
          responseData = {
            statusCode: axiosErr.response?.status || 500,
            latency: Date.now() - startTime,
            error: axiosErr.message,
            message: "Balance query failed: Destination returned an error response."
          };
        }
      }
    } else if (testType === "status_check") {
      if (typeof adapter.status === "function") {
        responseData = await adapter.status("MOCK_TXN_123", "MOCK_PROV_123");
      } else {
        const targetUrl = provider.statusCheckUrl;
        if (!targetUrl) {
          return res.status(400).json({ success: false, message: "No Status Check URL configured for this provider." });
        }
        responseData = {
          message: "Status check endpoint format validated.",
          targetUrl,
          headers: { Authorization: "Bearer [MASKED_TOKEN]" }
        };
      }
    } else {
      return res.status(400).json({ success: false, message: "Invalid testType action specified. Allowed: ping, balance, status_check" });
    }

    if (responseData.success === false) {
      return res.json({
        success: false,
        testType,
        message: responseData.message || "Diagnostics check failed",
        error: responseData.error
      });
    }

    return res.json({
      success: true,
      testType,
      data: responseData
    });
  } catch (error) {
    logger.error("Failed to execute provider API diagnostics test", { error: error.message, id });
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};

export default {
  getProvidersList,
  createProvider,
  updateProvider,
  testProviderApi
};
