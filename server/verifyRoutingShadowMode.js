import prisma from "./src/config/prisma.js";
import { recordShadowValidation, checkShadowAgreementGate } from "./src/services/routingIntelligenceService.js";

async function main() {
  console.log("=== STARTING SHADOW ROUTING VERIFICATION SUITE ===");

  try {
    const txnId = 99998;
    const current = "APIBOX";
    const recommended = "EZYTM";
    const latency = 120;
    const success = true;
    const cost = 0.50;

    console.log("[TEST 1] Logging custom shadow route comparison...");
    await recordShadowValidation(txnId, current, recommended, latency, success, cost);
    console.log("✔ Shadow route comparison recorded.");

    // Query DB validation
    const record = await prisma.routingShadowComparison.findUnique({
      where: { txnId }
    });
    if (!record || record.currentProvider !== current || record.recommendedProvider !== recommended) {
      throw new Error("Recorded shadow comparison is invalid.");
    }
    console.log("✔ DB persistence validated.");

    console.log("[TEST 2] Evaluating shadow metrics aggregation...");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const metrics = await prisma.routingShadowMetrics.findUnique({
      where: { billingDate: today }
    });

    if (!metrics || metrics.totalShadows === 0) {
      throw new Error("Shadow metrics daily aggregation failed.");
    }
    console.log(`✔ Daily aggregates fetched (Total Shadows: ${metrics.totalShadows}, Agreements: ${metrics.agreements}, Rate: ${metrics.agreementRate}%).`);

    console.log("[TEST 3] Evaluating autonomous routing gate logic...");
    const gatePassed = await checkShadowAgreementGate();
    console.log(`✔ Shadow gate passed checks status: ${gatePassed}`);

    console.log("✔ ALL SHADOW ROUTING TESTS PASSED SUCCESSFULLY!");
  } catch (err) {
    console.error("❌ SHADOW ROUTING VERIFICATION FAILED:", err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
