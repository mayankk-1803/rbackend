import express from "express";
import { auth } from "../middlewares/auth.js";
import { isAdmin } from "../middlewares/admin.js";
import { checkPermission } from "../middlewares/rbac.js";
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
  toggleEnterpriseFeatureFlag
} from "../controllers/routingAdminController.js";

const router = express.Router();

// Enforce administrative scope globally across all endpoints
router.use(auth, isAdmin);

// 1. Providers Management (Matches: GET /api/admin/enterprise/providers)
router.get("/providers", checkPermission("recharges", "read"), getProvidersList);
router.put("/providers/:id", checkPermission("recharges", "write"), updateProviderSettings);

// 2. Operator Mappings (Matches: GET /api/admin/enterprise/operators/mappings)
router.get("/operators/mappings", checkPermission("recharges", "read"), getOperatorMappings);
router.post("/operators/mappings", checkPermission("recharges", "write"), createOperatorMapping);
router.patch("/operators/mappings/:id/toggle", checkPermission("recharges", "write"), toggleOperatorMapping);

// 3. Routing & Switching Rules (Matches: GET /api/admin/enterprise/routing/rules)
router.get("/routing/rules", checkPermission("recharges", "read"), getRoutingRules);
router.post("/routing/rules", checkPermission("recharges", "write"), createRoutingRule);
router.patch("/routing/rules/:id/toggle", checkPermission("recharges", "write"), toggleRoutingRule);

// 3.5 Routing Decision Logs (Matches: GET /api/admin/enterprise/routing/logs)
router.get("/routing/logs", checkPermission("recharges", "read"), getRoutingDecisionLogs);

// 4. WhatsApp Notifications & Templates (Matches: GET /api/admin/enterprise/whatsapp/templates)
router.get("/whatsapp/templates", checkPermission("recharges", "read"), getWhatsappTemplates);
router.post("/whatsapp/templates", checkPermission("recharges", "write"), createWhatsappTemplate);
router.patch("/whatsapp/templates/:id/toggle", checkPermission("recharges", "write"), toggleWhatsappTemplate);
router.get("/whatsapp/logs", checkPermission("recharges", "read"), getNotificationLogs);

// 5. Telemetry & Feature Flags (Matches: GET /api/admin/enterprise/telemetry)
router.get("/telemetry", checkPermission("recharges", "read"), getTelemetryData);
router.post("/features/flags", checkPermission("recharges", "write"), toggleEnterpriseFeatureFlag);

export default router;
