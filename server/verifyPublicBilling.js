import prisma from "./src/config/prisma.js";
import featureFlags, { FLAGS } from "./src/services/featureFlagsService.js";
import { buyCredits, consumeCredits, generateInvoice, verifyBillingRolloutLevel, reconcileCreditWallet } from "./src/services/apiMarketplaceService.js";

async function main() {
  console.log("=== STARTING PUBLIC BILLING & RECONCILIATION VERIFICATION ===");

  try {
    // 1. Setup mock users
    let pilotUser = await prisma.user.findFirst({ where: { phone: "9111111111" } });
    if (!pilotUser) {
      pilotUser = await prisma.user.create({
        data: { phone: "9111111111", password: "mock" }
      });
    }

    let nonPilotUser = await prisma.user.findFirst({ where: { phone: "9222222222" } });
    if (!nonPilotUser) {
      nonPilotUser = await prisma.user.create({
        data: { phone: "9222222222", password: "mock" }
      });
    }

    // Setup ApiClient records
    await prisma.apiClient.upsert({
      where: { userId: pilotUser.id },
      update: { companyName: "DiziPay Pilot Customer Ltd" },
      create: { userId: pilotUser.id, companyName: "DiziPay Pilot Customer Ltd" }
    });

    await prisma.apiClient.upsert({
      where: { userId: nonPilotUser.id },
      update: { companyName: "Retail Customer B" },
      create: { userId: nonPilotUser.id, companyName: "Retail Customer B" }
    });

    // Seed ApiBillingConfig
    await prisma.apiBillingConfig.upsert({
      where: { id: 1 },
      update: { rolloutLevel: "PILOT_CUSTOMERS" },
      create: { id: 1, rolloutLevel: "PILOT_CUSTOMERS" }
    });

    await featureFlags.setFlag(FLAGS.API_MARKETPLACE_ENABLED, true);
    await featureFlags.setFlag(FLAGS.PUBLIC_API_BILLING, true);

    console.log("[TEST 1] Testing rollout tier authorization whitelisting...");
    const isPilotAllowed = await verifyBillingRolloutLevel(pilotUser.id);
    const isNonPilotAllowed = await verifyBillingRolloutLevel(nonPilotUser.id);

    if (!isPilotAllowed) throw new Error("Expected Pilot Customer to be authorized.");
    if (isNonPilotAllowed) throw new Error("Expected Non-Pilot Customer to be blocked under PILOT_CUSTOMERS rollout level.");
    console.log("✔ Customer rollout tier authorization verified.");

    console.log("[TEST 2] Testing credit consumption & continuous wallet reconciliation...");
    // Clear and buy credits
    await prisma.apiCreditWallet.deleteMany({ where: { userId: pilotUser.id } });
    await buyCredits(pilotUser.id, 500.00);

    // Setup mock api sub for consumption
    let prod = await prisma.apiProduct.findFirst();
    if (!prod) {
      prod = await prisma.apiProduct.create({
        data: { name: "Recharge API Service", code: "RECHARGE_API", description: "Mobile Recharges" }
      });
    }

    let plan = await prisma.apiPlan.findFirst({ where: { productId: prod.id } });
    if (!plan) {
      plan = await prisma.apiPlan.create({
        data: { productId: prod.id, name: "Premium Enterprise plan", price: 1000.00, requestsPerMinute: 100, requestsPerHour: 1000, requestsPerDay: 5000, costPerRequest: 0.10 }
      });
    }

    let sub = await prisma.apiSubscription.findFirst({ where: { clientId: pilotUser.id, planId: plan.id } });
    if (!sub) {
      sub = await prisma.apiSubscription.create({
        data: { clientId: pilotUser.id, planId: plan.id, status: "ACTIVE" }
      });
    }

    // Consume credits
    await consumeCredits(pilotUser.id, sub.id, 50.00);

    const wallet = await prisma.apiCreditWallet.findUnique({ where: { userId: pilotUser.id } });
    if (Number(wallet.balance) !== 450.00 || Number(wallet.usedCredits) !== 50.00) {
      throw new Error(`Wallet balance failed continuous consumption reconciliation. Balance: ₹${wallet.balance}, Used: ₹${wallet.usedCredits}`);
    }

    // Verify reconciliation loop passes
    const isReconciliationValid = await reconcileCreditWallet(pilotUser.id);
    if (!isReconciliationValid) throw new Error("Credit Wallet Reconciliation check failed under normal circumstances.");
    console.log("✔ Atomic credit wallet consumption and reconciliation loop holds perfectly.");

    console.log("[TEST 3] Testing continuous reconciliation discrepancy threat audit logging...");
    // Artificially corrupt wallet
    await prisma.apiCreditWallet.update({
      where: { userId: pilotUser.id },
      data: { usedCredits: 40.00 } // corrupts formula balance (450) + used (40) === 490 !== purchased (500)
    });

    const isReconciliationCorrupted = await reconcileCreditWallet(pilotUser.id);
    if (isReconciliationCorrupted) throw new Error("Continuous reconciliation should have failed on corrupted data.");

    // Verify threat entry logged
    const threat = await prisma.apiThreatLog.findFirst({
      where: { clientId: pilotUser.id, threatType: "RECONCILIATION_FAILURE" }
    });
    if (!threat) throw new Error("Threat alert log was not generated for reconciliation failure.");
    console.log(`- Threat Alert verified: severity ${threat.severity} | details: "${threat.details}"`);
    console.log("✔ Continuous reconciliation engine correctly identified and audited wallet discrepancies.");

    console.log("[TEST 4] Testing Draft Invoicing Gate for Pilot customers...");
    const pilotInvoice = await generateInvoice(sub.id, 1500.00, "2026-06");
    if (pilotInvoice.status !== "DRAFT") {
      throw new Error(`Expected pilot invoice status to be DRAFT under PILOT_CUSTOMERS level, got: ${pilotInvoice.status}`);
    }
    console.log("✔ Pilot Customers draft invoicing gate verified (Status: DRAFT).");

    // Clean up config
    await prisma.apiBillingConfig.update({
      where: { id: 1 },
      data: { rolloutLevel: "FULL_PUBLIC" }
    });

    const publicInvoice = await generateInvoice(sub.id, 1500.00, "2026-06");
    if (publicInvoice.status !== "UNPAID") {
      throw new Error(`Expected standard public invoice status to be UNPAID, got: ${publicInvoice.status}`);
    }
    console.log("✔ Standard public customer final invoicing verified (Status: UNPAID).");

    console.log("✔ ALL PUBLIC BILLING ACTIVATION TESTS PASSED SUCCESSFULLY!");
  } catch (err) {
    console.error("❌ PUBLIC BILLING VERIFICATION FAILED:", err.message, err.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
