import prisma from "../src/config/prisma.js";
import {
  getManageableUsers,
  convertPartner,
  rotatePartnerSecret,
  togglePartnerStatus,
  updatePartnerEnvironment,
  updatePartnerRateLimit,
  getPartnerUsage,
  revokePartner,
  createAgreement,
  updateAgreement,
  deleteAgreement,
  updateAgreementStatus
} from "../src/controllers/enterpriseController.js";

// Mock Express Response
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
  console.log("STARTING PARTNER & AGREEMENT AUTOMATION WORKFLOW TESTS");
  console.log("====================================================\n");

  // Create temporary Admin and Super Admin users
  console.log("Setting up sandbox test accounts...");
  const adminEmail = `temp_admin_${Date.now()}@irecharge.in`;
  const superAdminEmail = `temp_superadmin_${Date.now()}@irecharge.in`;
  
  const adminUser = await prisma.user.create({
    data: {
      name: "Temp Sandbox Admin",
      email: adminEmail,
      password: "hashedpassword123",
      role: "ADMIN",
      isActive: true,
      authType: "email"
    }
  });

  const superAdminUser = await prisma.user.create({
    data: {
      name: "Temp Sandbox SuperAdmin",
      email: superAdminEmail,
      password: "hashedpassword123",
      role: "SUPER_ADMIN",
      isActive: true,
      authType: "email"
    }
  });

  console.log(`Mocked Admin: ID=${adminUser.id}, Role=${adminUser.role}`);
  console.log(`Mocked Super Admin: ID=${superAdminUser.id}, Role=${superAdminUser.role}`);

  // Create a clean active test user
  console.log("\nSetting up active test user...");
  const testUserEmail = `automation_test_user_${Date.now()}@irecharge.in`;
  const testUser = await prisma.user.create({
    data: {
      name: "Automation Test User",
      email: testUserEmail,
      phone: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      password: "hashedpassword123",
      role: "USER",
      isActive: true,
      authType: "email",
      wallet: {
        create: {
          balance: 500.00
        }
      }
    }
  });
  console.log(`Created Test User: ID=${testUser.id}, Role=${testUser.role}, Email=${testUser.email}`);

  let apiAccessId = null;

  try {
    // Test 1: getManageableUsers
    console.log("\n[Test 1] Testing getManageableUsers...");
    const req1 = { 
      user: { id: adminUser.id, role: adminUser.role },
      ip: "127.0.0.1",
      headers: { "user-agent": "test-runner" }
    };
    const res1 = mockResponse();
    await getManageableUsers(req1, res1);
    
    if (res1.data && res1.data.success) {
      console.log(`✔️ Success: Fetched ${res1.data.data.length} manageable users.`);
      const found = res1.data.data.find(u => u.id === testUser.id);
      if (found) {
        console.log(`✔️ Success: Created test user is visible to Admin.`);
      } else {
        throw new Error("Created test user was NOT visible to Admin in getManageableUsers!");
      }
    } else {
      throw new Error(`Failed to fetch manageable users: ${JSON.stringify(res1.data)}`);
    }

    // Test 2: convertPartner (promote user to API_USER)
    console.log("\n[Test 2] Testing convertPartner...");
    const req2 = {
      user: { id: adminUser.id, role: adminUser.role },
      body: { userId: testUser.id, rateLimit: 120, environment: "PRODUCTION" },
      ip: "127.0.0.1",
      headers: { "user-agent": "test-runner" }
    };
    const res2 = mockResponse();
    await convertPartner(req2, res2);

    if (res2.statusCode === 201 && res2.data.success) {
      apiAccessId = res2.data.data.id;
      console.log(`✔️ Success: Promoted user to API Partner. apiAccessId = ${apiAccessId}`);
      if (res2.data.data.apiSecret) {
        console.log(`✔️ Success: Plain API Secret returned ONCE: ${res2.data.data.apiSecret}`);
      } else {
        throw new Error("Plain API Secret was not returned in payload!");
      }
    } else {
      throw new Error(`Failed to convert user: ${JSON.stringify(res2.data)}`);
    }

    // Double check database status
    const dbUserAfterConvert = await prisma.user.findUnique({
      where: { id: testUser.id },
      include: { apiAccesses: true }
    });
    if (dbUserAfterConvert.role === "API_USER" && dbUserAfterConvert.apiAccesses.length === 1) {
      console.log(`✔️ Success: Database updated - role is API_USER and ApiAccess record exists.`);
    } else {
      throw new Error("Database role or ApiAccess record did not update correctly after promotion!");
    }

    // Test 3: convertPartner duplicate protection
    console.log("\n[Test 3] Testing convertPartner duplicate conversion protection...");
    const res3 = mockResponse();
    await convertPartner(req2, res3);
    if (res3.statusCode === 400) {
      console.log(`✔️ Success: Duplicate promotion rejected safely with message: "${res3.data.message}"`);
    } else {
      throw new Error(`Failed duplicate check. Got status ${res3.statusCode}: ${JSON.stringify(res3.data)}`);
    }

    // Test 4: rotatePartnerSecret
    console.log("\n[Test 4] Testing rotatePartnerSecret...");
    const req4 = {
      user: { id: adminUser.id, role: adminUser.role },
      params: { id: apiAccessId },
      ip: "127.0.0.1",
      headers: { "user-agent": "test-runner" }
    };
    const res4 = mockResponse();
    await rotatePartnerSecret(req4, res4);

    if (res4.data && res4.data.success) {
      console.log(`✔️ Success: API Secret rotated. New secret: ${res4.data.apiSecret}`);
    } else {
      throw new Error(`Failed to rotate secret: ${JSON.stringify(res4.data)}`);
    }

    // Test 5: togglePartnerStatus (Suspend API Partner)
    console.log("\n[Test 5] Testing togglePartnerStatus (Suspend)...");
    const req5 = {
      user: { id: adminUser.id, role: adminUser.role },
      params: { id: apiAccessId },
      body: { isActive: false },
      ip: "127.0.0.1",
      headers: { "user-agent": "test-runner" }
    };
    const res5 = mockResponse();
    await togglePartnerStatus(req5, res5);

    if (res5.data && res5.data.success) {
      console.log(`✔️ Success: Partner suspended. State in DB: ${res5.data.data.isActive}`);
      if (res5.data.data.isActive === false) {
        console.log("✔️ Success: DB state matches expected suspended status.");
      } else {
        throw new Error("DB state does not match suspended status.");
      }
    } else {
      throw new Error(`Failed to suspend partner: ${JSON.stringify(res5.data)}`);
    }

    // Test 6: updatePartnerEnvironment (Switch to SANDBOX)
    console.log("\n[Test 6] Testing updatePartnerEnvironment (SANDBOX)...");
    const req6 = {
      user: { id: adminUser.id, role: adminUser.role },
      params: { id: apiAccessId },
      body: { environment: "SANDBOX" },
      ip: "127.0.0.1",
      headers: { "user-agent": "test-runner" }
    };
    const res6 = mockResponse();
    await updatePartnerEnvironment(req6, res6);

    if (res6.data && res6.data.success) {
      console.log(`✔️ Success: Toggled sandbox state. Environment is now: ${res6.data.data.environment}`);
    } else {
      throw new Error(`Failed to update environment: ${JSON.stringify(res6.data)}`);
    }

    // Test 7: updatePartnerRateLimit
    console.log("\n[Test 7] Testing updatePartnerRateLimit...");
    const req7 = {
      user: { id: adminUser.id, role: adminUser.role },
      params: { id: apiAccessId },
      body: { rateLimit: 250 },
      ip: "127.0.0.1",
      headers: { "user-agent": "test-runner" }
    };
    const res7 = mockResponse();
    await updatePartnerRateLimit(req7, res7);

    if (res7.data && res7.data.success) {
      console.log(`✔️ Success: Rate limit set to ${res7.data.data.rateLimit}`);
    } else {
      throw new Error(`Failed to update rate limit: ${JSON.stringify(res7.data)}`);
    }

    // Test 8: getPartnerUsage
    console.log("\n[Test 8] Testing getPartnerUsage...");
    const req8 = {
      user: { id: adminUser.id, role: adminUser.role },
      params: { id: apiAccessId },
      ip: "127.0.0.1",
      headers: { "user-agent": "test-runner" }
    };
    const res8 = mockResponse();
    await getPartnerUsage(req8, res8);

    if (res8.data && res8.data.success) {
      console.log(`✔️ Success: Fetched partner usage logs. Count = ${res8.data.data.length}`);
    } else {
      throw new Error(`Failed to fetch partner usage logs: ${JSON.stringify(res8.data)}`);
    }

    // Test 9: createAgreement
    console.log("\n[Test 9] Testing createAgreement (Direct Admin Creation)...");
    const req9 = {
      user: { id: adminUser.id, role: adminUser.role },
      body: { userId: testUser.id, title: "Automation Master Agreement v1.0", content: "Terms and conditions clauses..." },
      ip: "127.0.0.1",
      headers: { "user-agent": "test-runner" }
    };
    const res9 = mockResponse();
    await createAgreement(req9, res9);

    let agreementId = null;
    if (res9.statusCode === 201 && res9.data.success) {
      agreementId = res9.data.data.id;
      console.log(`✔️ Success: Created agreement directly. ID = ${agreementId}, Status = ${res9.data.data.status}`);
    } else {
      throw new Error(`Failed to create agreement: ${JSON.stringify(res9.data)}`);
    }

    // Test 10: updateAgreement (Edit agreement parameters while pending)
    console.log("\n[Test 10] Testing updateAgreement (Pending state)...");
    const req10 = {
      user: { id: adminUser.id, role: adminUser.role },
      params: { id: agreementId },
      body: { title: "Updated Agreement Title", content: "Updated content clauses..." },
      ip: "127.0.0.1",
      headers: { "user-agent": "test-runner" }
    };
    const res10 = mockResponse();
    await updateAgreement(req10, res10);

    if (res10.data && res10.data.success) {
      console.log(`✔️ Success: Updated pending agreement successfully. New title: "${res10.data.data.title}"`);
    } else {
      throw new Error(`Failed to update pending agreement: ${JSON.stringify(res10.data)}`);
    }

    // Test 11: updateAgreementStatus (Approve agreement)
    console.log("\n[Test 11] Testing updateAgreementStatus (Approve contract)...");
    const req11 = {
      user: { id: adminUser.id, role: adminUser.role },
      params: { id: agreementId },
      body: { status: "APPROVED", remarks: "Approved by test script" },
      ip: "127.0.0.1",
      headers: { "user-agent": "test-runner" }
    };
    const res11 = mockResponse();
    await updateAgreementStatus(req11, res11);

    if (res11.data && res11.data.success) {
      console.log(`✔️ Success: Agreement approved. Status: ${res11.data.data.status}`);
    } else {
      throw new Error(`Failed to approve agreement: ${JSON.stringify(res11.data)}`);
    }

    // Test 12: updateAgreement Immutability Protection
    console.log("\n[Test 12] Testing updateAgreement Immutability Protection (ADMIN edit attempt on APPROVED agreement)...");
    const res12 = mockResponse();
    await updateAgreement(req10, res12);

    if (res12.statusCode === 400) {
      console.log(`✔️ Success: ADMIN modification blocked on approved agreement: "${res12.data.message}"`);
    } else {
      throw new Error(`Security Failure: ADMIN was allowed to edit APPROVED agreement! Status = ${res12.statusCode}`);
    }

    // Test 13: deleteAgreement Immutability Protection
    console.log("\n[Test 13] Testing deleteAgreement Immutability Protection (ADMIN delete attempt on APPROVED agreement)...");
    const req13 = {
      user: { id: adminUser.id, role: adminUser.role },
      params: { id: agreementId },
      ip: "127.0.0.1",
      headers: { "user-agent": "test-runner" }
    };
    const res13 = mockResponse();
    await deleteAgreement(req13, res13);

    if (res13.statusCode === 400) {
      console.log(`✔️ Success: ADMIN deletion blocked on approved agreement: "${res13.data.message}"`);
    } else {
      throw new Error(`Security Failure: ADMIN was allowed to delete APPROVED agreement! Status = ${res13.statusCode}`);
    }

    // Test 14: updateAgreementStatus Immutability Protection
    console.log("\n[Test 14] Testing updateAgreementStatus Immutability Protection (ADMIN status change attempt on APPROVED agreement)...");
    const req14 = {
      user: { id: adminUser.id, role: adminUser.role },
      params: { id: agreementId },
      body: { status: "PENDING", remarks: "Reopen attempt by admin" },
      ip: "127.0.0.1",
      headers: { "user-agent": "test-runner" }
    };
    const res14 = mockResponse();
    await updateAgreementStatus(req14, res14);

    if (res14.statusCode === 400) {
      console.log(`✔️ Success: ADMIN status change blocked on approved agreement: "${res14.data.message}"`);
    } else {
      throw new Error(`Security Failure: ADMIN was allowed to change status of APPROVED agreement! Status = ${res14.statusCode}`);
    }

    // Test 15: SUPER_ADMIN bypass of immutability
    console.log("\n[Test 15] Testing SUPER_ADMIN force-reopen (bypass immutability)...");
    const req15 = {
      user: { id: superAdminUser.id, role: superAdminUser.role },
      params: { id: agreementId },
      body: { status: "PENDING", remarks: "Force reopen by super admin" },
      ip: "127.0.0.1",
      headers: { "user-agent": "test-runner" }
    };
    const res15 = mockResponse();
    await updateAgreementStatus(req15, res15);

    if (res15.data && res15.data.success) {
      console.log(`✔️ Success: SUPER_ADMIN successfully force-reopened agreement. Status is now: ${res15.data.data.status}`);
    } else {
      throw new Error(`Failed SUPER_ADMIN bypass reopen: ${JSON.stringify(res15.data)}`);
    }

    // Test 16: SUPER_ADMIN delete pending agreement
    console.log("\n[Test 16] Testing SUPER_ADMIN agreement delete...");
    const req16 = {
      user: { id: superAdminUser.id, role: superAdminUser.role },
      params: { id: agreementId },
      ip: "127.0.0.1",
      headers: { "user-agent": "test-runner" }
    };
    const res16 = mockResponse();
    await deleteAgreement(req16, res16);

    if (res16.data && res16.data.success) {
      console.log(`✔️ Success: SUPER_ADMIN deleted agreement successfully.`);
    } else {
      throw new Error(`Failed to delete agreement as SUPER_ADMIN: ${JSON.stringify(res16.data)}`);
    }

    // Test 17: revokePartner (demote API Partner and purge credentials)
    console.log("\n[Test 17] Testing revokePartner...");
    const req17 = {
      user: { id: adminUser.id, role: adminUser.role },
      params: { id: apiAccessId },
      ip: "127.0.0.1",
      headers: { "user-agent": "test-runner" }
    };
    const res17 = mockResponse();
    await revokePartner(req17, res17);

    if (res17.data && res17.data.success) {
      console.log(`✔️ Success: API Partner privileges revoked. Message: "${res17.data.message}"`);
    } else {
      throw new Error(`Failed to revoke partner: ${JSON.stringify(res17.data)}`);
    }

    // Verify user role demoted back to USER in DB
    const dbUserAfterRevoke = await prisma.user.findUnique({
      where: { id: testUser.id },
      include: { apiAccesses: true }
    });
    if (dbUserAfterRevoke.role === "USER" && dbUserAfterRevoke.apiAccesses.length === 0) {
      console.log(`✔️ Success: Database validated. Role is back to USER and ApiAccess record is deleted.`);
    } else {
      throw new Error(`Revocation database check failed: Role is ${dbUserAfterRevoke.role}, apiAccesses length = ${dbUserAfterRevoke.apiAccesses.length}`);
    }

    console.log("\n====================================================");
    console.log("ALL ENTERPRISE OPERATIONS SYSTEM TESTS COMPLETED WITH SUCCESS!");
    console.log("====================================================");

  } finally {
    // Cleanup test data
    console.log("\nCleaning up test user and admin data...");
    try {
      const userIds = [testUser?.id, adminUser?.id, superAdminUser?.id].filter(Boolean);
      
      if (userIds.length > 0) {
        // 1. Delete usages
        await prisma.apiUsage.deleteMany({
          where: {
            apiAccess: {
              userId: { in: userIds }
            }
          }
        });
        
        // 2. Delete apiAccesses
        await prisma.apiAccess.deleteMany({
          where: {
            userId: { in: userIds }
          }
        });

        // 3. Delete agreements
        await prisma.agreement.deleteMany({
          where: {
            userId: { in: userIds }
          }
        });

        // 4. Delete wallets
        await prisma.wallet.deleteMany({
          where: {
            userId: { in: userIds }
          }
        });

        // 5. Delete audit logs referencing these users
        await prisma.auditLog.deleteMany({
          where: {
            OR: [
              { userId: { in: userIds } },
              { adminId: { in: userIds } }
            ]
          }
        });
        
        // 6. Finally delete users
        for (const uid of userIds) {
          await prisma.user.delete({ where: { id: uid } });
        }
      }
      console.log("✔️ Cleanup completed successfully.");
    } catch (cleanupErr) {
      console.error("⚠️ Cleanup failed:", cleanupErr.message);
    }
  }
}

runTests().catch(err => {
  console.error("\n❌ TEST SUITE CRASHED:", err);
  process.exit(1);
});
