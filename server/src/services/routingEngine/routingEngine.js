import prisma from "../../config/prisma.js";
import logger from "../logging/logger.js";
import { redisClient } from "../../config/redis.js";
import { REAL_TO_ALIAS, ALIAS_TO_REAL } from "../../config/providerAliases.js";
import { REDIS_KEYS, getFeatureFlag } from "./routingCache.js";
import { incrementMetric, observeMetric } from "./routingMetrics.js";

// Enterprise feature flags fallback
export const enterpriseFeatures = {
  routingEngine: true,
  providerManagement: true,
  operatorManagement: true,
  whatsappSystem: true,
  telemetryMonitoring: true,
  shadowMode: true,
  enterpriseProviderManager: true
};

/**
 * Executes the Smooth Weighted Round Robin algorithm using Redis Lua script.
 */
const runSWRR = async (providersWithWeights) => {
  if (providersWithWeights.length === 0) return null;
  const keys = providersWithWeights.map(p => p.code.toUpperCase());
  const weights = providersWithWeights.map(p => Math.max(1, p.weight).toString());

  const luaScript = `
    local keys = KEYS
    local weights = ARGV
    local max_val = -999999
    local max_idx = 1
    local total_sum = 0
    local current_weights = {}
    for i, key in ipairs(keys) do
        local cw = tonumber(redis.call('HGET', 'routing:traffic:current_weights', key)) or 0
        local ew = tonumber(weights[i])
        total_sum = total_sum + ew
        cw = cw + ew
        current_weights[i] = cw
        redis.call('HSET', 'routing:traffic:current_weights', key, cw)
        if cw > max_val then
            max_val = cw
            max_idx = i
        end
    end
    local selected_key = keys[max_idx]
    local new_cw = current_weights[max_idx] - total_sum
    redis.call('HSET', 'routing:traffic:current_weights', selected_key, new_cw)
    return selected_key
  `;

  try {
    const selectedCode = await redisClient.eval(luaScript, keys.length, ...keys, ...weights);
    return selectedCode;
  } catch (err) {
    logger.error("Failed SWRR evaluation, fallback to first", { error: err.message });
    return keys[0];
  }
};

/**
 * PRODUCTION RESOLVER Contract
 * resolveRoute()
 */
