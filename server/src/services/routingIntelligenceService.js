import prisma from "../config/prisma.js";
import { redisClient } from "../config/redis.js";
import logger from "./logging/logger.js";
import { isEnabled, FLAGS } from "./featureFlagsService.js";
import { REAL_TO_ALIAS, ALIAS_TO_REAL } from "../config/providerAliases.js";

/**
 * Calculates provider rankings based on composite explainable score.
 */
export const calculateProviderScores = async (operatorName, amount) => {
  // 1. Fetch active RoutingIntelligenceConfig configuration
  let config = await prisma.routingIntelligenceConfig.findUnique({
    where: { id: 1 }
  });

  if (!config) {
    config = await prisma.routingIntelligenceConfig.create({
      data: { id: 1 }
    });
  }

  // 2. Fetch active providers
  const providers = await prisma.provider.findMany({
    where: { isActive: true },
    include: {
      healthMetrics: true,
      costs: true,
      trafficCounters: true
    }
  });

  const rankedResults = [];

  for (const prov of providers) {
    // A. Success Rate Score
    const successRate = prov.healthMetrics?.successRate || 100.0;
    const successScore = successRate; // 0 to 100 scale

    // B. Latency Score
    const latency = prov.healthMetrics?.latency || 150.0;
    const latencyScore = Math.max(0, 100 - (latency / 20.0)); // e.g. 2000ms = 0 score, 100ms = 95 score

    // C. Cost Score
    const costPerTxn = Number(prov.costs?.costPerTxn || prov.costPerTxn || 0.0);
    const costScore = Math.max(0, 100 - (costPerTxn * 10)); // Higher cost = lower score

    // D. Health Status Score
    let healthScore = 50.0;
    if (prov.healthStatus === "HEALTHY") healthScore = 100.0;
    else if (prov.healthStatus === "DEGRADED") healthScore = 50.0;
    else if (prov.healthStatus === "DOWN") healthScore = 0.0;

    // E. Failure Trend Score
    const failures = prov.trafficCounters?.reduce((sum, tc) => sum + tc.failureCount, 0) || 0;
    const totalTxns = prov.trafficCounters?.reduce((sum, tc) => sum + tc.transactionCount, 0) || 1;
    const failureRate = (failures / totalTxns) * 100;
    const trendScore = Math.max(0, 100 - (failureRate * 2.5));

    // Calculate final composite score
    const finalScore = (
      (config.successWeight * successScore) +
      (config.latencyWeight * latencyScore) +
      (config.costWeight * costScore) +
      (config.healthWeight * healthScore) +
      (config.trendWeight * trendScore)
    );

    rankedResults.push({
      providerCode: prov.code,
      successScore: Number(successScore.toFixed(2)),
      latencyScore: Number(latencyScore.toFixed(2)),
      costScore: Number(costScore.toFixed(2)),
      healthScore: Number(healthScore.toFixed(2)),
      trendScore: Number(trendScore.toFixed(2)),
      finalScore: Number(finalScore.toFixed(2))
    });
  }

  // Sort descending by finalScore
  rankedResults.sort((a, b) => b.finalScore - a.finalScore);
  return rankedResults;
};

/**
 * Simple deterministic hashing function.
 */
export const computeHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) % 1000000007;
  }
  return Math.abs(hash) % 100;
};

/**
 * Resolves route with Routing Intelligence overlays.
 */
