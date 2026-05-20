import prisma from "../src/config/prisma.js";
import { redisClient } from "../src/config/redis.js";
import { setGlobalFreeze, getFreezeStatus } from "../src/services/freezeService.js";
import { recordFinancialEntry, recordCoinEntry } from "../src/services/ledgerService.js";

// Mock redis client in-memory
const redisMockStore = new Map();
redisClient.get = async (key) => redisMockStore.get(key) || null;
redisClient.set = async (key, val) => { redisMockStore.set(key, String(val)); return "OK"; };
redisClient.del = async (key) => { redisMockStore.delete(key); return 1; };
redisClient.quit = async () => {};

async function runTests() {
  console.log("=== STARTING FREEZE MODE TESTS ===");

  try {
    // 1. Initial State Check
    await setGlobalFreeze(null);
    let status = await getFreezeStatus();
    console.log("Initial global status:", status);
    if (status.isSoft || status.isHard) {
      throw new Error("System should not be frozen initially");
    }

    // Create a mock user if not exists
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          phone: "9999999999",
          password: "hashedpassword",
          role: "USER"
        }
      });
    }
    const userId = user.id;

    // Create wallet if not exists
    let wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId,
          balance: 1000,
          coinBalance: 500
        }
      });
    }

    // 2. Test Soft Freeze
    console.log("\n--- Testing Soft Freeze ---");
    await setGlobalFreeze("soft", "Suspicious volume");
    status = await getFreezeStatus(userId);
    console.log("Status under global soft freeze:", status);
    if (!status.isSoft || status.isHard) {
      throw new Error("System should be in soft freeze mode");
    }

    // Verify recharge debit (RECHARGE_DEBIT) is ALLOWED under soft freeze
    console.log("Testing recharge debit (allowed under soft freeze)...");
    const rechargeResult = await recordFinancialEntry({
      userId,
      amount: -100,
      type: "RECHARGE_DEBIT",
      description: "Test recharge allowed",
      allowNegative: false
    });
    console.log("Recharge debit result balanceAfter:", rechargeResult.balanceAfter.toString());

    // Verify cashback credit (CASHBACK_CREDIT) is BLOCKED under soft freeze
    console.log("Testing cashback credit (should be blocked)...");
    try {
      await recordFinancialEntry({
        userId,
        amount: 10,
        type: "CASHBACK_CREDIT",
        description: "Test cashback blocked"
      });
      throw new Error("Cashback credit should have been blocked by soft freeze");
    } catch (err) {
      console.log("Cashback successfully blocked:", err.message);
      if (err.code !== "ACCOUNT_SOFT_FROZEN") {
        throw new Error("Expected ACCOUNT_SOFT_FROZEN error code");
      }
    }

    // Verify coin entry is BLOCKED under soft freeze
    console.log("Testing coin entry (should be blocked)...");
    try {
      await recordCoinEntry({
        userId,
        amount: 5,
        type: "EARNED",
        description: "Test coin earn blocked"
      });
      throw new Error("Coin entry should have been blocked by soft freeze");
    } catch (err) {
      console.log("Coin entry successfully blocked:", err.message);
    }

    // 3. Test Hard Freeze
    console.log("\n--- Testing Hard Freeze ---");
    await setGlobalFreeze("hard", "Forensic check");
    status = await getFreezeStatus(userId);
    console.log("Status under global hard freeze:", status);
    if (!status.isHard) {
      throw new Error("System should be in hard freeze mode");
    }

    // Verify recharge debit is now BLOCKED under hard freeze
    console.log("Testing recharge debit (should be blocked)...");
    try {
      await recordFinancialEntry({
        userId,
        amount: -50,
        type: "RECHARGE_DEBIT",
        description: "Test recharge blocked"
      });
      throw new Error("Recharge debit should have been blocked by hard freeze");
    } catch (err) {
      console.log("Recharge debit successfully blocked:", err.message);
      if (err.code !== "ACCOUNT_FROZEN") {
        throw new Error("Expected ACCOUNT_FROZEN error code");
      }
    }

    // Clean up freeze state
    await setGlobalFreeze(null);
    console.log("\n=== ALL FREEZE MODE TESTS PASSED ===");
  } catch (error) {
    console.error("TEST FAILED:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await redisClient.quit();
  }
}

runTests();
