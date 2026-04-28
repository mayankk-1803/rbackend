import prisma from "../config/prisma.js";
import eventBus from "../config/eventBus.js";

export const monitorProviderHealth = async () => {
  console.log("[HEALTH] Starting health check for all providers...");
  
  try {
    const providers = await prisma.provider.findMany();
    
    for (const provider of providers) {
      const startTime = Date.now();
      let isUp = false;
      let responseTime = 0;

      try {
        // Simulation: 90% success rate for health check
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
      
      const updateData = {
        healthStatus: newStatus
      };

      // Auto-blacklist if DOWN
      if (newStatus === "DOWN" && !provider.isBlacklisted) {
        updateData.isBlacklisted = true;
        updateData.isActive = false;
        eventBus.emit("provider_down_alert", { provider: provider.code, name: provider.name });
      } else if (newStatus === "HEALTHY" && provider.isBlacklisted) {
        // Auto-recovery after cooldown
        updateData.isBlacklisted = false;
        updateData.isActive = true;
      }

      await prisma.provider.update({
        where: { id: provider.id },
        data: updateData
      });

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
  // setInterval(monitorProviderHealth, intervalMs);
  console.log("⚠️ Health monitoring disabled (Simulation Mode)");
};
