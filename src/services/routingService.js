import { connection as redis } from "../config/redis.js";
import { primaryRecharge, backupRecharge } from "./providerService.js";
import { sendAlert } from "./alertService.js";

// Mapping provider names to their respective gateway functions
const PROVIDERS = {
    primary: primaryRecharge,
    backup: backupRecharge
};

export const getProviderMetrics = async (providerName) => {
    const key = `provider:metrics:${providerName}`;
    const metrics = await redis.hgetall(key);
    
    return {
        success: parseInt(metrics.success || "0", 10),
        failed: parseInt(metrics.failed || "0", 10),
        avgResponseTime: parseInt(metrics.avgResponseTime || "1000", 10),
        profitMargin: parseFloat(metrics.profitMargin || "1.0")
    };
};

export const updateProviderMetrics = async (providerName, isSuccess, durationMs) => {
    const key = `provider:metrics:${providerName}`;
    const metrics = await getProviderMetrics(providerName);
    
    // Calculate new rolling average for response time
    const totalTxns = metrics.success + metrics.failed;
    const newAvgTime = totalTxns === 0 ? durationMs : Math.round(((metrics.avgResponseTime * totalTxns) + durationMs) / (totalTxns + 1));
    
    const pipeline = redis.pipeline();
    if (isSuccess) {
        pipeline.hincrby(key, "success", 1);
    } else {
        pipeline.hincrby(key, "failed", 1);
        
        // Check if failure rate is getting too high recently? Optional logic to trigger cooldown
    }
    
    pipeline.hset(key, "avgResponseTime", newAvgTime);
    await pipeline.exec();
};

const calculateScore = (metrics) => {
    const total = metrics.success + metrics.failed;
    if (total === 0) return Number.MAX_SAFE_INTEGER; // Unused providers get high priority to be tested
    
    const successRate = metrics.success / total;
    const failureRate = metrics.failed / total;
    const latencyScore = Math.max(0, 1 - (metrics.avgResponseTime / 5000)); // Normalizing to 5 sec max expected
    
    // score = (successRate * 0.5) + (profitMargin * 0.2) + (latencyScore * 0.2) - (failureRate * 0.3)
    return (successRate * 0.5) + (metrics.profitMargin * 0.2) + (latencyScore * 0.2) - (failureRate * 0.3);
};

export const executeIntelligentRecharge = async (data) => {
    // 1. Get all providers and their scores
    const providerScores = [];
    
    for (const provider of Object.keys(PROVIDERS)) {
        // Check Cooldown
        const cooldown = await redis.get(`provider:cooldown:${provider}`);
        if (cooldown) {
            console.log(`[ROUTING] Skipping ${provider} due to cooldown.`);
            continue;
        }
        
        const metrics = await getProviderMetrics(provider);
        const score = calculateScore(metrics);
        providerScores.push({ name: provider, score, fn: PROVIDERS[provider] });
    }
    
    // Sort highest score first
    providerScores.sort((a, b) => b.score - a.score);
    
    if (providerScores.length === 0) {
        await sendAlert('PROVIDER_DOWN', 'All providers are either failing or in cooldown!', 'Critical infrastructure failure.');
        throw new Error("No available providers to route to.");
    }
    
    // 2. Attempt execute cascadingly
    for (let i = 0; i < providerScores.length; i++) {
        const selected = providerScores[i];
        console.log(`[ROUTING] Attempting via ${selected.name} (Score: ${selected.score.toFixed(2)})`);
        
        const startTime = Date.now();
        try {
            // Promise.race for strict timeouts (e.g. 10000 ms)
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Provider Timeout")), 10000)
            );
            
            const result = await Promise.race([
                selected.fn(data),
                timeoutPromise
            ]);
            
            const duration = Date.now() - startTime;
            await updateProviderMetrics(selected.name, true, duration);
            
            return {
                provider: selected.name,
                providerTxnId: result.providerTxnId || result.txnId,
                status: "success"
            };
        } catch (err) {
            const duration = Date.now() - startTime;
            console.log(`[ROUTING] Provider ${selected.name} failed: ${err.message}`);
            await updateProviderMetrics(selected.name, false, duration);
            
            // Set simple cooldown: 1 minute
            await redis.set(`provider:cooldown:${selected.name}`, "1", "EX", 60);
            await sendAlert('HIGH_FAILURE_RATE', `Provider ${selected.name} failed`, `Error: ${err.message}`);
        }
    }
    
    // If we reach here, ALL providers tried and failed.
    await sendAlert('PROVIDER_DOWN', 'All providers failed for the transaction', `Data: ${JSON.stringify(data)}`);
    throw new Error("All preferred providers failed");
};
