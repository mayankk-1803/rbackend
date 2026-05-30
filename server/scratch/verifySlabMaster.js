import { PrismaClient } from '@prisma/client';
import { 
  createSlab, 
  updateSlab, 
  deleteSlab, 
  cloneSlab, 
  assignUsersToSlab 
} from '../src/controllers/commissionAdminController.js';

const prisma = new PrismaClient();

// Helper to mock request/response objects
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
  console.log("-----------------------------------------");
  console.log("RUNNING SLAB MASTER CONSTRAINTS VERIFICATION");
  console.log("-----------------------------------------");

  // 1. Fetch default slab
  const defaultSlab = await prisma.slab.findFirst({
    where: { isDefault: true, isDeleted: false }
  });

  if (!defaultSlab) {
    throw new Error("Default Slab not found in database! Make sure to run seeding first.");
  }
  console.log("✔ Default slab found:", defaultSlab.name);

  // 2. Test: Prevent disabling default slab
  console.log("Test: Disable Default Slab (Should Fail)...");
  const res1 = mockRes();
  await updateSlab(mockReq({ isActive: false }, { id: defaultSlab.id.toString() }), res1);
  if (res1.statusCode === 400 && !res1.data.success) {
    console.log("✔ Successfully rejected disabling default slab:", res1.data.message);
  } else {
    throw new Error(`Failed! Disabled default slab with code ${res1.statusCode}`);
  }

  // 3. Test: Prevent deleting default slab
  console.log("Test: Delete Default Slab (Should Fail)...");
  const res2 = mockRes();
  await deleteSlab(mockReq({}, { id: defaultSlab.id.toString() }), res2);
  if (res2.statusCode === 400 && !res2.data.success) {
    console.log("✔ Successfully rejected deleting default slab:", res2.data.message);
  } else {
    throw new Error(`Failed! Deleted default slab with code ${res2.statusCode}`);
  }

  // 4. Test: Create a new test slab
  console.log("Test: Create New Slab (Should Succeed)...");
  const res3 = mockRes();
  const testSlabName = "Verify Slab " + Date.now();
  await createSlab(mockReq({ name: testSlabName, description: "Test Verification Slab", isActive: true }), res3);
  if (res3.statusCode === 200 && res3.data.success) {
    console.log("✔ Created test slab successfully:", res3.data.data.name);
  } else {
    throw new Error(`Failed to create slab: ${JSON.stringify(res3.data)}`);
  }
  const createdSlabId = res3.data.data.id;

  // 5. Test: Edit the created slab
  console.log("Test: Edit Slab (Should Succeed)...");
  const res4 = mockRes();
  await updateSlab(mockReq({ name: testSlabName + " Modified", description: "Modified desc", isActive: true }, { id: createdSlabId.toString() }), res4);
  if (res4.statusCode === 200 && res4.data.success) {
    console.log("✔ Updated test slab successfully:", res4.data.data.name);
  } else {
    throw new Error(`Failed to update slab: ${JSON.stringify(res4.data)}`);
  }

  // 6. Test: Clone the slab
  console.log("Test: Clone Slab (Should Succeed)...");
  const res5 = mockRes();
  const cloneSlabName = "Cloned Slab " + Date.now();
  await cloneSlab(mockReq({ name: cloneSlabName, description: "Cloned slab rules" }, { id: createdSlabId.toString() }), res5);
  if (res5.statusCode === 200 && res5.data.success) {
    console.log("✔ Cloned slab successfully:", res5.data.data.name);
  } else {
    throw new Error(`Failed to clone slab: ${JSON.stringify(res5.data)}`);
  }
  const clonedSlabId = res5.data.data.id;

  // 7. Establish package-slab linkage to test active package & user protections
  console.log("Setting up active package & user linkages for cloned slab...");
  const testPackage = await prisma.commissionPackage.create({
    data: {
      name: "Verify Package " + Date.now(),
      description: "Test Package for Slab Deletion Protection"
    }
  });

  // Link cloned slab to test package
  await prisma.packageServiceSlab.create({
    data: {
      packageId: testPackage.id,
      serviceCategoryId: 1, // RECHARGE Category ID
      slabId: clonedSlabId
    }
  });

  // Assign user 1 to this test package
  await prisma.user.update({
    where: { id: 1 },
    data: { packageId: testPackage.id }
  });

  // 8. Test: Prevent deleting slab linked to packages / active users
  console.log("Test: Delete Slab with Active Package Linkage (Should Fail)...");
  const res7 = mockRes();
  await deleteSlab(mockReq({}, { id: clonedSlabId.toString() }), res7);
  if (res7.statusCode === 400 && !res7.data.success) {
    console.log("✔ Successfully blocked deleting slab linked to packages/active users:", res7.data.message);
  } else {
    throw new Error(`Failed! Allowed deleting linked slab with code ${res7.statusCode}`);
  }

  // Restore user package & clean up linkages
  await prisma.user.update({
    where: { id: 1 },
    data: { packageId: 1 }
  });

  await prisma.packageServiceSlab.deleteMany({
    where: { packageId: testPackage.id }
  });

  await prisma.commissionPackage.delete({
    where: { id: testPackage.id }
  });

  // 9. Test: Soft delete slab
  console.log("Test: Soft Delete Slab (Should Succeed)...");
  const res8 = mockRes();
  await deleteSlab(mockReq({}, { id: createdSlabId.toString() }), res8);
  if (res8.statusCode === 200 && res8.data.success) {
    console.log("✔ Soft deleted test slab successfully");
  } else {
    throw new Error(`Failed to delete slab: ${JSON.stringify(res8.data)}`);
  }

  const checkDb = await prisma.slab.findUnique({ where: { id: createdSlabId } });
  if (checkDb.isDeleted && checkDb.deletedAt !== null) {
    console.log("✔ DB check confirms soft-delete flag set correctly");
  } else {
    throw new Error("DB check failed: Slab is not soft-deleted in database!");
  }

  // 10. Verify audit logging
  console.log("Test: Verify Audit Logs (Should Succeed)...");
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      action: { in: ["SLAB_CREATE", "SLAB_UPDATE", "SLAB_CLONE", "SLAB_ASSIGN_USERS", "SLAB_DELETE"] }
    },
    orderBy: { createdAt: "desc" },
    take: 5
  });

  if (auditLogs.length >= 5) {
    console.log("✔ Confirmed 5+ Slab audit log entries recorded in database:");
    auditLogs.forEach(log => {
      console.log(`  - [${log.action}] Entity: ${log.entity}:${log.entityId} (IP: ${log.ipAddress})`);
    });
  } else {
    throw new Error(`Audit logs verification failed: Only found ${auditLogs.length} logs!`);
  }

  // Cleanup cloned slab
  await prisma.slab.update({
    where: { id: clonedSlabId },
    data: { isDeleted: true, deletedAt: new Date() }
  });

  console.log("-----------------------------------------");
  console.log("ALL SLAB MASTER CONSTRAINTS VERIFIED SUCCESSFULLY!");
  console.log("-----------------------------------------");
}

runTests()
  .catch((e) => {
    console.error("FAIL:", e.message || e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