export const resolveRoute = async (params) => {
  const {
    sectionId,
    operatorId,
    circleId,
    amount,
    serviceType,
    simulation = false
  } = params;

  const start = Date.now();
  let selectedProviderCode = "APIBOX";
  let routingMode = "MANUAL";
  let matchedRules = [];
  let rejectedRules = [];
  let fallbackChain = [];
  let healthScore = 100.0;
  let reason = "Global Default Route";

  try {
    // 1. Fetch live configs from Redis (or DB fallback)
    const isEmergencyEnabled = await getFeatureFlag("emergencyOverrideEnabled");
    const isSmartEnabled = await getFeatureFlag("smartRoutingEnabled");
    const isWeightedEnabled = await getFeatureFlag("weightedRoutingEnabled");
    const isHealthEnabled = await getFeatureFlag("healthRoutingEnabled");
    const isCircuitBreakerEnabled = await getFeatureFlag("circuitBreakerEnabled");

    // Fetch emergency overrides
    const overrides = await redisClient.hgetall(REDIS_KEYS.OVERRIDES).catch(() => ({}));
    
    // 2. Step 1: Check Emergency Override Freeze
    if (isEmergencyEnabled && overrides.globalFreeze === "true") {
      return {
        selectedProvider: REAL_TO_ALIAS["APIBOX"],
        routingMode: "MANUAL",
        matchedRules: [{ id: 0, name: "Global Emergency Freeze Override", priority: 999 }],
        fallbackChain: [],
        healthScore: 100.0,
        reason: "Routing is currently frozen globally.",
        simulation
      };
    }

    // Step 2: Check Emergency Forced Provider route
    if (isEmergencyEnabled && overrides.forcedProvider) {
      selectedProviderCode = overrides.forcedProvider.toUpperCase();
      reason = "Emergency Forced Provider Route applied.";
      routingMode = "MANUAL";
    } else {
      // 3. Rules Evaluation & Precedence check
      let rulesCacheHit = true;
      const rulesRaw = await redisClient.hgetall(REDIS_KEYS.RULES).catch(() => {
        rulesCacheHit = false;
        return {};
      });
      
      if (!rulesRaw || Object.keys(rulesRaw).length === 0) {
        rulesCacheHit = false;
      }
      
      if (rulesCacheHit) {
        await incrementMetric("dizipay_routing_cache_hits_total", 1, { type: "rules" });
      } else {
        await incrementMetric("dizipay_routing_cache_misses_total", 1, { type: "rules" });
      }

      const rules = Object.values(rulesRaw).map(r => JSON.parse(r));

      // Filter and evaluate rules
      // Priority sorting: Operator+Circle (3), Operator (4), Circle (5), Amount Slab (6), Section Default (7)
      const matchingRules = [];
      for (const r of rules) {
        if (r.isDeleted) continue;
        
        let match = true;
        let rejectReason = "";

        if (sectionId && r.sectionId !== sectionId) {
          match = false;
          rejectReason = `Section mismatch (Expected ID: ${sectionId}, Rule: ${r.sectionId})`;
        } else if (serviceType && r.serviceType && r.serviceType !== serviceType) {
          match = false;
          rejectReason = `ServiceType mismatch (Expected: ${serviceType}, Rule: ${r.serviceType})`;
        } else {
          const amt = Number(amount || 0);
          if (r.amountFrom && Number(r.amountFrom) > amt) {
            match = false;
            rejectReason = `Amount below slab min (Amount: ${amt}, Min: ${r.amountFrom})`;
          } else if (r.amountTo && Number(r.amountTo) < amt) {
            match = false;
            rejectReason = `Amount above slab max (Amount: ${amt}, Max: ${r.amountTo})`;
          } else if (r.operatorId && operatorId && r.operatorId !== operatorId) {
            match = false;
            rejectReason = `Operator mismatch (Expected: ${operatorId}, Rule: ${r.operatorId})`;
          } else if (r.circleId && circleId && r.circleId !== circleId) {
            match = false;
            rejectReason = `Circle mismatch (Expected: ${circleId}, Rule: ${r.circleId})`;
          }
        }

        if (match) {
          matchingRules.push(r);
        } else {
          rejectedRules.push({
            id: r.id,
            name: r.name || `Rule #${r.id}`,
            reason: rejectReason
          });
        }
      }

      // Sort by precedence logic: Specific operator+circle first, then operator, then circle, then amount slab, then priority values
      matchingRules.sort((a, b) => {
        const getScore = (r) => {
          let score = 0;
          if (r.operatorId && r.circleId) score += 5000;
          else if (r.operatorId) score += 3000;
          else if (r.circleId) score += 2000;
          else if (r.amountFrom > 0) score += 1000;
          score += (r.priority || 0);
          return score;
        };
        return getScore(b) - getScore(a);
      });

      if (matchingRules.length > 0) {
        const topRule = matchingRules[0];
        matchedRules = [{ id: topRule.id, name: topRule.name || `Rule #${topRule.id}`, priority: topRule.priority }];
        
        const ruleProviderCode = topRule.providerCode || topRule.provider?.code;
        if (ruleProviderCode) {
          selectedProviderCode = ruleProviderCode.toUpperCase();
          reason = `Matched high-priority rule: ${topRule.name}`;
        }
      }
    }

    // 4. Validate Provider Availability & Health checks
    let providersCacheHit = true;
    const activeProvidersRaw = await redisClient.hgetall(REDIS_KEYS.PROVIDERS).catch(() => {
      providersCacheHit = false;
      return {};
    });
    
    if (!activeProvidersRaw || Object.keys(activeProvidersRaw).length === 0) {
      providersCacheHit = false;
    }

    if (providersCacheHit) {
      await incrementMetric("dizipay_routing_cache_hits_total", 1, { type: "providers" });
    } else {
      await incrementMetric("dizipay_routing_cache_misses_total", 1, { type: "providers" });
    }

    const isLegacyProvider = (code) => {
      return ["APIBOX", "P1", "NEXGATE", "MPLAN", "EZYTM"].includes(String(code).toUpperCase().trim());
    };

    const activeProviders = Object.values(activeProvidersRaw)
      .map(p => {
        const prov = JSON.parse(p);
        prov.isDynamic = !isLegacyProvider(prov.code);
        if (prov.isDynamic && process.env.ENABLE_DYNAMIC_RECHARGE !== "true") {
          prov.isRechargeEligible = false;
        } else {
          prov.isRechargeEligible = true;
        }
        return prov;
      })
      .filter(p => p.isActive);

    const checkProviderHealth = async (code) => {
      // Circuit breaker check
      if (isCircuitBreakerEnabled) {
        const isTripped = await redisClient.get(`provider:${code.toLowerCase()}:breaker`);
        if (isTripped) {
          await incrementMetric("dizipay_circuit_breaker_trips_total", 1, { provider: code });
          return { healthy: false, score: 0, reason: "Circuit Breaker Tripped" };
        }
      }

      // Health metrics check
      const hmRaw = await redisClient.hget(REDIS_KEYS.HEALTH, code.toUpperCase());
      if (hmRaw) {
        const hm = JSON.parse(hmRaw);
        if (isHealthEnabled && hm.healthScore < 40) {
          return { healthy: false, score: hm.healthScore, reason: "Health score below critical limit" };
        }
        return { healthy: true, score: hm.healthScore };
      }
      return { healthy: true, score: 100.0 };
    };

    const getHealthyLegacyProvider = async () => {
      const legacyProviders = activeProviders.filter(p => isLegacyProvider(p.code));
      for (const p of legacyProviders) {
        const h = await checkProviderHealth(p.code);
        if (h.healthy) {
          return p.code.toUpperCase();
        }
      }
      return "APIBOX";
    };

    const primaryHealth = await checkProviderHealth(selectedProviderCode);
    healthScore = primaryHealth.score;

    // 5. Fallback Chain Builder
    const otherProviders = activeProviders.filter(
      p => p.code.toUpperCase() !== selectedProviderCode && p.isRechargeEligible
    );
    const healthyBackups = [];
    for (const bp of otherProviders) {
      const bh = await checkProviderHealth(bp.code);
      if (bh.healthy) {
        healthyBackups.push({ code: bp.code, score: bh.score, priority: bp.priority });
      }
    }

    // Sort backups by priority descending
    healthyBackups.sort((a, b) => b.priority - a.priority);
    fallbackChain = healthyBackups.map(b => b.code);

    // 6. Handle Primary Failure & Fallback Switch
    if (!primaryHealth.healthy) {
      if (fallbackChain.length > 0) {
        const backupProvider = fallbackChain[0];
        await incrementMetric("dizipay_provider_failover_count_total", 1, { from: selectedProviderCode, to: backupProvider });
        reason = `Primary provider ${selectedProviderCode} unhealthy (${primaryHealth.reason}). Switched to backup.`;
        selectedProviderCode = fallbackChain.shift();
      } else {
        reason = `Primary provider ${selectedProviderCode} unhealthy, and no healthy backups available. Using fallback.`;
        selectedProviderCode = "APIBOX"; // Forced global safety fallback
      }
    }

    // 7. Resolve Smart & Weighted Routing Modes if configured
    if (isWeightedEnabled && !overrides.forcedProvider) {
      routingMode = "WEIGHTED";
      // Retrieve configured weights
      const providersWithWeights = activeProviders.filter(p => p.isRechargeEligible).map(p => ({
        code: p.code,
        weight: p.priority || 10 // Use priority column temporarily as weight split
      }));
      const swrrSelected = await runSWRR(providersWithWeights);
      if (swrrSelected) {
        selectedProviderCode = swrrSelected;
        reason = "Smooth Weighted Round Robin resolved route.";
        await incrementMetric("dizipay_weighted_distribution_accuracy_deviation", 1, { provider: selectedProviderCode });
      }
    } else if (isSmartEnabled && !overrides.forcedProvider) {
      routingMode = "SMART";
      // Evaluate scores dynamically: Score = (priority * 0.3) + (health * 0.3) + (latency * 0.2) + (cost * 0.2)
      const providerScores = [];
      const costsRaw = await redisClient.hgetall(REDIS_KEYS.COSTS).catch(() => ({}));

      for (const prov of activeProviders) {
        if (!prov.isRechargeEligible) continue;
        const ph = await checkProviderHealth(prov.code);
        if (!ph.healthy) continue;

        const priorityScore = 100 - (prov.priority * 10);
        const costConfig = costsRaw[prov.id.toString()] ? JSON.parse(costsRaw[prov.id.toString()]) : { costPerTxn: 0 };
        const costScore = Math.max(0, 100 - (Number(costConfig.costPerTxn) * 10));
        
        const hmRaw = await redisClient.hget(REDIS_KEYS.HEALTH, prov.code.toUpperCase());
        const latency = hmRaw ? JSON.parse(hmRaw).latency : 120.0;
        const latencyScore = Math.max(0, 100 - (latency / 20));

        const score = (priorityScore * 0.3) + (ph.score * 0.3) + (latencyScore * 0.2) + (costScore * 0.2);
        providerScores.push({ code: prov.code, score });
      }

      providerScores.sort((a, b) => b.score - a.score);
      if (providerScores.length > 0) {
        selectedProviderCode = providerScores[0].code;
        reason = `Smart Route resolved. Select highest scoring node: ${selectedProviderCode} (Score: ${providerScores[0].score.toFixed(1)})`;
      }
    }

    // Final safety check: Ensure the selected provider is eligible for recharge execution
    const finalSelectedProv = activeProviders.find(p => p.code.toUpperCase() === selectedProviderCode);
    if (finalSelectedProv && !finalSelectedProv.isRechargeEligible) {
      const fallbackProvider = await getHealthyLegacyProvider();
      reason = `Dynamic provider ${selectedProviderCode} is ineligible for recharge execution in safe mode. Safe fallback to healthy legacy: ${fallbackProvider}`;
      selectedProviderCode = fallbackProvider;
    }

  } catch (error) {
    logger.error("Error in resolveRoute engine", { error: error.message });
    selectedProviderCode = "APIBOX";
    reason = "Error occurred. Safe fallback applied.";
  }

  const durationSec = (Date.now() - start) / 1000;
  await observeMetric("dizipay_route_resolution_duration_seconds", durationSec, { mode: routingMode });

  // Obfuscate and alias returned names for client protection
  const aliasedProvider = REAL_TO_ALIAS[selectedProviderCode] || selectedProviderCode;
  const aliasedFallbackChain = fallbackChain.map(code => REAL_TO_ALIAS[code] || code);

  return {
    selectedProvider: aliasedProvider,
    routingMode,
    matchedRules,
    rejectedRules,
    fallbackChain: aliasedFallbackChain,
    healthScore,
    reason,
    simulation
  };
};

