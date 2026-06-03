import prisma from "../config/prisma.js";
import logger from "../services/logging/logger.js";
import { redisClient } from "../config/redis.js";
import { REDIS_KEYS, rebuildRoutingCache, incrementRoutingConfigVersion } from "../services/routingEngine/routingCache.js";
import { resolveRoute } from "../services/routingEngine/routingEngine.js";
import { REAL_TO_ALIAS, ALIAS_TO_REAL } from "../config/providerAliases.js";

// Helper for writing audit logs
const logAudit = async (action, entityType, entityId, oldValue, newValue, req) => {
  try {
    await prisma.routingAuditLog.create({
      data: {
        action,
        entityType,
        entityId: Number(entityId),
        oldValue: oldValue ? JSON.stringify(oldValue) : null,
        newValue: newValue ? JSON.stringify(newValue) : null,
        userId: req.user?.id || null,
        userRole: req.user?.role || null,
        ipAddress: req.ip || null
      }
    });
  } catch (err) {
    logger.error("Failed to write immutability audit log entry", { error: err.message });
  }
};

/**
 * ==========================================
 * SECTION MASTER (Module 1)
 * ==========================================
 */
export const getSections = async (req, res) => {
  try {
    const sections = await prisma.serviceSection.findMany({
      where: { isDeleted: false },
      orderBy: { displayOrder: "asc" }
    });
    return res.json({ success: true, data: sections });
  } catch (error) {
    logger.error("Failed to load sections", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const createSection = async (req, res) => {
  const { name, code, description, serviceType, displayOrder } = req.body;
  if (!name || !code || !serviceType) {
    return res.status(400).json({ success: false, message: "Missing required section fields" });
  }

  try {
    const newSec = await prisma.serviceSection.create({
      data: {
        name,
        code: code.toUpperCase(),
        description,
        serviceType,
        displayOrder: Number(displayOrder || 0),
        createdBy: req.user?.id
      }
    });

    await logAudit("SECTION_CREATE", "ServiceSection", newSec.id, null, newSec, req);
    await incrementRoutingConfigVersion(req.user?.email || req.user?.id);
    await rebuildRoutingCache();

    return res.json({ success: true, message: "Section created successfully", data: newSec });
  } catch (error) {
    logger.error("Failed to create section", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updateSection = async (req, res) => {
  const { id } = req.params;
  const { name, description, serviceType, displayOrder, isActive } = req.body;

  try {
    const oldSec = await prisma.serviceSection.findUnique({ where: { id: Number(id) } });
    if (!oldSec) return res.status(404).json({ success: false, message: "Section not found" });

    const updated = await prisma.serviceSection.update({
      where: { id: Number(id) },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(serviceType && { serviceType }),
        ...(displayOrder !== undefined && { displayOrder: Number(displayOrder) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        updatedBy: req.user?.id
      }
    });

    await logAudit("SECTION_UPDATE", "ServiceSection", updated.id, oldSec, updated, req);
    await incrementRoutingConfigVersion(req.user?.email || req.user?.id);
    await rebuildRoutingCache();

    return res.json({ success: true, message: "Section updated successfully", data: updated });
  } catch (error) {
    logger.error("Failed to update section", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const deleteSection = async (req, res) => {
  const { id } = req.params;

  try {
    const oldSec = await prisma.serviceSection.findUnique({ where: { id: Number(id) } });
    if (!oldSec) return res.status(404).json({ success: false, message: "Section not found" });

    await prisma.serviceSection.update({
      where: { id: Number(id) },
      data: { isDeleted: true }
    });

    await logAudit("SECTION_DELETE", "ServiceSection", id, oldSec, { isDeleted: true }, req);
    await incrementRoutingConfigVersion(req.user?.email || req.user?.id);
    await rebuildRoutingCache();

    return res.json({ success: true, message: "Section deleted successfully" });
  } catch (error) {
    logger.error("Failed to delete section", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * ==========================================
 * OPERATOR MAPPING (Module 4)
 * ==========================================
 */
export const getOperatorMappings = async (req, res) => {
  try {
    const mappings = await prisma.operatorProviderMapping.findMany({
      include: { operator: true, provider: true }
    });

    // Map provider names to aliased client names for obfuscation
    const obfuscated = mappings.map(m => {
      const pAlias = REAL_TO_ALIAS[m.provider.code.toUpperCase()] || m.provider.code;
      return {
        ...m,
        provider: {
          ...m.provider,
          name: pAlias,
          code: pAlias
        }
      };
    });

    return res.json({ success: true, data: obfuscated });
  } catch (error) {
    logger.error("Failed to load mappings", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const createOperatorMapping = async (req, res) => {
  const { operatorId, providerId, providerOperatorCode, providerCircleCode, priority } = req.body;
  if (!operatorId || !providerId || !providerOperatorCode) {
    return res.status(400).json({ success: false, message: "Missing required mapping properties" });
  }

  try {
    const newMap = await prisma.operatorProviderMapping.create({
      data: {
        operatorId: Number(operatorId),
        providerId: Number(providerId),
        providerOperatorCode: String(providerOperatorCode),
        providerCircleCode: providerCircleCode || null,
        priority: Number(priority || 0)
      }
    });

    await logAudit("PROVIDER_MAPPING_CREATE", "OperatorProviderMapping", newMap.id, null, newMap, req);
    await incrementRoutingConfigVersion(req.user?.email || req.user?.id);
    await rebuildRoutingCache();

    return res.json({ success: true, message: "Operator mapping registered", data: newMap });
  } catch (error) {
    logger.error("Failed to create mapping", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updateOperatorMapping = async (req, res) => {
  const { id } = req.params;
  const { providerOperatorCode, providerCircleCode, priority, isActive } = req.body;

  try {
    const oldMap = await prisma.operatorProviderMapping.findUnique({ where: { id: Number(id) } });
    if (!oldMap) return res.status(404).json({ success: false, message: "Mapping not found" });

    const updated = await prisma.operatorProviderMapping.update({
      where: { id: Number(id) },
      data: {
        ...(providerOperatorCode && { providerOperatorCode: String(providerOperatorCode) }),
        ...(providerCircleCode !== undefined && { providerCircleCode }),
        ...(priority !== undefined && { priority: Number(priority) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) })
      }
    });

    await logAudit("PROVIDER_MAPPING_UPDATE", "OperatorProviderMapping", updated.id, oldMap, updated, req);
    await incrementRoutingConfigVersion(req.user?.email || req.user?.id);
    await rebuildRoutingCache();

    return res.json({ success: true, message: "Mapping updated successfully", data: updated });
  } catch (error) {
    logger.error("Failed to update mapping", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const deleteOperatorMapping = async (req, res) => {
  const { id } = req.params;

  try {
    const oldMap = await prisma.operatorProviderMapping.findUnique({ where: { id: Number(id) } });
    if (!oldMap) return res.status(404).json({ success: false, message: "Mapping not found" });

    await prisma.operatorProviderMapping.delete({ where: { id: Number(id) } });

    await logAudit("PROVIDER_MAPPING_DELETE", "OperatorProviderMapping", id, oldMap, null, req);
    await incrementRoutingConfigVersion(req.user?.email || req.user?.id);
    await rebuildRoutingCache();

    return res.json({ success: true, message: "Mapping deleted successfully" });
  } catch (error) {
    logger.error("Failed to delete mapping", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * ==========================================
 * ROUTING RULES & APPROVAL WORKFLOW (Module 2, 3, 6)
 * ==========================================
 */
export const getRules = async (req, res) => {
  try {
    const rules = await prisma.routingRule.findMany({
      where: { isDeleted: false },
      include: {
        section: true,
        operator: true,
        provider: true,
        versions: {
          orderBy: { version: "desc" }
        }
      },
      orderBy: { priority: "desc" }
    });

    // Obfuscate provider codes
    const mappedRules = rules.map(r => {
      const pAlias = r.provider ? (REAL_TO_ALIAS[r.provider.code.toUpperCase()] || r.provider.code) : null;
      return {
        ...r,
        provider: r.provider ? { ...r.provider, name: pAlias, code: pAlias } : null
      };
    });

    return res.json({ success: true, data: mappedRules });
  } catch (error) {
    logger.error("Failed to load rules", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const createRuleDraft = async (req, res) => {
  const {
    name,
    sectionId,
    operatorId,
    circleId,
    providerId,
    priority,
    weight,
    routeType,
    failureThreshold,
    latencyThreshold,
    amountFrom,
    amountTo,
    serviceType
  } = req.body;

  try {
    // Save draft rule with status DRAFT
    const newRule = await prisma.routingRule.create({
      data: {
        name,
        sectionId: sectionId ? Number(sectionId) : null,
        operatorId: operatorId ? Number(operatorId) : null,
        circleId: circleId ? Number(circleId) : null,
        providerId: providerId ? Number(providerId) : null,
        priority: Number(priority || 1),
        weight: Number(weight || 0),
        routeType,
        status: "DRAFT",
        failureThreshold: Number(failureThreshold || 0),
        latencyThreshold: Number(latencyThreshold || 0),
        amountFrom: Number(amountFrom || 0.0),
        amountTo: Number(amountTo || 99999.0),
        serviceType,
        isActive: false
      }
    });

    // Create rules version snapshot
    await prisma.routingRuleVersion.create({
      data: {
        routingRuleId: newRule.id,
        version: 1,
        configSnapshot: newRule,
        status: "DRAFT",
        createdBy: req.user?.id || 999
      }
    });

    await logAudit("ROUTING_CREATE", "RoutingRule", newRule.id, null, newRule, req);
    await incrementRoutingConfigVersion(req.user?.email || req.user?.id);
    await rebuildRoutingCache();

    return res.json({ success: true, message: "Draft routing rule created", data: newRule });
  } catch (error) {
    logger.error("Failed to create rule draft", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const submitRuleForApproval = async (req, res) => {
  const { id } = req.params;

  try {
    const rule = await prisma.routingRule.findUnique({ where: { id: Number(id) } });
    if (!rule) return res.status(404).json({ success: false, message: "Rule not found" });

    const updated = await prisma.routingRule.update({
      where: { id: Number(id) },
      data: { status: "PENDING_APPROVAL" }
    });

    // Create rule version pending approval
    const latestVer = await prisma.routingRuleVersion.findFirst({
      where: { routingRuleId: Number(id) },
      orderBy: { version: "desc" }
    });

    const nextVer = (latestVer?.version || 0) + 1;
    await prisma.routingRuleVersion.create({
      data: {
        routingRuleId: Number(id),
        version: nextVer,
        configSnapshot: updated,
        status: "PENDING_APPROVAL",
        createdBy: latestVer?.createdBy || req.user?.id || 999
      }
    });

    await logAudit("ROUTING_SUBMIT", "RoutingRule", id, rule, updated, req);
    await incrementRoutingConfigVersion(req.user?.email || req.user?.id);
    await rebuildRoutingCache();

    return res.json({ success: true, message: "Rule submitted for verification approval", data: updated });
  } catch (error) {
    logger.error("Failed to submit rule", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const approveRule = async (req, res) => {
  const { id } = req.params;

  try {
    const rule = await prisma.routingRule.findUnique({ where: { id: Number(id) } });
    if (!rule) return res.status(404).json({ success: false, message: "Rule not found" });

    // Resolve latest version record and update approval details
    const latestVer = await prisma.routingRuleVersion.findFirst({
      where: { routingRuleId: Number(id), status: "PENDING_APPROVAL" },
      orderBy: { version: "desc" }
    });

    if (latestVer) {
      // Maker-checker constraint: draft.creatorId !== approverId
      if (latestVer.createdBy === req.user?.id) {
        return res.status(403).json({
          success: false,
          message: "Maker-checker constraint violation: Self-approval is blocked."
        });
      }
    }

    // Update rule to APPROVED status and set isActive = true
    const updated = await prisma.routingRule.update({
      where: { id: Number(id) },
      data: {
        status: "APPROVED",
        isActive: true
      }
    });

    if (latestVer) {
      await prisma.routingRuleVersion.update({
        where: { id: latestVer.id },
        data: {
          status: "APPROVED",
          approvedBy: req.user?.id,
          approvedAt: new Date()
        }
      });
    }

    await logAudit("ROUTING_APPROVE", "RoutingRule", id, rule, updated, req);
    await logAudit("ROUTING_ACTIVATE", "RoutingRule", id, null, updated, req);
    await incrementRoutingConfigVersion(req.user?.email || req.user?.id);
    await rebuildRoutingCache();

    return res.json({ success: true, message: "Rule published successfully", data: updated });
  } catch (error) {
    logger.error("Failed to approve rule", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const rejectRule = async (req, res) => {
  const { id } = req.params;
  const { comments } = req.body;

  try {
    const rule = await prisma.routingRule.findUnique({ where: { id: Number(id) } });
    if (!rule) return res.status(404).json({ success: false, message: "Rule not found" });

    const updated = await prisma.routingRule.update({
      where: { id: Number(id) },
      data: { status: "REJECTED" }
    });

    const latestVer = await prisma.routingRuleVersion.findFirst({
      where: { routingRuleId: Number(id), status: "PENDING_APPROVAL" },
      orderBy: { version: "desc" }
    });

    if (latestVer) {
      await prisma.routingRuleVersion.update({
        where: { id: latestVer.id },
        data: {
          status: "REJECTED",
          approvedBy: req.user?.id,
          approvedAt: new Date()
        }
      });
    }

    await logAudit("ROUTING_REJECT", "RoutingRule", id, rule, updated, req);
    await incrementRoutingConfigVersion(req.user?.email || req.user?.id);
    await rebuildRoutingCache();

    return res.json({ success: true, message: "Rule changes rejected", data: updated });
  } catch (error) {
    logger.error("Failed to reject rule", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const deleteRule = async (req, res) => {
  const { id } = req.params;

  try {
    const oldRule = await prisma.routingRule.findUnique({ where: { id: Number(id) } });
    if (!oldRule) return res.status(404).json({ success: false, message: "Rule not found" });

    await prisma.routingRule.update({
      where: { id: Number(id) },
      data: { isDeleted: true, isActive: false }
    });

    await logAudit("ROUTING_DELETE", "RoutingRule", id, oldRule, { isDeleted: true }, req);
    await incrementRoutingConfigVersion(req.user?.email || req.user?.id);
    await rebuildRoutingCache();

    return res.json({ success: true, message: "Rule deleted successfully" });
  } catch (error) {
    logger.error("Failed to delete rule", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * ==========================================
 * ROUTE SIMULATOR (Module 5, 8)
 * ==========================================
 */
export const simulateRoute = async (req, res) => {
  const { sectionId, operatorId, circleId, amount, serviceType } = req.body;

  // Rate Limiting simulation queries (20 simulations per minute per user)
  const userId = req.user?.id || 999;
  const rateLimitKey = `routing:simulator:limit:${userId}`;
  try {
    const hits = await redisClient.incr(rateLimitKey);
    if (hits === 1) {
      await redisClient.expire(rateLimitKey, 60);
    }
    if (hits > 20) {
      return res.status(429).json({ success: false, message: "Simulator rate limit exceeded. Max 20 queries/min." });
    }

    // DRY RUN resolution evaluation (simulation flag = true)
    const result = await resolveRoute({
      sectionId: sectionId ? Number(sectionId) : null,
      operatorId: operatorId ? Number(operatorId) : null,
      circleId: circleId ? Number(circleId) : null,
      amount: Number(amount || 0.0),
      serviceType: serviceType || "RECHARGE",
      simulation: true
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    logger.error("Failed to simulate route", { error: error.message });
    return res.status(500).json({ success: false, message: "Simulation failed." });
  }
};

/**
 * ==========================================
 * ROUTING ANALYTICS & AUDIT LOGS (Module 6, 7)
 * ==========================================
 */
export const getRoutingAnalytics = async (req, res) => {
  try {
    const [trafficLogs, healthMetrics, providers] = await Promise.all([
      prisma.routingDecisionLog.findMany({ take: 100, orderBy: { createdAt: "desc" } }),
      prisma.providerHealthMetrics.findMany({ include: { provider: true } }),
      prisma.provider.findMany()
    ]);

    // Format metrics
    const totalTransactions = trafficLogs.length;
    const successLogs = trafficLogs.filter(l => l.routingReason?.toLowerCase().includes("success"));
    const successRate = totalTransactions > 0 ? (successLogs.length / totalTransactions) * 100 : 100.0;

    const providerStats = healthMetrics.map(hm => {
      const pAlias = REAL_TO_ALIAS[hm.provider.code.toUpperCase()] || hm.provider.code;
      return {
        providerAlias: pAlias,
        healthScore: hm.healthScore,
        latency: hm.latency,
        successRate: hm.successRate
      };
    });

    return res.json({
      success: true,
      data: {
        totalTransactions,
        successRate,
        providers: providerStats
      }
    });
  } catch (error) {
    logger.error("Failed to load routing analytics", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getAuditLogs = async (req, res) => {
  try {
    const logs = await prisma.routingAuditLog.findMany({
      orderBy: { createdAt: "desc" }
    });
    return res.json({ success: true, data: logs });
  } catch (error) {
    logger.error("Failed to fetch audit logs", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * ==========================================
 * EMERGENCY OVERRIDES (Module 8)
 * ==========================================
 */
export const getOverrides = async (req, res) => {
  if (req.user?.role !== "SUPER_ADMIN") {
    return res.status(403).json({ success: false, message: "Super Admin access required" });
  }

  try {
    const overrides = await redisClient.hgetall(REDIS_KEYS.OVERRIDES).catch(() => ({}));
    return res.json({ success: true, data: overrides });
  } catch (error) {
    logger.error("Failed to fetch emergency overrides", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updateOverride = async (req, res) => {
  if (req.user?.role !== "SUPER_ADMIN") {
    return res.status(403).json({ success: false, message: "Super Admin access required" });
  }

  const { globalFreeze, forcedProvider, reason } = req.body;
  if (!reason) {
    return res.status(400).json({ success: false, message: "Reason is mandatory for emergency actions." });
  }

  try {
    const oldOverrides = await redisClient.hgetall(REDIS_KEYS.OVERRIDES).catch(() => ({}));

    if (globalFreeze !== undefined) {
      await redisClient.hset(REDIS_KEYS.OVERRIDES, "globalFreeze", globalFreeze.toString());
    }
    if (forcedProvider !== undefined) {
      const realCode = ALIAS_TO_REAL[forcedProvider.toUpperCase()] || forcedProvider;
      await redisClient.hset(REDIS_KEYS.OVERRIDES, "forcedProvider", realCode);
    }

    const newOverrides = await redisClient.hgetall(REDIS_KEYS.OVERRIDES).catch(() => ({}));

    // Create EmergencyOverrideSnapshot
    const snapshot = await prisma.emergencyOverrideSnapshot.create({
      data: {
        oldValue: oldOverrides,
        newValue: newOverrides,
        reason,
        createdBy: req.user?.email || req.user?.id?.toString() || "SYSTEM"
      }
    });

    await logAudit("EMERGENCY_OVERRIDE", "EmergencyOverrides", snapshot.id, oldOverrides, newOverrides, req);
    await incrementRoutingConfigVersion(req.user?.email || req.user?.id);
    await rebuildRoutingCache();

    return res.json({ success: true, message: "Emergency overrides updated successfully", data: newOverrides });
  } catch (error) {
    logger.error("Failed to update emergency override", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const rollbackOverride = async (req, res) => {
  if (req.user?.role !== "SUPER_ADMIN") {
    return res.status(403).json({ success: false, message: "Super Admin access required" });
  }

  const { reason } = req.body;
  if (!reason) {
    return res.status(400).json({ success: false, message: "Reason is mandatory for emergency actions." });
  }

  try {
    const latestSnapshot = await prisma.emergencyOverrideSnapshot.findFirst({
      orderBy: { timestamp: "desc" }
    });

    if (!latestSnapshot) {
      return res.status(404).json({ success: false, message: "No emergency override snapshots found to rollback." });
    }

    const oldOverrides = await redisClient.hgetall(REDIS_KEYS.OVERRIDES).catch(() => ({}));

    // Clear current overrides
    await redisClient.del(REDIS_KEYS.OVERRIDES);

    // Restore oldValue from snapshot
    const restoredValue = latestSnapshot.oldValue;
    if (restoredValue && typeof restoredValue === "object") {
      for (const [k, v] of Object.entries(restoredValue)) {
        await redisClient.hset(REDIS_KEYS.OVERRIDES, k, String(v));
      }
    }

    const newOverrides = await redisClient.hgetall(REDIS_KEYS.OVERRIDES).catch(() => ({}));

    // Create a new snapshot for rollback tracking
    await prisma.emergencyOverrideSnapshot.create({
      data: {
        oldValue: oldOverrides,
        newValue: newOverrides,
        reason: `EMERGENCY_ROLLBACK of snapshot ID ${latestSnapshot.id}. Reason: ${reason}`,
        createdBy: req.user?.email || req.user?.id?.toString() || "SYSTEM"
      }
    });

    await logAudit("EMERGENCY_ROLLBACK", "EmergencyOverrides", latestSnapshot.id, oldOverrides, newOverrides, req);
    await incrementRoutingConfigVersion(req.user?.email || req.user?.id);
    await rebuildRoutingCache();

    return res.json({ success: true, message: "Emergency overrides rolled back successfully", data: newOverrides });
  } catch (error) {
    logger.error("Failed to rollback emergency override", { error: error.message });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const rebuildCacheEndpoint = async (req, res) => {
  try {
    await rebuildRoutingCache();
    return res.json({ success: true, message: "Routing configurations cache successfully rebuilt." });
  } catch (error) {
    logger.error("Failed to rebuild cache via endpoint", { error: error.message });
    return res.status(500).json({ success: false, message: "Cache rebuild failed." });
  }
};

export default {
  getSections,
  createSection,
  updateSection,
  deleteSection,
  getOperatorMappings,
  createOperatorMapping,
  updateOperatorMapping,
  deleteOperatorMapping,
  getRules,
  createRuleDraft,
  submitRuleForApproval,
  approveRule,
  rejectRule,
  deleteRule,
  simulateRoute,
  getRoutingAnalytics,
  getAuditLogs,
  getOverrides,
  updateOverride,
  rollbackOverride,
  rebuildCacheEndpoint
};
