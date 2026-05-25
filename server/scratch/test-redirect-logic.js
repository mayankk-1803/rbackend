import axios from "axios";
import IORedis from "ioredis";
import { Queue } from "bullmq";
import https from "https";

// 1. Mock Redis & BullMQ to avoid connection exceptions if Redis is offline
IORedis.prototype.get = async (key) => null;
IORedis.prototype.set = async (key, value, ...args) => "OK";
IORedis.prototype.del = async (key) => 1;
IORedis.prototype.connect = async () => {};
IORedis.prototype.sendCommand = async () => {};

Queue.prototype.getJobs = async () => [];
Queue.prototype.add = async () => ({ id: "mock-job-id" });

// 2. Configure the mock behavior globally before importing the service
const mockConfig = {
  behavior: "success", // "success" or "timeout" or "failure"
};

// Programmatic time stubbing
let mockTime = Date.now();
const originalNow = Date.now;
Date.now = () => mockTime;

const originalCreate = axios.create;
axios.create = function(config) {
  const instance = originalCreate.call(axios, {
    ...config,
    adapter: async (reqConfig) => {
      console.log(`[MOCK AXIOS ADAPTER] URL: ${reqConfig.url}, Behavior: ${mockConfig.behavior}`);
      
      if (reqConfig.url === "/create_order.php") {
        if (mockConfig.behavior === "success") {
          return {
            data: {
              status: "success",
              data: {
                payment_url: "https://nexgate.in/pay/mock_redirect_12345",
                order_id: "MOCK_GATEWAY_123"
              }
            },
            status: 200,
            statusText: "OK",
            headers: {},
            config: reqConfig
          };
        } else if (mockConfig.behavior === "timeout") {
          const error = new Error("timeout of 25000ms exceeded");
          error.code = "ETIMEDOUT";
          error.config = reqConfig;
          throw error;
        } else {
          return {
            data: {
              status: "failure",
              message: "Gateway invalid credential check"
            },
            status: 400,
            statusText: "Bad Request",
            headers: {},
            config: reqConfig
          };
        }
      }
      return {
        data: { status: "success" },
        status: 200,
        statusText: "OK",
        headers: {},
        config: reqConfig
      };
    }
  });
  return instance;
};

// 3. Dynamically import core dependencies so monkeypatching executes first
const { default: prisma } = await import("../src/config/prisma.js");
const { createPaymentOrder } = await import("../src/services/paymentService.js");
const { isCircuitBreakerOpen } = await import("../src/services/providers/nexgateService.js");
const { default: crypto } = await import("crypto");

