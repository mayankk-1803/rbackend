import prisma from "../config/prisma.js";

/**
 * Resolves the active payment merchant integration from the database.
 * Rules:
 * 1. Query provider table.
 * 2. Filter providerType = PAYMENT.
 * 3. Filter isActive = true.
 * 4. Sort by priority.
 * 5. Return primary merchant.
 */
export const resolveActiveMerchant = async () => {
  const activeMerchant = await prisma.provider.findFirst({
    where: {
      providerType: "PAYMENT",
      isActive: true
    },
    orderBy: {
      priority: "asc" // Priority 1 is primary
    }
  });
  
  if (!activeMerchant) {
    throw new Error("No active payment merchant configured");
  }
  
  return activeMerchant;
};

/**
 * Validates the resolved merchant integration.
 */
export const validateMerchant = (merchant) => {
  if (!merchant) {
    throw new Error("No active payment merchant configured");
  }
  if (!merchant.apiKey) {
    throw new Error("Merchant API key is missing");
  }
  if (!merchant.baseUrl) {
    throw new Error("Merchant base URL is missing");
  }
  return true;
};

/**
 * Resolves the credentials for the merchant gateway.
 */
export const getMerchantCredentials = (merchant) => {
  validateMerchant(merchant);
  return {
    apiKey: merchant.apiKey,
    baseUrl: merchant.baseUrl,
    code: merchant.code,
    name: merchant.name
  };
};
