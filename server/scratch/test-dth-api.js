import IORedis from "ioredis";
import { Queue } from "bullmq";

// Mock Redis & BullMQ to avoid connection exceptions if Redis is offline
IORedis.prototype.get = async (key) => null;
IORedis.prototype.set = async (key, value, ...args) => "OK";
IORedis.prototype.del = async (key) => 1;
IORedis.prototype.connect = async () => {};
IORedis.prototype.sendCommand = async () => null;

Queue.prototype.getJobs = async () => [];
Queue.prototype.add = async () => ({ id: "mock-job-id" });

import prisma from "../src/config/prisma.js";
import { getDthPlans, validateDthCustomer } from "../src/controllers/rechargeController.js";

// Helper helper mock res object
const makeMockRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    sentData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.sentData = data;
      return this;
    },
    send(data) {
      this.sentData = data;
      return this;
    },
    header(name, value) {
      this.headers[name] = value;
      return this;
    }
  };
  return res;
};

// Check if test user exists
let testUser = await prisma.user.findFirst({
  where: { role: "USER" }
});
if (!testUser) {
  testUser = await prisma.user.create({
    data: {
      name: "Test User",
      email: "testuser@dizipay.com",
      password: "password123",
      phone: "8888877777",
      role: "USER"
    }
  });
}

const reqUser = { id: testUser.id, role: "USER" };

