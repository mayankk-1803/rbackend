import prisma from "../config/prisma.js";
import logger from "../services/logging/logger.js";
import { enterpriseFeatures } from "../services/routingEngine/routingEngine.js";
import { rechargeQueue } from "../config/rechargeQueue.js";
import { REAL_TO_ALIAS, ALIAS_TO_REAL, mapProviderToAlias, mapAliasToReal } from "../config/providerAliases.js";
import { getDynamicTelemetry } from "../services/telemetryService.js";
import { rebuildRoutingCache, incrementRoutingConfigVersion } from "../services/routingEngine/routingCache.js";
import featureFlagsService, { FLAGS } from "../services/featureFlagsService.js";
import { promoteRoutingRolloutLevel } from "../services/routingIntelligenceService.js";
import { redisClient } from "../config/redis.js";

/**
 * ============================================================================
 * PROVIDERS DIRECTORY ENDPOINTS
 * ============================================================================
 */

export const getProvidersList = async (req, res) => {
  try {
    const providers = await prisma.provider.findMany({
      where: {
        providerType: {
          not: "PAYMENT"
        },
        code: {
          not: "NEXGATE"
        }
      },
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
    await incrementRoutingConfigVersion(req.user?.email || req.user?.id);
    await rebuildRoutingCache();
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
    await incrementRoutingConfigVersion(req.user?.email || req.user?.id);
    await rebuildRoutingCache();
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

    await incrementRoutingConfigVersion(req.user?.email || req.user?.id);
    await rebuildRoutingCache();
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
    await incrementRoutingConfigVersion(req.user?.email || req.user?.id);
    await rebuildRoutingCache();
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

    await incrementRoutingConfigVersion(req.user?.email || req.user?.id);
    await rebuildRoutingCache();
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

export const getEnrichedDbFeatureFlags = async () => {
  const dbFlagsList = await prisma.featureFlag.findMany().catch(() => []);
  const dbFeatureFlags = {};
  
  const allFlagKeys = Object.values(FLAGS);
  const existingKeys = dbFlagsList.map(f => f.key);
  
  for (const key of allFlagKeys) {
    if (!existingKeys.includes(key)) {
      try {
        const desc = key.replace(/_/g, " ").toLowerCase();
        const created = await prisma.featureFlag.create({
          data: { key, value: false, description: `Enables ${desc} configuration settings.` }
        });
        dbFlagsList.push(created);
        logger.info(`[AUTO-SEED] Dynamically seeded missing flag: ${key}`);
      } catch (seedErr) {
        logger.error(`[AUTO-SEED ERROR] Failed to seed missing flag: ${key}`, { error: seedErr.message });
      }
    }
  }

  for (const flag of dbFlagsList) {
    let redisValue = null;
    let redisSynced = false;
    const cacheKey = `feature:flag:${flag.key}`;
    try {
      if (redisClient && redisClient.status === "ready") {
        redisValue = await redisClient.get(cacheKey);
        
        if (redisValue === null || (redisValue === "true") !== flag.value) {
          await redisClient.set(cacheKey, flag.value ? "true" : "false").catch(() => {});
          redisValue = flag.value ? "true" : "false";
          logger.info(`[CACHE REPAIR] Auto-repaired feature flag cache for ${flag.key}`);
        }
        
        redisSynced = redisValue !== null && (redisValue === "true") === flag.value;
      }
    } catch (err) {
      logger.error("Redis status check failed in telemetry config", { error: err.message });
    }
    
    dbFeatureFlags[flag.key] = {
      key: flag.key,
      enabled: flag.value,
      value: flag.value,
      dbValue: flag.value,
      redisValue: redisValue === "true",
      redisSynced: redisSynced,
      description: flag.description,
      updatedAt: flag.updatedAt
    };
  }
  return dbFeatureFlags;
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
        where: {
          providerType: {
            not: "PAYMENT"
          },
          code: {
            not: "NEXGATE"
          }
        },
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

    const dbFeatureFlags = await getEnrichedDbFeatureFlags();

    let routingIntelligenceConfig = await prisma.routingIntelligenceConfig.findUnique({
      where: { id: 1 }
    });
    if (!routingIntelligenceConfig) {
      routingIntelligenceConfig = await prisma.routingIntelligenceConfig.create({
        data: {
          id: 1,
          successWeight: 0.4,
          latencyWeight: 0.2,
          costWeight: 0.2,
          healthWeight: 0.1,
          trendWeight: 0.1,
          autonomousThreshold: 0.9,
          rolloutLevel: 0.01,
          killSwitchTriggered: false
        }
      }).catch(() => null);
    }

    return res.json({
      success: true,
      data: {
        healthLogs: mappedHealthLogs,
        decisionLogs: mappedDecisionLogs,
        queueStatus,
        providers: enrichedProviders,
        featureFlags: enterpriseFeatures,
        dbFeatureFlags,
        routingIntelligenceConfig
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

  // Check if it's a database flag:
  if (FLAGS[flagName] !== undefined) {
    try {
      await featureFlagsService.setFlag(flagName, Boolean(value), `Toggled by admin: ${req.user?.email || req.user?.id}`);
      const dbFeatureFlags = await getEnrichedDbFeatureFlags();

      return res.json({ 
        success: true, 
        message: `Database feature flag '${flagName}' updated`, 
        dbFeatureFlags 
      });
    } catch (err) {
      logger.error("Failed to update database feature flag", { flagName, value, error: err.message });
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  enterpriseFeatures[flagName] = Boolean(value);
  logger.info(`[FEATURE FLAG] Toggled '${flagName}' to ${value}`);
  await incrementRoutingConfigVersion(req.user?.email || req.user?.id);
  await rebuildRoutingCache();
  return res.json({ success: true, message: `Feature flag '${flagName}' updated`, data: enterpriseFeatures });
};

export const patchEnterpriseFeatureFlag = async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;

  if (key === undefined || value === undefined) {
    return res.status(400).json({ success: false, message: "Missing parameters" });
  }

  // Check if it's a database flag:
  if (FLAGS[key] !== undefined) {
    try {
      await featureFlagsService.setFlag(key, Boolean(value), `Patched by admin: ${req.user?.email || req.user?.id}`);
      const dbFeatureFlags = await getEnrichedDbFeatureFlags();
      return res.json({ 
        success: true, 
        message: `Database feature flag '${key}' updated`, 
        dbFeatureFlags 
      });
    } catch (err) {
      logger.error("Failed to patch database feature flag", { key, value, error: err.message });
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  enterpriseFeatures[key] = Boolean(value);
  logger.info(`[FEATURE FLAG] Patched '${key}' to ${value}`);
  await incrementRoutingConfigVersion(req.user?.email || req.user?.id);
  await rebuildRoutingCache();
  return res.json({ success: true, message: `Feature flag '${key}' updated`, data: enterpriseFeatures });
};

export const promoteRoutingRollout = async (req, res) => {
  try {
    const { targetLevel } = req.body;
    if (targetLevel === undefined) {
      return res.status(400).json({ success: false, message: "Missing targetLevel parameter" });
    }

    const updated = await promoteRoutingRolloutLevel(Number(targetLevel), true);
    res.json({ 
      success: true, 
      message: `Autonomous routing rollout level promoted successfully to ${(Number(targetLevel) * 100).toFixed(0)}%`, 
      data: updated 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const pauseRoutingRollout = async (req, res) => {
  try {
    const oldConfig = await prisma.routingIntelligenceConfig.findUnique({ where: { id: 1 } });
    const updated = await prisma.routingIntelligenceConfig.update({
      where: { id: 1 },
      data: { rolloutLevel: 0.01 }
    });

    await prisma.routingAuditLog.create({
      data: {
        action: "AUTONOMOUS_ROUTING_PAUSED",
        entityType: "RoutingIntelligenceConfig",
        entityId: 1,
        oldValue: { rolloutLevel: oldConfig?.rolloutLevel || 0.01 },
        newValue: { rolloutLevel: 0.01 }
      }
    }).catch(() => {});

    res.json({ 
      success: true, 
      message: "Autonomous routing rollout paused and reset to 1%", 
      data: updated 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const rollbackRoutingRollout = async (req, res) => {
  try {
    // 1. Turn off autonomous routing flag
    await featureFlagsService.setFlag(FLAGS.ROUTING_INTELLIGENCE_AUTONOMOUS, false, "Emergency Rollback triggered by admin");
    // 2. Turn on shadow mode flag
    await featureFlagsService.setFlag(FLAGS.ROUTING_INTELLIGENCE_ENABLED, true, "Emergency Rollback triggered by admin");

    const oldConfig = await prisma.routingIntelligenceConfig.findUnique({ where: { id: 1 } });
    const updated = await prisma.routingIntelligenceConfig.update({
      where: { id: 1 },
      data: { rolloutLevel: 0.01 }
    });

    await prisma.routingAuditLog.create({
      data: {
        action: "AUTONOMOUS_ROUTING_ROLLED_BACK",
        entityType: "RoutingIntelligenceConfig",
        entityId: 1,
        oldValue: { rolloutLevel: oldConfig?.rolloutLevel || 0.01, autonomous: true },
        newValue: { rolloutLevel: 0.01, autonomous: false }
      }
    }).catch(() => {});

    res.json({ 
      success: true, 
      message: "Emergency rollback executed successfully. Sharded routing disabled and returned to Shadow Validation.", 
      data: updated 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * ============================================================================
 * MANUAL OPERATOR REGISTRY CRUD ENDPOINTS (PHASE 7)
 * ============================================================================
 */

const VALID_CATEGORIES = ["Mobile", "DTH", "Broadband", "Electricity", "Gas", "Water", "FASTag", "Landline"];

const isValidCategory = (cat) => {
  if (!cat) return false;
  return VALID_CATEGORIES.some(c => c.toUpperCase() === cat.toUpperCase());
};

const getStandardCategory = (cat) => {
  const match = VALID_CATEGORIES.find(c => c.toUpperCase() === cat.toUpperCase());
  return match || "Mobile";
};

const parseOperatorCodes = (op) => {
  try {
    const parsed = JSON.parse(op.codes);
    if (parsed && typeof parsed === "object") {
      return {
        id: op.id,
        name: op.name,
        code: parsed.code || op.codes || op.name,
        category: parsed.category || "Mobile",
        circleRequired: parsed.circleRequired ?? false,
        description: parsed.description || "",
        active: op.active,
        isDeleted: parsed.isDeleted ?? false,
        createdAt: op.createdAt,
        updatedAt: op.updatedAt
      };
    }
  } catch (e) {
    // fallback
  }
  return {
    id: op.id,
    name: op.name,
    code: op.codes || op.name,
    category: "Mobile",
    circleRequired: false,
    description: "",
    active: op.active,
    isDeleted: false,
    createdAt: op.createdAt,
    updatedAt: op.updatedAt
  };
};

export const getOperatorsRegistry = async (req, res) => {
  try {
    const operators = await prisma.operator.findMany({
      orderBy: { name: "asc" }
    });
    const parsed = operators
      .map(parseOperatorCodes)
      .filter(op => !op.isDeleted);
    return res.json({ success: true, data: parsed });
  } catch (error) {
    logger.error("Failed to fetch operators registry", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const createOperatorRegistry = async (req, res) => {
  try {
    const { name, code, category, active, circleRequired, description } = req.body;
    
    if (!name || !code || !category) {
      return res.status(400).json({ success: false, message: "Missing required operator registry fields" });
    }

    if (!isValidCategory(category)) {
      return res.status(400).json({ success: false, message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` });
    }

    const normalizedName = String(name).trim().toUpperCase();

    // Check if operator already exists
    const existing = await prisma.operator.findUnique({
      where: { name: normalizedName }
    });

    let resultOperator;
    if (existing) {
      const parsed = parseOperatorCodes(existing);
      if (parsed.isDeleted) {
        // Resurrect soft-deleted operator
        const codesObj = {
          code: String(code).trim(),
          category: getStandardCategory(category),
          circleRequired: circleRequired !== undefined ? Boolean(circleRequired) : false,
          description: String(description || "").trim(),
          isDeleted: false
        };
        resultOperator = await prisma.operator.update({
          where: { id: existing.id },
          data: {
            active: active !== undefined ? Boolean(active) : true,
            codes: JSON.stringify(codesObj)
          }
        });
      } else {
        return res.status(400).json({ success: false, message: "Operator name already exists" });
      }
    } else {
      const codesObj = {
        code: String(code).trim(),
        category: getStandardCategory(category),
        circleRequired: circleRequired !== undefined ? Boolean(circleRequired) : false,
        description: String(description || "").trim(),
        isDeleted: false
      };
      resultOperator = await prisma.operator.create({
        data: {
          name: normalizedName,
          active: active !== undefined ? Boolean(active) : true,
          codes: JSON.stringify(codesObj)
        }
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "OPERATOR_CREATED",
        adminId: req.user.id,
        entity: "operator",
        entityId: resultOperator.id,
        details: { name: normalizedName, code, category: getStandardCategory(category), active: active !== undefined ? Boolean(active) : true },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"]
      }
    }).catch(err => logger.error("Audit log failed for operator create", { error: err.message }));

    const parsedRes = parseOperatorCodes(resultOperator);
    return res.json({ success: true, message: "Operator created successfully", data: parsedRes });
  } catch (error) {
    logger.error("Failed to create operator registry", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updateOperatorRegistry = async (req, res) => {
  const { id } = req.params;
  try {
    const { name, code, category, active, circleRequired, description } = req.body;

    const op = await prisma.operator.findUnique({
      where: { id: Number(id) }
    });

    if (!op) {
      return res.status(404).json({ success: false, message: "Operator not found" });
    }

    const currentParsed = parseOperatorCodes(op);
    if (currentParsed.isDeleted) {
      return res.status(404).json({ success: false, message: "Operator not found" });
    }

    const normalizedName = name ? String(name).trim().toUpperCase() : op.name;

    // Check if name changed and matches another operator
    if (name && normalizedName !== op.name) {
      const existingName = await prisma.operator.findUnique({
        where: { name: normalizedName }
      });
      if (existingName) {
        return res.status(400).json({ success: false, message: "Operator name already exists" });
      }
    }

    if (category && !isValidCategory(category)) {
      return res.status(400).json({ success: false, message: `Invalid category` });
    }

    const codesObj = {
      code: code ? String(code).trim() : currentParsed.code,
      category: category ? getStandardCategory(category) : currentParsed.category,
      circleRequired: circleRequired !== undefined ? Boolean(circleRequired) : currentParsed.circleRequired,
      description: description !== undefined ? String(description || "").trim() : currentParsed.description,
      isDeleted: false
    };

    const updated = await prisma.operator.update({
      where: { id: Number(id) },
      data: {
        name: normalizedName,
        active: active !== undefined ? Boolean(active) : op.active,
        codes: JSON.stringify(codesObj)
      }
    });

    // Handle Enable/Disable Audit Log Action
    let auditAction = "OPERATOR_UPDATED";
    if (active !== undefined && Boolean(active) !== op.active) {
      auditAction = active ? "OPERATOR_ENABLED" : "OPERATOR_DISABLED";
    }

    await prisma.auditLog.create({
      data: {
        action: auditAction,
        adminId: req.user.id,
        entity: "operator",
        entityId: updated.id,
        details: { name: normalizedName, code: codesObj.code, category: codesObj.category, active: updated.active },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"]
      }
    }).catch(err => logger.error("Audit log failed for operator update", { error: err.message }));

    const parsedRes = parseOperatorCodes(updated);
    return res.json({ success: true, message: "Operator updated successfully", data: parsedRes });
  } catch (error) {
    logger.error("Failed to update operator registry", { error: error.message, id });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const deleteOperatorRegistry = async (req, res) => {
  const { id } = req.params;
  try {
    const op = await prisma.operator.findUnique({
      where: { id: Number(id) }
    });

    if (!op) {
      return res.status(404).json({ success: false, message: "Operator not found" });
    }

    const currentParsed = parseOperatorCodes(op);
    if (currentParsed.isDeleted) {
      return res.status(404).json({ success: false, message: "Operator not found" });
    }

    const codesObj = {
      ...currentParsed,
      isDeleted: true
    };
    delete codesObj.id;
    delete codesObj.name;
    delete codesObj.active;
    delete codesObj.createdAt;
    delete codesObj.updatedAt;

    await prisma.operator.update({
      where: { id: Number(id) },
      data: {
        active: false,
        codes: JSON.stringify(codesObj)
      }
    });

    await prisma.auditLog.create({
      data: {
        action: "OPERATOR_DELETED",
        adminId: req.user.id,
        entity: "operator",
        entityId: op.id,
        details: { name: op.name },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"]
      }
    }).catch(err => logger.error("Audit log failed for operator delete", { error: err.message }));

    return res.json({ success: true, message: "Operator deleted successfully" });
  } catch (error) {
    logger.error("Failed to soft-delete operator registry", { error: error.message, id });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const importOperatorsCSV = async (req, res) => {
  const { csvData } = req.body;
  if (!csvData || typeof csvData !== "string") {
    return res.status(400).json({ success: false, message: "csvData text string is required" });
  }

  try {
    const lines = csvData.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      return res.status(400).json({ success: false, message: "CSV must contain at least headers and one row" });
    }

    const headers = lines[0].toLowerCase().split(",").map(h => h.trim());
    const nameIdx = headers.indexOf("name");
    const codeIdx = headers.indexOf("code");
    const catIdx = headers.indexOf("category");
    const statusIdx = headers.indexOf("status");

    if (nameIdx === -1 || codeIdx === -1 || catIdx === -1 || statusIdx === -1) {
      return res.status(400).json({ success: false, message: "CSV headers must contain 'name', 'code', 'category', and 'status'" });
    }

    const imported = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(",").map(p => p.trim());
      if (parts.length < headers.length) continue;

      const name = parts[nameIdx];
      const code = parts[codeIdx];
      const category = parts[catIdx];
      const statusStr = parts[statusIdx].toUpperCase();

      if (!name || !code || !category) continue;

      const active = statusStr === "ACTIVE" || statusStr === "TRUE";
      const normalizedName = String(name).toUpperCase();
      const standardCategory = getStandardCategory(category);

      const codesObj = {
        code,
        category: standardCategory,
        circleRequired: false,
        description: `Imported via CSV`,
        isDeleted: false
      };

      const record = await prisma.operator.upsert({
        where: { name: normalizedName },
        update: {
          active,
          codes: JSON.stringify(codesObj)
        },
        create: {
          name: normalizedName,
          active,
          codes: JSON.stringify(codesObj)
        }
      });
      imported.push(record);
    }

    await prisma.auditLog.create({
      data: {
        action: "OPERATORS_IMPORTED",
        adminId: req.user.id,
        entity: "operator",
        details: { count: imported.length },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"]
      }
    }).catch(err => logger.error("Audit log failed for operator import", { error: err.message }));

    return res.json({ success: true, message: `Successfully imported ${imported.length} operators` });
  } catch (error) {
    logger.error("Failed to import CSV operators", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const exportOperatorsCSV = async (req, res) => {
  try {
    const operators = await prisma.operator.findMany({
      orderBy: { name: "asc" }
    });
    const parsed = operators
      .map(parseOperatorCodes)
      .filter(op => !op.isDeleted);

    let csvContent = "name,code,category,status\n";
    for (const op of parsed) {
      const statusStr = op.active ? "ACTIVE" : "INACTIVE";
      csvContent += `"${op.name}","${op.code}","${op.category.toUpperCase()}","${statusStr}"\n`;
    }

    await prisma.auditLog.create({
      data: {
        action: "OPERATORS_EXPORTED",
        adminId: req.user.id,
        entity: "operator",
        details: { count: parsed.length },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"]
      }
    }).catch(err => logger.error("Audit log failed for operator export", { error: err.message }));

    res.header("Content-Type", "text/csv");
    res.attachment("operators_registry.csv");
    return res.send(csvContent);
  } catch (error) {
    logger.error("Failed to export operators CSV", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