async function runTests() {
  console.log("=== RUNNING GATEWAY DIRECT REDIRECT & TIMEOUT FALLBACK TESTS ===");

  // Setup Test User
  let user = await prisma.user.findFirst({
    where: { email: "redirect_test_user@dizipay.com" }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Redirect Test User",
        email: "redirect_test_user@dizipay.com",
        password: "testpassword123",
        phone: "9999922222",
        isPhoneVerified: true,
        isEmailVerified: true,
        role: "USER"
      }
    });
  }

  // Ensure wallet exists
  await prisma.wallet.upsert({
    where: { userId: user.id },
    update: { balance: 0.00 },
    create: { userId: user.id, balance: 0.00, currency: "INR" }
  });

  // ==========================================================
  // SCENARIO 1: SUCCESSFUL ORDER CREATION WITH IMMEDIATE REDIRECT URL
  // ==========================================================
  console.log("\n--- SCENARIO 1: Successful Order Creation (Direct Redirect Expected) ---");
  mockConfig.behavior = "success";
  
  const idempotencyKey1 = crypto.randomUUID();
  const payment1 = await createPaymentOrder(user.id, 100.00, idempotencyKey1, "demo@upi", "TOPUP");
  
  console.log("[TEST] Returned Payment Object:", {
    id: payment1.id,
    status: payment1.status,
    paymentUrl: payment1.paymentUrl || payment1.payment_url,
    success: payment1.success
  });

  if (!payment1.success || payment1.status !== "PENDING") {
    throw new Error("Scenario 1 Failed: Expected PENDING status and success");
  }
  console.log("[PASS] Scenario 1 Passed!");

  // ==========================================================
  // SCENARIO 2: CIRCUIT BREAKER DEBOUNCING
  // ==========================================================
  console.log("\n--- SCENARIO 2: Circuit Breaker Failure Debouncing ---");
  mockConfig.behavior = "timeout";
  
  // Verify that the circuit breaker is closed at start
  console.log("[TEST] Circuit breaker is open:", isCircuitBreakerOpen());
  if (isCircuitBreakerOpen()) {
    throw new Error("Expected circuit breaker to be closed initially");
  }

  // Fail 1: time = 100000 (starts far in future relative to initial 0 time)
  mockTime = 100000;
  console.log(`[TEST] Triggering failure 1 at mockTime = ${mockTime}`);
  try { await createPaymentOrder(user.id, 10.00, crypto.randomUUID(), "demo@upi", "TOPUP"); } catch (e) {}

  // Fail 2: time = 101000 (within 5s debounce window)
  mockTime = 101000;
  console.log(`[TEST] Triggering failure 2 (debounced) at mockTime = ${mockTime}`);
  try { await createPaymentOrder(user.id, 10.00, crypto.randomUUID(), "demo@upi", "TOPUP"); } catch (e) {}

  // Fail 3: time = 102000 (within 5s debounce window)
  mockTime = 102000;
  console.log(`[TEST] Triggering failure 3 (debounced) at mockTime = ${mockTime}`);
  try { await createPaymentOrder(user.id, 10.00, crypto.randomUUID(), "demo@upi", "TOPUP"); } catch (e) {}

  console.log("[TEST] Circuit breaker open after 3 rapid failures:", isCircuitBreakerOpen());
  if (isCircuitBreakerOpen()) {
    throw new Error("Expected circuit breaker to be closed due to debouncing");
  }

  // Now trigger failures separated by 6 seconds to open the circuit breaker
  // Fail 4 (actual second increment): time = 106100
  mockTime = 106100;
  console.log(`[TEST] Triggering failure 2 (actual) at mockTime = ${mockTime}`);
  try { await createPaymentOrder(user.id, 10.00, crypto.randomUUID(), "demo@upi", "TOPUP"); } catch (e) {}

  // Fail 5 (actual third increment): time = 112200
  mockTime = 112200;
  console.log(`[TEST] Triggering failure 3 (actual) at mockTime = ${mockTime}`);
  try { await createPaymentOrder(user.id, 10.00, crypto.randomUUID(), "demo@upi", "TOPUP"); } catch (e) {}

  // Fail 6 (actual fourth increment): time = 118300
  mockTime = 118300;
  console.log(`[TEST] Triggering failure 4 (actual) at mockTime = ${mockTime}`);
  try { await createPaymentOrder(user.id, 10.00, crypto.randomUUID(), "demo@upi", "TOPUP"); } catch (e) {}

  // Fail 7 (actual fifth increment -> threshold reached): time = 124400
  mockTime = 124400;
  console.log(`[TEST] Triggering failure 5 (actual) at mockTime = ${mockTime}`);
  try { await createPaymentOrder(user.id, 10.00, crypto.randomUUID(), "demo@upi", "TOPUP"); } catch (e) {}

  console.log("[TEST] Circuit breaker open after 5 spaced failures:", isCircuitBreakerOpen());
  if (!isCircuitBreakerOpen()) {
    throw new Error("Expected circuit breaker to be open after 5 spaced failures");
  }
  console.log("[PASS] Scenario 2: Circuit breaker correctly debounced rapid failures and opened after spaced threshold!");

  // ==========================================================
  // SCENARIO 3: OPEN BREAKER PREVENTS FURTHER INCREMENTS & BLOCKS REQUESTS
  // ==========================================================
  console.log("\n--- SCENARIO 3: Open Breaker Request Blocking ---");
  mockTime = 125000;
  
  // Make a request while the circuit is open
  try {
    await createPaymentOrder(user.id, 10.00, crypto.randomUUID(), "demo@upi", "TOPUP");
    throw new Error("Expected request to throw open circuit breaker error");
  } catch (error) {
    console.log("[TEST] Request threw expected error:", error.message);
    if (!error.message.includes("Circuit Breaker open")) {
      throw error;
    }
  }
  console.log("[PASS] Scenario 3: Requests correctly blocked while circuit is open!");

  // Cleanup Date.now stubbing
  Date.now = originalNow;
  console.log("\n=== ALL REDIRECT, DEBOUNCE, AND CIRCUIT BREAKER SCENARIOS PASSED ===");
}

runTests()
  .catch(err => {
    console.error("[TEST ERROR]:", err);
    process.exit(1);
  })
  .finally(async () => {
    console.log("[TEST] Cleaning up test data...");
    const user = await prisma.user.findFirst({
      where: { email: "redirect_test_user@dizipay.com" }
    });
    if (user) {
      await prisma.transaction.deleteMany({ where: { userId: user.id } });
      await prisma.payment.deleteMany({ where: { userId: user.id } });
      await prisma.wallet.delete({ where: { userId: user.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    }
    await prisma.$disconnect();
    console.log("[TEST] Cleanup finished.");
    process.exit(0);
  });
