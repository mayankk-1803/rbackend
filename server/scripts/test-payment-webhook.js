import IORedis from "ioredis";

// Mock IORedis prototype to isolate database checks and prevent connection closed errors
IORedis.prototype.get = async (key) => {
  return null;
};
IORedis.prototype.set = async (key, value, ...args) => {
  return "OK";
};
IORedis.prototype.del = async (key) => {
  return 1;
};
IORedis.prototype.multi = function() {
  const chain = {
    incr: () => chain,
    ttl: () => chain,
    exec: async () => [[null, 1], [null, 10]]
  };
  return chain;
};
IORedis.prototype.connect = async () => {};
IORedis.prototype.sendCommand = async () => {};

import prisma from "../src/config/prisma.js";
import eventBus from "../src/config/eventBus.js";
import { paymentWebhook } from "../src/controllers/paymentController.js";
import { Prisma } from "@prisma/client";
import crypto from "crypto";

async function runPaymentWebhookTests() {
  console.log("=== STARTING PAYMENT WEBHOOK INTEGRATION TESTS ===");

  // 1. Setup Test User and Wallet
  console.log("[TEST] Setting up test user and wallet...");
  let user = await prisma.user.findFirst({
    where: { email: "test_payment_webhook@dizipay.com" }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Test Payment User",
        email: "test_payment_webhook@dizipay.com",
        password: "testpassword123",
        phone: "9999911111",
        isPhoneVerified: true,
        isEmailVerified: true,
        role: "USER"
      }
    });
  }

  // Create Wallet and set balance to 0
  let wallet = await prisma.wallet.upsert({
    where: { userId: user.id },
    update: { balance: new Prisma.Decimal("0.00"), coinBalance: 0 },
    create: {
      userId: user.id,
      balance: new Prisma.Decimal("0.00"),
      coinBalance: 0,
      currency: "INR"
    }
  });

  console.log(`[TEST] Wallet balance initialized: ${wallet.balance}`);

  // Create helper to generate payment orders
  const createTestPayment = async (amount, intent = "TOPUP") => {
    return await prisma.payment.create({
      data: {
        userId: user.id,
        amount: new Prisma.Decimal(amount),
        status: "PENDING",
        intent: intent,
        gatewayTxnId: null,
        errorMessage: null,
        webhookReceived: false,
        idempotencyKey: `topup_key_${Date.now()}_${Math.random()}`
      }
    });
  };

  const createMockResponse = () => {
    return {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      }
    };
  };

  // ==========================================
  // SCENARIO 1: VALID SIGNATURE AND HEADERS
  // ==========================================
  console.log("\n--- SCENARIO 1: Valid Signature and standard Headers ---");
  const p1 = await createTestPayment(150.00);
  console.log(`[TEST] Created Payment ID: ${p1.id} | Amount: ${p1.amount}`);

  const expectedSecret = process.env.WEBHOOK_SECRET || "internal_secret";
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString("hex");
  const payload1 = {
    paymentId: p1.id,
    status: "SUCCESS",
    gatewayTxnId: "TXN_SUCCESS_1",
    amount: 150.00
  };
  
  const payloadString = timestamp + "." + nonce + "." + JSON.stringify(payload1);
  const signature = crypto.createHmac("sha256", expectedSecret).update(payloadString).digest("hex");

  const req1 = {
    method: "POST",
    headers: {
      "x-webhook-signature": signature,
      "x-webhook-timestamp": timestamp,
      "x-webhook-nonce": nonce
    },
    body: payload1,
    ip: "127.0.0.1"
  };

  const res1 = createMockResponse();
  await paymentWebhook(req1, res1);

  console.log(`[TEST] Webhook Response Status: ${res1.statusCode || 200} | Body:`, JSON.stringify(res1.body));

  // Verify DB state
  const updatedP1 = await prisma.payment.findUnique({ where: { id: p1.id } });
  console.log(`[TEST] Payment status: ${updatedP1.status} (Expected: SUCCESS)`);
  console.log(`[TEST] Payment gatewayTxnId: ${updatedP1.gatewayTxnId} (Expected: TXN_SUCCESS_1)`);

  const updatedW1 = await prisma.wallet.findUnique({ where: { userId: user.id } });
  console.log(`[TEST] User Wallet balance: ${updatedW1.balance} (Expected: 150.00)`);

  if (updatedP1.status !== "SUCCESS" || Number(updatedW1.balance) !== 150.00) {
    throw new Error("Scenario 1 Failed!");
  }

  // ==========================================
  // SCENARIO 2: CASE-INSENSITIVE HEADER CHECK (X-Webhook-Signature)
  // ==========================================
  console.log("\n--- SCENARIO 2: Case-Insensitive Header Extraction ---");
  const p2 = await createTestPayment(200.00);
  console.log(`[TEST] Created Payment ID: ${p2.id} | Amount: ${p2.amount}`);

  const timestamp2 = Date.now().toString();
  const nonce2 = crypto.randomBytes(16).toString("hex");
  const payload2 = {
    paymentId: p2.id,
    status: "SUCCESSFUL", // Alternative success status
    gatewayTxnId: "TXN_SUCCESS_2",
    amount: 200.00
  };

  const payloadString2 = timestamp2 + "." + nonce2 + "." + JSON.stringify(payload2);
  const signature2 = crypto.createHmac("sha256", expectedSecret).update(payloadString2).digest("hex");

  const req2 = {
    method: "POST",
    headers: {
      "X-Webhook-Signature": signature2, // Uppercased keys
      "X-Webhook-Timestamp": timestamp2,
      "X-Webhook-Nonce": nonce2
    },
    body: payload2,
    ip: "127.0.0.1"
  };

  const res2 = createMockResponse();
  await paymentWebhook(req2, res2);

  console.log(`[TEST] Webhook Response Status: ${res2.statusCode || 200}`);

  const updatedP2 = await prisma.payment.findUnique({ where: { id: p2.id } });
  console.log(`[TEST] Payment status: ${updatedP2.status} (Expected: SUCCESS)`);

  const updatedW2 = await prisma.wallet.findUnique({ where: { userId: user.id } });
  console.log(`[TEST] User Wallet balance: ${updatedW2.balance} (Expected: 350.00)`);

  if (updatedP2.status !== "SUCCESS" || Number(updatedW2.balance) !== 350.00) {
    throw new Error("Scenario 2 Failed!");
  }

  // ==========================================
  // SCENARIO 3: MISSING SECURITY HEADERS (PROACTIVE VERIFICATION / BYPASS BY DESIGN)
  // ==========================================
  console.log("\n--- SCENARIO 3: Missing Security Headers Validation (Bypass Safety) ---");
  const p3 = await createTestPayment(100.00);
  console.log(`[TEST] Created Payment ID: ${p3.id} | Amount: ${p3.amount}`);

  const payload3 = {
    order_id: p3.id.toString(), // NexGate uses order_id as string
    status: "SUCCESS",
    transaction_id: "TXN_SUCCESS_3",
    amount: "100.00"
  };

  // Completely omit signature headers
  const req3 = {
    method: "POST",
    headers: {}, // Empty headers
    body: payload3,
    ip: "127.0.0.1"
  };

  const res3 = createMockResponse();
  await paymentWebhook(req3, res3);

  console.log(`[TEST] Webhook Response Status: ${res3.statusCode || 200}`);

  const updatedP3 = await prisma.payment.findUnique({ where: { id: p3.id } });
  console.log(`[TEST] Payment status: ${updatedP3.status} (Expected: SUCCESS)`);

  const updatedW3 = await prisma.wallet.findUnique({ where: { userId: user.id } });
  console.log(`[TEST] User Wallet balance: ${updatedW3.balance} (Expected: 450.00)`);

  if (updatedP3.status !== "SUCCESS" || Number(updatedW3.balance) !== 450.00) {
    throw new Error("Scenario 3 Failed!");
  }

  // ==========================================
  // SCENARIO 4: STATUS NORMALIZATION & FAILED WEBHOOKS
  // ==========================================
  console.log("\n--- SCENARIO 4: Status Normalization ---");
  const p4 = await createTestPayment(50.00);
  console.log(`[TEST] Created Payment ID: ${p4.id}`);

  // Test "FAILED" maps properly to FAILED status in DB
  const req4 = {
    method: "POST",
    headers: {},
    body: {
      order_id: p4.id.toString(),
      status: "ERROR", // maps to FAILED
      transaction_id: "TXN_FAILED_4",
      message: "User cancelled transaction"
    },
    ip: "127.0.0.1"
  };

  const res4 = createMockResponse();
  await paymentWebhook(req4, res4);

  const updatedP4 = await prisma.payment.findUnique({ where: { id: p4.id } });
  console.log(`[TEST] Payment status: ${updatedP4.status} (Expected: FAILED)`);
  console.log(`[TEST] Error Message: ${updatedP4.errorMessage} (Expected: User cancelled transaction)`);

  const updatedW4 = await prisma.wallet.findUnique({ where: { userId: user.id } });
  console.log(`[TEST] User Wallet balance remains: ${updatedW4.balance} (Expected: 450.00)`);

  if (updatedP4.status !== "FAILED" || Number(updatedW4.balance) !== 450.00) {
    throw new Error("Scenario 4 Failed!");
  }

  // ==========================================
  // SCENARIO 5: REPLAY DUPLICATE PROTECTION
  // ==========================================
  console.log("\n--- SCENARIO 5: Duplicate/Replay Callback Protection ---");
  
  // Re-send success webhook for p3
  const res5 = createMockResponse();
  await paymentWebhook(req3, res5);

  console.log(`[TEST] Duplicate response code: ${res5.statusCode || 200}`);

  const updatedW5 = await prisma.wallet.findUnique({ where: { userId: user.id } });
  console.log(`[TEST] Wallet balance after duplicate hit: ${updatedW5.balance} (Expected: 450.00)`);

  if (Number(updatedW5.balance) !== 450.00) {
    throw new Error("Scenario 5 Failed: Wallet balance credited twice!");
  }

  console.log("\n=== ALL PAYMENT WEBHOOK SCENARIOS PASSED SUCCESSFULLY ===");
}

runPaymentWebhookTests()
  .catch(err => {
    console.error("[TEST FAILED]:", err);
    process.exit(1);
  })
  .finally(async () => {
    console.log("[TEST] Performing post-test cleanup...");
    const user = await prisma.user.findFirst({
      where: { email: "test_payment_webhook@dizipay.com" }
    });
    if (user) {
      // Find payments
      const payments = await prisma.payment.findMany({
        where: { userId: user.id }
      });
      const paymentIds = payments.map(p => p.id);

      await prisma.coinTransaction.deleteMany({ where: { userId: user.id } });
      await prisma.ledgerEntry.deleteMany({ where: { userId: user.id } });
      await prisma.transaction.deleteMany({ where: { userId: user.id } });
      await prisma.payment.deleteMany({ where: { userId: user.id } });

      const keys = paymentIds.flatMap(id => [`topup:${id}`, `imart:${id}`]);
      await prisma.idempotencyRecord.deleteMany({
        where: { key: { in: keys } }
      });

      await prisma.wallet.delete({ where: { userId: user.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    }
    await prisma.$disconnect();
    console.log("[TEST] Cleanup done. Disconnected.");
    process.exit(0);
  });
