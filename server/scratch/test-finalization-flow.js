import axios from "axios";
import IORedis from "ioredis";
import { Queue as BullQueue } from "bullmq";

// 1. Mock Redis & BullMQ to avoid connection exceptions if Redis is offline
IORedis.prototype.get = async (key) => null;
IORedis.prototype.set = async (key, value, ...args) => "OK";
IORedis.prototype.del = async (key) => 1;
IORedis.prototype.connect = async () => {};
IORedis.prototype.sendCommand = async () => {};

BullQueue.prototype.getJobs = async () => [];
BullQueue.prototype.add = async () => ({ id: "mock-job-id" });

const mockConfig = {
  statusBehavior: "SUCCESS", // "SUCCESS" or "FAILED" or "PENDING"
};

// 2. Mock axios.create globally before importing nexgateService.js
const originalCreate = axios.create;
axios.create = function(config) {
  const instance = originalCreate.call(axios, {
    ...config,
    adapter: async (reqConfig) => {
      console.log(`[MOCK AXIOS ADAPTER] URL: ${reqConfig.url}, statusBehavior: ${mockConfig.statusBehavior}`);
      if (reqConfig.url === "/check_status.php") {
        return {
          status: 200,
          statusText: "OK",
          headers: {},
          config: reqConfig,
          data: {
            status: "success",
            payment_status: mockConfig.statusBehavior,
            operator_id: "GATEWAY_OP_987",
            amount: 50.00,
            message: "Status queried successfully"
          }
        };
      }
      return {
        status: 200,
        statusText: "OK",
        headers: {},
        config: reqConfig,
        data: { success: true }
      };
    }
  });
  return instance;
};

// 3. Dynamically import core dependencies so monkeypatching executes first
const { default: prisma } = await import("../src/config/prisma.js");
const { checkNexgateStatus } = await import("../src/services/providers/nexgateService.js");
const { paymentWebhook } = await import("../src/controllers/paymentController.js");
const { startPaymentWorker } = await import("../src/workers/paymentWorker.js");

