import IORedis from "ioredis";
import jwt from "jsonwebtoken";

// Mock Redis & BullMQ to avoid connection exceptions if Redis is offline
IORedis.prototype.get = async (key) => null;
IORedis.prototype.set = async (key, value, ...args) => "OK";
IORedis.prototype.del = async (key) => 1;
IORedis.prototype.connect = async () => {};
IORedis.prototype.sendCommand = async () => null;

import prisma from "../src/config/prisma.js";
import { verifyMasterKey, getMasterKeyStatus } from "../src/controllers/enterpriseController.js";
import { masterKeySessionMiddleware, clearMasterKeyFailures } from "../src/middlewares/masterKeySessionMiddleware.js";

// Helper mock res object
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

const reqUser = { id: testAdmin.id, role: "ADMIN" };

async function cleanTestAuditLogs() {
  await prisma.auditLog.deleteMany({
    where: {
      action: {
        in: [
          "MASTER_KEY_USED",
          "MASTER_KEY_FAILED",
          "MASTER_KEY_DENIED",
          "MASTER_KEY_LOCKED",
          "MASTER_KEY_UNLOCKED",
          "MASTER_KEY_SESSION_CREATED",
          "MASTER_KEY_SESSION_EXPIRED"
        ]
      }
    }
  });
}

