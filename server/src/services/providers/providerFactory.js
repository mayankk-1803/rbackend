import apibox from "./apibox/index.js";
import { executeNexgateRecharge, checkNexgateStatus } from "./nexgateService.js";
import { DynamicProviderAdapter } from "./DynamicProviderAdapter.js";
import prisma from "../../config/prisma.js";

const providers = {
  APIBOX: {
    recharge: apibox.recharge,
    status: apibox.status,
    checkStatus: apibox.status,
    balance: apibox.balance,
    webhook: apibox.webhook
  },
  P1: {
    recharge: apibox.recharge,
    status: apibox.status,
    checkStatus: apibox.status,
    balance: apibox.balance,
    webhook: apibox.webhook
  },
  NEXGATE: {
    recharge: executeNexgateRecharge,
    status: checkNexgateStatus,
    checkStatus: checkNexgateStatus
  }
};

// In-memory cache for registered codes to allow synchronous existence check
let registeredCodes = new Set();

export const refreshProviderFactoryCache = async () => {
  try {
    const list = await prisma.provider.findMany({ select: { code: true } });
    registeredCodes = new Set(list.map(p => p.code.toUpperCase().trim()));
  } catch (e) {
    // Silently ignore or log during build/initialization phases
  }
};

// Initial load
refreshProviderFactoryCache();

export const getProvider = (code) => {
  const uCode = String(code).toUpperCase().trim();
  
  // 1. Legacy Providers always win
  if (providers[uCode]) {
    return providers[uCode];
  }

  // 2. Dynamic Providers
  if (
    process.env.ENABLE_DYNAMIC_PROVIDER_ADAPTER === "true" &&
    registeredCodes.has(uCode)
  ) {
    return new DynamicProviderAdapter(uCode);
  }

  throw new Error("Provider not found");
};

export const isSupported = (code) => {
  const uCode = String(code).toUpperCase().trim();
  return (
    !!providers[uCode] ||
    (process.env.ENABLE_DYNAMIC_PROVIDER_ADAPTER === "true" && registeredCodes.has(uCode))
  );
};

export const getProviderService = (code) => {
  return getProvider(code);
};
