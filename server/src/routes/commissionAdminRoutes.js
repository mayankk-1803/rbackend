import express from "express";
import { auth } from "../middlewares/auth.js";
import { isAdmin } from "../middlewares/admin.js";
import {
  getSlabs,
  createSlab,
  updateSlab,
  deleteSlab,
  cloneSlab,
  assignUsersToSlab,
  getServiceCategories,
  getPackages,
  createPackage,
  updatePackage,
  deletePackage,
  clonePackage,
  assignUsersToPackage,
  getRechargeRules,
  createRechargeRule,
  updateRechargeRule,
  deleteRechargeRule,
  cloneRechargeRule,
  approveRechargeRule,
  rejectRechargeRule,
  getRangeRules,
  createRangeRule,
  updateRangeRule,
  deleteRangeRule,
  cloneRangeRule,
  approveRangeRule,
  rejectRangeRule,
  getCommissionOperators,
  getCommissionRoles,
  getBulkJobs,
  getBulkPreview,
  executeBulkJob,
  rollbackBulkJob,
  simulateCommission,
  getShadowValidationStats,
  getShadowValidationList,
  getCommissionConfig,
  updateCommissionConfig,
  getCommissionMigrationMetrics,
  getCommissionRecommendations,
  getCommissionIntelConfig,
  updateCommissionIntelConfig,
  simulateCommissionRecommendation,
  approveCommissionRecommendation,
  rejectCommissionRecommendation,
  applyCommissionRecommendation,
  rollbackCommissionRecommendation,
  getCommissionAuditLogs
} from "../controllers/commissionAdminController.js";

import prisma from "../config/prisma.js";

const router = express.Router();

/**
 * Granular RBAC middleware for the Commission Module.
 * - SUPER_ADMIN: Full Access
 * - ADMIN: Commission Management
 * - SUB_ADMIN: Read-only access (Limited Commission Management)
 * - Others: No Access
 */
export const checkCommissionPermission = (actionType) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: "Unauthorized request" });
      }

      // Bypass for SUPER_ADMIN role in JWT
      if (user.role === "SUPER_ADMIN") {
        return next();
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { commissionRole: true }
      });

      if (!dbUser) {
        return res.status(401).json({ success: false, message: "User not found" });
      }

      const commRole = dbUser.commissionRole;

      // DB-based role mappings
      if (commRole === "SUPER_ADMIN") {
        return next();
      }

      if (commRole === "SUB_ADMIN") {
        if (actionType === "read") {
          return next();
        }
        return res.status(403).json({
          success: false,
          message: "Access Denied: Sub-Admins have read-only access to Commission settings."
        });
      }

      // If they have admin status in JWT, allow standard access
      if (user.role === "ADMIN") {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: "Access Denied: You do not have commission management privileges."
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  };
};

// All commission endpoints are protected by authentication and admin guard first
router.use(auth, isAdmin);

// Slab Master APIs
router.get("/slabs", checkCommissionPermission("read"), getSlabs);
router.post("/slabs", checkCommissionPermission("write"), createSlab);
router.put("/slabs/:id", checkCommissionPermission("write"), updateSlab);
router.delete("/slabs/:id", checkCommissionPermission("write"), deleteSlab);
router.post("/slabs/:id/clone", checkCommissionPermission("write"), cloneSlab);
router.post("/slabs/:id/assign-users", checkCommissionPermission("write"), assignUsersToSlab);

// Service Category APIs
router.get("/service-categories", checkCommissionPermission("read"), getServiceCategories);

// Package Master APIs
router.get("/packages", checkCommissionPermission("read"), getPackages);
router.post("/packages", checkCommissionPermission("write"), createPackage);
router.put("/packages/:id", checkCommissionPermission("write"), updatePackage);
router.delete("/packages/:id", checkCommissionPermission("write"), deletePackage);
router.post("/packages/:id/clone", checkCommissionPermission("write"), clonePackage);
router.post("/packages/:id/assign-users", checkCommissionPermission("write"), assignUsersToPackage);

// Recharge Commission Rule APIs
router.get("/recharge-rules", checkCommissionPermission("read"), getRechargeRules);
router.post("/recharge-rules", checkCommissionPermission("write"), createRechargeRule);
router.put("/recharge-rules/:id", checkCommissionPermission("write"), updateRechargeRule);
router.delete("/recharge-rules/:id", checkCommissionPermission("write"), deleteRechargeRule);
router.post("/recharge-rules/:id/clone", checkCommissionPermission("write"), cloneRechargeRule);
router.post("/recharge-rules/:id/approve", checkCommissionPermission("write"), approveRechargeRule);
router.post("/recharge-rules/:id/reject", checkCommissionPermission("write"), rejectRechargeRule);

// Range Commission Rule APIs
router.get("/range-rules", checkCommissionPermission("read"), getRangeRules);
router.post("/range-rules", checkCommissionPermission("write"), createRangeRule);
router.put("/range-rules/:id", checkCommissionPermission("write"), updateRangeRule);
router.delete("/range-rules/:id", checkCommissionPermission("write"), deleteRangeRule);
router.post("/range-rules/:id/clone", checkCommissionPermission("write"), cloneRangeRule);
router.post("/range-rules/:id/approve", checkCommissionPermission("write"), approveRangeRule);
router.post("/range-rules/:id/reject", checkCommissionPermission("write"), rejectRangeRule);

// Catalog APIs
router.get("/operators", checkCommissionPermission("read"), getCommissionOperators);
router.get("/commission-roles", checkCommissionPermission("read"), getCommissionRoles);

// Bulk setting APIs
router.get("/bulk/jobs", checkCommissionPermission("read"), getBulkJobs);
router.post("/bulk/preview", checkCommissionPermission("read"), getBulkPreview);
router.post("/bulk/execute", checkCommissionPermission("write"), executeBulkJob);
router.post("/bulk/rollback/:id", checkCommissionPermission("write"), rollbackBulkJob);

// Simulation APIs
router.post("/simulate", checkCommissionPermission("read"), simulateCommission);

// Shadow Validation APIs
router.get("/shadow-validation/stats", checkCommissionPermission("read"), getShadowValidationStats);
router.get("/shadow-validation/list", checkCommissionPermission("read"), getShadowValidationList);
router.get("/audit-logs", checkCommissionPermission("read"), getCommissionAuditLogs);

// Migration & Rollout APIs
router.get("/config", checkCommissionPermission("read"), getCommissionConfig);
router.put("/config", checkCommissionPermission("write"), updateCommissionConfig);
router.get("/migration/metrics", checkCommissionPermission("read"), getCommissionMigrationMetrics);

// Commission Intelligence Endpoints
router.get("/intelligence/recommendations", checkCommissionPermission("read"), getCommissionRecommendations);
router.get("/intelligence/config", checkCommissionPermission("read"), getCommissionIntelConfig);
router.put("/intelligence/config", checkCommissionPermission("write"), updateCommissionIntelConfig);
router.post("/intelligence/recommendations", checkCommissionPermission("write"), simulateCommissionRecommendation);
router.post("/intelligence/recommendations/:id/approve", checkCommissionPermission("write"), approveCommissionRecommendation);
router.post("/intelligence/recommendations/:id/reject", checkCommissionPermission("write"), rejectCommissionRecommendation);
router.post("/intelligence/recommendations/:id/apply", checkCommissionPermission("write"), applyCommissionRecommendation);
router.post("/intelligence/recommendations/:id/rollback", checkCommissionPermission("write"), rollbackCommissionRecommendation);

export default router;

