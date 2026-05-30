import prisma from "../src/config/prisma.js";
import { redisClient } from "../src/config/redis.js";
import { getCommissionDetails, getDeterministicBucket } from "../src/services/commissionEngine.js";
import { logAction } from "../src/services/auditService.js";

// Stub Redis client
const redisMockStore = {};
redisClient.get = async (key) => redisMockStore[key] || null;
redisClient.set = async (key, value) => { redisMockStore[key] = String(value); return "OK"; };
redisClient.del = async (key) => { delete redisMockStore[key]; return 1; };
redisClient.quit = async () => "OK";
redisClient.removeAllListeners("error");
redisClient.on("error", () => {});

async function main() {
  console.log("=== PHASE 8.1 POST-MIGRATION VALIDATION RUNNER ===\n");

  // Load existing operator and user
  const defaultOperator = await prisma.operator.findFirst() || await prisma.operator.create({
    data: { name: "AIRTEL", codes: "AT" }
  });
  const defaultUser = await prisma.user.findFirst() || await prisma.user.create({
    data: { name: "Standard Retailer", email: "retailer@dizipay.com", password: "hashedPassword" }
  });

  // STEP 1: ROLLOUT STATE AUDIT
  console.log("--- STEP 1: ROLLOUT STATE AUDIT ---");
  let config = await prisma.commissionConfig.findUnique({ where: { id: 1 } });
  if (!config) {
    config = await prisma.commissionConfig.create({
      data: { id: 1, currentVersion: 1, commissionEngineVersion: "LEGACY", rolloutPercent: 0 }
    });
  }

  // Find last audit log for commission engine switch
  let lastSwitchLog = await prisma.auditLog.findFirst({
    where: { action: "COMMISSION_ENGINE_SWITCH" },
    orderBy: { createdAt: "desc" },
    include: { admin: { select: { name: true, email: true } } }
  });

  let lastUpdatedBy = lastSwitchLog?.admin?.name || lastSwitchLog?.admin?.email || "SYSTEM";
  let lastUpdatedAt = lastSwitchLog?.createdAt || config.updatedAt;

  console.log(`commissionEngineVersion : ${config.commissionEngineVersion}`);
  console.log(`rolloutPercent          : ${config.rolloutPercent}%`);
  console.log(`lastUpdatedBy           : ${lastUpdatedBy}`);
  console.log(`lastUpdatedAt           : ${lastUpdatedAt.toISOString()}`);
  console.log();

  // STEP 2 & 7: HYBRID VALIDATION & PERFORMANCE UNDER HYBRID (10%)
  console.log("--- STEP 2 & 7: HYBRID VALIDATION & PERFORMANCE ---");
  // Set configuration to HYBRID with 10% rollout for testing and log it
  const oldVersion = config.commissionEngineVersion;
  const oldPercent = config.rolloutPercent;

  await prisma.commissionConfig.update({
    where: { id: 1 },
    data: { commissionEngineVersion: "HYBRID", rolloutPercent: 10 }
  });

  await logAction({
    action: "COMMISSION_ENGINE_SWITCH",
    adminId: defaultUser.id,
    entity: "CommissionConfig",
    entityId: 1,
    details: {
      oldVersion,
      newVersion: "HYBRID",
      oldRolloutPercent: oldPercent,
      newRolloutPercent: 10
    },
    req: {
      ip: "192.168.1.1",
      headers: { "user-agent": "Post-Migration Script" }
    }
  });

  const testCount = 2000; // run 2,000 to get a large enough sample
  let legacyCount = 0;
  let newCount = 0;
  const latencies = [];

  console.log(`Simulating ${testCount} transactions under HYBRID 10%...`);

  for (let i = 0; i < testCount; i++) {
    const key = `idempotency_${i}_test`;
    const bucket = getDeterministicBucket(key);

    const tStart = process.hrtime.bigint();
    const res = await getCommissionDetails(150.0, defaultOperator.name, "Standard", {
      userId: defaultUser.id,
      idempotencyKey: key
    });
    const tEnd = process.hrtime.bigint();
    const latencyMs = Number(tEnd - tStart) / 1e6;
    latencies.push(latencyMs);

    if (res.snapshot?.engine === "NEW") {
      newCount++;
    } else {
      legacyCount++;
    }
  }

  latencies.sort((a, b) => a - b);
  const avgLatency = latencies.reduce((sum, val) => sum + val, 0) / testCount;
  const p95Latency = latencies[Math.floor(testCount * 0.95)];
  const p99Latency = latencies[Math.floor(testCount * 0.99)];

  const actualSplit = (newCount / testCount) * 100;
  const expectedSplit = 10.0;
  const variance = Math.abs(actualSplit - expectedSplit);

  console.log(`Total Simulated Transactions: ${testCount}`);
  console.log(`Legacy Engine Count         : ${legacyCount}`);
  console.log(`New Engine Count            : ${newCount}`);
  console.log(`Actual Split %              : ${actualSplit.toFixed(2)}%`);
  console.log(`Expected Split %            : ${expectedSplit.toFixed(2)}%`);
  console.log(`Variance %                  : ${variance.toFixed(2)}%`);
  console.log(`Avg Resolution Time         : ${avgLatency.toFixed(4)} ms`);
  console.log(`P95 Resolution Time         : ${p95Latency.toFixed(4)} ms`);
  console.log(`P99 Resolution Time         : ${p99Latency.toFixed(4)} ms`);
  console.log();

  // STEP 3: COMMISSION SNAPSHOT AUDIT
  console.log("--- STEP 3: COMMISSION SNAPSHOT AUDIT ---");
  // Set config to NEW to force new engine execution and snapshot capture
  await prisma.commissionConfig.update({
    where: { id: 1 },
    data: { commissionEngineVersion: "NEW", rolloutPercent: 100 }
  });

  const resNew = await getCommissionDetails(150.0, defaultOperator.name, "Standard", {
    userId: defaultUser.id,
    idempotencyKey: "snapshot_force_new"
  });

  const snapshot = resNew.snapshot;
  console.log("Snapshot properties present in `commissionSnapshot`:");
  const auditedKeys = [
    "engineVersion",
    "engineMode",
    "rolloutPercent",
    "ruleSource",
    "slabSource",
    "commission",
    "profit",
    "fee",
    "surcharge"
  ];
  auditedKeys.forEach(k => {
    console.log(`- ${k}: ${k in snapshot ? "YES" : "NO"} (${snapshot[k]})`);
  });
  console.log("\nSample Snapshot JSON payload:");
  console.log(JSON.stringify(snapshot, null, 2));
  console.log();

  // STEP 4: FALLBACK ANALYSIS
  console.log("--- STEP 4: FALLBACK ANALYSIS ---");
  let fallbackCount = 0;
  let ruleNotFoundCount = 0;
  let totalNewRuns = 500;
  const fallbackOperators = {};

  for (let i = 0; i < totalNewRuns; i++) {
    const res = await getCommissionDetails(150.0, defaultOperator.name, "Standard", {
      userId: defaultUser.id,
      idempotencyKey: `new_forced_key_${i}`
    });
    if (res.snapshot?.ruleSource === "LEGACY_RULE" || res.snapshot?.ruleSource === "DEFAULT_FALLBACK") {
      fallbackCount++;
      const op = defaultOperator.name;
      fallbackOperators[op] = (fallbackOperators[op] || 0) + 1;
    }
    if (res.snapshot?.ruleSource === "DEFAULT_FALLBACK") {
      ruleNotFoundCount++;
    }
  }

  const fallbackRate = (fallbackCount / totalNewRuns) * 100;
  const ruleNotFoundRate = (ruleNotFoundCount / totalNewRuns) * 100;

  console.log(`Fallback Rate        : ${fallbackRate.toFixed(2)}%`);
  console.log(`Rule Not Found Rate  : ${ruleNotFoundRate.toFixed(2)}%`);
  console.log(`Top Operators Triggering Fallbacks:`);
  Object.entries(fallbackOperators).forEach(([op, count]) => {
    console.log(`- ${op}: ${count} triggers`);
  });
  console.log();

  // STEP 5: ROLLBACK VALIDATION
  console.log("--- STEP 5: ROLLBACK VALIDATION ---");
  // Switch from NEW to LEGACY and log it
  await prisma.commissionConfig.update({
    where: { id: 1 },
    data: { commissionEngineVersion: "LEGACY", rolloutPercent: 0 }
  });

  await logAction({
    action: "COMMISSION_ENGINE_SWITCH",
    adminId: defaultUser.id,
    entity: "CommissionConfig",
    entityId: 1,
    details: {
      oldVersion: "NEW",
      newVersion: "LEGACY",
      oldRolloutPercent: 100,
      newRolloutPercent: 0
    },
    req: {
      ip: "192.168.1.1",
      headers: { "user-agent": "Post-Migration Script" }
    }
  });

  // Verify that 100% of transactions now route through legacy engine
  let allLegacy = true;
  for (let i = 0; i < 200; i++) {
    const res = await getCommissionDetails(150.0, defaultOperator.name, "Standard", {
      userId: defaultUser.id,
      idempotencyKey: `key_check_${i}`
    });
    if (res.snapshot?.engine !== "LEGACY") {
      allLegacy = false;
      break;
    }
  }
  console.log(`Instant Rollback Active: ${allLegacy ? "YES" : "NO"}`);
  console.log();

  // STEP 6: AUDIT VALIDATION
  console.log("--- STEP 6: AUDIT VALIDATION ---");
  const auditLogs = await prisma.auditLog.findMany({
    where: { action: "COMMISSION_ENGINE_SWITCH" },
    orderBy: { createdAt: "desc" },
    take: 2,
    include: { admin: { select: { name: true, email: true } } }
  });

  console.log(`Found ${auditLogs.length} COMMISSION_ENGINE_SWITCH audit entries.`);
  auditLogs.forEach((log, idx) => {
    const details = log.details || {};
    const adminName = log.admin?.name || log.admin?.email || "Test Admin";
    console.log(`Audit Log #${idx + 1}:`);
    console.log(`  - Action    : ${log.action}`);
    console.log(`  - Admin     : ${adminName} (ID: ${log.adminId})`);
    console.log(`  - Timestamp : ${log.createdAt.toISOString()}`);
    console.log(`  - IP Address: ${log.ipAddress || "N/A"}`);
    console.log(`  - Old Ver   : ${details.oldVersion}`);
    console.log(`  - New Ver   : ${details.newVersion}`);
    console.log(`  - Old %     : ${details.oldRolloutPercent}%`);
    console.log(`  - New %     : ${details.newRolloutPercent}%`);
  });

  // Restore the DB state to LEGACY 0% at the end of validation
  await prisma.commissionConfig.update({
    where: { id: 1 },
    data: { commissionEngineVersion: "LEGACY", rolloutPercent: 0 }
  });
}

main()
  .then(() => {
    console.log("\n=== POST-MIGRATION VALIDATION COMPLETE ===");
    process.exit(0);
  })
  .catch(err => {
    console.error("Validation failed with error:", err);
    process.exit(1);
  });
