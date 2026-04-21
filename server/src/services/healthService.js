import Provider from "../models/Provider.js";
import eventBus from "../config/eventBus.js";
import axios from "axios";

export const monitorProviderHealth = async () => {
    console.log("[HEALTH] Starting health check for all providers...");
    
    try {
        const providers = await Provider.find();
        
        for (const provider of providers) {
            const startTime = Date.now();
            let isUp = false;
            let responseTime = 0;

            try {
                // In production, you would actually ping the baseUrl
                // For simulation, we'll use a 90% success rate for health check
                await new Promise((resolve, reject) => {
                    setTimeout(() => {
                        if (Math.random() > 0.1) resolve();
                        else reject(new Error("Timeout"));
                    }, 500);
                });
                
                responseTime = Date.now() - startTime;
                isUp = true;
            } catch (err) {
                console.error(`[HEALTH] Provider ${provider.name} ping failed: ${err.message}`);
            }

            // Update health status based on success and response time
            let newStatus = "DOWN";
            if (isUp) {
                if (responseTime < 1000 && provider.successRate > 90) {
                    newStatus = "HEALTHY";
                } else if (responseTime < 3000 && provider.successRate > 60) {
                    newStatus = "DEGRADED";
                } else {
                    newStatus = "DOWN";
                }
            }

            const oldStatus = provider.healthStatus;
            provider.healthStatus = newStatus;
            
            // Auto-blacklist if DOWN
            if (newStatus === "DOWN" && !provider.isBlacklisted) {
                provider.isBlacklisted = true;
                provider.isActive = false;
                eventBus.emit("provider_down_alert", { provider: provider.code, name: provider.name });
            } else if (newStatus === "HEALTHY" && provider.isBlacklisted) {
                // Auto-recovery after cooldown (if it becomes healthy again)
                provider.isBlacklisted = false;
            }

            await provider.save();

            if (oldStatus !== newStatus) {
                eventBus.emit("provider_health_update", { 
                    provider: provider.code, 
                    name: provider.name,
                    status: newStatus,
                    responseTime
                });
            }
        }
    } catch (err) {
        console.error("[HEALTH] Health monitoring service error:", err);
    }
};

// Start the periodic health check
export const startHealthMonitoring = (intervalMs = 60000) => {
    // Run immediately on start
    monitorProviderHealth();
    
    // Then run periodically
    setInterval(monitorProviderHealth, intervalMs);
    console.log(`[HEALTH] Monitoring service scheduled every ${intervalMs / 1000}s`);
};
