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
    if (provider.isBlacklisted) return -1;
    
    const successRateScore = provider.successRate / 100; // 0 to 1
    const responseTimeScore = provider.avgResponseTime > 0 ? (1 / provider.avgResponseTime) : 1;
    const costScore = provider.costPerTxn > 0 ? (1 / provider.costPerTxn) : 1;

    // score = (0.5 * successRate) + (0.3 * (1 / avgResponseTime)) + (0.2 * (1 / costPerTxn))
    return (0.5 * successRateScore) + (0.3 * responseTimeScore) + (0.2 * costScore);
};

export const getProvider = async (data) => {
    // ✅ STEP 1: PROVIDER OVERRIDE (HIGHEST PRIORITY)
    if (data.providerCode) {
        const provider = await Provider.findOne({ code: data.providerCode });
        if (!provider) throw new Error("Invalid providerCode");
        if (provider.isBlacklisted) throw new Error("Selected provider is blacklisted");
        return provider;
    }

    // ✅ STEP 2: SMART ROUTING
    if (SMART_ROUTING) {
        const providers = await Provider.find({ isBlacklisted: false });
        if (providers.length > 0) {
            const scoredProviders = providers.map(p => ({
                provider: p,
                score: calculateScore(p)
            })).sort((a, b) => b.score - a.score);
            return scoredProviders[0].provider;
        }
    }

    // ✅ STEP 3: MANUAL MODE (FALLBACK)
    const activeProvider = await Provider.findOne({ isActive: true, isBlacklisted: false });
    if (!activeProvider) {
        throw new Error("No active provider configured in manual mode.");
    }
    return activeProvider;
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
