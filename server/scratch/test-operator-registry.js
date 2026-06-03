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
import {
  getOperatorsRegistry,
  createOperatorRegistry,
  updateOperatorRegistry,
  deleteOperatorRegistry,
  importOperatorsCSV,
  exportOperatorsCSV
} from "../src/controllers/routingAdminController.js";
import { getActiveOperators } from "../src/controllers/rechargeController.js";

// Helper helper mock res object
const makeMockRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    attachmentName: null,
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
    },
    attachment(name) {
      this.attachmentName = name;
      return this;
    }
  };
  return res;
};

// Check if test admin exists
let testAdmin = await prisma.user.findFirst({
  where: { role: "ADMIN" }
});
if (!testAdmin) {
  testAdmin = await prisma.user.create({
    data: {
      name: "Test Admin",
      email: "testadmin@dizipay.com",
      password: "password123",
      phone: "9999988888",
      role: "ADMIN"
    }
  });
}

// Check if test user exists
let testUser = await prisma.user.findFirst({
  where: { role: "USER" }
});

const reqUser = { id: testAdmin.id, role: "ADMIN" };

async function cleanTestOperators() {
  await prisma.operator.deleteMany({
    where: {
      name: {
        in: ["JIO_TEST", "TEST_JIO", "AIRTEL_TEST", "JIO PREPAID", "AIRTEL PREPAID"]
      }
    }
  });
  await prisma.auditLog.deleteMany({
    where: {
      action: {
        in: [
          "OPERATOR_CREATED",
          "OPERATOR_UPDATED",
          "OPERATOR_ENABLED",
          "OPERATOR_DISABLED",
          "OPERATOR_DELETED",
          "OPERATORS_IMPORTED",
          "OPERATORS_EXPORTED"
        ]
      }
    }
  });
}

