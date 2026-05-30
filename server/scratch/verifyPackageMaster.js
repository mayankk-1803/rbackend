import { PrismaClient } from '@prisma/client';
import { 
  createPackage, 
  updatePackage, 
  deletePackage, 
  clonePackage, 
  assignUsersToPackage,
  getPackages
} from '../src/controllers/commissionAdminController.js';
import { checkCommissionPermission } from '../src/routes/commissionAdminRoutes.js';

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

const mockReq = (body = {}, params = {}, query = {}, user = { id: 1, role: "SUPER_ADMIN" }) => {
  return {
    body,
    params,
    query,
    user,
    ip: "127.0.0.1",
    headers: { "user-agent": "verification-script" }
  };
};

async function runTests() {
  console.log("==================================================");
  console.log("RUNNING PACKAGE MASTER VERIFICATION TEST SUITE");
  console.log("==================================================");

  // 1. Fetch default package
  const defaultPkg = await prisma.commissionPackage.findFirst({
    where: { isDefault: true, isDeleted: false }
  });

  if (!defaultPkg) {
    throw new Error("Default package not found! Make sure to run seeding first.");
  }
  console.log(`[Setup] Default package found: ${defaultPkg.name} (ID: ${defaultPkg.id})`);

  // Fetch a slab for mapping
  const testSlab = await prisma.slab.findFirst({
    where: { isDeleted: false }
  });
  if (!testSlab) {
    throw new Error("No slab found in database! Make sure to seed commission data.");
  }
  console.log(`[Setup] Using Slab for mapping: ${testSlab.name} (ID: ${testSlab.id})`);

  // Fetch first service category
  const testCat = await prisma.serviceCategory.findFirst({
    where: { isActive: true }
  });
  if (!testCat) {
    throw new Error("No active ServiceCategory found! Run seeding.");
  }
  console.log(`[Setup] Using Service Category: ${testCat.name} (ID: ${testCat.id})`);

  let createdPkgId = null;
  let clonedPkgId = null;
  let testUser = null;

  try {
    // ----------------------------------------------------
    // TEST 1: Default Package Protection
    // ----------------------------------------------------
    console.log("\n--- TEST 1: Default Package Protection ---");
    
    // Attempt disable
    console.log("Attempting to disable Default Package...");
    const res1a = mockRes();
    await updatePackage(mockReq({ isActive: false }, { id: defaultPkg.id.toString() }), res1a);
    if (res1a.statusCode === 400 && !res1a.data.success) {
      console.log("✔ Correctly rejected disabling default package:", res1a.data.message);
    } else {
      throw new Error(`Failed Test 1A! Status code: ${res1a.statusCode}`);
    }

    // Attempt delete
    console.log("Attempting to delete Default Package...");
    const res1b = mockRes();
    await deletePackage(mockReq({}, { id: defaultPkg.id.toString() }), res1b);
    if (res1b.statusCode === 400 && !res1b.data.success) {
      console.log("✔ Correctly rejected deleting default package:", res1b.data.message);
    } else {
      throw new Error(`Failed Test 1B! Status code: ${res1b.statusCode}`);
    }

    // ----------------------------------------------------
    // TEST 2: Package CRUD & Service Matrix
    // ----------------------------------------------------
    console.log("\n--- TEST 2: Package CRUD & Service Matrix ---");
    const testPkgName = "Verify Package " + Date.now();
    const matrixPayload = { [testCat.id]: testSlab.id };

    console.log(`Creating package: "${testPkgName}"...`);
    const res2a = mockRes();
    await createPackage(mockReq({
      name: testPkgName,
      description: "Verification Package Description",
      cost: "199.50",
      expiryDays: "30",
      selfAssignment: true,
      isActive: true,
      matrix: matrixPayload
    }), res2a);

    if (res2a.statusCode === 200 && res2a.data.success) {
      createdPkgId = res2a.data.data.id;
      console.log(`✔ Package created successfully! ID: ${createdPkgId}`);
    } else {
      throw new Error(`Failed package creation: ${JSON.stringify(res2a.data)}`);
    }

    // Verify matrix mapping in DB
    const matrixLink = await prisma.packageServiceSlab.findUnique({
      where: { packageId_serviceCategoryId: { packageId: createdPkgId, serviceCategoryId: testCat.id } }
    });
    if (matrixLink && matrixLink.slabId === testSlab.id) {
      console.log("✔ Dynamic Service Matrix link found in DB matching the request slab.");
    } else {
      throw new Error("Failed to verify Service Matrix link in database.");
    }

    // Update package
    console.log("Updating package cost and description...");
    const res2b = mockRes();
    await updatePackage(mockReq({
      name: testPkgName,
      cost: "249.00",
      description: "Updated Verification Package"
    }, { id: createdPkgId.toString() }), res2b);

    if (res2b.statusCode === 200 && res2b.data.success) {
      console.log("✔ Package details updated successfully!");
    } else {
      throw new Error(`Failed to update package: ${JSON.stringify(res2b.data)}`);
    }

    // ----------------------------------------------------
    // TEST 3: Package Clone
    // ----------------------------------------------------
    console.log("\n--- TEST 3: Package Clone ---");
    const clonePkgName = "Cloned Package " + Date.now();

    console.log(`Cloning Package ${createdPkgId} into "${clonePkgName}"...`);
    const res3a = mockRes();
    await clonePackage(mockReq({
      name: clonePkgName,
      description: "Cloned package verify"
    }, { id: createdPkgId.toString() }), res3a);

    if (res3a.statusCode === 200 && res3a.data.success) {
      clonedPkgId = res3a.data.data.id;
      console.log(`✔ Package cloned successfully! ID: ${clonedPkgId}`);
    } else {
      throw new Error(`Failed to clone package: ${JSON.stringify(res3a.data)}`);
    }

    // Verify properties cloned
    const clonedPkg = await prisma.commissionPackage.findUnique({ where: { id: clonedPkgId } });
    if (clonedPkg.cost === 249.00 && clonedPkg.expiryDays === 30 && clonedPkg.selfAssignment === true && clonedPkg.isDefault === false) {
      console.log("✔ Cloned package cost, expiry, selfAssignment, and default flag are verified.");
    } else {
      throw new Error(`Cloned package metadata mismatch: ${JSON.stringify(clonedPkg)}`);
    }

    // Verify matrix link copied
    const clonedLink = await prisma.packageServiceSlab.findUnique({
      where: { packageId_serviceCategoryId: { packageId: clonedPkgId, serviceCategoryId: testCat.id } }
    });
    if (clonedLink && clonedLink.slabId === testSlab.id) {
      console.log("✔ Service Matrix mappings duplicated successfully to the cloned package.");
    } else {
      throw new Error("Cloned package lacks Service Matrix mappings.");
    }

    // Clone duplicate block check
    console.log("Checking duplicate clone block...");
    const res3b = mockRes();
    await clonePackage(mockReq({ name: clonePkgName }, { id: createdPkgId.toString() }), res3b);
    if (res3b.statusCode === 400 && !res3b.data.success) {
      console.log("✔ Correctly blocked duplicate package name clone:", res3b.data.message);
    } else {
      throw new Error(`Duplicate clone name validation failed! status: ${res3b.statusCode}`);
    }

    // ----------------------------------------------------
    // TEST 4: Package Assignment
    // ----------------------------------------------------
    console.log("\n--- TEST 4: Package Assignment ---");
    testUser = await prisma.user.create({
      data: {
        name: "Pkg Test User",
        email: `pkg_user_${Date.now()}@example.com`,
        password: "password123",
        packageId: defaultPkg.id
      }
    });
    console.log(`Created user ${testUser.id} initialized with packageId = ${testUser.packageId}`);

    console.log(`Assigning user ${testUser.id} to package ${createdPkgId}...`);
    const res4a = mockRes();
    await assignUsersToPackage(mockReq({ userIds: [testUser.id] }, { id: createdPkgId.toString() }), res4a);

    if (res4a.statusCode === 200 && res4a.data.success) {
      console.log("✔ User assigned successfully!");
    } else {
      throw new Error(`Failed to assign user: ${JSON.stringify(res4a.data)}`);
    }

    const assignedUser = await prisma.user.findUnique({ where: { id: testUser.id } });
    if (assignedUser.packageId === createdPkgId && assignedUser.packageAssignedAt !== null && assignedUser.packageExpiresAt !== null) {
      console.log("✔ Database confirms packageId, packageAssignedAt, and packageExpiresAt were populated correctly.");
    } else {
      throw new Error(`User assignment database state invalid: ${JSON.stringify(assignedUser)}`);
    }

    // Delete protection: assigned users check
    console.log("Attempting to delete package currently assigned to users...");
    const res4b = mockRes();
    await deletePackage(mockReq({}, { id: createdPkgId.toString() }), res4b);
    if (res4b.statusCode === 400 && !res4b.data.success) {
      console.log("✔ Correctly blocked deleting package with active users:", res4b.data.message);
    } else {
      throw new Error(`Failed delete-assigned protection test! Status: ${res4b.statusCode}`);
    }

    // Cleanup user to test delete slab linkage check
    await prisma.user.delete({ where: { id: testUser.id } });
    testUser = null;

    // Delete protection: linked to active slabs check
    console.log("Attempting to delete package currently linked to active slabs...");
    const res4c = mockRes();
    await deletePackage(mockReq({}, { id: createdPkgId.toString() }), res4c);
    if (res4c.statusCode === 400 && !res4c.data.success) {
      console.log("✔ Correctly blocked deleting package linked to active slabs:", res4c.data.message);
    } else {
      throw new Error(`Failed delete-slab-linkage protection test! Status: ${res4c.statusCode}`);
    }

    // Cleanup matrix links to allow soft delete
    await prisma.packageServiceSlab.deleteMany({ where: { packageId: createdPkgId } });
    console.log("[Cleanup] Matrix links removed from package.");

    // Delete Package (Soft delete)
    console.log("Performing soft delete...");
    const res4d = mockRes();
    await deletePackage(mockReq({}, { id: createdPkgId.toString() }), res4d);
    if (res4d.statusCode === 200 && res4d.data.success) {
      const deletedPkg = await prisma.commissionPackage.findUnique({ where: { id: createdPkgId } });
      if (deletedPkg.isDeleted === true && deletedPkg.deletedAt !== null) {
        console.log("✔ Soft delete succeeded! Database flag isDeleted=true, deletedAt is set.");
      } else {
        throw new Error("Database flags are incorrect after soft-delete execution.");
      }
    } else {
      throw new Error(`Soft delete failed: ${JSON.stringify(res4d.data)}`);
    }

    // ----------------------------------------------------
    // TEST 5: Audit Logs
    // ----------------------------------------------------
    console.log("\n--- TEST 5: Audit Log Verification ---");
    const actions = ["PACKAGE_CREATE", "PACKAGE_UPDATE", "PACKAGE_CLONE", "PACKAGE_ASSIGN", "PACKAGE_DELETE"];
    const logs = await prisma.auditLog.findMany({
      where: { action: { in: actions } },
      orderBy: { createdAt: "desc" }
    });

    console.log(`Found ${logs.length} Package audit logs in database.`);
    const foundActions = logs.map(l => l.action);
    const missing = actions.filter(a => !foundActions.includes(a));

    if (missing.length === 0) {
      console.log("✔ Verified: Audit logs exist for all actions: CREATE, UPDATE, CLONE, ASSIGN, DELETE.");
    } else {
      throw new Error(`Missing expected audit actions: ${missing.join(", ")}`);
    }

    // ----------------------------------------------------
    // TEST 6: RBAC Protection
    // ----------------------------------------------------
    console.log("\n--- TEST 6: RBAC Protection (SUB_ADMIN Read-Only) ---");
    
    // Set user.commissionRole to SUB_ADMIN for testing middleware
    // We can simulate req.user details or run test directly against middleware
    const mockMiddlewareReq = {
      user: { id: 1, role: "ADMIN" } // JWT says ADMIN
    };
    
    // In Dizipay db commissionRole determines granular access:
    // Let's temporarily set User ID 1 commissionRole to SUB_ADMIN to verify
    const originalRole = (await prisma.user.findUnique({ where: { id: 1 }, select: { commissionRole: true } })).commissionRole;
    await prisma.user.update({ where: { id: 1 }, data: { commissionRole: "SUB_ADMIN" } });

    const middleware = checkCommissionPermission("write");
    const mockMiddlewareRes = mockRes();
    let nextCalled = false;
    const mockNext = () => { nextCalled = true; };

    await middleware(mockMiddlewareReq, mockMiddlewareRes, mockNext);

    // Restore role
    await prisma.user.update({ where: { id: 1 }, data: { commissionRole: originalRole } });

    if (mockMiddlewareRes.statusCode === 403 && !nextCalled) {
      console.log("✔ Correctly blocked write action for SUB_ADMIN role: returned 403 Forbidden");
    } else {
      throw new Error(`RBAC failure: SUB_ADMIN was not blocked from writing! status: ${mockMiddlewareRes.statusCode}`);
    }

    console.log("\n==================================================");
    console.log("STATUS: ALL 6 PACKAGE MASTER TESTS PASSED!");
    console.log("==================================================");

  } finally {
    console.log("\n[Cleanup] Cleaning up created users, package clones, and test entries...");
    if (testUser) {
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
    if (createdPkgId) {
      await prisma.packageServiceSlab.deleteMany({ where: { packageId: createdPkgId } }).catch(() => {});
      await prisma.commissionPackage.delete({ where: { id: createdPkgId } }).catch(() => {});
    }
    if (clonedPkgId) {
      await prisma.packageServiceSlab.deleteMany({ where: { packageId: clonedPkgId } }).catch(() => {});
      await prisma.commissionPackage.delete({ where: { id: clonedPkgId } }).catch(() => {});
    }
    console.log("[Cleanup] Completed.");
  }
}

runTests()
  .catch((e) => {
    console.error("\nTEST RUN FAILED:", e.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
