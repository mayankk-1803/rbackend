import prisma from "../config/prisma.js";

/**
 * Validates Master Key settings and provider route health/availability.
 * Supports running inside a Prisma transaction context.
 */
export const validateMasterKeyAndRoutes = async (tx = prisma) => {
  try {
    // 1. Check Master Key configurations
    const masterKey = process.env.SYSTEM_MASTER_KEY;
    const isEnabled = process.env.ENABLE_MASTER_KEY === "true";

    if (!masterKey) {
      console.warn("[MASTER_KEY_VAL_FAIL] SYSTEM_MASTER_KEY is not configured.");
      return false;
    }

    if (!isEnabled) {
      console.warn("[MASTER_KEY_VAL_FAIL] ENABLE_MASTER_KEY is not set to true.");
      return false;
    }

    // 2. Check active providers that are not suspended (blacklisted or in maintenance)
    const activeProviders = await tx.provider.findMany({
      where: {
        isActive: true,
        isBlacklisted: false,
        maintenanceMode: false
      },
      select: { id: true, code: true }
    });

    if (activeProviders.length === 0) {
      console.warn("[MASTER_KEY_VAL_FAIL] No active, non-suspended, non-maintenance providers exist.");
      return false;
    }

    const activeProviderIds = activeProviders.map(p => p.id);

    // 3. Verify active operator provider mapping exists
    const activeMapping = await tx.operatorProviderMapping.findFirst({
      where: {
        providerId: { in: activeProviderIds },
        isActive: true
      }
    });

    if (!activeMapping) {
      console.warn("[MASTER_KEY_VAL_FAIL] No active OperatorProviderMapping found for active providers.");
      return false;
    }

    // 4. Verify route availability (active routing rules exist)
    const activeRule = await tx.routingRule.findFirst({
      where: {
        isActive: true,
        isDeleted: false
      }
    });

    if (!activeRule) {
      console.warn("[MASTER_KEY_VAL_FAIL] No active and non-deleted RoutingRule found.");
      return false;
    }

    return true;
  } catch (error) {
    console.error("[MASTER_KEY_VAL_ERROR] Error running validations:", error.message);
    return false;
  }
};