async function run() {
  console.log("=== STARTING OPERATOR REGISTRY & UX FLOW VERIFICATION ===");
  await cleanTestOperators();

  // Test 1: Create operator registry entry
  console.log("\n[TEST 1] Creating a new operator: JIO_TEST");
  const req1 = {
    user: reqUser,
    ip: "127.0.0.1",
    headers: { "user-agent": "test-agent" },
    body: {
      name: "JIO_TEST",
      code: "JIO_TEST_CODE",
      category: "Mobile",
      active: true,
      circleRequired: true,
      description: "Jio Test Operator Description"
    }
  };
  const res1 = makeMockRes();
  await createOperatorRegistry(req1, res1);
  console.log("Response:", res1.sentData);
  if (res1.statusCode !== 200 || !res1.sentData.success) {
    throw new Error("Failed to create operator JIO_TEST");
  }
  const createdId = res1.sentData.data.id;

  // Verify Audit Log
  const audit1 = await prisma.auditLog.findFirst({
    where: { action: "OPERATOR_CREATED", entityId: createdId }
  });
  if (!audit1) {
    throw new Error("Audit log OPERATOR_CREATED not found");
  }
  console.log("[PASS] Operator JIO_TEST created and audit logged successfully.");

  // Test 2: Update operator details
  console.log("\n[TEST 2] Updating operator description and category");
  const req2 = {
    user: reqUser,
    ip: "127.0.0.1",
    headers: { "user-agent": "test-agent" },
    params: { id: createdId },
    body: {
      description: "Updated Jio Test Operator Description",
      category: "DTH"
    }
  };
  const res2 = makeMockRes();
  await updateOperatorRegistry(req2, res2);
  console.log("Response:", res2.sentData);
  if (res2.statusCode !== 200 || res2.sentData.data.description !== "Updated Jio Test Operator Description" || res2.sentData.data.category !== "DTH") {
    throw new Error("Failed to update operator registry");
  }
  console.log("[PASS] Operator updated successfully.");

  // Test 3: Toggle status (Disable)
  console.log("\n[TEST 3] Disabling operator (active: false)");
  const req3 = {
    user: reqUser,
    ip: "127.0.0.1",
    headers: { "user-agent": "test-agent" },
    params: { id: createdId },
    body: {
      active: false
    }
  };
  const res3 = makeMockRes();
  await updateOperatorRegistry(req3, res3);
  console.log("Response:", res3.sentData);
  if (res3.statusCode !== 200 || res3.sentData.data.active !== false) {
    throw new Error("Failed to disable operator registry");
  }
  const audit3 = await prisma.auditLog.findFirst({
    where: { action: "OPERATOR_DISABLED", entityId: createdId }
  });
  if (!audit3) {
    throw new Error("Audit log OPERATOR_DISABLED not found");
  }
  console.log("[PASS] Operator disabled and audit log generated.");

  // Test 4: Verify getActiveOperators filter out disabled operator
  console.log("\n[TEST 4] Fetch active operators list for client UI");
  const res4 = makeMockRes();
  await getActiveOperators({}, res4);
  const activeOps = res4.sentData.data;
  console.log("Active Operators Count:", activeOps.length);
  const foundDisabled = activeOps.find(op => op.id === createdId);
  if (foundDisabled) {
    throw new Error("Disabled operator returned in getActiveOperators list");
  }
  console.log("[PASS] Disabled operator correctly excluded from client-facing active list.");

  // Test 5: Re-enable operator and verify it is visible
  console.log("\n[TEST 5] Re-enabling operator (active: true)");
  const req5 = {
    user: reqUser,
    ip: "127.0.0.1",
    headers: { "user-agent": "test-agent" },
    params: { id: createdId },
    body: { active: true }
  };
  const res5 = makeMockRes();
  await updateOperatorRegistry(req5, res5);
  if (res5.statusCode !== 200 || res5.sentData.data.active !== true) {
    throw new Error("Failed to enable operator registry");
  }
  const audit5 = await prisma.auditLog.findFirst({
    where: { action: "OPERATOR_ENABLED", entityId: createdId }
  });
  if (!audit5) {
    throw new Error("Audit log OPERATOR_ENABLED not found");
  }

  const res5Active = makeMockRes();
  await getActiveOperators({}, res5Active);
  const foundEnabled = res5Active.sentData.data.find(op => op.id === createdId);
  if (!foundEnabled) {
    throw new Error("Re-enabled operator missing from active operators list");
  }
  console.log("[PASS] Enabled operator correctly visible in client-facing active list.");

  // Test 6: Soft Delete
  console.log("\n[TEST 6] Soft deleting operator");
  const req6 = {
    user: reqUser,
    ip: "127.0.0.1",
    headers: { "user-agent": "test-agent" },
    params: { id: createdId }
  };
  const res6 = makeMockRes();
  await deleteOperatorRegistry(req6, res6);
  if (res6.statusCode !== 200 || !res6.sentData.success) {
    throw new Error("Failed to soft delete operator");
  }
  const audit6 = await prisma.auditLog.findFirst({
    where: { action: "OPERATOR_DELETED", entityId: createdId }
  });
  if (!audit6) {
    throw new Error("Audit log OPERATOR_DELETED not found");
  }

  // Ensure soft-deleted operator doesn't show in active list or list registry
  const res6Active = makeMockRes();
  await getActiveOperators({}, res6Active);
  if (res6Active.sentData.data.find(op => op.id === createdId)) {
    throw new Error("Soft deleted operator found in active operators list");
  }

  const res6List = makeMockRes();
  await getOperatorsRegistry({}, res6List);
  if (res6List.sentData.data.find(op => op.id === createdId)) {
    throw new Error("Soft deleted operator found in getOperatorsRegistry list");
  }
  console.log("[PASS] Soft deletion hiding works perfectly.");

  // Test 7: Export CSV
  console.log("\n[TEST 7] Exporting Operator Registry to CSV");
  const res7 = makeMockRes();
  await exportOperatorsCSV({ user: reqUser, ip: "127.0.0.1", headers: {} }, res7);
  if (res7.statusCode !== 200 || !res7.sentData.includes("name,code,category,status")) {
    throw new Error("CSV Export failed or returned invalid content");
  }
  console.log("CSV Output sample:\n", res7.sentData.split("\n").slice(0, 3).join("\n"));
  const audit7 = await prisma.auditLog.findFirst({
    where: { action: "OPERATORS_EXPORTED" }
  });
  if (!audit7) {
    throw new Error("Audit log OPERATORS_EXPORTED not found");
  }
  console.log("[PASS] CSV export and audit logging successful.");

  // Test 8: Import CSV
  console.log("\n[TEST 8] Bulk Importing Operators via CSV");
  const csvData = "name,code,category,status\nJIO PREPAID,JIO_PRE,MOBILE,ACTIVE\nAIRTEL PREPAID,AIRTEL_PRE,MOBILE,ACTIVE";
  const req8 = {
    user: reqUser,
    ip: "127.0.0.1",
    headers: { "user-agent": "test-agent" },
    body: { csvData }
  };
  const res8 = makeMockRes();
  await importOperatorsCSV(req8, res8);
  console.log("Response:", res8.sentData);
  if (res8.statusCode !== 200 || !res8.sentData.success) {
    throw new Error("CSV Import failed");
  }
  const audit8 = await prisma.auditLog.findFirst({
    where: { action: "OPERATORS_IMPORTED" }
  });
  if (!audit8) {
    throw new Error("Audit log OPERATORS_IMPORTED not found");
  }

  // Verify that imported items exist
  const importedJio = await prisma.operator.findUnique({
    where: { name: "JIO PREPAID" }
  });
  const importedAirtel = await prisma.operator.findUnique({
    where: { name: "AIRTEL PREPAID" }
  });
  if (!importedJio || !importedAirtel) {
    throw new Error("Imported operator records not found in database");
  }
  console.log("[PASS] CSV Bulk Import and audit logging successful.");

  // Test 9: Recharge Controller Error Propagation
  console.log("\n[TEST 9] Verifying Recharge error propagation for insufficient balance");
  const { recharge } = await import("../src/controllers/rechargeController.js");
  // Stub transaction flow to throw an error with custom code/statusCode
  const originalTransaction = prisma.$transaction;
  
  // Create mock error
  const mockInsufficientError = new Error("Insufficient wallet balance");
  mockInsufficientError.statusCode = 400;

  prisma.$transaction = async () => {
    throw mockInsufficientError;
  };

  const req9 = {
    user: { id: testUser?.id || 9999, role: "USER" },
    body: { mobile: "9999988888", amount: 100, operatorCode: 1 },
    headers: {}
  };
  const res9 = makeMockRes();

  try {
    await recharge(req9, res9);
    console.log("Recharge Response:", res9.sentData);
    if (res9.statusCode !== 400 || res9.sentData.message !== "Insufficient wallet balance") {
      throw new Error(`Expected status 400 and message 'Insufficient wallet balance', got status ${res9.statusCode} and message '${res9.sentData.message}'`);
    }
    console.log("[PASS] Recharge controller propagated insufficient balance error correctly.");
  } finally {
    prisma.$transaction = originalTransaction;
  }

  await cleanTestOperators();
  console.log("\n=== ALL OPERATOR REGISTRY AND UX VERIFICATION SCENARIOS PASSED ===");
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