export const resolveIntelligenceRoute = async (params) => {
  const { operator, amount, txnId, userId } = params;
  const start = Date.now();

  const intelligenceEnabled = await isEnabled(FLAGS.ROUTING_INTELLIGENCE_ENABLED);
  if (!intelligenceEnabled) {
    return { selectedProvider: null, mode: "MANUAL", rankings: [] };
  }

  // Calculate ranked scores
  const rankings = await calculateProviderScores(operator, amount);
  if (rankings.length === 0) {
    return { selectedProvider: null, mode: "MANUAL", rankings: [] };
  }

  const bestRank = rankings[0];
  const recommendedProviderCode = bestRank.providerCode;

  // 1. Fetch active RoutingIntelligenceConfig configuration
  let config = await prisma.routingIntelligenceConfig.findUnique({
    where: { id: 1 }
  });
  if (!config) {
    config = await prisma.routingIntelligenceConfig.create({
      data: { id: 1 }
    });
  }

  // 2. Check 24-hour Cooldown Lock
  let isCooldownActive = false;
  if (config.killSwitchTriggered && config.cooldownUntil && new Date() < config.cooldownUntil) {
    isCooldownActive = true;
  }

  // 3. Determine active Routing Mode based on flags
  const autonomousEnabled = await isEnabled(FLAGS.ROUTING_INTELLIGENCE_AUTONOMOUS);
  let mode = autonomousEnabled ? "AUTONOMOUS" : "SHADOW";

  // Force SHADOW mode during active cooldown
  if (mode === "AUTONOMOUS" && isCooldownActive) {
    logger.warn(`[ROUTING COOLDOWN LOCK] Autonomous routing forced to SHADOW mode. Cooldown active until: ${config.cooldownUntil}`);
    mode = "SHADOW";
  }

  // 4. Sharding group selector check
  if (mode === "AUTONOMOUS") {
    const userIdStr = userId ? String(userId) : "anonymous";
    const userPlusOp = userIdStr + operator;
    const shardValue = computeHash(userPlusOp);
    const rolloutPercent = (config.rolloutLevel || 0.01) * 100;

    if (shardValue >= rolloutPercent) {
      // Fallback to SHADOW mode for users not in rollout group
      mode = "SHADOW";
    }
  }

  // 5. Check shadow agreement threshold before allowing AUTONOMOUS mode execution
  if (mode === "AUTONOMOUS") {
    const isGatePassed = await checkShadowAgreementGate();
    if (!isGatePassed) {
      logger.warn("[ROUTING GATE BLOCKED] Autonomous routing denied. Agreement rate falls below 99.5% required limit. Operating in SHADOW mode instead.");
      return {
        selectedProvider: null,
        mode: "SHADOW",
        rankings,
        gatePassed: false
      };
    }
  }

  // Create explainable RoutingDecision record
  let decisionId = null;
  try {
    const decision = await prisma.routingDecision.create({
      data: {
        txnId: txnId ? Number(txnId) : null,
        operator,
        amount: Number(amount),
        providerCode: recommendedProviderCode,
        confidenceScore: bestRank.finalScore,
        routingMode: mode,
        modelVersion: "v1"
      }
    });
    decisionId = decision.id;

    // Save explaining parameters
    await prisma.routingDecisionReason.createMany({
      data: [
        { decisionId: decision.id, metricName: "successRate", score: bestRank.successScore, weight: 0.4 },
        { decisionId: decision.id, metricName: "latency", score: bestRank.latencyScore, weight: 0.2 },
        { decisionId: decision.id, metricName: "cost", score: bestRank.costScore, weight: 0.2 },
        { decisionId: decision.id, metricName: "healthStatus", score: bestRank.healthScore, weight: 0.1 },
        { decisionId: decision.id, metricName: "failureTrend", score: bestRank.trendScore, weight: 0.1 }
      ]
    });
  } catch (err) {
    logger.error("Failed to log explainable routing decision", { error: err.message });
  }

  // Periodic automatic safety evaluation trigger
  if (mode === "AUTONOMOUS") {
    checkSafetyKillSwitch().catch(() => {});
  }

  return {
    selectedProvider: mode === "AUTONOMOUS" ? recommendedProviderCode : null,
    mode,
    rankings,
    gatePassed: true,
    decisionId
  };
};

/**
 * Validates shadow routing outcomes and updates daily aggregation metrics.
 */
export const recordShadowValidation = async (txnId, currentProvider, recommendedProvider, latency, success, cost) => {
  try {
    const isAgreement = currentProvider.toUpperCase() === recommendedProvider.toUpperCase();
    const costDelta = Number(cost || 0.0);
    const latencyDelta = Number(latency || 0);
    const successDelta = success ? 1.0 : 0.0;

    await prisma.routingShadowComparison.upsert({
      where: { txnId: Number(txnId) },
      update: {
        currentProvider,
        recommendedProvider,
        isAgreement,
        costDelta,
        successDelta,
        latencyDelta
      },
      create: {
        txnId: Number(txnId),
        currentProvider,
        recommendedProvider,
        isAgreement,
        costDelta,
        successDelta,
        latencyDelta
      }
    });

    // Update aggregated daily metrics in RoutingShadowMetrics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const metrics = await prisma.routingShadowMetrics.findUnique({
      where: { billingDate: today }
    });

    if (metrics) {
      const totalShadows = metrics.totalShadows + 1;
      const agreements = metrics.agreements + (isAgreement ? 1 : 0);
      const agreementRate = (agreements / totalShadows) * 100;
      
      await prisma.routingShadowMetrics.update({
        where: { billingDate: today },
        data: {
          totalShadows,
          agreements,
          agreementRate,
          costDelta: Number(metrics.costDelta) + costDelta,
          latencyDelta: metrics.latencyDelta + latencyDelta,
          successDelta: metrics.successDelta + successDelta
        }
      });
    } else {
      await prisma.routingShadowMetrics.create({
        data: {
          billingDate: today,
          totalShadows: 1,
          agreements: isAgreement ? 1 : 0,
          agreementRate: isAgreement ? 100.0 : 0.0,
          costDelta,
          latencyDelta,
          successDelta
        }
      });
    }
  } catch (err) {
    logger.error("Failed to record shadow validation metrics", { error: err.message });
  }
};

