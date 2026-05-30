import prisma from "../config/prisma.js";
import { redisClient } from "../config/redis.js";
import { getHighestPriorityRule } from "../utils/getHighestPriorityRule.js";

const CACHE_KEY = "commission_rules";
const CACHE_TTL = 3600; // 1 hr

/**
 * Deterministic bucket hashing function returning a value between 0 and 99.
 */
export const getDeterministicBucket = (key) => {
  let hash = 0;
  const str = String(key);
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash) % 100;
};

/**
 * Legacy resolution path for commission calculations.
 */
const runLegacyEngine = async (amount, operator, userTier) => {
  let rules = await redisClient.get(CACHE_KEY);

  if (rules) {
    rules = JSON.parse(rules);
  } else {
    rules = await prisma.commissionRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' }
    });
    await redisClient.set(CACHE_KEY, JSON.stringify(rules), "EX", CACHE_TTL);
  }

  const applicableRule = rules.find(
    (rule) => rule.operator === operator && rule.userTier === userTier
  );

  if (!applicableRule) {
    const commission = Number((amount * 0.05).toFixed(2)); // Default 5% commission
    const cashback = Number((amount * 0.01).toFixed(2));   // Default 1% cashback
    const profit = Number((commission - cashback).toFixed(2));
    return { 
      commission, 
      cashback, 
      profit, 
      snapshot: { 
        engine: "LEGACY", 
        source: "DEFAULT_FALLBACK" 
      } 
    };
  }

  const commission = Number((amount * (applicableRule.commissionPercent / 100)).toFixed(2));
  const cashback = Number((amount * (applicableRule.cashbackPercent / 100)).toFixed(2));
  const profit = Number((commission - cashback).toFixed(2));

  return { 
    commission, 
    cashback, 
    profit, 
    snapshot: { 
      engine: "LEGACY", 
      source: "RULE_RESOLVED", 
      ruleId: applicableRule.id,
      commissionPercent: applicableRule.commissionPercent,
      cashbackPercent: applicableRule.cashbackPercent
    } 
  };
};

/**
 * New simulator-based precedence resolution engine.
 */