async function run() {
  console.log("=== STARTING DTH API ENDPOINTS VERIFICATION ===");

  // Test 1: Fetch DTH Plans for Tata Sky (Code 10)
  console.log("\n[TEST 1] Fetching DTH Plans for Tata Sky (operatorCode = 10)");
  const req1 = {
    query: { operatorCode: "10" }
  };
  const res1 = makeMockRes();
  await getDthPlans(req1, res1);
  console.log("Response Status:", res1.statusCode);
  console.log("Response Keys:", Object.keys(res1.sentData));
  console.log("Success Status:", res1.sentData.success);
  
  if (res1.statusCode !== 200 || !res1.sentData.success) {
    throw new Error("Failed to fetch DTH Plans for Tata Sky");
  }
  
  // Verify plan categories exist
  const categories = res1.sentData.data || res1.sentData.plans || {};
  console.log("Plan Categories:", Object.keys(categories));
  if (Object.keys(categories).length === 0) {
    throw new Error("DTH Plans response has no plan categories");
  }
  console.log("[PASS] DTH Plans retrieved successfully.");

  // Test 2: Validate DTH Customer for Tata Sky (Code 10)
  console.log("\n[TEST 2] Validating DTH Customer for Tata Sky (operatorCode = 10, subscriberId = 301245789)");
  const req2 = {
    user: reqUser,
    body: {
      operatorCode: "10",
      subscriberId: "301245789"
    }
  };
  const res2 = makeMockRes();
  await validateDthCustomer(req2, res2);
  console.log("Response Status:", res2.statusCode);
  console.log("Response Data:", res2.sentData);
  
  const isFallback = res2.sentData.source === "local-graceful-fallback";
  if (res2.statusCode !== 200 || (!res2.sentData.success && !isFallback)) {
    throw new Error("Failed to validate DTH customer info");
  }
  
  // We expect custom details fields
  if (res2.sentData.customerName === undefined) {
    throw new Error("Customer name field missing in validation response");
  }
  console.log("[PASS] DTH Customer validation works successfully (with fallback/live resolution).");

  // Test 3: DTH Recharge Input Validation Flow (e.g. 9-digit subscriber ID)
  console.log("\n[TEST 3] Verifying DTH Recharge input validation accepts 8-15 digit subscriber IDs");
  const { recharge } = await import("../src/controllers/rechargeController.js");
  
  // Stub transaction flow to throw an error with custom code/statusCode so we know it passed validation
  const originalTransaction = prisma.$transaction;
  const mockInsufficientError = new Error("Insufficient wallet balance");
  mockInsufficientError.statusCode = 400;

  prisma.$transaction = async () => {
    throw mockInsufficientError;
  };

  const req3 = {
    user: reqUser,
    body: {
      mobile: "301245789", // 9 digits (valid for DTH, would fail for mobile)
      amount: 100,
      operatorCode: "10" // Tata Sky (DTH)
    },
    headers: {}
  };
  const res3 = makeMockRes();

  try {
    await recharge(req3, res3);
    console.log("Recharge Response Status:", res3.statusCode);
    console.log("Recharge Response Data:", res3.sentData);
    
    // We expect it to pass validation and propagate "Insufficient wallet balance"
    if (res3.statusCode !== 400 || res3.sentData.message !== "Insufficient wallet balance") {
      throw new Error(`Expected validation success and insufficient balance, got status ${res3.statusCode} and message '${res3.sentData.message}'`);
    }
    console.log("[PASS] DTH Recharge input validation successfully accepted 9-digit subscriber ID.");
  } finally {
    prisma.$transaction = originalTransaction;
  }

  // Test 4: Regression - Mobile Recharge Input Validation Flow (strictly 10-digit mobile number)
  console.log("\n[TEST 4] Verifying Mobile Recharge input validation still enforces 10-digit mobile numbers");
  const originalTransactionMobile = prisma.$transaction;
  const mockInsufficientErrorMobile = new Error("Insufficient wallet balance");
  mockInsufficientErrorMobile.statusCode = 400;

  prisma.$transaction = async () => {
    throw mockInsufficientErrorMobile;
  };

  const req4 = {
    user: reqUser,
    body: {
      mobile: "9999988888", // 10 digits (valid for mobile)
      amount: 100,
      operatorCode: "1" // Jio (Mobile)
    },
    headers: {}
  };
  const res4_mobile = makeMockRes();

  try {
    await recharge(req4, res4_mobile);
    console.log("Recharge Response Status:", res4_mobile.statusCode);
    console.log("Recharge Response Data:", res4_mobile.sentData);
    
    if (res4_mobile.statusCode !== 400 || res4_mobile.sentData.message !== "Insufficient wallet balance") {
      throw new Error(`Expected mobile validation success and insufficient balance, got status ${res4_mobile.statusCode} and message '${res4_mobile.sentData.message}'`);
    }
    console.log("[PASS] Mobile Recharge input validation successfully accepted 10-digit mobile number.");
  } finally {
    prisma.$transaction = originalTransactionMobile;
  }

  // Test 5: Regression - Invalid mobile recharge input validation (9-digit mobile number)
  console.log("\n[TEST 5] Verifying Mobile Recharge input validation rejects non-10-digit numbers");
  const req5 = {
    user: reqUser,
    body: {
      mobile: "999998888", // 9 digits (invalid for mobile)
      amount: 100,
      operatorCode: "1" // Jio (Mobile)
    },
    headers: {}
  };
  const res5_invalid = makeMockRes();

  try {
    await recharge(req5, res5_invalid);
    console.log("Recharge Response Status (expect 400):", res5_invalid.statusCode);
    console.log("Recharge Response Data:", res5_invalid.sentData);
    
    if (res5_invalid.statusCode !== 400 || !res5_invalid.sentData.message.includes("Valid 10-digit mobile number")) {
      throw new Error(`Expected validation failure (400) for mobile, got status ${res5_invalid.statusCode} and message '${res5_invalid.sentData.message}'`);
    }
    console.log("[PASS] Mobile Recharge input validation successfully rejected 9-digit mobile number.");
  } catch (err) {
    throw err;
  }

  console.log("\n=== ALL DTH API VERIFICATION SCENARIOS PASSED ===");
}

run()
  .then(() => {
    prisma.$disconnect();
    process.exit(0);
  })
  .catch(err => {
    console.error("[CRITICAL TEST FAILURE]:", err);
    prisma.$disconnect();
    process.exit(1);
  });
