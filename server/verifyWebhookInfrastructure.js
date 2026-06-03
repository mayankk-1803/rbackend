import prisma from "./src/config/prisma.js";
import { dispatchWebhook, requeueWebhook } from "./src/services/apiMarketplaceService.js";

async function main() {
  console.log("=== STARTING WEBHOOK INFRASTRUCTURE VERIFICATION ===");

  try {
    const clientId = 1002;
    const url = "http://mock-webhook-target.com/callback";
    const secret = "super_secret_webhook_signing_key";

    console.log("[TEST 1] Seeding active client webhook configuration...");
    await prisma.apiWebhook.deleteMany({ where: { clientId } }); // clean state
    const webhook = await prisma.apiWebhook.create({
      data: {
        clientId,
        url,
        secret,
        events: JSON.stringify(["transaction.success", "transaction.failed"])
      }
    });

    console.log("[TEST 2] Dispatching signed webhook payload...");
    const payload = { transactionId: 55443, status: "SUCCESS", amount: 150.0 };
    await dispatchWebhook(clientId, "transaction.success", payload);
    console.log("✔ Dispatch triggered.");

    // Query logs
    const log = await prisma.apiWebhookLog.findFirst({
      where: { webhookId: webhook.id }
    });

    if (!log) {
      throw new Error("Webhook dispatch failed to generate delivery logs.");
    }
    console.log(`✔ Webhook delivery logged (Log ID: ${log.id}, Status: ${log.deliveryStatus}, Payload: ${log.payload}).`);

    console.log("[TEST 3] Testing manual requeuing trigger...");
    await requeueWebhook(log.id);
    
    const requeuedLog = await prisma.apiWebhookLog.findUnique({
      where: { id: log.id }
    });

    if (requeuedLog.deliveryStatus !== "REQUEUED" && requeuedLog.deliveryStatus !== "SUCCESS") {
      throw new Error(`Webhook manual requeue failed (Current status: ${requeuedLog.deliveryStatus}).`);
    }
    console.log("✔ Manual requeuing triggered successfully.");

    console.log("✔ ALL WEBHOOK INFRASTRUCTURE TESTS PASSED!");
  } catch (err) {
    console.error("❌ WEBHOOK INFRASTRUCTURE VERIFICATION FAILED:", err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
