import prisma from "../config/prisma.js";
import logger from "../services/logging/logger.js";
import { enterpriseFeatures } from "../services/routingEngine/routingEngine.js";
import { rechargeQueue } from "../config/rechargeQueue.js";
import { REAL_TO_ALIAS, ALIAS_TO_REAL, mapProviderToAlias, mapAliasToReal } from "../config/providerAliases.js";
import { getDynamicTelemetry } from "../services/telemetryService.js";

/**
 * ============================================================================
 * PROVIDERS DIRECTORY ENDPOINTS
 * ============================================================================
 */

export const getProvidersList = async (req, res) => {
  try {
    const providers = await prisma.provider.findMany({
      orderBy: { priority: "desc" }
    });

    const enrichedProviders = await Promise.all(providers.map(async (p) => {
      const dynamic = await getDynamicTelemetry(p.code);
      const aliased = mapProviderToAlias(p);
      return {
        ...aliased,
        successRate: dynamic.successRate,
        avgResponseTime: dynamic.avgResponseTime,
        healthStatus: dynamic.healthStatus
      };
    }));

    return res.json({ success: true, data: enrichedProviders });
  } catch (error) {
    logger.error("Failed to load providers list", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updateProviderSettings = async (req, res) => {
  const { id } = req.params;
  
  try {
    const realData = mapAliasToReal(req.body);
    const { isActive, priority, baseUrl, healthStatus } = realData;

    const updated = await prisma.provider.update({
      where: { id: Number(id) },
      data: {
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        ...(priority !== undefined && { priority: Number(priority) }),
        ...(baseUrl && { baseUrl: String(baseUrl).trim() }),
        ...(healthStatus && { healthStatus })
      }
    });

    const aliased = mapProviderToAlias(updated);
    logger.info(`Admin updated settings for provider: ${updated.code}`, { id, isActive, priority });
    return res.json({ success: true, message: "Provider settings updated successfully", data: aliased });
  } catch (error) {
    logger.error("Failed to update provider settings", { error: error.message, id });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * ============================================================================
 * OPERATOR MAPPINGS ENDPOINTS
 * ============================================================================
 */

export const getOperatorMappings = async (req, res) => {
  try {
    const mappings = await prisma.operatorMapping.findMany({
      orderBy: { operatorName: "asc" }
    });
    const mapped = mappings.map(m => ({
      ...m,
      providerCode: REAL_TO_ALIAS[m.providerCode?.toUpperCase()] || m.providerCode
    }));
    return res.json({ success: true, data: mapped });
  } catch (error) {
    logger.error("Failed to fetch operator mappings", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const createOperatorMapping = async (req, res) => {
  const { operatorName, circleName, providerCode, providerOperatorCode, minAmount, maxAmount } = req.body;

  if (!operatorName || !providerCode || !providerOperatorCode) {
    return res.status(400).json({ success: false, message: "Missing required mapping fields" });
  }

  const realProviderCode = ALIAS_TO_REAL[providerCode.toUpperCase()] || providerCode;

  try {
    const mapping = await prisma.operatorMapping.create({
      data: {
        operatorName: String(operatorName).toUpperCase(),
        circleName: String(circleName || "ALL").toUpperCase(),
        providerCode: String(realProviderCode).toUpperCase(),
        providerOperatorCode: String(providerOperatorCode),
        minAmount: Number(minAmount || 0),
        maxAmount: Number(maxAmount || 99999)
      }
    });

    const aliased = {
      ...mapping,
      providerCode: REAL_TO_ALIAS[mapping.providerCode?.toUpperCase()] || mapping.providerCode
    };

    logger.info(`Created new operator mapping: ${operatorName} -> ${realProviderCode}:${providerOperatorCode}`);
    return res.json({ success: true, message: "Operator mapping registered successfully", data: aliased });
  } catch (error) {
    logger.error("Failed to create operator mapping", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const toggleOperatorMapping = async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  try {
    const updated = await prisma.operatorMapping.update({
      where: { id: Number(id) },
      data: { isActive: Boolean(isActive) }
    });

    const aliased = {
      ...updated,
      providerCode: REAL_TO_ALIAS[updated.providerCode?.toUpperCase()] || updated.providerCode
    };

    return res.json({ success: true, message: "Operator mapping status toggled", data: aliased });
  } catch (error) {
    logger.error("Failed to toggle operator mapping status", { error: error.message, id });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * ============================================================================
 * ROUTING & SWITCHING RULES ENDPOINTS
 * ============================================================================
 */

export const getRoutingRules = async (req, res) => {
  try {
    const rules = await prisma.routingRule.findMany({
      orderBy: { priority: "desc" }
    });
    const mapped = rules.map(r => ({
      ...r,
      providerCode: REAL_TO_ALIAS[r.providerCode?.toUpperCase()] || r.providerCode,
      backupProviderCode: REAL_TO_ALIAS[r.backupProviderCode?.toUpperCase()] || r.backupProviderCode
    }));
    return res.json({ success: true, data: mapped });
  } catch (error) {
    logger.error("Failed to fetch routing rules", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const createRoutingRule = async (req, res) => {
  const { name, ruleType, targetValue, providerCode, backupProviderCode, priority, minAmount, maxAmount } = req.body;

  if (!name || !ruleType || !targetValue || !providerCode) {
    return res.status(400).json({ success: false, message: "Missing required routing rule parameters" });
  }

  const allowedTypes = ["operator", "user", "amount", "circle"];
  if (!allowedTypes.includes(ruleType)) {
    return res.status(400).json({ success: false, message: `Invalid rule type: ${ruleType}` });
  }

  const realProviderCode = ALIAS_TO_REAL[providerCode.toUpperCase()] || providerCode;
  const realBackupCode = backupProviderCode ? (ALIAS_TO_REAL[backupProviderCode.toUpperCase()] || backupProviderCode) : null;

  try {
    const rule = await prisma.routingRule.create({
      data: {
        name: String(name).trim(),
        ruleType,
        targetValue: String(targetValue).trim(),
        providerCode: String(realProviderCode).toUpperCase(),
        backupProviderCode: realBackupCode ? String(realBackupCode).toUpperCase() : null,
        priority: Number(priority || 1),
        minAmount: Number(minAmount || 0),
        maxAmount: Number(maxAmount || 99999)
      }
    });

    const aliased = {
      ...rule,
      providerCode: REAL_TO_ALIAS[rule.providerCode?.toUpperCase()] || rule.providerCode,
      backupProviderCode: REAL_TO_ALIAS[rule.backupProviderCode?.toUpperCase()] || rule.backupProviderCode
    };

    logger.info(`Created new routing rule: ${name} (${ruleType})`);
    return res.json({ success: true, message: "Routing rule created successfully", data: aliased });
  } catch (error) {
    logger.error("Failed to create routing rule", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const toggleRoutingRule = async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  try {
    const updated = await prisma.routingRule.update({
      where: { id: Number(id) },
      data: { isActive: Boolean(isActive) }
    });

    const aliased = {
      ...updated,
      providerCode: REAL_TO_ALIAS[updated.providerCode?.toUpperCase()] || updated.providerCode,
      backupProviderCode: REAL_TO_ALIAS[updated.backupProviderCode?.toUpperCase()] || updated.backupProviderCode
    };

    return res.json({ success: true, message: "Routing rule status toggled", data: aliased });
  } catch (error) {
    logger.error("Failed to toggle routing rule status", { error: error.message, id });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getRoutingDecisionLogs = async (req, res) => {
  try {
    const logs = await prisma.routingDecisionLog.findMany({
      take: 50,
      orderBy: { createdAt: "desc" }
    });
    const mapped = logs.map(log => ({
      ...log,
      recommendedProvider: REAL_TO_ALIAS[log.recommendedProvider?.toUpperCase()] || log.recommendedProvider,
      executedProvider: REAL_TO_ALIAS[log.executedProvider?.toUpperCase()] || log.executedProvider
    }));
    return res.json({ success: true, data: mapped });
  } catch (error) {
    logger.error("Failed to fetch routing decision logs", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * ============================================================================
 * WHATSAPP NOTIFICATIONS CONFIG ENDPOINTS
 * ============================================================================
 */

export const getWhatsappTemplates = async (req, res) => {
  try {
    const templates = await prisma.whatsappTemplate.findMany();
    return res.json({ success: true, data: templates });
  } catch (error) {
    logger.error("Failed to fetch WhatsApp templates", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const createWhatsappTemplate = async (req, res) => {
  const { name, templateId, body, variables } = req.body;

  if (!name || !templateId || !body) {
    return res.status(400).json({ success: false, message: "Missing template parameters" });
  }

  try {
    const template = await prisma.whatsappTemplate.create({
      data: {
        name: String(name).trim().toLowerCase(),
        templateId: String(templateId).trim(),
        body: String(body).trim(),
        variables: variables || null
      }
    });

    return res.json({ success: true, message: "WhatsApp template configured successfully", data: template });
  } catch (error) {
    logger.error("Failed to create WhatsApp template", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const toggleWhatsappTemplate = async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  try {
    const updated = await prisma.whatsappTemplate.update({
      where: { id: Number(id) },
      data: { isActive: Boolean(isActive) }
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    logger.error("Failed to toggle template status", { error: error.message, id });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getNotificationLogs = async (req, res) => {
  try {
    const logs = await prisma.notificationLog.findMany({
      take: 50,
      orderBy: { createdAt: "desc" }
    });
    return res.json({ success: true, data: logs });
  } catch (error) {
    logger.error("Failed to fetch notification logs", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * ============================================================================
 * TELEMETRY & OBSERVABILITY ENDPOINTS
 * ============================================================================
 */

export const getTelemetryData = async (req, res) => {
  try {
    const [healthLogs, decisionLogs, providers] = await Promise.all([
      prisma.providerHealthLog.findMany({
        take: 30,
        orderBy: { createdAt: "desc" }
      }),
      prisma.routingDecisionLog.findMany({
        take: 30,
        orderBy: { createdAt: "desc" }
      }),
      prisma.provider.findMany({
        orderBy: { priority: "desc" }
      })
    ]);

    const mappedHealthLogs = healthLogs.map(log => ({
      ...log,
      providerCode: REAL_TO_ALIAS[log.providerCode?.toUpperCase()] || log.providerCode
    }));

    const mappedDecisionLogs = decisionLogs.map(log => ({
      ...log,
      recommendedProvider: REAL_TO_ALIAS[log.recommendedProvider?.toUpperCase()] || log.recommendedProvider,
      executedProvider: REAL_TO_ALIAS[log.executedProvider?.toUpperCase()] || log.executedProvider
    }));

    // Dynamic queue status from live BullMQ queue
    let activeJobs = 0;
    let waitingJobs = 0;
    let delayedJobs = 0;
    let failedJobs = 0;
    let completedJobs = 0;

    try {
      if (rechargeQueue) {
        activeJobs = await rechargeQueue.getActiveCount().catch(() => 0);
        waitingJobs = await rechargeQueue.getWaitingCount().catch(() => 0);
        delayedJobs = await rechargeQueue.getDelayedCount().catch(() => 0);
        failedJobs = await rechargeQueue.getFailedCount().catch(() => 0);
        completedJobs = await rechargeQueue.getCompletedCount().catch(() => 0);
      }
    } catch (qErr) {
      logger.error("Failed to query real BullMQ queue stats", { error: qErr.message });
    }

    const queueStatus = {
      name: "rechargeQueue",
      activeJobs,
      waitingJobs,
      delayedJobs,
      failedJobs,
      completedJobs
    };

    // Enrich with dynamic telemetry and map to aliases
    const enrichedProviders = await Promise.all(providers.map(async (p) => {
      const dynamic = await getDynamicTelemetry(p.code);
      const aliased = mapProviderToAlias(p);
      return {
        ...aliased,
        successRate: dynamic.successRate,
        avgResponseTime: dynamic.avgResponseTime,
        healthStatus: dynamic.healthStatus
      };
    }));

    return res.json({
      success: true,
      data: {
        healthLogs: mappedHealthLogs,
        decisionLogs: mappedDecisionLogs,
        queueStatus,
        providers: enrichedProviders,
        featureFlags: enterpriseFeatures
      }
    });
  } catch (error) {
    logger.error("Failed to retrieve telemetry details", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const toggleEnterpriseFeatureFlag = async (req, res) => {
  const { flagName, value } = req.body;

  if (flagName === undefined || value === undefined) {
    return res.status(400).json({ success: false, message: "Missing parameters" });
  }

  if (enterpriseFeatures[flagName] === undefined) {
    return res.status(400).json({ success: false, message: "Unknown feature flag key" });
  }

  enterpriseFeatures[flagName] = Boolean(value);
  logger.info(`[FEATURE FLAG] Toggled '${flagName}' to ${value}`);
  return res.json({ success: true, message: `Feature flag '${flagName}' updated`, data: enterpriseFeatures });
};
