import prisma from "../src/config/prisma.js";
import { getUsers, getSingleUser, toggleUserStatus, topUpWallet, getUsersStats } from "../src/controllers/adminController.js";
import { executeBulkAction, updateRbacPermissions } from "../src/controllers/enterpriseController.js";

const mockResponse = () => {
  const res = {};
  res.json = (data) => {
    res.data = data;
    return res;
  };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  return res;
};

async function runTests() {
  console.log("====================================================");
  console.log("STARTING ROLE HIERARCHY SECURITY AND PRIVILEGE TESTS");
  console.log("====================================================\n");

  const timestamp = Date.now();
  let testUser = null;
  let testAdmin = null;
  let testSuperAdmin = null;

  try {
    console.log("Configuring isolated sandbox role hierarchy test users...");
    testUser = await prisma.user.create({
      data: {
        name: "Hierarchy Test User",
        email: `test_user_${timestamp}@dizipay.in`,
        password: "hashedpassword",
        phone: `90${timestamp.toString().slice(-8)}`,
        role: "USER",
        authType: "email"
      }
    });

    testAdmin = await prisma.user.create({
      data: {
        name: "Hierarchy Test Admin",
        email: `test_admin_${timestamp}@dizipay.in`,
        password: "hashedpassword",
        phone: `91${timestamp.toString().slice(-8)}`,
        role: "ADMIN",
        authType: "email"
      }
    });

    testSuperAdmin = await prisma.user.create({
      data: {
        name: "Hierarchy Test SuperAdmin",
        email: `test_superadmin_${timestamp}@dizipay.in`,
        password: "hashedpassword",
        phone: `92${timestamp.toString().slice(-8)}`,
        role: "SUPER_ADMIN",
        authType: "email"
      }
    });

    console.log("✔ Sandbox configured successfully!");
    console.log(`Using Admin Actor: ID=${testAdmin.id}`);
    console.log(`Using Super Admin Actor: ID=${testSuperAdmin.id}`);
    console.log(`Using Target User: ID=${testUser.id}\n`);

    // ----------------------------------------------------
    // TEST 1: ADMIN Querying getUsers
    // ----------------------------------------------------
    console.log("[TEST 1] ADMIN requests user directory list...");
    const req1 = { query: { role: "ALL" }, user: testAdmin };
    const res1 = mockResponse();
    await getUsers(req1, res1);
    if (res1.data && res1.data.success) {
      const usersList = res1.data.data.users;
      const invalidUsers = usersList.filter(u => u.role === "ADMIN" || u.role === "SUPER_ADMIN");
      if (invalidUsers.length > 0) {
        throw new Error("ADMIN actor was able to query ADMIN or SUPER_ADMIN users!");
      }
      console.log(`✔ Passed! List filtered correctly. Query returned ${usersList.length} subordinate users.`);
    } else {
      throw new Error(`getUsers failed: ${res1.data?.message}`);
    }

    // ----------------------------------------------------
    // TEST 2: ADMIN Querying getUsersStats
    // ----------------------------------------------------
    console.log("\n[TEST 2] ADMIN requests user directory statistics...");
    const req2 = { user: testAdmin };
    const res2 = mockResponse();
    await getUsersStats(req2, res2);
    if (res2.data && res2.data.success) {
      console.log(`✔ Passed! Total manageable users: ${res2.data.data.totalUsers}`);
    } else {
      throw new Error(`getUsersStats failed: ${res2.data?.message}`);
    }

    // ----------------------------------------------------
    // TEST 3: ADMIN fetching SUPER_ADMIN details
    // ----------------------------------------------------
    console.log("\n[TEST 3] ADMIN requests SUPER_ADMIN details (getSingleUser)...");
    const req3 = { params: { id: testSuperAdmin.id.toString() }, user: testAdmin };
    const res3 = mockResponse();
    await getSingleUser(req3, res3);
    if (res3.statusCode === 403) {
      console.log(`✔ Passed! Access denied correctly: ${res3.data.message}`);
    } else {
      throw new Error(`Privilege escalation! ADMIN was able to fetch SUPER_ADMIN details. Status: ${res3.statusCode}`);
    }

    // ----------------------------------------------------
    // TEST 4: ADMIN modifying SUPER_ADMIN status
    // ----------------------------------------------------
    console.log("\n[TEST 4] ADMIN attempts to toggle SUPER_ADMIN status...");
    const req4 = { params: { id: testSuperAdmin.id.toString() }, body: { isActive: false }, user: testAdmin };
    const res4 = mockResponse();
    await toggleUserStatus(req4, res4);
    if (res4.statusCode === 403) {
      console.log(`✔ Passed! Access denied correctly: ${res4.data.message}`);
    } else {
      throw new Error(`Privilege escalation! ADMIN was able to modify SUPER_ADMIN status. Status: ${res4.statusCode}`);
    }

    // ----------------------------------------------------
    // TEST 5: ADMIN funding SUPER_ADMIN wallet
    // ----------------------------------------------------
    console.log("\n[TEST 5] ADMIN attempts to top up SUPER_ADMIN wallet...");
    const req5 = { body: { userId: testSuperAdmin.id, amount: "100.00", description: "Illegal credit" }, user: testAdmin };
    const res5 = mockResponse();
    await topUpWallet(req5, res5);
    if (res5.statusCode === 403) {
      console.log(`✔ Passed! Access denied correctly: ${res5.data.message}`);
    } else {
      throw new Error(`Privilege escalation! ADMIN was able to fund SUPER_ADMIN wallet. Status: ${res5.statusCode}`);
    }

    // ----------------------------------------------------
    // TEST 6: ADMIN modifying SUPER_ADMIN RBAC Matrix
    // ----------------------------------------------------
    console.log("\n[TEST 6] ADMIN attempts to update SUPER_ADMIN RBAC Matrix...");
    const req6 = { body: { role: "SUPER_ADMIN", module: "users", action: "delete", granted: false }, user: testAdmin };
    const res6 = mockResponse();
    await updateRbacPermissions(req6, res6);
    if (res6.statusCode === 403) {
      console.log(`✔ Passed! Access denied correctly: ${res6.data.message}`);
    } else {
      throw new Error(`Privilege escalation! ADMIN was able to update SUPER_ADMIN permissions. Status: ${res6.statusCode}`);
    }

    // ----------------------------------------------------
    // TEST 7: ADMIN executing Bulk Action on ADMIN/SUPER_ADMIN
    // ----------------------------------------------------
    console.log("\n[TEST 7] ADMIN attempts Bulk Action deactivation on ADMIN...");
    const req7 = { body: { userIds: [testAdmin.id], actionType: "deactivate" }, user: testAdmin };
    const res7 = mockResponse();
    await executeBulkAction(req7, res7);
    if (res7.data && res7.data.success) {
      const bulkResults = res7.data.data;
      if (bulkResults.failed === 1 && bulkResults.errors[0].error.includes("Role hierarchy violation")) {
        console.log(`✔ Passed! Bulk transaction safely protected: ${bulkResults.errors[0].error}`);
      } else {
        throw new Error("Bulk action was able to run on an ADMIN user!");
      }
    } else {
      throw new Error(`Bulk action transaction wrapper failed: ${res7.data?.message}`);
    }

    // ----------------------------------------------------
    // TEST 8: SUPER_ADMIN managing subordinate ADMIN
    // ----------------------------------------------------
    console.log("\n[TEST 8] SUPER_ADMIN manages subordinate ADMIN details...");
    const req8 = { params: { id: testAdmin.id.toString() }, user: testSuperAdmin };
    const res8 = mockResponse();
    await getSingleUser(req8, res8);
    if (res8.data && res8.data.success) {
      console.log(`✔ Passed! SUPER_ADMIN fetched ADMIN detail successfully: Name=${res8.data.data.name}`);
    } else {
      throw new Error(`SUPER_ADMIN unable to manage ADMIN: ${res8.data?.message}`);
    }

    console.log("\n====================================================");
    console.log("ALL ROLE HIERARCHY SECURITY TESTS PASSED SUCCESSFULLY!");
    console.log("====================================================");
  } catch (err) {
    console.error(`\n❌ [TEST FAILURE]: ${err.message}`);
    process.exit(1);
  } finally {
    console.log("\nCleaning up integration sandbox test accounts...");
    if (testUser) await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    if (testAdmin) await prisma.user.delete({ where: { id: testAdmin.id } }).catch(() => {});
    if (testSuperAdmin) await prisma.user.delete({ where: { id: testSuperAdmin.id } }).catch(() => {});
    console.log("✔ Sandbox teardown completed successfully!");
  }
}

runTests()
  .then(() => {
    prisma.$disconnect();
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ [FATAL UNHANDLED EXCEPTION]:", err.message);
    prisma.$disconnect();
    process.exit(1);
  });
