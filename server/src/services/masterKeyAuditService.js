import { logAction } from "./auditService.js";

/**
 * Log Master Key related security events to the audit log.
 * @param {number|null} adminId - The administrator ID
 * @param {string} action - Action tag (e.g. MASTER_KEY_USED, MASTER_KEY_FAILED)
 * @param {Object|null} req - The express request object
 * @param {Object} metadata - Optional metadata details
 */
export const logMasterKeyAction = async (adminId, action, req, metadata = {}) => {
  try {
    await logAction({
      action,
      adminId: adminId ? Number(adminId) : null,
      entity: "MASTER_KEY_SYSTEM",
      details: {
        endpoint: req?.originalUrl || req?.url || "N/A",
        timestamp: new Date().toISOString(),
        ...metadata
      },
      req
    });
  } catch (err) {
    console.error("[MasterKeyAuditService] Log failed:", err.message);
  }
};
