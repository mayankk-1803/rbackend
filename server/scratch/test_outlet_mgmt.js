import prisma from "../src/config/prisma.js";
import { createOutlet, updateOutlet, getOutlets, updateOutletStatus, getUsersWithoutOutlet } from "../src/controllers/enterpriseController.js";

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
  console.log("STARTING OUTLET MANAGEMENT & SECURITY POLICY TESTS");
  console.log("====================================================\n");

  const timestamp = Date.now();
  let testUser = null;
  let testAdmin = null;
  let testSuperAdmin = null;
  let createdOutlet = null;

  try {
    console.log("Configuring isolated sandbox role hierarchy test users...");
    testUser = await prisma.user.create({
      data: {
        name: "Outlet Test User",
        email: `outlet_user_${timestamp}@dizipay.in`,
        password: "hashedpassword",
        phone: `93${timestamp.toString().slice(-8)}`,
        role: "USER",
        authType: "email"
      }
    });

    testAdmin = await prisma.user.create({
      data: {
        name: "Outlet Test Admin",
        email: `outlet_admin_${timestamp}@dizipay.in`,
        password: "hashedpassword",
        phone: `94${timestamp.toString().slice(-8)}`,
        role: "ADMIN",
        authType: "email"
      }
    });

    testSuperAdmin = await prisma.user.create({
      data: {
        name: "Outlet Test SuperAdmin",
        email: `outlet_superadmin_${timestamp}@dizipay.in`,
        password: "hashedpassword",
        phone: `95${timestamp.toString().slice(-8)}`,
        role: "SUPER_ADMIN",
        authType: "email"
      }
    });

    console.log("✔ Sandbox configured successfully!");
    console.log(`Using Admin Actor: ID=${testAdmin.id}`);
    console.log(`Using Super Admin Actor: ID=${testSuperAdmin.id}`);
    console.log(`Using Target User: ID=${testUser.id}\n`);

    // ----------------------------------------------------
    // TEST 1: GET getUsersWithoutOutlet
    // ----------------------------------------------------
    console.log("[TEST 1] ADMIN queries users without an outlet...");
    const req1 = { user: testAdmin };
    const res1 = mockResponse();
    await getUsersWithoutOutlet(req1, res1);
    if (res1.data && res1.data.success) {
      const list = res1.data.data;
      const hasTarget = list.some(u => u.id === testUser.id);
      if (!hasTarget) {
        throw new Error("Target user not found in users without outlet list");
      }
      console.log(`✔ Passed! Target user is present in the list.`);
    } else {
      throw new Error(`getUsersWithoutOutlet failed: ${res1.data?.message}`);
    }

    // ----------------------------------------------------
    // TEST 2: Create Outlet (Success)
    // ----------------------------------------------------
    console.log("\n[TEST 2] ADMIN registers a new outlet for the target user...");
    const req2 = {
      body: {
        userId: testUser.id,
        name: "Test Store Delhi",
        ownerName: "Delhi Owner",
        address: "12 Main Road",
        city: "New Delhi",
        state: "Delhi",
        pincode: "110001",
        latitude: "28.6139",
        longitude: "77.2090"
      },
      user: testAdmin
    };
    const res2 = mockResponse();
    await createOutlet(req2, res2);
    if (res2.statusCode === 201 && res2.data.success) {
      createdOutlet = res2.data.data;
      console.log(`✔ Passed! Outlet created successfully in PENDING status: ID=${createdOutlet.id}`);
      if (createdOutlet.status !== "PENDING") {
        throw new Error("New outlet status does not default to PENDING");
      }
    } else {
      throw new Error(`Outlet registration failed: ${res2.data?.message || res2.statusCode}`);
    }

    // ----------------------------------------------------
    // TEST 3: Block Duplicate Outlet Creation
    // ----------------------------------------------------
    console.log("\n[TEST 3] ADMIN attempts to register a duplicate outlet for the same user...");
    const req3 = {
      body: {
        userId: testUser.id,
        name: "Test Store Delhi 2",
        ownerName: "Delhi Owner 2",
        address: "13 Main Road",
        city: "New Delhi",
        state: "Delhi",
        pincode: "110001"
      },
      user: testAdmin
    };
    const res3 = mockResponse();
    await createOutlet(req3, res3);
    if (res3.statusCode === 400) {
      console.log(`✔ Passed! Duplicate blocked correctly: ${res3.data.message}`);
    } else {
      throw new Error(`Duplicate outlet was allowed to be created! Status: ${res3.statusCode}`);
    }

    // ----------------------------------------------------
    // TEST 4: Edit Outlet Details (Success)
    // ----------------------------------------------------
    console.log("\n[TEST 4] ADMIN edits the created outlet details...");
    const req4 = {
      params: { id: createdOutlet.id.toString() },
      body: {
        name: "Updated Test Store Delhi",
        ownerName: "Delhi Owner Updated",
        address: "12 Main Road Ext",
        city: "New Delhi",
        state: "Delhi",
        pincode: "110002",
        latitude: "28.6140",
        longitude: "77.2095"
      },
      user: testAdmin
    };
    const res4 = mockResponse();
    await updateOutlet(req4, res4);
    if (res4.data && res4.data.success) {
      const updated = res4.data.data;
      console.log(`✔ Passed! Outlet updated successfully. New Name: ${updated.name}`);
      if (updated.name !== "Updated Test Store Delhi" || updated.pincode !== "110002") {
        throw new Error("Fields were not updated correctly in DB");
      }
    } else {
      throw new Error(`Outlet details update failed: ${res4.data?.message}`);
    }

    // ----------------------------------------------------
    // TEST 5: Verify Edit Audit Logs
    // ----------------------------------------------------
    console.log("\n[TEST 5] Verify audit log records for creation and edit events...");
    const logs = await prisma.auditLog.findMany({
      where: {
        entityId: createdOutlet.id,
        entity: "outlet"
      },
      orderBy: { createdAt: "desc" }
    });

    if (logs.length >= 2) {
      console.log(`✔ Passed! Found ${logs.length} audit log entries for outlet ID ${createdOutlet.id}.`);
      const editLog = logs.find(l => l.action === "OUTLET_EDIT");
      const createLog = logs.find(l => l.action === "OUTLET_CREATE");
      if (!editLog || !createLog) {
        throw new Error("Missing OUTLET_CREATE or OUTLET_EDIT audit logs");
      }
      console.log(`- Create Log Action: ${createLog.action}`);
      console.log(`- Edit Log Action: ${editLog.action}`);
    } else {
      throw new Error(`Insufficient audit logs created. Expected at least 2, found ${logs.length}`);
    }

    // ----------------------------------------------------
    // TEST 6: Role Hierarchy Enforcement on Create
    // ----------------------------------------------------
    console.log("\n[TEST 6] ADMIN attempts to register outlet for equal/higher privileged SUPER_ADMIN...");
    const req6 = {
      body: {
        userId: testSuperAdmin.id,
        name: "Super Store",
        ownerName: "Super Owner",
        address: "Address",
        city: "City",
        state: "State",
        pincode: "111111"
      },
      user: testAdmin
    };
    const res6 = mockResponse();
    await createOutlet(req6, res6);
    if (res6.statusCode === 403) {
      console.log(`✔ Passed! Access denied correctly: ${res6.data.message}`);
    } else {
      throw new Error(`Privilege escalation! ADMIN created outlet for SUPER_ADMIN. Status: ${res6.statusCode}`);
    }

    // ----------------------------------------------------
    // TEST 7: Role Hierarchy Enforcement on Edit
    // ----------------------------------------------------
    console.log("\n[TEST 7] ADMIN attempts to edit outlet belonging to SUPER_ADMIN (simulated setup)...");
    // First let's register an outlet for Super Admin as Super Admin
    const superOutlet = await prisma.outlet.create({
      data: {
        userId: testSuperAdmin.id,
        name: "Super Admin Store",
        ownerName: "Super Admin Owner",
        address: "HQ",
        city: "Delhi",
        state: "Delhi",
        pincode: "110001",
        status: "PENDING"
      }
    });

    const req7 = {
      params: { id: superOutlet.id.toString() },
      body: {
        name: "Admin Attacked Store",
        ownerName: "Owner",
        address: "Address",
        city: "City",
        state: "State",
        pincode: "110001"
      },
      user: testAdmin
    };
    const res7 = mockResponse();
    await updateOutlet(req7, res7);
    if (res7.statusCode === 403) {
      console.log(`✔ Passed! Edit denied due to role hierarchy: ${res7.data.message}`);
    } else {
      // Clean up super outlet if it wasn't blocked (should be blocked)
      await prisma.outlet.delete({ where: { id: superOutlet.id } }).catch(() => {});
      throw new Error(`Privilege escalation! ADMIN edited SUPER_ADMIN's outlet. Status: ${res7.statusCode}`);
    }
    // Clean up super outlet
    await prisma.outlet.delete({ where: { id: superOutlet.id } }).catch(() => {});

    // ----------------------------------------------------
    // TEST 8: Approve Status Workflow
    // ----------------------------------------------------
    console.log("\n[TEST 8] ADMIN approves the created outlet...");
    const req8 = {
      params: { id: createdOutlet.id.toString() },
      body: { status: "APPROVED" },
      user: testAdmin
    };
    const res8 = mockResponse();
    await updateOutletStatus(req8, res8);
    if (res8.data && res8.data.success) {
      console.log(`✔ Passed! Status updated to APPROVED.`);
      const updatedRecord = await prisma.outlet.findUnique({ where: { id: createdOutlet.id } });
      if (updatedRecord.status !== "APPROVED") {
        throw new Error("Outlet status in database is not APPROVED");
      }
    } else {
      throw new Error(`Outlet approval failed: ${res8.data?.message}`);
    }

    console.log("\n====================================================");
    console.log("ALL OUTLET MANAGEMENT TESTS PASSED SUCCESSFULLY!");
    console.log("====================================================");
  } catch (err) {
    console.error(`\n❌ [TEST FAILURE]: ${err.message}`);
    process.exit(1);
  } finally {
    console.log("\nCleaning up integration sandbox test records...");
    if (createdOutlet) {
      await prisma.outlet.delete({ where: { id: createdOutlet.id } }).catch(() => {});
      await prisma.auditLog.deleteMany({ where: { entityId: createdOutlet.id, entity: "outlet" } }).catch(() => {});
    }
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
