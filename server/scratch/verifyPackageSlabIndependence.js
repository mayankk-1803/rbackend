import { PrismaClient } from '@prisma/client';
import { 
  assignUsersToPackage, 
  assignUsersToSlab 
} from '../src/controllers/commissionAdminController.js';

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

async function testIndependence() {
  console.log("==================================================");
  console.log("RUNNING PACKAGE VS SLAB ASSIGNMENT INDEPENDENCE TEST");
  console.log("==================================================");

  // Setup Test Slabs
  const slab7 = await prisma.slab.create({ data: { name: "Test Slab 7", isActive: true } });
  const slab12 = await prisma.slab.create({ data: { name: "Test Slab 12", isActive: true } });
  const slab13 = await prisma.slab.create({ data: { name: "Test Slab 13", isActive: true } });
  const slab14 = await prisma.slab.create({ data: { name: "Test Slab 14", isActive: true } });

  // Setup Test Packages
  const pkg4 = await prisma.commissionPackage.create({ data: { name: "Test Package 4", isActive: true } });
  const pkg8 = await prisma.commissionPackage.create({ data: { name: "Test Package 8", isActive: true } });
  const pkg9 = await prisma.commissionPackage.create({ data: { name: "Test Package 9", isActive: true } });
  const pkg10 = await prisma.commissionPackage.create({ data: { name: "Test Package 10", isActive: true } });

  console.log("[Setup] Test Slabs and Packages successfully created.");

  let testUser = null;

  try {
    // Initial State Setup
    testUser = await prisma.user.create({
      data: {
        name: "Independence Test User",
        email: `indep_${Date.now()}@example.com`,
        password: "password123",
        packageId: pkg4.id,
        slabId: slab7.id,
        packageAssignedAt: new Date(Date.now() - 100000), // past date
        slabAssignedAt: new Date(Date.now() - 50000)      // past date
      }
    });

    console.log(`\n[Initial User State] ID: ${testUser.id}`);
    console.log(`- packageId: ${testUser.packageId} (Pkg 4)`);
    console.log(`- slabId: ${testUser.slabId} (Slab 7)`);
    console.log(`- packageAssignedAt: ${testUser.packageAssignedAt.toISOString()}`);
    console.log(`- slabAssignedAt: ${testUser.slabAssignedAt.toISOString()}`);

    // ----------------------------------------------------
    // TEST 1: Package change should not touch slabId
    // ----------------------------------------------------
    console.log("\n--- TEST 1: Package Change Should Not Touch Slab ---");
    const req1 = mockReq({ userIds: [testUser.id] }, { id: pkg8.id.toString() });
    const res1 = mockRes();
    await assignUsersToPackage(req1, res1);

    if (res1.statusCode !== 200) {
      throw new Error(`Package assignment failed: ${JSON.stringify(res1.data)}`);
    }

    let userState = await prisma.user.findUnique({ where: { id: testUser.id } });
    console.log(`Database Snapshot: packageId = ${userState.packageId}, slabId = ${userState.slabId}`);

    if (userState.packageId !== pkg8.id) {
      throw new Error(`FAIL: packageId was not updated to ${pkg8.id}`);
    }
    if (userState.slabId !== slab7.id) {
      throw new Error(`FAIL: slabId was incorrectly changed from ${slab7.id} to ${userState.slabId}`);
    }
    console.log("✔ TEST 1 PASSED");

    // ----------------------------------------------------
    // TEST 2: Slab change should not touch packageId
    // ----------------------------------------------------
    console.log("\n--- TEST 2: Slab Change Should Not Touch Package ---");
    const req2 = mockReq({ userIds: [testUser.id] }, { id: slab12.id.toString() });
    const res2 = mockRes();
    await assignUsersToSlab(req2, res2);

    if (res2.statusCode !== 200) {
      throw new Error(`Slab assignment failed: ${JSON.stringify(res2.data)}`);
    }

    userState = await prisma.user.findUnique({ where: { id: testUser.id } });
    console.log(`Database Snapshot: packageId = ${userState.packageId}, slabId = ${userState.slabId}`);

    if (userState.slabId !== slab12.id) {
      throw new Error(`FAIL: slabId was not updated to ${slab12.id}`);
    }
    if (userState.packageId !== pkg8.id) {
      throw new Error(`FAIL: packageId was incorrectly changed from ${pkg8.id} to ${userState.packageId}`);
    }
    console.log("✔ TEST 2 PASSED");

    // ----------------------------------------------------
    // TEST 3: Multiple package assignments do not modify slabId
    // ----------------------------------------------------
    console.log("\n--- TEST 3: Multiple Package Assignments ---");
    // Assign package 9
    const res3a = mockRes();
    await assignUsersToPackage(mockReq({ userIds: [testUser.id] }, { id: pkg9.id.toString() }), res3a);
    userState = await prisma.user.findUnique({ where: { id: testUser.id } });
    console.log(`After Package 9 assignment: packageId = ${userState.packageId}, slabId = ${userState.slabId}`);
    if (userState.slabId !== slab12.id) {
      throw new Error("FAIL: slabId changed during package 9 assignment!");
    }

    // Assign package 10
    const res3b = mockRes();
    await assignUsersToPackage(mockReq({ userIds: [testUser.id] }, { id: pkg10.id.toString() }), res3b);
    userState = await prisma.user.findUnique({ where: { id: testUser.id } });
    console.log(`After Package 10 assignment: packageId = ${userState.packageId}, slabId = ${userState.slabId}`);
    if (userState.slabId !== slab12.id) {
      throw new Error("FAIL: slabId changed during package 10 assignment!");
    }
    console.log("✔ TEST 3 PASSED: slabId remained constant at 12 throughout all package changes.");

    // ----------------------------------------------------
    // TEST 4: Multiple slab assignments do not modify packageId
    // ----------------------------------------------------
    console.log("\n--- TEST 4: Multiple Slab Assignments ---");
    // Assign slab 13
    const res4a = mockRes();
    await assignUsersToSlab(mockReq({ userIds: [testUser.id] }, { id: slab13.id.toString() }), res4a);
    userState = await prisma.user.findUnique({ where: { id: testUser.id } });
    console.log(`After Slab 13 assignment: packageId = ${userState.packageId}, slabId = ${userState.slabId}`);
    if (userState.packageId !== pkg10.id) {
      throw new Error("FAIL: packageId changed during slab 13 assignment!");
    }

    // Assign slab 14
    const res4b = mockRes();
    await assignUsersToSlab(mockReq({ userIds: [testUser.id] }, { id: slab14.id.toString() }), res4b);
    userState = await prisma.user.findUnique({ where: { id: testUser.id } });
    console.log(`After Slab 14 assignment: packageId = ${userState.packageId}, slabId = ${userState.slabId}`);
    if (userState.packageId !== pkg10.id) {
      throw new Error("FAIL: packageId changed during slab 14 assignment!");
    }
    console.log("✔ TEST 4 PASSED: packageId remained constant at 10 throughout all slab changes.");

    // ----------------------------------------------------
    // TEST 5: Timestamp validation
    // ----------------------------------------------------
    console.log("\n--- TEST 5: Timestamp Validation ---");
    // Record current values
    const beforePkgTime = userState.packageAssignedAt;
    const beforeSlabTime = userState.slabAssignedAt;

    // Execute package change
    await new Promise(resolve => setTimeout(resolve, 100)); // ensure timestamp ticks
    await assignUsersToPackage(mockReq({ userIds: [testUser.id] }, { id: pkg9.id.toString() }), mockRes());
    let state = await prisma.user.findUnique({ where: { id: testUser.id } });

    if (state.packageAssignedAt.getTime() === beforePkgTime.getTime()) {
      throw new Error("FAIL: packageAssignedAt was not updated by Package assignment!");
    }
    if (state.slabAssignedAt.getTime() !== beforeSlabTime.getTime()) {
      throw new Error("FAIL: slabAssignedAt was incorrectly updated by Package assignment!");
    }
    console.log("✔ Package Assignment timestamp validation passed.");

    // Execute slab change
    const midPkgTime = state.packageAssignedAt;
    await new Promise(resolve => setTimeout(resolve, 100));
    await assignUsersToSlab(mockReq({ userIds: [testUser.id] }, { id: slab13.id.toString() }), mockRes());
    state = await prisma.user.findUnique({ where: { id: testUser.id } });

    if (state.slabAssignedAt.getTime() === beforeSlabTime.getTime()) {
      throw new Error("FAIL: slabAssignedAt was not updated by Slab assignment!");
    }
    if (state.packageAssignedAt.getTime() !== midPkgTime.getTime()) {
      throw new Error("FAIL: packageAssignedAt was incorrectly updated by Slab assignment!");
    }
    console.log("✔ Slab Assignment timestamp validation passed.");
    console.log("✔ TEST 5 PASSED");

    // ----------------------------------------------------
    // TEST 6: Audit log validation
    // ----------------------------------------------------
    console.log("\n--- TEST 6: Audit Log Validation ---");
    
    // Check package log
    const pkgLog = await prisma.auditLog.findFirst({
      where: { action: "PACKAGE_ASSIGN", entityId: pkg9.id },
      orderBy: { createdAt: "desc" }
    });
    if (!pkgLog) {
      throw new Error("FAIL: Expected PACKAGE_ASSIGN audit log is missing!");
    }
    console.log("✔ Confirmed PACKAGE_ASSIGN audit log successfully created.");

    // Check slab log
    const slabLog = await prisma.auditLog.findFirst({
      where: { action: "SLAB_ASSIGN", entityId: slab13.id },
      orderBy: { createdAt: "desc" }
    });
    if (!slabLog) {
      throw new Error("FAIL: Expected SLAB_ASSIGN audit log is missing!");
    }
    console.log("✔ Confirmed SLAB_ASSIGN audit log successfully created.");
    console.log("✔ TEST 6 PASSED");

    // ----------------------------------------------------
    // TEST 7: Simultaneous Exist
    // ----------------------------------------------------
    console.log("\n--- TEST 7: Simultaneous Existence Check ---");
    // Ensure final db user state maps package 9 and slab 13
    if (state.packageId === pkg9.id && state.slabId === slab13.id) {
      console.log(`✔ User simultaneously has packageId = ${pkg9.id} and slabId = ${slab13.id}.`);
    } else {
      throw new Error(`FAIL: DB user simultaneous state mismatch: ${JSON.stringify(state)}`);
    }
    console.log("✔ TEST 7 PASSED");

    console.log("\n==================================================");
    console.log("ALL INDEPENDENCE VERIFICATION TESTS PASSED!");
    console.log("==================================================");

  } finally {
    console.log("\n[Cleanup] Cleaning up test slabs, packages, and user...");
    if (testUser) {
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
    await prisma.slab.deleteMany({ where: { id: { in: [slab7.id, slab12.id, slab13.id, slab14.id] } } }).catch(() => {});
    await prisma.commissionPackage.deleteMany({ where: { id: { in: [pkg4.id, pkg8.id, pkg9.id, pkg10.id] } } }).catch(() => {});
    console.log("[Cleanup] Completed.");
  }
}

testIndependence()
  .catch((e) => {
    console.error("\nTEST RUN FAILED:", e.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
