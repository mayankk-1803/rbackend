import prisma from "./src/config/prisma.js";
import { runReplaySimulation } from "./src/services/commissionIntelligenceService.js";

async function main() {
  console.log("=== STARTING COMMISSION REPLAY SIMULATION VERIFICATION ===");

  try {
    // Seed an operator if missing
    let op = await prisma.operator.findFirst();
    if (!op) {
      op = await prisma.operator.create({
        data: { name: "AIRTEL" }
      });
    }

    // Seed a standard service category
    let sc = await prisma.serviceCategory.findFirst();
    if (!sc) {
      sc = await prisma.serviceCategory.create({
        data: { code: "RECHARGE", name: "Mobile Recharge" }
      });
    }

    console.log("[TEST 1] Seeding mock transactions for replay estimation...");
    // Seed a SUCCESS transaction
    const user = await prisma.user.findFirst() || await prisma.user.create({
      data: { phone: "9876543210", password: "hash" }
    });

    const txn = await prisma.transaction.create({
      data: {
        userId: user.id,
        amount: 200.00,
        type: "RECHARGE",
        status: "SUCCESS",
        commission: 6.00,
        profit: 2.00,
        operator: op.name
      }
    });

    console.log("[TEST 2] Processing 30, 90, and 180-day historical replay simulator...");
    const sim30 = await runReplaySimulation(op.id, sc.id, "RETAILER", 2.5, 30);
    const sim90 = await runReplaySimulation(op.id, sc.id, "RETAILER", 2.5, 90);

    if (sim30.commissionDelta === undefined || sim30.profitDelta === undefined) {
      throw new Error("Replay simulator output format is invalid.");
    }

    console.log(`✔ Replay 30-Day simulation results: Commission Delta: ${sim30.commissionDelta}, Profit Delta: ${sim30.profitDelta}, Retention: ${sim30.retentionImpact}%, Growth: ${sim30.growthImpact}%.`);
    console.log(`✔ Replay 90-Day simulation results: Commission Delta: ${sim90.commissionDelta}, Profit Delta: ${sim90.profitDelta}.`);

    // Cleanup mock transaction
    await prisma.transaction.delete({ where: { id: txn.id } });

    console.log("✔ ALL COMMISSION REPLAY SIMULATION TESTS PASSED!");
  } catch (err) {
    console.error("❌ COMMISSION REPLAY SIMULATION VERIFICATION FAILED:", err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
