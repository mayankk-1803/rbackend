import prisma from "./src/config/prisma.js";
import { checkPermission, superAdminOnly } from "./src/middlewares/rbac.js";

async function runRBACVerification() {
  console.log("==========================================================================");
  console.log("STARTING OPERATIONS RBAC VERIFICATION SCRIPT");
  console.log("==========================================================================");

  let passed = 0;
  let failed = 0;

  const assert = (condition, message) => {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  };

  try {
    // 1. Setup mock users
    // Ensure we have a user with commissionRole SUB_ADMIN for testing
    let subAdminUser = await prisma.user.findFirst({
      where: { commissionRole: "SUB_ADMIN" }
    });

    if (!subAdminUser) {
      // Create a temporary sub admin user
      subAdminUser = await prisma.user.create({
        data: {
          name: "Test Sub Admin",
          email: "testsub@dizipay.in",
          phone: "9999999991",
          password: "password_hash",
          role: "ADMIN",
          commissionRole: "SUB_ADMIN",
          isActive: true,
          authType: "email"
        }
      });
      console.log("Created temporary SUB_ADMIN user for testing.");
    }

    let standardAdminUser = await prisma.user.findFirst({
      where: { role: "ADMIN", NOT: { commissionRole: "SUB_ADMIN" } }
    });

    if (!standardAdminUser) {
      standardAdminUser = await prisma.user.create({
        data: {
          name: "Test Standard Admin",
          email: "testadmin@dizipay.in",
          phone: "9999999992",
          password: "password_hash",
          role: "ADMIN",
          commissionRole: "CUSTOMER", // default/standard role
          isActive: true,
          authType: "email"
        }
      });
      console.log("Created temporary ADMIN user for testing.");
    }

    let superAdminUser = await prisma.user.findFirst({
      where: { role: "SUPER_ADMIN" }
    });

    // Helper to run middleware
    const runMiddleware = (middleware, reqMock) => {
      return new Promise((resolve) => {
        let statusCode = 200;
        let responseJson = null;

        const resMock = {
          status: (code) => {
            statusCode = code;
            return resMock;
          },
          json: (data) => {
            responseJson = data;
            resolve({ allowed: false, statusCode, responseJson });
          }
        };

        const nextMock = () => {
          resolve({ allowed: true, statusCode: 200, responseJson: null });
        };

        middleware(reqMock, resMock, nextMock).catch(err => {
          resolve({ allowed: false, statusCode: 500, responseJson: { message: err.message } });
        });
      });
    };

    // Test 1: SUPER_ADMIN permissions (operations write/read & emergency override)
    console.log("\n1. Testing SUPER_ADMIN access...");
    const reqSuperRead = { user: { id: superAdminUser.id, role: "SUPER_ADMIN" } };
    const superReadResult = await runMiddleware(checkPermission("operations", "read"), reqSuperRead);
    assert(superReadResult.allowed, "SUPER_ADMIN allowed read operations.");

    const reqSuperWrite = { user: { id: superAdminUser.id, role: "SUPER_ADMIN" } };
    const superWriteResult = await runMiddleware(checkPermission("operations", "write"), reqSuperWrite);
    assert(superWriteResult.allowed, "SUPER_ADMIN allowed write operations.");

    const reqSuperEmergency = { user: { id: superAdminUser.id, role: "SUPER_ADMIN" } };
    const superEmergencyResult = await runMiddleware(superAdminOnly, reqSuperEmergency);
    assert(superEmergencyResult.allowed, "SUPER_ADMIN allowed emergency overrides.");

    // Test 2: Standard ADMIN permissions (operations write/read allowed, but emergency blocked)
    console.log("\n2. Testing Standard ADMIN access...");
    const reqAdminRead = { user: { id: standardAdminUser.id, role: "ADMIN" } };
    const adminReadResult = await runMiddleware(checkPermission("operations", "read"), reqAdminRead);
    assert(adminReadResult.allowed, "Standard ADMIN allowed read operations.");

    const reqAdminWrite = { user: { id: standardAdminUser.id, role: "ADMIN" } };
    const adminWriteResult = await runMiddleware(checkPermission("operations", "write"), reqAdminWrite);
    assert(adminWriteResult.allowed, "Standard ADMIN allowed write operations.");

    const reqAdminEmergency = { user: { id: standardAdminUser.id, role: "ADMIN" } };
    const adminEmergencyResult = await runMiddleware(superAdminOnly, reqAdminEmergency);
    assert(!adminEmergencyResult.allowed && adminEmergencyResult.statusCode === 403, "Standard ADMIN blocked from emergency overrides with 403 Forbidden.");

    // Test 3: SUB_ADMIN permissions (read allowed, write blocked, emergency blocked)
    console.log("\n3. Testing SUB_ADMIN access...");
    const reqSubRead = { user: { id: subAdminUser.id, role: "ADMIN" } };
    const subReadResult = await runMiddleware(checkPermission("operations", "read"), reqSubRead);
    assert(subReadResult.allowed, "SUB_ADMIN allowed read operations.");

    const reqSubWrite = { user: { id: subAdminUser.id, role: "ADMIN" } };
    const subWriteResult = await runMiddleware(checkPermission("operations", "write"), reqSubWrite);
    assert(!subWriteResult.allowed && subWriteResult.statusCode === 403, "SUB_ADMIN blocked from write operations with 403 Forbidden.");
    assert(subWriteResult.responseJson?.message?.includes("read-only access"), `SUB_ADMIN write error message contains "read-only access"`);

    const reqSubEmergency = { user: { id: subAdminUser.id, role: "ADMIN" } };
    const subEmergencyResult = await runMiddleware(superAdminOnly, reqSubEmergency);
    assert(!subEmergencyResult.allowed && subEmergencyResult.statusCode === 403, "SUB_ADMIN blocked from emergency overrides.");

    // Cleanup temp users if we created them
    if (subAdminUser.email === "testsub@dizipay.in") {
      await prisma.user.delete({ where: { id: subAdminUser.id } });
    }
    if (standardAdminUser.email === "testadmin@dizipay.in") {
      await prisma.user.delete({ where: { id: standardAdminUser.id } });
    }

  } catch (err) {
    console.error("RBAC test threw an error:", err);
    failed++;
  } finally {
    await prisma.$disconnect();
    console.log("\n==========================================================================");
    console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log("==========================================================================");
    process.exit(failed > 0 ? 1 : 0);
  }
}

runRBACVerification();
