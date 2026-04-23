import axios from "axios";
import Provider from "../models/Provider.js";

/**
 * Generic function to call a recharge provider API
 */
export const callProviderApi = async (provider, data) => {
  const { mobile, amount, operator } = data;
  
  console.log(`Calling provider: ${provider.name} (${provider.code})...`);

  // In a real production environment, this would call the actual baseUrl
  // For this project, we'll simulate the API call with some logic
  
  // Simulate network latency
  const startTime = Date.now();
  await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));
  const duration = Date.now() - startTime;

  // Mock failure cases for testing
  if (mobile === "8888888888" && provider.code === "P1") {
    throw new Error(`${provider.name} API failed (Mocked)`);
  }
  
  if (mobile === "7777777777") {
    throw new Error("Critical API failure across all providers (Mocked)");
  }

  // Simulate random failure based on success rate for testing
  if (Math.random() * 100 > provider.successRate) {
    throw new Error(`${provider.name} random failure (Mocked)`);
  }

  return {
    success: true,
    provider: provider.code,
    providerTxnId: `${provider.code.charAt(0)}_${Date.now()}`,
    duration
  };
};

// Keep existing exports if they are used elsewhere, but redirect them to the new generic function
export const primaryRecharge = async (data) => {
  const provider = await Provider.findOne({ code: "P1" });
  if (!provider) throw new Error("Primary provider not found");
  return callProviderApi(provider, data);
};

export const backupRecharge = async (data) => {
  const provider = await Provider.findOne({ code: "P2" });
  if (!provider) throw new Error("Backup provider not found");
  return callProviderApi(provider, data);
};
