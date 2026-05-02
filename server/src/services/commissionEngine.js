import prisma from "../config/prisma.js";
import { redisClient } from "../config/redis.js";

const CACHE_KEY = "commission_rules";
const CACHE_TTL = 3600; // 1 hr

export const getCommissionDetails = async (amount, operator, userTier = "Standard") => {
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

  // Find the exact rule (highest priority comes first due to sorting above)
  const applicableRule = rules.find(
    (rule) => rule.operator === operator && rule.userTier === userTier
  );

  if (!applicableRule) {
    // Return default values if no rule matches
    const commission = Number((amount * 0.05).toFixed(2)); // Default 5% commission
    const cashback = Number((amount * 0.01).toFixed(2));   // Default 1% cashback
    const profit = Number((commission - cashback).toFixed(2));
    return { commission, cashback, profit };
  }

  const commission = Number((amount * (applicableRule.commissionPercent / 100)).toFixed(2));
  const cashback = Number((amount * (applicableRule.cashbackPercent / 100)).toFixed(2));
  const profit = Number((commission - cashback).toFixed(2));

  return { commission, cashback, profit };
};

// Admin operation to forcefully invalidate cache when updating rules
export const invalidateCommissionCache = async () => {
    await redisClient.del(CACHE_KEY);
};