const runNewEngine = async (amount, operator, userTier, options) => {
  const searchAmount = parseFloat(amount);
  let resolvedUser = null;
  let resolvedRole = "RETAILER";
  let resolvedTier = userTier || "Standard";
  let resolvedSlabId = null;
  let resolvedPackageId = null;
  let slabSource = "DEFAULT_FALLBACK";

  // 1. Load User context if provided
  if (options.userId) {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(options.userId) },
      select: {
        id: true,
        name: true,
        slabId: true,
        packageId: true,
        commissionRole: true,
        tier: true
      }
    });
    if (user) {
      resolvedUser = user;
      resolvedRole = user.commissionRole || "RETAILER";
      resolvedTier = user.tier || resolvedTier;
      resolvedSlabId = user.slabId;
      resolvedPackageId = user.packageId;
    }
  }

  // 2. Load Operator and Service Category objects from DB
  const operatorObj = await prisma.operator.findFirst({
    where: { name: { equals: operator } }
  });

  const serviceCategoryObj = await prisma.serviceCategory.findFirst({
    where: { code: "RECHARGE" }
  });

  // 3. Resolve Slab Precedence: Slab Override -> Package Slab -> Default Fallback
  if (resolvedSlabId) {
    slabSource = "USER_SLAB_OVERRIDE";
  } else if (resolvedPackageId && serviceCategoryObj) {
    const packageMapping = await prisma.packageServiceSlab.findUnique({
      where: {
        packageId_serviceCategoryId: {
          packageId: resolvedPackageId,
          serviceCategoryId: serviceCategoryObj.id
        }
      }
    });
    if (packageMapping) {
      resolvedSlabId = packageMapping.slabId;
      slabSource = "PACKAGE_SLAB_RESOLUTION";
    }
  }

  if (!resolvedSlabId) {
    const defaultSlab = await prisma.slab.findFirst({
      where: { isDefault: true, isDeleted: false }
    });
    if (defaultSlab) {
      resolvedSlabId = defaultSlab.id;
      slabSource = "DEFAULT_FALLBACK";
    }
  }

  let winningRule = null;
  let ruleSource = "DEFAULT_FALLBACK";

  if (resolvedSlabId && operatorObj && serviceCategoryObj) {
    const now = Date.now();
    
    // Evaluate Range Rules
    const rangeRules = await prisma.rangeCommissionRule.findMany({
      where: {
        slabId: resolvedSlabId,
        operatorId: operatorObj.id,
        serviceCategoryId: serviceCategoryObj.id,
        isDeleted: false
      }
    });

    const rangeCandidates = [];
    for (const rule of rangeRules) {
      const roleMatch = rule.role === resolvedRole;
      const amountMatch = searchAmount >= rule.amountFrom && searchAmount <= rule.amountTo;
      
      const start = rule.effectiveFrom ? new Date(rule.effectiveFrom).getTime() : 0;
      const end = rule.effectiveTo ? new Date(rule.effectiveTo).getTime() : Infinity;
      const dateMatch = now >= start && now <= end;
      
      const statusMatch = rule.status === "ACTIVE" || rule.status === "APPROVED";

      if (roleMatch && amountMatch && dateMatch && statusMatch) {
        rangeCandidates.push(rule);
      }
    }

    // Evaluate Recharge Rules
    const rechargeRules = await prisma.rechargeCommissionRule.findMany({
      where: {
        slabId: resolvedSlabId,
        operatorId: operatorObj.id,
        serviceCategoryId: serviceCategoryObj.id,
        isDeleted: false
      }
    });

    const rechargeCandidates = [];
    for (const rule of rechargeRules) {
      const roleMatch = rule.role === resolvedRole;
      
      const start = rule.effectiveFrom ? new Date(rule.effectiveFrom).getTime() : 0;
      const end = rule.effectiveTo ? new Date(rule.effectiveTo).getTime() : Infinity;
      const dateMatch = now >= start && now <= end;
      
      const statusMatch = rule.status === "ACTIVE" || rule.status === "APPROVED";

      if (roleMatch && dateMatch && statusMatch) {
        rechargeCandidates.push(rule);
      }
    }

    if (rangeCandidates.length > 0) {
      winningRule = getHighestPriorityRule(rangeCandidates);
      ruleSource = "RANGE_RULE";
    } else if (rechargeCandidates.length > 0) {
      winningRule = getHighestPriorityRule(rechargeCandidates);
      ruleSource = "RECHARGE_RULE";
    }
  }

  // 4. Fallback to Legacy rules if no rule resolved inside slab
  if (!winningRule) {
    const legacyRule = await prisma.commissionRule.findFirst({
      where: {
        operator: operator,
        userTier: resolvedTier,
        isActive: true
      },
      orderBy: { priority: "desc" }
    });
    if (legacyRule) {
      const simulatedLegacyRule = {
        id: legacyRule.id,
        commissionType: "PERCENTAGE",
        commissionValue: legacyRule.commissionPercent,
        cashbackPercent: legacyRule.cashbackPercent,
        surchargeType: "PERCENTAGE",
        surchargeValue: 0.0,
        profitType: "PERCENTAGE",
        profitValue: legacyRule.commissionPercent - legacyRule.cashbackPercent,
        feeType: "PERCENTAGE",
        feeValue: 0.0,
        maxCommission: null,
        fixedCharge: 0.0,
        mode: "GENERAL"
      };
      winningRule = simulatedLegacyRule;
      ruleSource = "LEGACY_RULE";
    }
  }

  // 5. Default Fallback
  if (!winningRule) {
    const simulatedDefaultRule = {
      id: 0,
      commissionType: "PERCENTAGE",
      commissionValue: 5.0,
      surchargeType: "PERCENTAGE",
      surchargeValue: 0.0,
      profitType: "PERCENTAGE",
      profitValue: 4.0,
      feeType: "PERCENTAGE",
      feeValue: 0.0,
      maxCommission: null,
      fixedCharge: 0.0,
      mode: "GENERAL"
    };
    winningRule = simulatedDefaultRule;
    ruleSource = "DEFAULT_FALLBACK";
  }

  // Financial Calculations
  const finalCommType = winningRule.commissionType;
  let baseCommission = finalCommType === "PERCENTAGE"
    ? (searchAmount * winningRule.commissionValue) / 100
    : winningRule.commissionValue;
  
  if (winningRule.maxCommission !== null && baseCommission > winningRule.maxCommission) {
    baseCommission = winningRule.maxCommission;
  }
  if (winningRule.fixedCharge) {
    baseCommission += winningRule.fixedCharge;
  }

  const surchargeVal = winningRule.surchargeValue || 0.0;
  const surchargeType = winningRule.surchargeType || "PERCENTAGE";
  const baseSurcharge = surchargeType === "PERCENTAGE"
    ? (searchAmount * surchargeVal) / 100
    : surchargeVal;

  const profitVal = winningRule.profitValue || 0.0;
  const profitType = winningRule.profitType || "PERCENTAGE";
  const baseProfit = profitType === "PERCENTAGE"
    ? (searchAmount * profitVal) / 100
    : profitVal;

  const feeVal = winningRule.feeValue || 0.0;
  const feeType = winningRule.feeType || "PERCENTAGE";
  const baseFee = feeType === "PERCENTAGE"
    ? (searchAmount * feeVal) / 100
    : feeVal;

  const commission = Number(baseCommission.toFixed(4));
  const profit = Number(baseProfit.toFixed(4));
  const cashback = Number((commission - profit).toFixed(4));

  const rolloutPercent = options.rolloutPercent !== undefined ? options.rolloutPercent : 0;

  const snapshot = {
    engine: "NEW",
    engineVersion: "NEW",
    winningRuleId: winningRule.id,
    slabSource,
    ruleSource,
    commission: Number(baseCommission.toFixed(4)),
    surcharge: Number(baseSurcharge.toFixed(4)),
    fee: Number(baseFee.toFixed(4)),
    profit: Number(baseProfit.toFixed(4)),
    cashback: Number((baseCommission - baseProfit).toFixed(4)),
    mode: winningRule.mode,
    engineMode: winningRule.mode,
    rolloutPercent
  };

  return { commission, cashback, profit, snapshot };
};

/**
 * Resolves commission details for transactions depending on version/rollout flag settings.
 */
export const getCommissionDetails = async (amount, operator, userTier = "Standard", options = {}) => {
  // Fetch current commission config version
  let config = await prisma.commissionConfig.findUnique({ where: { id: 1 } });
  if (!config) {
    config = await prisma.commissionConfig.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, currentVersion: 1, commissionEngineVersion: "LEGACY", rolloutPercent: 0 }
    });
  }

  const engineVersion = config.commissionEngineVersion || "LEGACY";
  const rolloutPercent = config.rolloutPercent || 0;

  let activeEngine = engineVersion;
  if (engineVersion === "HYBRID") {
    const routingKey = options.idempotencyKey || options.userId || Math.random().toString();
    const bucket = getDeterministicBucket(routingKey);
    activeEngine = bucket < rolloutPercent ? "NEW" : "LEGACY";
  }

  if (activeEngine === "NEW") {
    return runNewEngine(amount, operator, userTier, { ...options, rolloutPercent });
  } else {
    return runLegacyEngine(amount, operator, userTier);
  }
};

/**
 * Invalidates redis commission rules cache (legacy path support).
 */
export const invalidateCommissionCache = async () => {
  await redisClient.del(CACHE_KEY);
};
