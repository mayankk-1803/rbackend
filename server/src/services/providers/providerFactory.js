import apibox from "./apibox/index.js";
import { executeNexgateRecharge } from "./nexgateService.js";

const providers = {
  APIBOX: {
    recharge: apibox.recharge,
    status: apibox.status,
    balance: apibox.balance,
    webhook: apibox.webhook
  },
  P1: {
    recharge: apibox.recharge,
    status: apibox.status,
    balance: apibox.balance,
    webhook: apibox.webhook
  },
  NEXGATE: {
    recharge: executeNexgateRecharge
  }
};

/**
 * Scalable Provider Registry
 * Returns the full provider service object
 */
export const getProvider = (code) => {
  const provider = providers[code.toUpperCase()];
  if (!provider) {
    throw new Error(`Provider ${code} not implemented in factory.`);
  }
  return provider;
};

export const isSupported = (code) => {
  return !!providers[code.toUpperCase()];
};

/**
 * Backward compatibility for existing worker/controllers
 */
export const getProviderService = (code) => {
  const provider = getProvider(code);
  return provider.recharge;
};