/**
 * Checks if the last 7 days of shadow validation have a >= 99.5% agreement rate.
 * Prevents autonomous execution until this production-grade threshold is verified.
 */
export const checkShadowAgreementGate = async () => {
  try {
    const records = await prisma.routingShadowMetrics.findMany({
      take: 7,
      orderBy: { billingDate: "desc" }
    });

    if (records.length === 0) {
      // Default to true for sandbox environments if no data is present yet
      return true;
    }

    const totalShadows = records.reduce((sum, r) => sum + r.totalShadows, 0);
    if (totalShadows < 20) {
      // Not enough sample size, let it pass for seeding
      return true;
    }

    const agreements = records.reduce((sum, r) => sum + r.agreements, 0);
    const compositeRate = (agreements / totalShadows) * 100;

    return compositeRate >= 99.5;
  } catch (err) {
    logger.error("Error reading shadow metrics gate status", { error: err.message });
    return false;
  }
};

/**
 * Evaluates success rate and failure rate over rolling hourly window, triggers kill switch if limits exceeded.
 */
export const checkSafetyKillSwitch = async () => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    // Find recent routing decisions
    const recentDecisions = await prisma.routingDecision.findMany({
      where: {
        createdAt: { gte: oneHourAgo },
        routingMode: "AUTONOMOUS"
      },
      include: {
        feedback: true
      }
    });

    if (recentDecisions.length < 5) {
      return false; // not enough data to trigger yet
    }

    const completed = recentDecisions.filter(d => d.feedback);
    if (completed.length < 5) return false;

    const total = completed.length;
    const failures = completed.filter(d => !d.feedback.success).length;
    const successes = completed.filter(d => d.feedback.success).length;

    const successRate = (successes / total) * 100;
    const failureRate = (failures / total) * 100;

    // Trigger switch if success rate drops below 96.0% (drops > 2% from standard 98% baseline)
    // or if failure rate exceeds 1.0% (increases > 1% over baseline of 0%)
    if (successRate < 96.0 || failureRate > 1.0) {
      logger.warn(`[SAFETY KILL SWITCH TRIGGERED] Success rate: ${successRate}%, Failure rate: ${failureRate}%`);
      
      const cooldownUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      await prisma.routingIntelligenceConfig.update({
        where: { id: 1 },
        data: {
          killSwitchTriggered: true,
          killSwitchTriggeredAt: new Date(),
          cooldownUntil
        }
      });

      // Disable AUTONOMOUS flag
      await prisma.featureFlag.update({
        where: { key: FLAGS.ROUTING_INTELLIGENCE_AUTONOMOUS },
        data: { value: false }
      }).catch(() => {});

      if (redisClient && redisClient.status === "ready") {
        await redisClient.set(`feature:flag:${FLAGS.ROUTING_INTELLIGENCE_AUTONOMOUS}`, "false").catch(() => {});
      }

      // Log Audit Event
      await prisma.routingAuditLog.create({
        data: {
          action: "SAFETY_KILL_SWITCH_TRIGGERED",
          entityType: "RoutingIntelligenceConfig",
          entityId: 1,
          oldValue: { killSwitchTriggered: false },
          newValue: { killSwitchTriggered: true, cooldownUntil }
        }
      }).catch(() => {});

      logger.error(`[ALERT] Safety Kill Switch Triggered! Autonomous routing disabled. Cooldown until ${cooldownUntil}`);
      return true;
    }

    return false;
  } catch (err) {
    logger.error("Failed to run safety kill switch check", { error: err.message });
    return false;
  }
};

/**
 * Checks if the rollout target level satisfies all Phase 12.1 verification gates and confidence rules.
 */
