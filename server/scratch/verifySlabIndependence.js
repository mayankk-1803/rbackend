import { PrismaClient } from '@prisma/client';
import { assignUsersToSlab } from '../src/controllers/commissionAdminController.js';

const prisma = new PrismaClient();

const mockRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    data: null,
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (obj) {
      this.data = obj;
      return this;
    }
  };
  return res;
};

const mockReq = (body = {}, params = {}) => {
  return {
    body,
    params,
    user: { id: 1, role: "SUPER_ADMIN" },
    ip: "127.0.0.1",
    headers: { "user-agent": "verification-script" }
  };
};

async function runAllTests() {
  console.log("==================================================");
  console.log("RUNNING SLAB ASSIGNMENT DECOUPLING VERIFICATION TESTS");
  console.log("==================================================");

  // Set up common test resources
  const testSlab = await prisma.slab.create({
    data: {
      name: "Decouple Test Slab " + Date.now(),
      description: "Temp slab for verification",
      isActive: true
    }
  });

  const testPackage = await prisma.commissionPackage.create({
    data: {
      name: "Decouple Test Package " + Date.now(),
      description: "Temp package for verification",
      isActive: true
    }
  });

  console.log(`[Setup] Created test Slab ID: ${testSlab.id}`);
  console.log(`[Setup] Created test Package ID: ${testPackage.id}`);

  let testUser = null;
  let testUsersBatch = [];

  try {
    // ----------------------------------------------------
    // TEST 1: Package remains unchanged after Slab Assignment
    // TEST 2: Slab changes correctly after Slab Assignment
    // ----------------------------------------------------
    console.log("\n--- TEST 1 & 2: Single User Slab Assignment ---");
    testUser = await prisma.user.create({
      data: {
        name: "Test User Single",
        email: `single_${Date.now()}@example.com`,
        password: "password123",
        packageId: testPackage.id,
        slabId: null
      }
    });
    console.log(`Created user ${testUser.id} with packageId=${testUser.packageId}, slabId=null`);

    // Assign to slab
    const req1 = mockReq({ userIds: [testUser.id] }, { id: testSlab.id.toString() });
    const res1 = mockRes();
    await assignUsersToSlab(req1, res1);

    if (res1.statusCode !== 200) {
      throw new Error(`Slab assignment failed with status ${res1.statusCode}: ${JSON.stringify(res1.data)}`);
    }

    const userAfterSlab = await prisma.user.findUnique({ where: { id: testUser.id } });
    
    // Check Test 1
    if (userAfterSlab.packageId !== testPackage.id) {
      console.log(`FAIL: User packageId changed from ${testPackage.id} to ${userAfterSlab.packageId}`);
      throw new Error("TEST 1 FAILED");
    } else {
      console.log("✔ TEST 1 PASSED: packageId remained unchanged.");
    }

    // Check Test 2
    if (userAfterSlab.slabId !== testSlab.id) {
      console.log(`FAIL: User slabId was not updated to ${testSlab.id} (got ${userAfterSlab.slabId})`);
      throw new Error("TEST 2 FAILED");
    } else {
      console.log("✔ TEST 2 PASSED: slabId updated correctly.");
    }

    // ----------------------------------------------------
    // TEST 3: Package assignment still works & leaves slabId unchanged
    // ----------------------------------------------------
    console.log("\n--- TEST 3: Package Assignment Works Independently ---");
    const testPackage2 = await prisma.commissionPackage.create({
      data: {
        name: "Second Test Package " + Date.now(),
        isActive: true
      }
    });

    // Simulate package assignment (updates packageId, packageAssignedAt)
    await prisma.user.update({
      where: { id: testUser.id },
      data: {
        packageId: testPackage2.id,
        packageAssignedAt: new Date()
      }
    });

    const userAfterPackage = await prisma.user.findUnique({ where: { id: testUser.id } });

    if (userAfterPackage.packageId !== testPackage2.id) {
      console.log(`FAIL: packageId did not update to ${testPackage2.id}`);
      throw new Error("TEST 3 FAILED");
    } else if (userAfterPackage.slabId !== testSlab.id) {
      console.log(`FAIL: package assignment modified slabId (got ${userAfterPackage.slabId}, expected ${testSlab.id})`);
      throw new Error("TEST 3 FAILED");
    } else {
      console.log("✔ TEST 3 PASSED: packageId updated, slabId remained unchanged.");
    }

    await prisma.commissionPackage.delete({ where: { id: testPackage2.id } });

    // ----------------------------------------------------
    // TEST 4: Multiple users batch assignment
    // ----------------------------------------------------
    console.log("\n--- TEST 4: Batch Slab Assignment ---");
    // Create 10 users
    for (let i = 0; i < 10; i++) {
      const u = await prisma.user.create({
        data: {
          name: `Batch User ${i}`,
          email: `batch_${i}_${Date.now()}@example.com`,
          password: "password123",
          packageId: testPackage.id,
          slabId: null
        }
      });
      testUsersBatch.push(u);
    }
    const batchIds = testUsersBatch.map(u => u.id);
    console.log(`Created 10 batch users: ${batchIds.join(", ")}`);

    const req4 = mockReq({ userIds: batchIds }, { id: testSlab.id.toString() });
    const res4 = mockRes();
    await assignUsersToSlab(req4, res4);

    if (res4.statusCode !== 200) {
      throw new Error(`Batch assignment failed: ${JSON.stringify(res4.data)}`);
    }

    const updatedBatchUsers = await prisma.user.findMany({
      where: { id: { in: batchIds } }
    });

    let test4Failed = false;
    for (const u of updatedBatchUsers) {
      if (u.slabId !== testSlab.id) {
        console.log(`FAIL: User ${u.id} slabId is ${u.slabId}, expected ${testSlab.id}`);
        test4Failed = true;
      }
      if (u.packageId !== testPackage.id) {
        console.log(`FAIL: User ${u.id} packageId changed to ${u.packageId}`);
        test4Failed = true;
      }
    }

    if (test4Failed) {
      throw new Error("TEST 4 FAILED");
    } else {
      console.log("✔ TEST 4 PASSED: All 10 users slabId updated correctly, packageId untouched.");
    }

    // ----------------------------------------------------
    // TEST 5: Audit logs
    // ----------------------------------------------------
    console.log("\n--- TEST 5: Audit Log Verification ---");
    const latestAudit = await prisma.auditLog.findFirst({
      where: { action: "SLAB_ASSIGN", entityId: testSlab.id },
      orderBy: { createdAt: "desc" }
    });

    if (!latestAudit) {
      console.log("FAIL: No audit log entry found for SLAB_ASSIGN action.");
      throw new Error("TEST 5 FAILED");
    } else {
      console.log("✔ TEST 5 PASSED: Audit log recorded successfully.");
      console.log("Audit details:", JSON.stringify(latestAudit.details));
    }

    console.log("\n==================================================");
    console.log("STATUS: ALL TESTS PASSED SUCCESSFULLY! (DECOUPLED)");
    console.log("==================================================");

  } finally {
    console.log("\n[Cleanup] Cleaning up created users, package, and slab...");
    if (testUser) {
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
    for (const u of testUsersBatch) {
      await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
    }
    await prisma.commissionPackage.delete({ where: { id: testPackage.id } }).catch(() => {});
    await prisma.slab.delete({ where: { id: testSlab.id } }).catch(() => {});
    console.log("[Cleanup] Completed.");
  }
}

runAllTests()
  .catch((e) => {
    console.error("\nTEST RUN FAILED:", e.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
