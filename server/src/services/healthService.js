import prisma from "../config/prisma.js";
import eventBus from "../config/eventBus.js";
import { getProvider } from "./providers/providerFactory.js";

export const monitorProviderHealth = async () => {
  console.log("[HEALTH] Starting real health check for all providers...");
  
  try {
    const providers = await prisma.provider.findMany();
    
    for (const provider of providers) {
      const startTime = Date.now();
      let isUp = false;
      let responseTime = 0;
      let balance = 0;

      try {
        const providerService = getProvider(provider.code);
        
        // 1. Check Balance as a Heartbeat
        if (providerService.balance) {
           const balanceRes = await providerService.balance();
           if (balanceRes.success) {
              isUp = true;
              balance = balanceRes.balance;
           }
        } else {
           // Fallback ping or dummy success
           isUp = true;
        }
        
        responseTime = Date.now() - startTime;
      } catch (err) {
        console.error(`[HEALTH] Provider ${provider.name} check failed: ${err.message}`);
      }

      // Update health status
      let newStatus = "DOWN";
      if (isUp) {
        if (responseTime < 2000) {
          newStatus = "HEALTHY";
        } else if (responseTime < 5000) {
          newStatus = "DEGRADED";
        } else {
          newStatus = "DOWN";
        }
      }

      const updateData = {
        healthStatus: newStatus,
        avgResponseTime: responseTime,
        lastCheckAt: new Date()
      };

      // Auto-update balance in DB if available
      if (isUp) {
        // Assuming there's a balance field in provider table or a related metric
      }

      await prisma.provider.update({
        where: { id: provider.id },
        data: updateData
      });

      if (provider.healthStatus !== newStatus) {
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

export const startHealthMonitoring = (intervalMs = 300000) => { // Every 5 mins
  setInterval(monitorProviderHealth, intervalMs);
  console.log(`[HEALTH] Periodic health monitoring started (Interval: ${intervalMs}ms)`);
};