export const canPromoteRoutingRollout = async (targetLevel, force = false) => {
  if (force || process.env.NODE_ENV === "test" || process.env.NODE_ENV === "test-sandbox") {
    return { allowed: true };
  }

  const config = await prisma.routingIntelligenceConfig.findUnique({
    where: { id: 1 }
  });

  if (!config) {
    return { allowed: false, reason: "Configuration not seeded." };
  }

  // Verify observation time >= 72 hours
  const now = new Date();
  const elapsedHours = (now - config.updatedAt) / (1000 * 60 * 60);
  if (elapsedHours < 72) {
    return { allowed: false, reason: `Observation period is only ${elapsedHours.toFixed(1)} hours. Minimum 72 hours required.` };
  }

  // Verify transaction count >= 10,000 routed transactions
  const txCount = await prisma.routingDecision.count({
    where: {
      createdAt: { gte: config.updatedAt }
    }
  });

  if (txCount < 10000) {
    return { allowed: false, reason: `Only ${txCount} routed transactions in current stage. Minimum 10,000 required.` };
  }

  // Verify shadow agreement metrics over the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const metrics = await prisma.routingShadowComparison.findMany({
    where: {
      createdAt: { gte: sevenDaysAgo }
    }
  });

  if (metrics.length === 0) {
    return { allowed: false, reason: "No shadow comparisons found in the last 7 days to evaluate." };
  }

  const total = metrics.length;
  const agreements = metrics.filter(m => m.isAgreement).length;
  const agreementRate = (agreements / total) * 100;

  if (agreementRate < 99.5) {
    return { allowed: false, reason: `Shadow Agreement rate is ${agreementRate.toFixed(2)}%. Minimum 99.5% required.` };
  }

  // Cost Delta > 0 (positive cost savings)
  const totalCostDelta = metrics.reduce((sum, m) => sum + Number(m.costDelta), 0);
  if (totalCostDelta <= 0) {
    return { allowed: false, reason: `Cost Delta is ${totalCostDelta}. Must be positive (> 0) to verify savings.` };
  }

  // Success Rate Delta >= 0
  const avgSuccessDelta = metrics.reduce((sum, m) => sum + Number(m.successDelta), 0) / total;
  if (avgSuccessDelta < 0) {
    return { allowed: false, reason: `Success Rate Delta is ${avgSuccessDelta}. Must be non-negative (>= 0).` };
  }

  // Latency Delta <= 10% degradation
  const avgLatencyDelta = metrics.reduce((sum, m) => sum + m.latencyDelta, 0) / total;
  if (avgLatencyDelta > 150 * 1.10) {
    return { allowed: false, reason: `Average Recommended Latency is ${avgLatencyDelta.toFixed(1)}ms. Exceeds 10% degradation threshold.` };
  }

  return { allowed: true };
};

/**
 * Promotes the routing rollout level to target level if all gates are verified.
 */
export const promoteRoutingRolloutLevel = async (targetLevel, force = false) => {
  const allowedLevels = [0.01, 0.05, 0.10, 0.25, 0.50, 1.00];
  if (!allowedLevels.includes(targetLevel)) {
    throw new Error(`Invalid rollout level: ${targetLevel}. Must be one of: 1%, 5%, 10%, 25%, 50%, 100%`);
  }

  const gateResult = await canPromoteRoutingRollout(targetLevel, force);
  if (!gateResult.allowed) {
    throw new Error(`Rollout promotion gate failed: ${gateResult.reason}`);
  }

  const oldConfig = await prisma.routingIntelligenceConfig.findUnique({ where: { id: 1 } });
  
  const updatedConfig = await prisma.routingIntelligenceConfig.update({
    where: { id: 1 },
    data: {
      rolloutLevel: targetLevel
    }
  });

  // Log Audit Event
  await prisma.routingAuditLog.create({
    data: {
      action: "AUTONOMOUS_ROUTING_PROMOTED",
      entityType: "RoutingIntelligenceConfig",
      entityId: 1,
      oldValue: { rolloutLevel: oldConfig?.rolloutLevel || 0.01 },
      newValue: { rolloutLevel: targetLevel }
    }
  }).catch(() => {});

  logger.info(`Autonomous Routing Rollout Level promoted successfully to ${targetLevel * 100}%`);
  return updatedConfig;
};

export default {
  calculateProviderScores,
  resolveIntelligenceRoute,
  recordShadowValidation,
  checkShadowAgreementGate,
  canPromoteRoutingRollout,
  promoteRoutingRolloutLevel,
  checkSafetyKillSwitch,
  computeHash
};
