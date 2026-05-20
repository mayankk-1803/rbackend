import prisma from "../src/config/prisma.js";
import { redisClient } from "../src/config/redis.js";
import { pushToDLQ, processDLQRetries } from "../src/services/dlqService.js";

// Mock redis client in-memory
const redisMockStore = new Map();
redisClient.get = async (key) => redisMockStore.get(key) || null;
redisClient.set = async (key, val) => { redisMockStore.set(key, String(val)); return "OK"; };
redisClient.del = async (key) => { redisMockStore.delete(key); return 1; };
redisClient.quit = async () => {};

async function runTests() {
  console.log("=== STARTING DLQ REPLAY TESTS ===");

  try {
    // 1. Push a failed event
    const uniqueKey = `dlq_test_${Date.now()}`;
    const payload = {
      transactionId: 999999, // A fake transaction ID
      idempotencyKey: uniqueKey
    };

    console.log("Pushing simulated failure to DLQ...");
    const entry = await pushToDLQ("WEBHOOK_FAILURE", payload, "Gateway timeout simulated");
    console.log("DLQ entry created:", entry.id, entry.status);

    // Verify it exists in DB
    const dbEntry = await prisma.dlqEntry.findUnique({ where: { id: entry.id } });
    if (!dbEntry) throw new Error("DLQ entry not persisted to database");
    console.log("DB status verified: FAILED");

    // 2. Mock a successful idempotency record to simulate a transaction that completed in the meantime
    console.log("Creating matching success idempotency record...");
    await prisma.idempotencyRecord.create({
      data: {
        key: uniqueKey,
        expiresAt: new Date(Date.now() + 60000),
        requestHash: "mockhash",
        status: "SUCCESS"
      }
    });

    // 3. Trigger retries (worker)
    console.log("Running DLQ retries process...");
    // Modify nextRetryAt so worker processes it immediately
    await prisma.dlqEntry.update({
      where: { id: entry.id },
      data: { nextRetryAt: new Date(Date.now() - 1000) }
    });

    await processDLQRetries();

    // 4. Verify that replay was blocked due to safety check
    const updatedEntry = await prisma.dlqEntry.findUnique({ where: { id: entry.id } });
    console.log("DLQ status after retry run:", updatedEntry.status);
    console.log("DLQ error after retry run:", updatedEntry.error);
    console.log("DLQ failureReason after retry run:", updatedEntry.failureReason);

    const errText = (updatedEntry.error || "") + " " + (updatedEntry.failureReason || "");
    if (updatedEntry.status !== "FAILED" || !errText.toLowerCase().includes("safety verification failed")) {
      throw new Error("Replay should have been blocked because of existing SUCCESS idempotency record");
    }

    console.log("Replay safety successfully blocked duplicate transaction execution.");

    // Clean up
    await prisma.dlqEntry.delete({ where: { id: entry.id } });
    await prisma.idempotencyRecord.delete({ where: { key: uniqueKey } });

    console.log("=== ALL DLQ REPLAY TESTS PASSED ===");
  } catch (error) {
    console.error("TEST FAILED:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await redisClient.quit();
  }
}

runTests();
