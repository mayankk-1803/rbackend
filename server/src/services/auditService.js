import prisma from "../config/prisma.js";

/**
 * Logs an administrative or user action to the auditLog table.
 * @param {Object} params - Audit log parameters.
 */
export const logAction = async ({
  action,
  adminId = null,
  userId = null,
  entity = null,
  entityId = null,
  details = {},
  req = null
}) => {
  try {
    const logData = {
      action,
      adminId,
      userId,
      entity,
      entityId,
      details,
      ipAddress: req?.ip || req?.headers['x-forwarded-for'],
      userAgent: req?.headers['user-agent']
    };

    await prisma.auditLog.create({
      data: logData
    });
    
    console.log(`[Audit] ${action} logged for ${entity}:${entityId}`);
  } catch (err) {
    console.error("[Audit Log Error]:", err.message);
    // We don't throw here to avoid breaking the main operation if logging fails
  }
};

/**
 * Standardized actions for audit logging.
 */
export const AUDIT_ACTIONS = {
  CASHBACK_UPDATE: "CASHBACK_UPDATE",
  WALLET_ADJUSTMENT: "WALLET_ADJUSTMENT",
  DISPUTE_RESOLVE: "DISPUTE_RESOLVE",
  USER_UPDATE: "USER_UPDATE",
  PROVIDER_UPDATE: "PROVIDER_UPDATE",
  RECHARGE_RETRY: "RECHARGE_RETRY",
  COIN_REDEMPTION: "COIN_REDEMPTION"
};
