import { redisClient } from "../config/redis.js";
import prisma from "../config/prisma.js";

/**
 * Checks the system-wide and user-specific freeze states.
 * 
 * SOFT FREEZE: Blocks cashback, coin redemption, and rewards.
 * HARD FREEZE: Blocks all mutations (wallet adjustments, ledger additions, recharges).
 * 
 * @param {number|string} [userId] - Optional user ID to check.
 * @returns {Promise<{ isHard: boolean, isSoft: boolean, reason: string|null }>}
 */
export const getFreezeStatus = async (userId = null) => {
  const globalFreeze = await redisClient.get("freeze:global");
  let userFreeze = null;

  if (userId) {
    userFreeze = await redisClient.get(`freeze:user:${userId}`);
  }

  const isHard = globalFreeze === "hard" || userFreeze === "hard";
  const isSoft = globalFreeze === "soft" || userFreeze === "soft" || isHard;

  let reason = null;
  if (isHard) {
    const globalReason = await redisClient.get("freeze:global:reason") || "Global hard freeze";
    const userReason = userFreeze === "hard" ? (await redisClient.get(`freeze:user:${userId}:reason`) || "User hard freeze") : null;
    reason = userReason || globalReason;
  } else if (isSoft) {
    const globalReason = await redisClient.get("freeze:global:reason") || "Global soft freeze";
    const userReason = userFreeze === "soft" ? (await redisClient.get(`freeze:user:${userId}:reason`) || "User soft freeze") : null;
    reason = userReason || globalReason;
  }

  return { isHard, isSoft, reason };
};

/**
 * Transition global freeze status.
 * @param {"hard"|"soft"|null} mode 
 * @param {string} reason 
 */
export const setGlobalFreeze = async (mode, reason) => {
  if (mode === "hard" || mode === "soft") {
    await redisClient.set("freeze:global", mode);
    await redisClient.set("freeze:global:reason", reason || `System ${mode} freeze`);
    
    await prisma.auditLog.create({
      data: {
        action: `SYSTEM_FREEZE_${mode.toUpperCase()}`,
        details: { reason, timestamp: Date.now() }
      }
    }).catch(err => console.error("[FreezeService] Failed to write audit log:", err));
  } else {
    await redisClient.del("freeze:global");
    await redisClient.del("freeze:global:reason");

    await prisma.auditLog.create({
      data: {
        action: "SYSTEM_UNFREEZE",
        details: { timestamp: Date.now() }
      }
    }).catch(err => console.error("[FreezeService] Failed to write audit log:", err));
  }
};

/**
 * Transition user freeze status.
 * @param {number|string} userId 
 * @param {"hard"|"soft"|null} mode 
 * @param {string} reason 
 */
export const setUserFreeze = async (userId, mode, reason) => {
  const uId = Number(userId);
  if (mode === "hard" || mode === "soft") {
    await redisClient.set(`freeze:user:${uId}`, mode);
    await redisClient.set(`freeze:user:${uId}:reason`, reason || `User ${mode} freeze`);

    await prisma.auditLog.create({
      data: {
        action: `USER_FREEZE_${mode.toUpperCase()}`,
        userId: uId,
        details: { reason, timestamp: Date.now() }
      }
    }).catch(err => console.error("[FreezeService] Failed to write audit log:", err));
  } else {
    await redisClient.del(`freeze:user:${uId}`);
    await redisClient.del(`freeze:user:${uId}:reason`);

    await prisma.auditLog.create({
      data: {
        action: "USER_UNFREEZE",
        userId: uId,
        details: { timestamp: Date.now() }
      }
    }).catch(err => console.error("[FreezeService] Failed to write audit log:", err));
  }
};
