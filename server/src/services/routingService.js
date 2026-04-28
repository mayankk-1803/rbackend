import prisma from "../config/prisma.js";
import { sendAlert } from "./alertService.js";
import dotenv from "dotenv";

dotenv.config();

export const updateProviderMetrics = async (providerCode, isSuccess, durationMs) => {
  try {
    const provider = await prisma.provider.findUnique({ where: { code: providerCode } });
    if (!provider) return;

    // Calculate rolling metrics
    const totalAttempts = 100;
    
    // Update Success Rate (simplified rolling average)
    const currentSuccessRate = provider.successRate || 100;
    const newSuccessRate = isSuccess 
      ? Math.min(100, currentSuccessRate + (100 - currentSuccessRate) / totalAttempts)
      : Math.max(0, currentSuccessRate - currentSuccessRate / totalAttempts);
    
    // Update Avg Response Time
    const currentAvgTime = provider.avgResponseTime || durationMs;
    const newAvgTime = (currentAvgTime * (totalAttempts - 1) + durationMs) / totalAttempts;

    const dataToUpdate = {
      successRate: parseFloat(newSuccessRate.toFixed(2)),
      avgResponseTime: Math.round(newAvgTime),
    };

    // Auto-blacklist if success rate falls below 50%
    if (dataToUpdate.successRate < 50 && !provider.isBlacklisted) {
      dataToUpdate.isBlacklisted = true;
      dataToUpdate.isActive = false;
      dataToUpdate.healthStatus = "DOWN";
      await sendAlert('PROVIDER_BLACKLISTED', `Provider ${provider.name} blacklisted due to low success rate: ${dataToUpdate.successRate}%`, 'Critical');
    } else if (dataToUpdate.successRate >= 60 && provider.isBlacklisted) {
      dataToUpdate.isBlacklisted = false;
      dataToUpdate.healthStatus = "HEALTHY";
    }

    await prisma.provider.update({
      where: { code: providerCode },
      data: dataToUpdate
    });
  } catch (err) {
    console.error("Error updating provider metrics:", err);
  }
};

/**
 * Returns a list of active providers sorted by their success rate for fallback logic
 */
export const getProviderList = async () => {
  return await prisma.provider.findMany({
    where: { isActive: true, isBlacklisted: false },
    orderBy: { successRate: "desc" }
  });
};

export const getProvider = async (data) => {
  const providers = await prisma.provider.findMany({
    where: { isActive: true, isBlacklisted: false }
  });
  
  if (!providers.length) {
    throw new Error("No active providers available in the system.");
  }

  if (data.providerCode) {
    const selected = providers.find(p => p.code === data.providerCode);
    if (selected) return selected;
    console.log(`[ROUTING] Requested provider ${data.providerCode} not active/found, falling back to smart routing.`);
  }

  const scoredProviders = providers.map(p => {
    const latency = Math.max(p.avgResponseTime || 200, 1);
    const cost = Math.max(Number(p.costPerTxn) || 1, 0.1);
    const successRate = p.successRate || 90;

    const score = (0.3 * successRate) + (0.6 * (1000 / latency)) + (0.1 * (1 / cost));
    return { provider: p, score };
  }).sort((a, b) => b.score - a.score);

  console.log(`[ROUTING] Smart routing selected: ${scoredProviders[0].provider.name} (Score: ${scoredProviders[0].score.toFixed(2)})`);
  return scoredProviders[0].provider;
};

/**
 * Returns a list of active providers sorted by their smart score for fallback logic
 */
export const getSortedProviders = async () => {
  const providers = await prisma.provider.findMany({
    where: { isActive: true, isBlacklisted: false }
  });

  const scoredProviders = providers.map(p => {
    const latency = Math.max(p.avgResponseTime || 200, 1);
    const cost = Math.max(Number(p.costPerTxn) || 1, 0.1);
    const successRate = p.successRate || 90;

    const score = (0.3 * successRate) + (0.6 * (1000 / latency)) + (0.1 * (1 / cost));
    return { provider: p, score };
  }).sort((a, b) => b.score - a.score);

  return scoredProviders.map(sp => sp.provider);
};