async function run() {
  console.log("=== STARTING MASTER KEY SECURITY & REGRESSION TESTS ===");
  await cleanTestAuditLogs();

  // Enforce environment configurations for tests
  process.env.SYSTEM_MASTER_KEY = "test_super_secret_key";
  process.env.SYSTEM_MASTER_KEY_PREVIOUS = "test_previous_secret_key";
  process.env.ENABLE_MASTER_KEY = "true";
  process.env.MASTER_KEY_SESSION_SECRET = "test_jwt_session_secret";
  process.env.MASTER_KEY_SESSION_DURATION = "10m";

  // Ensure failure trackers are clean
  await clearMasterKeyFailures(testAdmin.id);

  // Test 1: Verify Key status endpoint
  console.log("\n[TEST 1] Testing getMasterKeyStatus endpoint");
  const req1 = { user: reqUser, ip: "127.0.0.1", headers: {} };
  const res1 = makeMockRes();
  await getMasterKeyStatus(req1, res1);
  console.log("Status response:", res1.sentData);
  if (res1.statusCode !== 200 || !res1.sentData.success || res1.sentData.data.enabled !== true) {
    throw new Error("Failed to get correct Master Key status");
  }
  console.log("[PASS] Master Key configured status retrieved successfully.");

  // Test 2: Verify with Missing Master Key
  console.log("\n[TEST 2] Verifying with missing masterKey input");
  const req2 = { user: reqUser, body: {}, ip: "127.0.0.1", headers: {} };
  const res2 = makeMockRes();
  await verifyMasterKey(req2, res2);
  console.log("Verify response:", res2.sentData);
  if (res2.statusCode !== 400 || res2.sentData.success !== false) {
    throw new Error("Expected status 400 for missing masterKey");
  }
  console.log("[PASS] Correctly rejected missing masterKey.");

  // Test 3: Verify with Invalid Master Key
  console.log("\n[TEST 3] Verifying with invalid masterKey");
  const req3 = { user: reqUser, body: { masterKey: "wrong_key" }, ip: "127.0.0.1", headers: {} };
  const res3 = makeMockRes();
  await verifyMasterKey(req3, res3);
  console.log("Verify response:", res3.sentData);
  if (res3.statusCode !== 403 || res3.sentData.success !== false) {
    throw new Error("Expected status 403 for invalid masterKey");
  }
  
  // Verify audit log exists
  const failedAudit = await prisma.auditLog.findFirst({
    where: { action: "MASTER_KEY_FAILED", adminId: testAdmin.id }
  });
  if (!failedAudit) {
    throw new Error("Audit log MASTER_KEY_FAILED was not created");
  }
  console.log("[PASS] Correctly rejected invalid masterKey and logged MASTER_KEY_FAILED.");

  // Test 4: Lockout after 5 failed attempts
  console.log("\n[TEST 4] Simulating lockout behavior (5 failed attempts)");
  for (let i = 0; i < 4; i++) {
    const reqLoop = { user: reqUser, body: { masterKey: "wrong_key" }, ip: "127.0.0.1", headers: {} };
    const resLoop = makeMockRes();
    await verifyMasterKey(reqLoop, resLoop);
  }
  
  // 5th attempt (total of 5 failures) should trigger lockout
  const reqLockout = { user: reqUser, body: { masterKey: "wrong_key" }, ip: "127.0.0.1", headers: {} };
  const resLockout = makeMockRes();
  await verifyMasterKey(reqLockout, resLockout);
  console.log("5th attempt response:", resLockout.sentData);
  if (resLockout.statusCode !== 403 || !resLockout.sentData.message.includes("locked")) {
    throw new Error("Expected lockout error on 5th failed attempt");
  }

  // 6th attempt with correct key should still fail due to lockout
  const reqBlocked = { user: reqUser, body: { masterKey: "test_super_secret_key" }, ip: "127.0.0.1", headers: {} };
  const resBlocked = makeMockRes();
  await verifyMasterKey(reqBlocked, resBlocked);
  console.log("Blocked attempt response:", resBlocked.sentData);
  if (resBlocked.statusCode !== 403 || !resBlocked.sentData.message.includes("locked")) {
    throw new Error("Locked account did not prevent authentication with correct key");
  }

  // Check lockout audit log
  const lockoutAudit = await prisma.auditLog.findFirst({
    where: { action: "MASTER_KEY_LOCKED", adminId: testAdmin.id }
  });
  if (!lockoutAudit) {
    throw new Error("Audit log MASTER_KEY_LOCKED was not created");
  }
  console.log("[PASS] Lockout triggered correctly and logged MASTER_KEY_LOCKED.");

  // Reset failures to proceed
  await clearMasterKeyFailures(testAdmin.id);

  // Test 5: Verify with Valid Master Key (Current & Previous rotation support)
  console.log("\n[TEST 5] Testing valid master key authentication");
  const req5 = { user: reqUser, body: { masterKey: "test_super_secret_key" }, ip: "127.0.0.1", headers: {} };
  const res5 = makeMockRes();
  await verifyMasterKey(req5, res5);
  console.log("Verify response:", res5.sentData);
  if (res5.statusCode !== 200 || !res5.sentData.success || !res5.sentData.masterKeySession) {
    throw new Error("Failed to authenticate valid Master Key");
  }
  const token = res5.sentData.masterKeySession;

  // Verify previous key matches too
  const req5Prev = { user: reqUser, body: { masterKey: "test_previous_secret_key" }, ip: "127.0.0.1", headers: {} };
  const res5Prev = makeMockRes();
  await verifyMasterKey(req5Prev, res5Prev);
  if (res5Prev.statusCode !== 200 || !res5Prev.sentData.success || !res5Prev.sentData.masterKeySession) {
    throw new Error("Failed to authenticate valid previous Master Key");
  }

  // Verify audit logs
  const successAudit = await prisma.auditLog.findFirst({
    where: { action: "MASTER_KEY_USED", adminId: testAdmin.id }
  });
  const sessionAudit = await prisma.auditLog.findFirst({
    where: { action: "MASTER_KEY_SESSION_CREATED", adminId: testAdmin.id }
  });
  if (!successAudit || !sessionAudit) {
    throw new Error("Success audit logs not found");
  }
  console.log("[PASS] Authenticated successfully, returned JWT session token, and logged events.");

  // Test 6: Validate Session Token in middleware
  console.log("\n[TEST 6] Validating session token inside masterKeySessionMiddleware");
  const req6 = {
    user: reqUser,
    headers: { "x-master-key-session": token },
    originalUrl: "/api/admin/topup",
    method: "POST"
  };
  const res6 = makeMockRes();
  let nextCalled = false;
  await masterKeySessionMiddleware(req6, res6, () => { nextCalled = true; });
  if (!nextCalled || res6.statusCode !== 200) {
    throw new Error("Middleware blocked valid session token");
  }
  console.log("[PASS] Valid session token successfully authorized.");

  // Test 7: Verify Missing Session Token in middleware
  console.log("\n[TEST 7] Testing middleware with missing token");
  const req7 = {
    user: reqUser,
    headers: {},
    originalUrl: "/api/admin/topup",
    method: "POST"
  };
  const res7 = makeMockRes();
  let nextCalled7 = false;
  await masterKeySessionMiddleware(req7, res7, () => { nextCalled7 = true; });
  if (nextCalled7 || res7.statusCode !== 403 || res7.sentData.message !== "Master Key validation required") {
    throw new Error("Middleware allowed request with missing session token");
  }
  console.log("[PASS] Missing token correctly blocked with 403.");

  // Test 8: Simulate expired session token
  console.log("\n[TEST 8] Testing middleware with expired session token");
  const expiredToken = jwt.sign(
    { adminId: testAdmin.id, role: "ADMIN", type: "MASTER_KEY_SESSION" },
    "test_jwt_session_secret",
    { expiresIn: "-10s" } // Expired token
  );
  const req8 = {
    user: reqUser,
    headers: { "x-master-key-session": expiredToken },
    originalUrl: "/api/admin/topup",
    method: "POST"
  };
  const res8 = makeMockRes();
  let nextCalled8 = false;
  await masterKeySessionMiddleware(req8, res8, () => { nextCalled8 = true; });
  if (nextCalled8 || res8.statusCode !== 403) {
    throw new Error("Middleware allowed request with expired session token");
  }
  const expiredAudit = await prisma.auditLog.findFirst({
    where: { action: "MASTER_KEY_SESSION_EXPIRED", adminId: testAdmin.id }
  });
  if (!expiredAudit) {
    throw new Error("Audit log MASTER_KEY_SESSION_EXPIRED not found");
  }
  console.log("[PASS] Expired token correctly blocked and logged MASTER_KEY_SESSION_EXPIRED.");

  // Test 9: Regression check (Bypassed actions bypass validation)
  console.log("\n[TEST 9] Verifying bypass validation for bypassed actions");
  const req9 = {
    user: reqUser,
    headers: {}, // No session token
    originalUrl: "/api/admin/enterprise/users/bulk-action",
    body: { actionType: "suspend" },
    method: "POST"
  };
  const res9 = makeMockRes();
  let nextCalled9 = false;
  await masterKeySessionMiddleware(req9, res9, () => { nextCalled9 = true; });
  if (!nextCalled9) {
    throw new Error("Middleware blocked bypassed bulk-action path");
  }
  console.log("[PASS] Bypassed actions correctly bypassed validation.");

  await cleanTestAuditLogs();
  console.log("\n=== ALL MASTER KEY SECURITY & REGRESSION VERIFICATIONS PASSED ===");
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
