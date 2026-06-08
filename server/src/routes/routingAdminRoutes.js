import express from "express";
import { auth } from "../middlewares/auth.js";
import { isAdmin } from "../middlewares/admin.js";
import { checkPermission, superAdminOnly } from "../middlewares/rbac.js";
import { masterKeySessionMiddleware } from "../middlewares/masterKeySessionMiddleware.js";
import {
  getProvidersList,
  updateProviderSettings,
  getOperatorMappings,
  createOperatorMapping,
  toggleOperatorMapping,
  getRoutingRules,
  createRoutingRule,
  toggleRoutingRule,
  getRoutingDecisionLogs,
  getWhatsappTemplates,
  createWhatsappTemplate,
  toggleWhatsappTemplate,
  getNotificationLogs,
  getTelemetryData,
  toggleEnterpriseFeatureFlag,
  patchEnterpriseFeatureFlag,
  promoteRoutingRollout,
  pauseRoutingRollout,
  rollbackRoutingRollout,
  getOperatorsRegistry,
  createOperatorRegistry,
  updateOperatorRegistry,
  deleteOperatorRegistry,
  importOperatorsCSV,
  exportOperatorsCSV
} from "../controllers/routingAdminController.js";

import ops from "../controllers/operationsController.js";
import { getPrometheusMetrics } from "../services/routingEngine/routingMetrics.js";

const router = express.Router();

// Enforce administrative scope globally across all endpoints
router.use(auth, isAdmin);

// ==========================================
// LEGACY ENTERPRISE ROUTING ENDPOINTS (Preserved)
// ==========================================
router.get("/providers", checkPermission("operations", "read"), getProvidersList);
router.put("/providers/:id", checkPermission("operations", "write"), masterKeySessionMiddleware, updateProviderSettings);

// Operator Registry Endpoints (Phase 7)
router.get("/operators", checkPermission("operations", "read"), getOperatorsRegistry);
router.post("/operators", checkPermission("operations", "write"), masterKeySessionMiddleware, createOperatorRegistry);
router.put("/operators/:id", checkPermission("operations", "write"), masterKeySessionMiddleware, updateOperatorRegistry);
router.delete("/operators/:id", checkPermission("operations", "write"), masterKeySessionMiddleware, deleteOperatorRegistry);
router.post("/operators/import", checkPermission("operations", "write"), masterKeySessionMiddleware, importOperatorsCSV);
router.get("/operators/export", checkPermission("operations", "read"), masterKeySessionMiddleware, exportOperatorsCSV);

router.get("/operators/mappings", checkPermission("operations", "read"), getOperatorMappings);
router.post("/operators/mappings", checkPermission("operations", "write"), masterKeySessionMiddleware, createOperatorMapping);
router.patch("/operators/mappings/:id/toggle", checkPermission("operations", "write"), masterKeySessionMiddleware, toggleOperatorMapping);

router.get("/routing/rules", checkPermission("operations", "read"), getRoutingRules);
router.post("/routing/rules", checkPermission("operations", "write"), masterKeySessionMiddleware, createRoutingRule);
router.patch("/routing/rules/:id/toggle", checkPermission("operations", "write"), masterKeySessionMiddleware, toggleRoutingRule);

router.get("/routing/logs", checkPermission("operations", "read"), getRoutingDecisionLogs);

router.get("/whatsapp/templates", checkPermission("operations", "read"), getWhatsappTemplates);
router.post("/whatsapp/templates", checkPermission("operations", "write"), createWhatsappTemplate);
router.patch("/whatsapp/templates/:id/toggle", checkPermission("operations", "write"), toggleWhatsappTemplate);
router.get("/whatsapp/logs", checkPermission("operations", "read"), getNotificationLogs);

router.get("/telemetry", checkPermission("operations", "read"), getTelemetryData);
router.post("/features/flags", checkPermission("operations", "write"), masterKeySessionMiddleware, toggleEnterpriseFeatureFlag);
router.patch("/features/flags/:key", checkPermission("operations", "write"), masterKeySessionMiddleware, patchEnterpriseFeatureFlag);
router.post("/routing/promote", checkPermission("operations", "write"), masterKeySessionMiddleware, promoteRoutingRollout);
router.post("/routing/pause", checkPermission("operations", "write"), masterKeySessionMiddleware, pauseRoutingRollout);
router.post("/routing/rollback", checkPermission("operations", "write"), masterKeySessionMiddleware, rollbackRoutingRollout);

// ==========================================
// NEW ROUTING SUITE ENDPOINTS (Additive & Isolated)
// ==========================================

// Section Master
router.get("/sections", checkPermission("operations", "read"), ops.getSections);
router.post("/sections", checkPermission("operations", "write"), masterKeySessionMiddleware, ops.createSection);
router.put("/sections/:id", checkPermission("operations", "write"), masterKeySessionMiddleware, ops.updateSection);
router.delete("/sections/:id", checkPermission("operations", "write"), masterKeySessionMiddleware, ops.deleteSection);

// Operator mappings provider resolution
router.get("/operators/provider-mappings", checkPermission("operations", "read"), ops.getOperatorMappings);
router.post("/operators/provider-mappings", checkPermission("operations", "write"), masterKeySessionMiddleware, ops.createOperatorMapping);
router.put("/operators/provider-mappings/:id", checkPermission("operations", "write"), masterKeySessionMiddleware, ops.updateOperatorMapping);
router.delete("/operators/provider-mappings/:id", checkPermission("operations", "write"), masterKeySessionMiddleware, ops.deleteOperatorMapping);

// Advanced Routing Rules & Maker Checker Workflow
router.get("/routing/advanced-rules", checkPermission("operations", "read"), ops.getRules);
router.post("/routing/advanced-rules", checkPermission("operations", "write"), ops.createRuleDraft);
router.post("/routing/advanced-rules/:id/submit", checkPermission("operations", "write"), ops.submitRuleForApproval);
router.post("/routing/advanced-rules/:id/approve", superAdminOnly, masterKeySessionMiddleware, ops.approveRule);
router.post("/routing/advanced-rules/:id/reject", checkPermission("operations", "write"), ops.rejectRule);
router.delete("/routing/advanced-rules/:id", checkPermission("operations", "write"), masterKeySessionMiddleware, ops.deleteRule);

// Route Simulator
router.post("/routing/simulate", checkPermission("operations", "read"), ops.simulateRoute);

// Performance Analytics & Immutable Audits
router.get("/routing/analytics", checkPermission("operations", "read"), ops.getRoutingAnalytics);
router.get("/routing/audit-logs", checkPermission("operations", "read"), ops.getAuditLogs);

// Emergency overrides and forced paths
router.get("/routing/emergency", superAdminOnly, ops.getOverrides);
router.post("/routing/emergency", superAdminOnly, masterKeySessionMiddleware, ops.updateOverride);
router.post("/routing/emergency/rollback", superAdminOnly, masterKeySessionMiddleware, ops.rollbackOverride);
router.post("/routing/cache/rebuild", checkPermission("operations", "write"), masterKeySessionMiddleware, ops.rebuildCacheEndpoint);

// Prometheus metric endpoint
router.get("/routing/metrics", checkPermission("operations", "read"), async (req, res) => {
  try {
    const rawMetrics = await getPrometheusMetrics();
    res.set("Content-Type", "text/plain");
    return res.send(rawMetrics);
  } catch (err) {
    return res.status(500).send("Error generating prometheus metrics string");
  }
});

export default router;