/**
 * Backward compatible entrypoint used by rechargeWorker.js
 */
export const selectProvider = async ({ userId, operator, amount, circle, txnId }) => {
  const start = Date.now();
  logger.info("selectProvider wrapper triggered", { userId, operator, amount, circle, txnId });

  // 1. Fetch the default executed provider (APIBOX is primary execution engine)
  let legacyProvider = await prisma.provider.findFirst({
    where: { code: "APIBOX" }
  }) || {
    code: "APIBOX",
    name: "APIBOX Provider",
    isActive: true
  };

  // 2. SHADOW ROUTING ENGINE CALCULATION
  let selectedResolverAlias = "Primary Gateway";
  let routingExplanation = "Default resolve";
  let resolvedMode = "MANUAL";
  let lat = 0;

  try {
    // Resolve standard parameters to ID checks
    const section = await prisma.serviceSection.findFirst({ where: { code: "RECHARGE" } });
    const op = await prisma.operator.findFirst({ where: { name: operator } });

    const newResolution = await resolveRoute({
      sectionId: section?.id,
      operatorId: op?.id,
      circleId: null,
      amount,
      serviceType: "RECHARGE",
      simulation: false
    });

    selectedResolverAlias = newResolution.selectedProvider;
    routingExplanation = newResolution.reason;
    resolvedMode = newResolution.routingMode;
    lat = Date.now() - start;

    // Log comparison differences if any
    const legacyAlias = REAL_TO_ALIAS[legacyProvider.code] || legacyProvider.code;
    const isMatch = legacyAlias === selectedResolverAlias;

    // Dynamic import for Phase 9 integration
    const { resolveIntelligenceRoute, recordShadowValidation } = await import("../routingIntelligenceService.js");
    
    // Resolve dynamic Explainable composite scores
    const intelRoute = await resolveIntelligenceRoute({
      operator,
      amount,
      txnId
    });

    if (txnId) {
      await prisma.routingDecisionLog.create({
        data: {
          txnId: Number(txnId),
          operator,
          amount: Number(amount),
          recommendedProvider: ALIAS_TO_REAL[selectedResolverAlias.toUpperCase()] || selectedResolverAlias,
          executedProvider: legacyProvider.code,
          shadowMode: true,
          routingReason: `${routingExplanation} (Mode: ${resolvedMode})`,
          latency: lat
        }
      }).catch(err => logger.error("Failed to save shadow routing comparison", { err: err.message }));

      // Custom shadow log audit mapping
      if (!isMatch) {
        console.warn(`[SHADOW ROUTING MISMATCH] Txn #${txnId} | Legacy Executed: ${legacyAlias} | New Resolver Recommended: ${selectedResolverAlias}`);
      }

      // Record shadow validation comparison metrics
      const recommendedReal = ALIAS_TO_REAL[selectedResolverAlias.toUpperCase()] || selectedResolverAlias;
      await recordShadowValidation(
        txnId,
        legacyProvider.code,
        recommendedReal,
        lat,
        true, // assumed success
        Number(legacyProvider.costPerTxn || 0.0)
      );
    }

    // Observing Output log console
    console.log(
      "[SHADOW ROUTING]",
      txnId || "N/A",
      JSON.stringify({
        operator,
        amount,
        recommendedProvider: selectedResolverAlias,
        executedProvider: legacyAlias,
        shadowReason: routingExplanation,
        latencyMs: lat,
        isMatch
      })
    );

    // Phase 9 Autonomous Mode Override execution
    if (intelRoute && intelRoute.selectedProvider && intelRoute.mode === "AUTONOMOUS") {
      const activeProvider = await prisma.provider.findUnique({
        where: { code: intelRoute.selectedProvider }
      });
      if (activeProvider && activeProvider.isActive) {
        logger.info("[ROUTING ENGINE] AUTONOMOUS ROUTE OVERRIDE EXECUTED", {
          recommended: intelRoute.selectedProvider,
          txnId
        });
        return [activeProvider];
      }
    }

  } catch (err) {
    logger.error("Error in selectProvider shadow routing calculation", { error: err.message });
  }

  // CRITICAL RULE: In Shadow Mode, ALWAYS return the legacy Provider for execution!
  return [legacyProvider];
};

export default {
  resolveRoute,
  selectProvider,
  enterpriseFeatures
};
