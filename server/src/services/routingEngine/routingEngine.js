import prisma from "../../config/prisma.js";
import logger from "../logging/logger.js";

// Enterprise feature flags
export const enterpriseFeatures = {
  routingEngine: true,
  providerManagement: true,
  operatorManagement: true,
  whatsappSystem: true,
  telemetryMonitoring: true,
  shadowMode: true, // Shadow mode is active by default in this rollout stage
  enterpriseProviderManager: true
};

/**
 * Enterprise Routing Engine Resolver
 */
export const selectProvider = async ({ userId, operator, amount, circle, txnId }) => {
  const start = Date.now();
  logger.info("Routing engine provider selection triggered", { userId, operator, amount, circle, txnId });

  try {
    // 1. Fetch the default provider (APIBOX is the active provider)
    let selectedProvider = await prisma.provider.findUnique({
      where: { code: "APIBOX" }
    });

    if (!selectedProvider) {
      // In case provider record doesn't exist, retrieve or build fallback object
      selectedProvider = {
        code: "APIBOX",
        name: "APIBOX Provider",
        baseUrl: process.env.APIBOX_BASE_URL || "https://Apibox.co.in/Api/Service",
        isActive: true,
        priority: 100
      };
    }

    // 2. COMPUTE ROUTING ENGINE RECOMMENDATIONS (SHADOW ROUTING RULES ANALYSIS)
    let recommendationReason = "Default Provider Route";
    let recommendedProviderCode = "APIBOX";

    // Lookup Operator Mapping compatibilities
    const opMapping = await prisma.operatorMapping.findFirst({
      where: {
        operatorName: operator,
        isActive: true,
        minAmount: { lte: amount },
        maxAmount: { gte: amount }
      }
    });

    if (opMapping) {
      recommendationReason = `Matched Operator Mapping for ${operator}`;
      recommendedProviderCode = opMapping.providerCode;
    }

    // Lookup User-specific switching rules
    const userRule = await prisma.routingRule.findFirst({
      where: {
        ruleType: "user",
        targetValue: String(userId),
        isActive: true,
        minAmount: { lte: amount },
        maxAmount: { gte: amount }
      },
      orderBy: { priority: "desc" }
    });

    if (userRule) {
      recommendationReason = `Matched User Specific Routing Rule for User ID: ${userId}`;
      recommendedProviderCode = userRule.providerCode;
    }

    // Lookup Circle-specific switching rules
    if (circle) {
      const circleRule = await prisma.routingRule.findFirst({
        where: {
          ruleType: "circle",
          targetValue: String(circle).toUpperCase(),
          isActive: true
        },
        orderBy: { priority: "desc" }
      });

      if (circleRule) {
        recommendationReason = `Matched Circle-Wise Routing Rule for ${circle}`;
        recommendedProviderCode = circleRule.providerCode;
      }
    }

    // Lookup Amount-specific switching rules
    const amountRule = await prisma.routingRule.findFirst({
      where: {
        ruleType: "amount",
        isActive: true,
        minAmount: { lte: amount },
        maxAmount: { gte: amount }
      },
      orderBy: { priority: "desc" }
    });

    if (amountRule) {
      recommendationReason = `Matched Amount slab rule for amount ₹${amount}`;
      recommendedProviderCode = amountRule.providerCode;
    }

    const latency = Date.now() - start;

    // 3. PERSIST AUDIT LOG TO RoutingDecisionLog
    if (txnId) {
      await prisma.routingDecisionLog.create({
        data: {
          txnId: Number(txnId),
          operator,
          amount: Number(amount),
          recommendedProvider: recommendedProviderCode,
          executedProvider: selectedProvider.code,
          shadowMode: enterpriseFeatures.shadowMode,
          routingReason: recommendationReason,
          latency
        }
      }).catch(err => logger.error("Failed to write shadow routing decision audit log", { err: err.message, txnId }));
    }

    // 4. OBSERVABILITY - Structured Shadow Routing Logging
    if (enterpriseFeatures.shadowMode) {
      console.log(
        "[SHADOW ROUTING]",
        txnId || "N/A",
        JSON.stringify({
          operator,
          amount,
          recommendedProvider: recommendedProviderCode,
          executedProvider: selectedProvider.code,
          shadowReason: recommendationReason,
          latencyMs: latency
        })
      );
    }

    // In Single Provider Mode, always return APIBOX as the executable provider
    return [selectedProvider];

  } catch (error) {
    logger.error("Error in Routing Engine selectProvider", { error: error.message, userId, txnId });
    // Safe fallback mode: always return a fallback array matching APIBOX
    const fallbackProvider = await prisma.provider.findFirst({
      where: { code: "APIBOX" }
    }) || {
      code: "APIBOX",
      name: "APIBOX Provider",
      isActive: true
    };
    return [fallbackProvider];
  }
};

export default {
  selectProvider,
  enterpriseFeatures
};
