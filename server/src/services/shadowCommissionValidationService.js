import prisma from "../config/prisma.js";
import { simulateCommission } from "../controllers/commissionAdminController.js";
import eventBus from "../config/eventBus.js";

const normalize = (value) => {
  if (value === undefined || value === null) return 0;
  return Number(Number(value).toFixed(4));
};

/**
 * Executes shadow commission validation on a successful recharge transaction
 * by comparing actual production commission details with simulated results.
 */
export const runShadowValidation = async (transactionId) => {
  try {
    const txn = await prisma.transaction.findUnique({
      where: { id: parseInt(transactionId) }
    });

    if (!txn) {
      console.warn(`[SHADOW_VALIDATION] Transaction #${transactionId} not found.`);
      return;
    }

    if (txn.type !== "RECHARGE" || txn.status !== "SUCCESS") {
      // Shadow validation is only concerned with successful recharge transactions
      return;
    }

    // Resolve operator and service category IDs for simulator input
    const opObj = await prisma.operator.findFirst({
      where: { name: { equals: txn.operator } }
    });

    const catObj = await prisma.serviceCategory.findFirst({
      where: { code: "RECHARGE" }
    });

    if (!opObj || !catObj) {
      console.error(`[SHADOW_VALIDATION] Failed to run shadow validation for Txn #${txn.id}: Operator or RECHARGE category not found.`);
      return;
    }

    // Mock request and response to run simulateCommission controller
    const req = {
      body: {
        userId: txn.userId,
        operatorId: opObj.id,
        serviceCategoryId: catObj.id,
        amount: Number(txn.amount)
      }
    };

    const res = {
      statusCode: 200,
      status: function (code) {
        this.statusCode = code;
        return this;
      },
      json: function (obj) {
        this.data = obj;
        return this;
      }
    };

    // Run simulator logic (safe and read-only)
    await simulateCommission(req, res);

    if (res.statusCode !== 200 || !res.data?.success) {
      // Mismatch because simulator failed to resolve rules
      await prisma.commissionShadowValidation.create({
        data: {
          transactionId: txn.id,
          userId: txn.userId,
          operatorId: opObj.id,
          amount: txn.amount,
          legacyResult: {
            commission: Number(txn.commission),
            profit: Number(txn.profit),
            fee: 0.0,
            surcharge: 0.0,
            finalEarnings: Number((Number(txn.commission) - Number(txn.profit)).toFixed(4))
          },
          simulatorResult: {},
          isMatch: false,
          mismatchReason: "RULE_NOT_FOUND"
        }
      });
      return;
    }

    const simData = res.data.data;
    
    // Legacy/Production values
    const prodComm = Number(txn.commission);
    const prodProfit = Number(txn.profit);
    const prodFee = 0.0;
    const prodSurcharge = 0.0;
    const prodEarnings = Number((prodComm - prodProfit).toFixed(4));

    // Simulated values
    const simComm = Number(simData.financials.commission);
    const simProfit = Number(simData.financials.profit);
    const simFee = Number(simData.financials.fee);
    const simSurcharge = Number(simData.financials.surcharge);
    const simEarnings = Number((simComm - simProfit).toFixed(4));

    // Match comparisons using 4-decimal normalization (Correction 1)
    const commMatch = normalize(simComm) === normalize(prodComm);
    const profitMatch = normalize(simProfit) === normalize(prodProfit);
    const feeMatch = normalize(simFee) === normalize(prodFee);
    const surchargeMatch = normalize(simSurcharge) === normalize(prodSurcharge);
    const earningsMatch = normalize(simEarnings) === normalize(prodEarnings);

    const isMatch = commMatch && profitMatch && feeMatch && surchargeMatch && earningsMatch;

    let mismatchReason = null;
    if (!isMatch) {
      const commDiff = simComm - prodComm;
      const profitDiff = simProfit - prodProfit;

      if (Math.abs(commDiff) <= 0.01 && Math.abs(profitDiff) <= 0.01) {
        mismatchReason = "ROUNDING";
      } else {
        const ruleSource = simData.resolutionPath?.ruleSource || "";
        const slabSource = simData.resolutionPath?.slabSource || "";
        
        if (ruleSource.includes('RANGE_RULE')) {
          if (simData.winningRule?.mode === 'REAL') {
            mismatchReason = 'MODE_PRIORITY';
          } else {
            mismatchReason = 'RANGE_MISMATCH';
          }
        } else if (ruleSource.includes('RECHARGE_RULE')) {
          mismatchReason = 'RECHARGE_MISMATCH';
        } else if (ruleSource.includes('LEGACY_RULE')) {
          mismatchReason = 'LEGACY_RULE_USED';
        } else if (ruleSource.includes('DEFAULT_FALLBACK')) {
          mismatchReason = 'RULE_NOT_FOUND';
        } else if (slabSource === 'USER_SLAB_OVERRIDE' || slabSource === 'MANUAL_SLAB_OVERRIDE') {
          mismatchReason = 'SLAB_OVERRIDE';
        } else if (slabSource === 'PACKAGE_SLAB_RESOLUTION') {
          mismatchReason = 'PACKAGE_MAPPING';
        } else {
          mismatchReason = 'UNKNOWN';
        }
      }
    }

    // Save comparison telemetry
    await prisma.commissionShadowValidation.create({
      data: {
        transactionId: txn.id,
        userId: txn.userId,
        operatorId: opObj.id,
        amount: txn.amount,
        legacyResult: {
          commission: prodComm,
          profit: prodProfit,
          fee: prodFee,
          surcharge: prodSurcharge,
          finalEarnings: prodEarnings
        },
        simulatorResult: {
          commission: simComm,
          profit: simProfit,
          fee: simFee,
          surcharge: simSurcharge,
          finalEarnings: simEarnings,
          ruleSource: simData.resolutionPath?.ruleSource,
          slabSource: simData.resolutionPath?.slabSource,
          winningRuleId: simData.winningRule?.id
        },
        isMatch,
        mismatchReason
      }
    });

    console.log(`[SHADOW_VALIDATION] Telemetry logged for Txn #${txn.id}. Match: ${isMatch}`);
  } catch (error) {
    console.error(`[SHADOW_VALIDATION_ERROR] Failed to run validation on transaction #${transactionId}:`, error.message);
  }
};

// EventBus Listener registration for successful recharges (asynchronous fire-and-forget)
eventBus.on("recharge_success", (data) => {
  setImmediate(async () => {
    try {
      console.log(`[SHADOW_VALIDATION_TRIGGERED] Txn: ${data.transactionId}`);
      await runShadowValidation(data.transactionId);
    } catch (err) {
      console.error("[SHADOW_VALIDATION] Event handler failure:", err.message);
    }
  });
});
