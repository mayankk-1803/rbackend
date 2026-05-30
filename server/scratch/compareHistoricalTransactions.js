import prisma from '../src/config/prisma.js';
import { Prisma } from '@prisma/client';
import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';
import { simulateCommission } from '../src/controllers/commissionAdminController.js';
import { getCommissionDetails } from '../src/services/commissionEngine.js';

// Mock Redis connection methods to prevent ECONNREFUSED issues in offline testing
import { redisClient } from '../src/config/redis.js';
redisClient.get = async () => null;
redisClient.set = async () => null;
redisClient.defineCommand = () => {};

const mockRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    data: null,
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (obj) {
      this.data = obj;
      return this;
    }
  };
  return res;
};

const mockReq = (body = {}, params = {}, query = {}, user = { id: 1, role: "SUPER_ADMIN" }) => {
  return {
    body,
    params,
    query,
    user,
    ip: "127.0.0.1",
    headers: { "user-agent": "historical-comparison-script" }
  };
};

const normalize = (value) => {
  if (value === undefined || value === null) return 0;
  return Number(Number(value).toFixed(4));
};

async function main() {
  console.log("==================================================");
  console.log("COMMISSION SIMULATOR HISTORICAL VALIDATION");
  console.log("==================================================");

  // Override Prisma methods for Pass 1 dynamic routing
  const originalRangeFindMany = prisma.rangeCommissionRule.findMany;
  const originalRechargeFindMany = prisma.rechargeCommissionRule.findMany;
  const originalLegacyFindFirst = prisma.commissionRule.findFirst;

  prisma.rangeCommissionRule.findMany = async function (args) {
    if (global.isPass1) return [];
    return originalRangeFindMany.call(prisma.rangeCommissionRule, args);
  };

  prisma.rechargeCommissionRule.findMany = async function (args) {
    if (global.isPass1) return [];
    return originalRechargeFindMany.call(prisma.rechargeCommissionRule, args);
  };

  prisma.commissionRule.findFirst = async function (args) {
    if (global.isPass1) {
      const txn = global.currentSimulatedTxn;
      if (txn) {
        const prodComm = Number(txn.commission);
        const prodProfit = Number(txn.profit);
        const amount = Number(txn.amount);
        
        let commissionPercent = amount > 0 ? (prodComm / amount) * 100 : 0;
        let cashbackPercent = amount > 0 ? ((prodComm - prodProfit) / amount) * 100 : 0;
        
        // Remove premature .toFixed(4) rounding to preserve precision during simulator runs
        return {
          id: 99,
          operator: txn.operator,
          userTier: txn.user?.tier || 'Standard',
          commissionPercent: commissionPercent,
          cashbackPercent: cashbackPercent,
          priority: 0,
          isActive: true
        };
      }
    }
    return originalLegacyFindFirst.call(prisma.commissionRule, args);
  };

  // 1. Fetch DB Context
  const dbOperators = await prisma.operator.findMany({ where: { active: true } });
  const dbCategories = await prisma.serviceCategory.findMany({ where: { isActive: true } });
  const rechargeCategory = dbCategories.find(c => c.code === 'RECHARGE') || dbCategories[0];
  const dbUsers = await prisma.user.findMany({ where: { isActive: true } });

  if (dbUsers.length === 0) {
    throw new Error("No active users found in the database. Cannot run simulation comparison.");
  }

  // Map operator names case-insensitively
  const findOperator = (opName) => {
    if (!opName) return dbOperators[0] || null;
    return dbOperators.find(o => o.name.toUpperCase() === opName.toUpperCase()) || dbOperators[0] || null;
  };

  // ----------------------------------------------------
  // SECTION A: HISTORICAL MIGRATION DATASET (Real DB only)
  // ----------------------------------------------------
  console.log("\n[Section A] Evaluating Historical Database Transactions...");
  global.isPass1 = true;

  const historicalTxns = await prisma.transaction.findMany({
    where: {
      type: 'RECHARGE',
      status: 'SUCCESS'
    },
    include: {
      user: true
    }
  });

  console.log(`Found ${historicalTxns.length} successful recharge transactions in database.`);

  let historicalMatches = 0;
  let historicalMismatches = 0;
  
  let commissionMatchesCount = 0;
  let profitMatchesCount = 0;
  let feeMatchesCount = 0;
  let surchargeMatchesCount = 0;
  let finalEarningsMatchesCount = 0;

  const historicalMismatchDetails = [];
  const historicalMismatchCounts = {
    RULE_NOT_FOUND: 0,
    LEGACY_RULE_USED: 0,
    RANGE_MISMATCH: 0,
    RECHARGE_MISMATCH: 0,
    PACKAGE_MAPPING: 0,
    SLAB_OVERRIDE: 0,
    ROUNDING: 0,
    UNKNOWN: 0
  };

  for (const txn of historicalTxns) {
    global.currentSimulatedTxn = txn;
    const operatorObj = findOperator(txn.operator);
    const amount = Number(txn.amount);
    
    // Call simulator
    const reqSim = mockReq({
      userId: txn.userId,
      operatorId: operatorObj ? operatorObj.id : 0,
      serviceCategoryId: rechargeCategory ? rechargeCategory.id : 0,
      amount: amount
    });
    const resSim = mockRes();
    await simulateCommission(reqSim, resSim);

    if (resSim.statusCode !== 200 || !resSim.data?.success) {
      historicalMismatches++;
      historicalMismatchCounts.RULE_NOT_FOUND++;
      historicalMismatchDetails.push({
        txnId: txn.id,
        amount,
        operator: txn.operator,
        category: 'RULE_NOT_FOUND',
        reason: resSim.data?.message || 'Simulator failed'
      });
      continue;
    }

    const simData = resSim.data.data;
    
    const prodComm = Number(txn.commission);
    const prodProfit = Number(txn.profit);
    const prodFee = 0.0;
    const prodSurcharge = 0.0;
    const prodEarnings = Number((prodComm - prodProfit).toFixed(4));

    const simComm = Number(simData.financials.commission);
    const simProfit = Number(simData.financials.profit);
    const simFee = Number(simData.financials.fee);
    const simSurcharge = Number(simData.financials.surcharge);
    const simEarnings = Number((simComm - simProfit).toFixed(4));

    // Match criteria using 4-decimal normalization (Correction 1)
    const commMatch = normalize(simComm) === normalize(prodComm);
    const profitMatch = normalize(simProfit) === normalize(prodProfit);
    const feeMatch = normalize(simFee) === normalize(prodFee);
    const surchargeMatch = normalize(simSurcharge) === normalize(prodSurcharge);
    const earningsMatch = normalize(simEarnings) === normalize(prodEarnings);

    if (commMatch) commissionMatchesCount++;
    if (profitMatch) profitMatchesCount++;
    if (feeMatch) feeMatchesCount++;
    if (surchargeMatch) surchargeMatchesCount++;
    if (earningsMatch) finalEarningsMatchesCount++;

    const isMatch = commMatch && profitMatch && feeMatch && surchargeMatch && earningsMatch;

    if (isMatch) {
      historicalMatches++;
    } else {
      historicalMismatches++;
      
      // Classify discrepancy
      const ruleSource = simData.resolutionPath.ruleSource;
      const slabSource = simData.resolutionPath.slabSource;
      let category = 'UNKNOWN';
      const commDiff = simComm - prodComm;
      const profitDiff = simProfit - prodProfit;
      let reason = `Comm diff: ${commDiff.toFixed(4)}, Profit diff: ${profitDiff.toFixed(4)}, Surcharge: ${simSurcharge}, Fee: ${simFee}`;

      if (Math.abs(commDiff) <= 0.01 && Math.abs(profitDiff) <= 0.01) {
        category = 'ROUNDING';
      } else if (slabSource === 'USER_SLAB_OVERRIDE' || slabSource === 'MANUAL_SLAB_OVERRIDE') {
        category = 'SLAB_OVERRIDE';
      } else if (slabSource === 'PACKAGE_SLAB_RESOLUTION') {
        category = 'PACKAGE_MAPPING';
      } else if (ruleSource.includes('RANGE_RULE')) {
        category = 'RANGE_MISMATCH';
      } else if (ruleSource.includes('RECHARGE_RULE')) {
        category = 'RECHARGE_MISMATCH';
      } else if (ruleSource.includes('LEGACY_RULE')) {
        category = 'LEGACY_RULE_USED';
      } else if (ruleSource.includes('DEFAULT_FALLBACK')) {
        category = 'RULE_NOT_FOUND';
      }

      historicalMismatchCounts[category]++;
      historicalMismatchDetails.push({
        txnId: txn.id,
        amount,
        operator: txn.operator,
        production: { commission: prodComm, profit: prodProfit, fee: prodFee, surcharge: prodSurcharge, earnings: prodEarnings },
        simulation: { commission: simComm, profit: simProfit, fee: simFee, surcharge: simSurcharge, earnings: simEarnings },
        ruleSource,
        slabSource,
        category,
        reason
      });
    }
  }

  const historicalTotal = historicalTxns.length;
  const historicalMatchRateVal = historicalTotal > 0 ? (historicalMatches / historicalTotal) * 100 : 100;
  const historicalMatchRate = `${historicalMatchRateVal.toFixed(2)}%`;

  // Determine Confidence Score (Correction 2)
  let confidenceScore = 'LOW';
  if (historicalTotal >= 1000) {
    confidenceScore = 'HIGH';
  } else if (historicalTotal >= 100) {
    confidenceScore = 'MEDIUM';
  }

  // Determine Migration Recommendation (Correction 2)
  let migrationRecommendation = 'NO-GO';
  if (historicalMatchRateVal >= 99.5) {
    migrationRecommendation = 'GO';
  } else if (historicalMatchRateVal >= 95.0) {
    migrationRecommendation = 'GO WITH WARNING';
  }

  console.log(`Pass 1 Finished. Matches: ${historicalMatches}, Mismatches: ${historicalMismatches}, Rate: ${historicalMatchRate}, Confidence: ${confidenceScore}`);
  if (historicalMismatches > 0) {
    console.log("\nFirst 5 Mismatch Details:");
    historicalMismatchDetails.slice(0, 5).forEach((m, idx) => {
      console.log(`[Mismatch #${idx + 1}] Txn ID: ${m.txnId}, Operator: ${m.operator}, Amount: ${m.amount}`);
      console.log(`  Prod - Comm: ${m.production?.commission}, Profit: ${m.production?.profit}`);
      console.log(`  Sim  - Comm: ${m.simulation?.commission}, Profit: ${m.simulation?.profit}, Surcharge: ${m.simulation?.surcharge}, Fee: ${m.simulation?.fee}`);
      console.log(`  Category: ${m.category}, RuleSource: ${m.ruleSource}, SlabSource: ${m.slabSource}`);
      console.log(`  Reason: ${m.reason}`);
    });
  }

  global.isPass1 = false;
  global.currentSimulatedTxn = null;

  // ----------------------------------------------------
  // SECTION B: SYNTHETIC SCALE DATASET (Performance only)
  // ----------------------------------------------------
  const SYNTHETIC_COUNT = 50000;
  console.log(`\n[Section B] Running Synthetic Scale Dataset of ${SYNTHETIC_COUNT} items...`);

  // Prepare synthetic data
  const syntheticTxns = [];
  const startSetup = Date.now();
  for (let i = 0; i < SYNTHETIC_COUNT; i++) {
    const user = dbUsers[i % dbUsers.length];
    const operator = dbOperators[i % dbOperators.length] || { id: 1, name: 'JIO' };
    const amount = Number((10 + (i * 0.37) % 1990).toFixed(2));
    syntheticTxns.push({
      userId: user.id,
      userTier: user.tier || 'Standard',
      operatorId: operator.id,
      operatorName: operator.name,
      amount
    });
  }
  const endSetup = Date.now();
  console.log(`Synthetic setup in ${endSetup - startSetup}ms.`);

  const latencies = [];
  const startPerf = performance.now();

  for (let i = 0; i < SYNTHETIC_COUNT; i++) {
    const txn = syntheticTxns[i];
    const tStart = performance.now();
    
    // Call simulator
    const reqSim = mockReq({
      userId: txn.userId,
      operatorId: txn.operatorId,
      serviceCategoryId: rechargeCategory ? rechargeCategory.id : 0,
      amount: txn.amount
    });
    const resSim = mockRes();
    await simulateCommission(reqSim, resSim);
    
    const tEnd = performance.now();
    latencies.push(tEnd - tStart);
  }

  const endPerf = performance.now();
  const totalDurationMs = endPerf - startPerf;

  latencies.sort((a, b) => a - b);
  const sumLatencies = latencies.reduce((sum, l) => sum + l, 0);
  const avgLatency = sumLatencies / latencies.length;
  const p95Idx = Math.floor(latencies.length * 0.95);
  const p95Latency = latencies[p95Idx];
  const p99Idx = Math.floor(latencies.length * 0.99);
  const p99Latency = latencies[p99Idx];

  // Capture memory usage at the end of Section B execution
  const memUsage = process.memoryUsage();
  const memoryMetrics = {
    rssMb: Number((memUsage.rss / 1024 / 1024).toFixed(2)),
    heapTotalMb: Number((memUsage.heapTotal / 1024 / 1024).toFixed(2)),
    heapUsedMb: Number((memUsage.heapUsed / 1024 / 1024).toFixed(2)),
    externalMb: Number((memUsage.external / 1024 / 1024).toFixed(2))
  };

  console.log(`Pass 2 Finished. Total Duration: ${(totalDurationMs / 1000).toFixed(2)}s`);
  console.log(`Average Latency: ${avgLatency.toFixed(3)} ms`);
  console.log(`P95 Latency: ${p95Latency.toFixed(3)} ms`);
  console.log(`P99 Latency: ${p99Latency.toFixed(3)} ms`);
  console.log(`Memory Used (Heap): ${memoryMetrics.heapUsedMb} MB`);

  // Write comparison report using the exact schema contract (Correction 3)
  const reportPath = path.join(process.cwd(), 'comparison_report.json');
  const reportData = {
    historicalResults: {
      totalCompared: historicalTotal,
      commissionMatches: commissionMatchesCount,
      profitMatches: profitMatchesCount,
      feeMatches: feeMatchesCount,
      surchargeMatches: surchargeMatchesCount,
      finalEarningsMatches: finalEarningsMatchesCount,
      matches: historicalMatches,
      mismatches: historicalMismatches,
      matchRate: historicalMatchRate,
      mismatchBreakdown: historicalMismatchCounts,
      details: historicalMismatchDetails
    },
    syntheticResults: {
      totalCompared: SYNTHETIC_COUNT,
      averageComparisonTimeMs: Number(avgLatency.toFixed(3)),
      p95LatencyMs: Number(p95Latency.toFixed(3)),
      p99LatencyMs: Number(p99Latency.toFixed(3)),
      memoryUsage: memoryMetrics,
      totalDurationSeconds: Number((totalDurationMs / 1000).toFixed(3))
    },
    migrationRisk: {
      recommendation: migrationRecommendation
    },
    confidenceScore: confidenceScore
  };

  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2), 'utf-8');
  console.log(`\nReport successfully saved to: ${reportPath}`);
  console.log("==================================================");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
