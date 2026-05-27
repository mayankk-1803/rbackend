import express from "express";
import { auth } from "../middlewares/auth.js";
import { isAdmin } from "../middlewares/admin.js";
import { checkPermission } from "../middlewares/rbac.js";
import {
  getCustomerCareQueue,
  getOutlets,
  updateOutletStatus,
  getPartners,
  getFosAgents,
  assignFosRetailers,
  executeBulkAction,
  getAgreements,
  updateAgreementStatus,
  getEmployees,
  createEmployee,
  getAttendanceLogs,
  checkInEmployee,
  checkOutEmployee,
  getMeetings,
  createMeeting,
  getAuditLogs,
  getRbacPermissions,
  updateRbacPermissions,
  createOutlet,
  getUsersWithoutOutlet,
  updateOutlet,
  getManageableUsers,
  convertPartner,
  rotatePartnerSecret,
  togglePartnerStatus,
  updatePartnerEnvironment,
  updatePartnerRateLimit,
  getPartnerUsage,
  revokePartner,
  createAgreement,
  updateAgreement,
  deleteAgreement
} from "../controllers/enterpriseController.js";

const router = express.Router();

// Enforce global admin JWT authentication
router.use(auth, isAdmin);

// 1. Customer Care Queue
router.get("/users/care", checkPermission("users", "read"), getCustomerCareQueue);

// 2. Outlets
router.get("/outlets", checkPermission("outlets", "read"), getOutlets);
router.post("/outlets", checkPermission("outlets", "write"), createOutlet);
router.put("/outlets/:id", checkPermission("outlets", "write"), updateOutlet);
router.patch("/outlets/:id/status", checkPermission("outlets", "approve"), updateOutletStatus);
router.get("/users-no-outlet", checkPermission("outlets", "read"), getUsersWithoutOutlet);

// 3. Partners
router.get("/partners", checkPermission("users", "read"), getPartners);
router.get("/manageable-users", checkPermission("users", "read"), getManageableUsers);
router.post("/partners/convert", checkPermission("users", "write"), convertPartner);
router.post("/partners/:id/rotate-secret", checkPermission("users", "write"), rotatePartnerSecret);
router.patch("/partners/:id/status", checkPermission("users", "write"), togglePartnerStatus);
router.patch("/partners/:id/environment", checkPermission("users", "write"), updatePartnerEnvironment);
router.patch("/partners/:id/rate-limit", checkPermission("users", "write"), updatePartnerRateLimit);
router.get("/partners/:id/usage", checkPermission("users", "read"), getPartnerUsage);
router.post("/partners/:id/revoke", checkPermission("users", "write"), revokePartner);

// 4. FOS Agents
router.get("/fos", checkPermission("employees", "read"), getFosAgents);
router.post("/fos/assign", checkPermission("employees", "write"), assignFosRetailers);

// 5. Bulk Operations
router.post("/users/bulk-action", checkPermission("users", "write"), executeBulkAction);

// 6. Agreements
router.get("/agreements", checkPermission("outlets", "read"), getAgreements);
router.patch("/agreements/:id/status", checkPermission("outlets", "approve"), updateAgreementStatus);
router.post("/agreements", checkPermission("outlets", "write"), createAgreement);
router.put("/agreements/:id", checkPermission("outlets", "write"), updateAgreement);
router.delete("/agreements/:id", checkPermission("outlets", "write"), deleteAgreement);

// 7. Employee Workforce CRM
router.get("/employees", checkPermission("employees", "read"), getEmployees);
router.post("/employees", checkPermission("employees", "write"), createEmployee);

// 8. Attendance Logs
router.get("/employees/attendance", checkPermission("employees", "read"), getAttendanceLogs);
router.post("/employees/attendance/checkin", checkPermission("employees", "write"), checkInEmployee);
router.post("/employees/attendance/checkout", checkPermission("employees", "write"), checkOutEmployee);

// 9. Meeting Scheduler
router.get("/employees/meetings", checkPermission("employees", "read"), getMeetings);
router.post("/employees/meetings", checkPermission("employees", "write"), createMeeting);

// 10. Security Audit Trails
router.get("/audit/logs", checkPermission("audit", "read"), getAuditLogs);

// 11. RBAC Matrix
router.get("/roles/permissions", checkPermission("audit", "read"), getRbacPermissions);
router.put("/roles/permissions", checkPermission("audit", "write"), updateRbacPermissions);
router.get("/rbac", checkPermission("audit", "read"), getRbacPermissions);
router.put("/rbac", checkPermission("audit", "write"), updateRbacPermissions);
router.put("/rbac/", checkPermission("audit", "write"), updateRbacPermissions);

export default router;