async function testFinalizationFlow() {
  console.log("\n=== RUNNING NEXGATE STATUS VERIFICATION & FINALIZATION TESTS ===");

  // 1. Create a test user
  let user = await prisma.user.findFirst({
    where: { email: "finalization_test_user@dizipay.com" }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Finalization Test User",
        email: "finalization_test_user@dizipay.com",
        password: "testpassword123",
        phone: "9876543210",
        isPhoneVerified: true,
        isEmailVerified: true,
        role: "USER"
      }
    });
  }

  // Ensure wallet exists
  await prisma.wallet.upsert({
    where: { userId: user.id },
    update: { balance: 100.00 },
    create: { userId: user.id, balance: 100.00, currency: "INR" }
  });

  // Create a payment order in database
  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      amount: 50.00,
      status: "PENDING",
      idempotencyKey: `topup_finalization_test_${Date.now()}`,
      intent: "TOPUP"
    }
  });

  console.log(`[TEST] Created Payment ID ${payment.id} in status: ${payment.status}`);

  // ==========================================================
  // SCENARIO 1: checkNexgateStatus Mapping and Logging
  // ==========================================================
  console.log("\n--- SCENARIO 1: checkNexgateStatus Mapping ---");
  mockConfig.statusBehavior = "SUCCESS";
  const statusResult = await checkNexgateStatus(payment.id);
  console.log("[TEST] checkNexgateStatus Normalized result:", statusResult);
  if (!statusResult.success || statusResult.providerStatus !== "SUCCESS") {
    throw new Error("Scenario 1 Failed: Status should map to SUCCESS");
  }
  console.log("[PASS] Scenario 1: Status mapping and logging correct.");

  // ==========================================================
  // SCENARIO 2: Webhook Immediate Response (HTTP 200)
  // ==========================================================
  console.log("\n--- SCENARIO 2: Webhook Immediate Response ---");
  let responseSent = false;
  const mockRes = {
    status: (code) => {
      console.log(`[TEST] Webhook res.status called with: ${code}`);
      if (code !== 200) {
        throw new Error(`Expected HTTP 200, got ${code}`);
      }
      return {
        json: (data) => {
          console.log("[TEST] Webhook res.json called with:", data);
          responseSent = true;
        }
      };
    }
  };

  const mockReq = {
    body: {
      order_id: payment.id.toString(),
      status: "SUCCESS",
      transaction_id: "GATEWAY_OP_987",
      amount: "50.00",
      message: "Paid via webhook"
    },
    headers: {}
  };

  await paymentWebhook(mockReq, mockRes);
  if (!responseSent) {
    throw new Error("Scenario 2 Failed: Webhook did not send immediate 200 response");
  }
  console.log("[PASS] Scenario 2: Webhook immediate response verified!");

  // Wait a short moment for background webhook processing to finalize DB
  await new Promise(resolve => setTimeout(resolve, 500));

  // ==========================================================
  // SCENARIO 3: Webhook background flow & duplicate finalization protection
  // ==========================================================
  console.log("\n--- SCENARIO 3: Webhook background flow & deduplication ---");
  const updatedPayment = await prisma.payment.findUnique({
    where: { id: payment.id }
  });
  console.log(`[TEST] Payment status in DB after background webhook runs: ${updatedPayment.status}`);
  if (updatedPayment.status !== "SUCCESS") {
    throw new Error("Scenario 3 Failed: Webhook should have successfully updated DB payment to SUCCESS in background");
  }

  // Triggering the webhook again to verify duplicate detection skips ledger crediting
  await paymentWebhook(mockReq, mockRes);
  console.log("[PASS] Scenario 3: Webhook background flow and duplicate processing completed safely.");

  // ==========================================================
  // SCENARIO 4: Worker direct finalization when webhook is missed
  // ==========================================================
  console.log("\n--- SCENARIO 4: Worker Direct Finalization ---");
  // Create another payment
  const payment2 = await prisma.payment.create({
    data: {
      userId: user.id,
      amount: 40.00,
      status: "PENDING",
      idempotencyKey: `topup_finalization_test_worker_${Date.now()}`,
      intent: "TOPUP"
    }
  });
  console.log(`[TEST] Created Payment 2 ID ${payment2.id} in status: ${payment2.status}`);

  // We start the worker and feed it a verifyNexgateStatus job manually
  const worker = startPaymentWorker();
  
  // Directly trigger the handler function logic of verifyNexgateStatus
  // This simulates the job running in the worker process
  const mockJob = {
    name: "verifyNexgateStatus",
    data: {
      paymentId: payment2.id,
      attempt: 1
    }
  };

  // We call the worker's handler function directly to verify it updates DB
  console.log("[TEST] Simulating worker verifyNexgateStatus job execution...");
  
  // Let's call the worker's processor logic (which is defined in paymentWorker.js)
  const jobProcessor = worker.processFn;
  await jobProcessor(mockJob);

  // Wait a short moment
  await new Promise(resolve => setTimeout(resolve, 500));

  const finalizedPayment2 = await prisma.payment.findUnique({
    where: { id: payment2.id },
    include: { user: { include: { wallet: true } } }
  });

  console.log(`[TEST] Payment 2 status in DB after worker runs: ${finalizedPayment2.status}`);
  console.log(`[TEST] User wallet balance: ${finalizedPayment2.user.wallet.balance}`);

  if (finalizedPayment2.status !== "SUCCESS") {
    throw new Error("Scenario 4 Failed: Worker should have updated payment status to SUCCESS directly");
  }

  if (Number(finalizedPayment2.user.wallet.balance) !== 190.00) { // 100 base + 50 (from webhook) + 40 (from worker)
    throw new Error(`Scenario 4 Failed: Expected wallet balance to be 190.00, got ${finalizedPayment2.user.wallet.balance}`);
  }

  console.log("[PASS] Scenario 4: Worker direct finalization was successful!");

  // Cleanup test user and payments
  await prisma.transaction.deleteMany({ where: { userId: user.id } });
  await prisma.payment.deleteMany({ where: { userId: user.id } });
  await prisma.wallet.delete({ where: { userId: user.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});

  await worker.close();

  console.log("\n=== ALL RECONCILIATION AND FINALIZATION TESTS PASSED ===");
}

testFinalizationFlow()
  .catch(err => {
    console.error("[TEST ERROR]:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
