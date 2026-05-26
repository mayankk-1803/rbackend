import prisma from "../config/prisma.js";

/**
 * Log audit events to the database
 * @param {string} action - The audit action (e.g. 'API_KEY_GEN', 'SECRET_ROTATE')
 * @param {number|null} userId - The user ID
 * @param {number|null} adminId - The admin ID if administrative action
 * @param {string|null} entity - The affected model/entity name
 * @param {number|null} entityId - The ID of the entity
 * @param {object|null} details - Custom details object
 * @param {string|null} ipAddress - The client IP
 * @param {string|null} userAgent - The client User Agent
 */
export const logAudit = async ({
  action,
  userId,
  adminId,
  entity,
  entityId,
  details,
  ipAddress,
  userAgent
}) => {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        userId: userId ? Number(userId) : null,
        adminId: adminId ? Number(adminId) : null,
        entity,
        entityId: entityId ? Number(entityId) : null,
        details: details || {},
        ipAddress,
        userAgent
      }
    });
  } catch (err) {
    console.error("[AUDIT LOG ERROR]:", err.message);
  }
};
