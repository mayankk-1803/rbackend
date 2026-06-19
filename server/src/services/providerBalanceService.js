import prisma from "../config/prisma.js";
import { getProvider } from "./providers/providerFactory.js";

/**
 * Retrieves the current recharge pool balance from the active provider.
 * Normalizes output and uses the existing cache layers inside provider clients.
 * This is read-only and does not mutate database records.
 */
export const getRechargePoolBalance = async () => {
  try {
    // 1. Find the active provider that is in use by operators or configured as active
    let providerCode = "APIBOX"; // System default
    const activeProvider = await prisma.provider.findFirst({
      where: {
        isActive: true,
        isBlacklisted: false,
        maintenanceMode: false,
        providerType: "RECHARGE"
      },
      select: { code: true }
    });

    if (activeProvider) {
      providerCode = activeProvider.code;
    }

    // 2. Fetch provider instance from the provider factory abstraction
    const providerInstance = getProvider(providerCode);

    if (providerInstance && typeof providerInstance.balance === "function") {
      // Reuses internal cached balance / API checking
      const balanceRes = await providerInstance.balance();
      return {
        balance: Number(balanceRes.balance || 0),
        providerAvailable: !!balanceRes.providerAvailable,
        timestamp: new Date().toISOString()
      };
    }

    throw new Error(`Provider ${providerCode} does not support balance queries`);
  } catch (error) {
    console.error("[providerBalanceService][BALANCE_ERROR]:", error.message);
    return {
      balance: 0,
      providerAvailable: false,
      timestamp: new Date().toISOString()
    };
  }
};
