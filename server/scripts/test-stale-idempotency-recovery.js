import prisma from "../src/config/prisma.js";
import { redisClient } from "../src/config/redis.js";
import { claimIdempotencyKey } from "../src/utils/idempotency.js";

// Mock redis client in-memory
const redisMockStore = new Map();
redisClient.get = async (key) => redisMockStore.get(key) || null;
redisClient.set = async (key, val) => { redisMockStore.set(key, String(val)); return "OK"; };
redisClient.del = async (key) => { redisMockStore.delete(key); return 1; };
redisClient.quit = async () => {};

async function runTests() {
  console.log("=== STARTING STALE IDEMPOTENCY RECOVERY TESTS ===");

  try {
    const key = `idempotency_test_${Date.now()}`;
    const payload = { amount: 100, mobile: "9999999999" };

    // 1. Claim initially
    console.log("Claiming fresh key...");
    const claimedFirst = await claimIdempotencyKey(key, payload, undefined, 3600);
    if (!claimedFirst) throw new Error("Should have successfully claimed fresh key");
    console.log("Successfully claimed fresh key.");

    // 2. Claim again (should fail because not expired yet)
    console.log("Attempting to claim again while active...");
    const claimedSecond = await claimIdempotencyKey(key, payload, undefined, 3600);
    if (claimedSecond) throw new Error("Should not be able to claim active key");
    console.log("Correctly blocked active key reclamation.");

    // 3. Try to claim with modified payload (should throw mutated payload error)
    console.log("Attempting to claim with mutated payload...");
    try {
      const mutatedPayload = { amount: 200, mobile: "9999999999" };
      await claimIdempotencyKey(key, mutatedPayload, undefined, 3600);
      throw new Error("Should have thrown MUTATED_PAYLOAD error");
    } catch (err) {
      console.log("Correctly threw mutated payload error:", err.message);
      if (!err.message.includes("MUTATED_PAYLOAD")) {
        throw new Error("Unexpected error message: " + err.message);
      }
    }

    // 4. Force expiration of the key in DB
    console.log("Expiring the key in the database...");
    await prisma.idempotencyRecord.update({
      where: { key },
      data: { expiresAt: new Date(Date.now() - 5000) } // 5s in the past
    });

    // 5. Try to claim again (should succeed since it is expired/stale)
    console.log("Claiming expired key...");
    const claimedThird = await claimIdempotencyKey(key, payload, undefined, 3600);
    if (!claimedThird) throw new Error("Should have successfully claimed expired key");
    console.log("Successfully reclaimed expired/stale key.");

    // Clean up
    await prisma.idempotencyRecord.delete({ where: { key } });

    console.log("=== ALL STALE IDEMPOTENCY RECOVERY TESTS PASSED ===");
  } catch (error) {
    console.error("TEST FAILED:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await redisClient.quit();
  }
}

runTests();
