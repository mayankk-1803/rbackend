import Provider from "../models/Provider.js";
import { callProviderApi } from "./providerService.js";
import { sendAlert } from "./alertService.js";
import dotenv from "dotenv";

dotenv.config();

const SMART_ROUTING = process.env.SMART_ROUTING === "true";

export const updateProviderMetrics = async (providerCode, isSuccess, durationMs) => {
    try {
        const provider = await Provider.findOne({ code: providerCode });
        if (!provider) return;

        // Calculate rolling metrics
        const totalAttempts = 100; // Let's assume a rolling window of 100
        
        // Update Success Rate (simplified rolling average)
        const currentSuccessRate = provider.successRate || 100;
        const newSuccessRate = isSuccess 
            ? Math.min(100, currentSuccessRate + (100 - currentSuccessRate) / totalAttempts)
            : Math.max(0, currentSuccessRate - currentSuccessRate / totalAttempts);
        
        // Update Avg Response Time
        const currentAvgTime = provider.avgResponseTime || durationMs;
        const newAvgTime = (currentAvgTime * (totalAttempts - 1) + durationMs) / totalAttempts;

        provider.successRate = parseFloat(newSuccessRate.toFixed(2));
        provider.avgResponseTime = Math.round(newAvgTime);

        // Auto-blacklist if success rate falls below 50%
        if (provider.successRate < 50 && !provider.isBlacklisted) {
            provider.isBlacklisted = true;
            provider.isActive = false;
            provider.healthStatus = "DOWN";
            await sendAlert('PROVIDER_BLACKLISTED', `Provider ${provider.name} blacklisted due to low success rate: ${provider.successRate}%`, 'Critical');
        } else if (provider.successRate >= 60 && provider.isBlacklisted) {
            // Auto-recovery if it somehow improves (though it shouldn't if it's blacklisted, unless health check recovers it)
            provider.isBlacklisted = false;
            provider.healthStatus = "HEALTHY";
        }

        await provider.save();
    } catch (err) {
        console.error("Error updating provider metrics:", err);
    }
};

const calculateScore = (provider) => {
    if (provider.isBlacklisted || !provider.isActive) return -1;
    
    const latency = provider.avgResponseTime > 0 ? provider.avgResponseTime : 1;
    const cost = provider.costPerTxn > 0 ? provider.costPerTxn : 1;

    // score = (0.5 * successRate) + (0.3 * (1 / latency)) + (0.2 * (1 / cost))
    return (0.5 * provider.successRate) + (0.3 * (1 / latency)) + (0.2 * (1 / cost));
};

/**
 * Returns a list of active providers sorted by their success rate for fallback logic
 */
export const getProviderList = async () => {
    return await Provider.find({ isActive: true, isBlacklisted: false }).sort({ successRate: -1 });
};

export const getProvider = async (data) => {
    // 1. Fetch all active providers
    const providers = await Provider.find({ isActive: true, isBlacklisted: false });
    
    if (!providers.length) {
        throw new Error("No active providers available in the system.");
    }

    // 2. Specific provider selection (High Priority)
    if (data.providerCode) {
        const selected = providers.find(p => p.code === data.providerCode);
        if (selected) return selected;
        console.log(`[ROUTING] Requested provider ${data.providerCode} not active/found, falling back to smart routing.`);
    }

    // 3. Smart Routing Engine (Score-based)
    // score = (0.5 * successRate) + (0.3 * (1 / latency)) + (0.2 * (1 / cost))
    const scoredProviders = providers.map(p => {
        const latency = Math.max(p.avgResponseTime || 200, 1);
        const cost = Math.max(p.costPerTxn || 1, 0.1);
        const successRate = p.successRate || 90;

        const score = (0.5 * successRate) + (0.3 * (1000 / latency)) + (0.2 * (1 / cost));
        return { provider: p, score };
    }).sort((a, b) => b.score - a.score);

    console.log(`[ROUTING] Smart routing selected: ${scoredProviders[0].provider.name} (Score: ${scoredProviders[0].score.toFixed(2)})`);
    return scoredProviders[0].provider;
};

/**
 * Returns a list of active providers sorted by their smart score for fallback logic
 */
export const getSortedProviders = async () => {
    const providers = await Provider.find({ isActive: true, isBlacklisted: false });
    
    return providers.map(p => {
        const latency = Math.max(p.avgResponseTime || 200, 1);
        const cost = Math.max(p.costPerTxn || 1, 0.1);
        const successRate = p.successRate || 90;

        const score = (0.5 * successRate) + (0.3 * (1000 / latency)) + (0.2 * (1 / cost));
        return { provider: p, score };
    }).sort((a, b) => b.score - a.score).map(sp => sp.provider);
};

export const executeIntelligentRecharge = async (data) => {
    // Get the provider based on priority
    const provider = await getProvider(data);
    
    console.log(`[ROUTING] Selected provider: ${provider.name} (${provider.code})`);
    
    const startTime = Date.now();
    try {
        // In case of smart routing, if the best provider fails, we might want a fallback.
        // But the requirement says: If providerCode is provided → ALWAYS use that provider.
        // And if Smart Routing is on → Select provider dynamically.
        
        // Let's implement a simplified version first that respects the priority.
        const result = await callProviderApi(provider, data);
        const duration = Date.now() - startTime;
        await updateProviderMetrics(provider.code, true, duration);
        return result;
    } catch (err) {
        const duration = Date.now() - startTime;
        await updateProviderMetrics(provider.code, false, duration);
        
        // If it was smart routing, maybe try next? 
        // For now, let's keep it simple as per instructions.
        throw err;
    }
};
