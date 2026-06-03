import prisma from "./src/config/prisma.js";
import featureFlags, { FLAGS } from "./src/services/featureFlagsService.js";
import { buyCredits, consumeCredits } from "./src/services/apiMarketplaceService.js";

async function main() {
  console.log("=== STARTING API WALLET BILLING VERIFICATION SUITE ===");

  try {
    // Enable marketplace
    await featureFlags.setFlag(FLAGS.API_MARKETPLACE_ENABLED, true);

    const user = await prisma.user.findFirst() || await prisma.user.create({
      data: { phone: "9876543211", password: "hash" }
    });

    console.log("[TEST 1] Creating wallet and buying credits...");
    await prisma.apiCreditWallet.deleteMany({ where: { userId: user.id } }); // reset state
    
    let wallet = await buyCredits(user.id, 500.00);
    if (Number(wallet.balance) !== 500.00 || Number(wallet.lifetimePurchased) !== 500.00) {
      throw new Error("Credit purchase wallet update is invalid.");
    }
    console.log(`✔ Credit purchase succeeded (Balance: ₹${wallet.balance}, Lifetime: ₹${wallet.lifetimePurchased}).`);

    console.log("[TEST 2] Consuming credits and verifying daily usage logs...");
    
    // Seed plan & subscription
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

    let sub = await prisma.apiSubscription.findFirst({ where: { clientId: user.id, planId: plan.id } });
    if (!sub) {
      sub = await prisma.apiSubscription.create({
        data: { clientId: user.id, planId: plan.id, status: "ACTIVE" }
      });
    }

    const costPerCall = 0.50;
    await consumeCredits(user.id, sub.id, costPerCall);

    let updatedWallet = await prisma.apiCreditWallet.findUnique({ where: { userId: user.id } });
    if (Number(updatedWallet.balance) !== 499.50 || Number(updatedWallet.usedCredits) !== 0.50) {
      throw new Error("Wallet credit consumption failed to reconcile atomically.");
    }
    console.log(`✔ Atomic consumption reconciled (New Balance: ₹${updatedWallet.balance}, Total Used: ₹${updatedWallet.usedCredits}).`);

    // Verify daily usage aggregations
    const usage = await prisma.apiUsageRecord.findFirst({
      where: { subscriptionId: sub.id }
    });

    if (!usage || usage.requests !== 1 || Number(usage.revenue) !== 0.50) {
      throw new Error("Daily usage record aggregation is invalid.");
    }
    console.log(`✔ Daily usage aggregation verified (Requests: ${usage.requests}, Daily Revenue: ₹${usage.revenue}).`);

    console.log("[TEST 3] Verifying insufficient credits lock limits...");
    try {
      // Consume more than balance
      await consumeCredits(user.id, sub.id, 600.00);
      throw new Error("Billing should have thrown an Insufficient Wallet Balance error.");
    } catch (err) {
      if (err.message.includes("Insufficient credit wallet balance")) {
        console.log("✔ Insufficient balance check locked calls correctly.");
      } else {
        throw err;
      }
    }

    console.log("✔ ALL API WALLET BILLING TESTS PASSED SUCCESSFULLY!");
  } catch (err) {
    console.error("❌ API WALLET BILLING VERIFICATION FAILED:", err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
