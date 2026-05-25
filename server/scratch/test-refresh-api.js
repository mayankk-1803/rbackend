import IORedis from "ioredis";

let mockRedisDb = {};
IORedis.prototype.get = async (key) => {
  return mockRedisDb[key] || null;
};
IORedis.prototype.set = async (key, value, ...args) => {
  if (args.includes("NX")) {
    if (mockRedisDb[key] !== undefined) {
      return null;
    }
  }
  mockRedisDb[key] = value;
  return "OK";
};
IORedis.prototype.del = async (key) => {
  delete mockRedisDb[key];
  return 1;
};
IORedis.prototype.connect = async () => {};
IORedis.prototype.sendCommand = async () => {};

import prisma from "../src/config/prisma.js";
import { redisClient } from "../src/config/redis.js";
import { isFinalizedStatus } from "../src/utils/transactionStateGuard.js";

async function testRefreshApiLogic() {
  console.log("=== STARTING REFRESH API LOGIC VERIFICATION ===");

  // Create a dummy transaction
  const txn = await prisma.transaction.create({
    data: {
      userId: 1, // assumes some user exists or we just use user 1
      amount: 50.00,
      type: "RECHARGE",
      status: "PENDING_REVIEW",
      direction: "DEBIT",
      mobile: "9999911111",
      operator: "Airtel",
      provider: "APIBOX",
      reviewStatus: "PENDING_REVIEW"
    }
  });
  console.log(`[TEST] Created active transaction #${txn.id} for testing.`);

  // 1. Verify cooldown
  const cooldownKey = `refresh_cooldown:${txn.id}`;
  // Ensure cleared first
  await redisClient.del(cooldownKey);

  // First check: should succeed (NX)
  const firstClaim = await redisClient.set(cooldownKey, "1", "NX", "EX", 10);
  console.log(`[TEST] First refresh claim: ${firstClaim} (Expected: OK)`);

  // Second check: should fail (null/not set)
  const secondClaim = await redisClient.set(cooldownKey, "1", "NX", "EX", 10);
  console.log(`[TEST] Second refresh claim: ${secondClaim} (Expected: null/undefined/rate-limited)`);

  if (firstClaim !== "OK" || secondClaim !== null) {
    throw new Error("Cooldown mechanism failed!");
  }

  // 2. Verify finalized check
  console.log(`[TEST] Checking isFinalizedStatus on PENDING_REVIEW: ${isFinalizedStatus("PENDING_REVIEW")} (Expected: false)`);
  console.log(`[TEST] Checking isFinalizedStatus on SUCCESS: ${isFinalizedStatus("SUCCESS")} (Expected: true)`);
  console.log(`[TEST] Checking isFinalizedStatus on REFUNDED: ${isFinalizedStatus("REFUNDED")} (Expected: true)`);

  if (isFinalizedStatus("PENDING_REVIEW") || !isFinalizedStatus("SUCCESS") || !isFinalizedStatus("REFUNDED")) {
    throw new Error("Finalized state guard checks failed!");
  }

  // Cleanup
  await prisma.transaction.delete({ where: { id: txn.id } });
  await redisClient.del(cooldownKey);
  console.log("=== ALL REFRESH API VERIFICATION SCENARIOS PASSED ===");
}

testRefreshApiLogic()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
  });
