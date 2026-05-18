import prisma from "../config/prisma.js";
import eventBus from "../config/eventBus.js";
import { getProvider, isSupported } from "./providers/providerFactory.js";

const failureTracking = new Map();
const COOLDOWN_MS = 600000; // 10 minutes cooldown for failing providers
const HEALTH_CACHE_TTL = 300000; // 5 minutes cache TTL

export const monitorProviderHealth = async (force = false) => {
  const now = Date.now();
  
  // Throttle health checks unless forced
  const lastGlobalCheck = failureTracking.get('global_check_timestamp') || 0;
  if (!force && now - lastGlobalCheck < HEALTH_CACHE_TTL) {
    return;
  }

  console.log(`[HEALTH][START] Running scheduled provider status checks...`);
  failureTracking.set('global_check_timestamp', now);
  
  try {
    const providers = await prisma.provider.findMany({
      where: { isActive: true }
    });
    
    for (const provider of providers) {
      // Individual cooldown for failing APIs
      const lastFailure = failureTracking.get(provider.code);
      if (lastFailure && now - lastFailure < COOLDOWN_MS) {
        continue;
      }

      if (!isSupported(provider.code)) continue;

      const startTime = now;
      let isUp = false;
      let responseTime = 0;
      let balance = 0;

      try {
        const providerService = getProvider(provider.code);
        
        // 1. Check Balance as a Heartbeat (only for providers that support it)
        if (providerService.balance) {
           const balanceRes = await providerService.balance();
           if (balanceRes.success) {
              isUp = true;
              balance = balanceRes.balance;
           }
        } else {
           isUp = true;
        }
        
        responseTime = Date.now() - startTime;
        failureTracking.delete(provider.code);
      } catch (err) {
        failureTracking.set(provider.code, Date.now());
        console.error(`[HEALTH][FAILURE] Provider ${provider.name}: ${err.message}`);
      }

      // 2. Determine Health Level
      let newStatus = "DOWN";
      if (isUp) {
        if (responseTime < 3000) {
          newStatus = "HEALTHY";
        } else if (responseTime < 10000) {
          newStatus = "DEGRADED";
        } else {
          newStatus = "DOWN";
        }
      }

      // 3. Persist and Notify
      await prisma.provider.update({
        where: { id: provider.id },
        data: {
          healthStatus: newStatus,
          avgResponseTime: responseTime,
          lastCheckAt: new Date()
        }
      });

      if (provider.healthStatus !== newStatus) {
        console.log(`[HEALTH][UPDATE] ${provider.name} status changed: ${provider.healthStatus} -> ${newStatus}`);
        eventBus.emit("provider_health_update", { 
          provider: provider.code, 
          name: provider.name,
          status: newStatus,
          responseTime
        });
      }
    }
    console.log(`[HEALTH][FINISH] Completed health checks.`);
  } catch (err) {
    console.error("[HEALTH][FATAL] Health monitoring service error:", err);
  }
};

export const startHealthMonitoring = (intervalMs = 600000) => { // Default 10 mins
  // Run once immediately
  monitorProviderHealth(true);
  
  setInterval(() => monitorProviderHealth(false), intervalMs);
  console.log(`[HEALTH] Health monitoring active (Check Interval: ${intervalMs}ms)`);
};
