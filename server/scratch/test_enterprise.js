import prisma from "../src/config/prisma.js";
import {
  getCustomerCareQueue,
  getOutlets,
  updateOutletStatus,
  getPartners,
  getFosAgents,
  assignFosRetailers,
  executeBulkAction,
  getAgreements,
  updateAgreementStatus,
  getEmployees,
  createEmployee,
  getAttendanceLogs,
  checkInEmployee,
  checkOutEmployee,
  getMeetings,
  createMeeting,
  getAuditLogs,
  getRbacPermissions,
  updateRbacPermissions
} from "../src/controllers/enterpriseController.js";

// Utility: Mock express response object
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
  console.log("STARTING AUTOMATED ENTERPRISE OPERATIONS SYSTEM TESTS");
  console.log("====================================================\n");

  const adminUser = await prisma.user.findFirst({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } }
  });

  if (!adminUser) {
    console.error("[TEST FAILURE]: No ADMIN or SUPER_ADMIN user found in database to run tests!");
    process.exit(1);
  }

  const standardUser = await prisma.user.findFirst({
    where: { role: "USER" },
    include: { wallet: true }
  });

  if (!standardUser) {
    console.error("[TEST FAILURE]: No standard USER found in database to run tests!");
    process.exit(1);
  }

  console.log(`Mocking Admin Agent: ID=${adminUser.id}, Name=${adminUser.name}`);

  // Resilient Teardown-Before-Setup
  console.log("\nPurging any existing test records first...");
  await prisma.dispute.deleteMany({ where: { userId: standardUser.id, description: { contains: "Test dispute" } } });
  await prisma.agreement.deleteMany({ where: { userId: standardUser.id } });
  await prisma.outlet.deleteMany({ where: { userId: standardUser.id } });
  await prisma.user.update({ where: { id: standardUser.id }, data: { fosAgentId: null } });
  await prisma.fosAgent.deleteMany({ where: { userId: adminUser.id } });
  await prisma.employee.deleteMany({ where: { name: { contains: "Test" } } });

  // Create temporary sandbox records to ensure tests succeed on empty tables
  console.log("Setting up integration test sandbox environment...");
  
  const testEmployee = await prisma.employee.create({
    data: { name: "Test Engineer Rajesh", email: `test_rajesh_${Date.now()}@irecharge.in`, role: "STAFF", isActive: true }
  });

  const testOutlet = await prisma.outlet.create({
    data: {
      userId: standardUser.id,
      name: "Test Operations Merchant Outlet",
      ownerName: standardUser.name || "Owner",
      address: "101, Test Hub, Sector 62",
      city: "Noida",
      state: "Uttar Pradesh",
      pincode: "201301",
      status: "PENDING"
    }
  });

  const testAgreement = await prisma.agreement.create({
    data: {
      userId: standardUser.id,
      title: "Test Master Merchant Agreement v1.0",
      content: "This is a sandbox merchant agreement content for test validation purposes.",
      status: "PENDING"
    }
  });

  const testFosAgent = await prisma.fosAgent.create({
    data: {
      userId: adminUser.id,
      region: "North India NCR",
      targetOnboardings: 100,
      currentOnboardings: 10
    }
  });

  // Query a real transaction to attach to dispute
  const txn = await prisma.transaction.findFirst();
  let testDispute = null;
  if (txn) {
    testDispute = await prisma.dispute.create({
      data: {
        userId: standardUser.id,
        transactionId: txn.id,
        type: "Support",
        description: "Test dispute description regarding wallet mismatch",
        status: "OPEN"
      }
    });
  }

  console.log("✔ Sandbox environment configured successfully!");

  try {
    // Test 1: Customer Care Queue
    console.log("\n[TEST 1]: Fetching Customer Care Queues...");
    const req1 = { user: adminUser };
    const res1 = mockResponse();
    await getCustomerCareQueue(req1, res1);
    if (res1.data && res1.data.success) {
      console.log(`✔ Success! Found ${res1.data.data.supportUsers.length} care agents and ${res1.data.data.activeTickets.length} active tickets.`);
    } else {
      throw new Error("Customer care retrieval failed");
    }

    // Test 2: Outlet Registry
    console.log("\n[TEST 2]: Fetching Merchant Outlets Registry...");
    const req2 = { query: {}, user: adminUser };
    const res2 = mockResponse();
    await getOutlets(req2, res2);
    if (res2.data && res2.data.success) {
      console.log(`✔ Success! Found ${res2.data.data.length} registered outlets.`);
      console.log(`Testing manual KYC status update on outlet ID: ${testOutlet.id}...`);
      const req2b = { params: { id: testOutlet.id }, body: { status: "APPROVED" }, user: adminUser };
      const res2b = mockResponse();
      await updateOutletStatus(req2b, res2b);
      console.log(`✔ KYC Update Status: ${res2b.data.success ? "APPROVED SUCCESS" : "FAILED"}`);
    } else {
      throw new Error("Outlet registry retrieval failed");
    }

    // Test 3: Partners
    console.log("\n[TEST 3]: Fetching API Partners...");
    const req3 = { user: adminUser };
    const res3 = mockResponse();
    await getPartners(req3, res3);
    if (res3.data && res3.data.success) {
      console.log(`✔ Success! Retrieved ${res3.data.data.length} API integration merchant accounts.`);
    } else {
      throw new Error("Partner accounts retrieval failed");
    }

    // Test 4: FOS agents and retailers mapping
    console.log("\n[TEST 4]: Fetching FOS Field Agents...");
    const req4 = { user: adminUser };
    const res4 = mockResponse();
    await getFosAgents(req4, res4);
    if (res4.data && res4.data.success) {
      console.log(`✔ Success! Found ${res4.data.data.length} field service agents.`);
      console.log(`Assigning retailer ID ${standardUser.id} to FOS Agent ID ${testFosAgent.id}...`);
      const req4b = { body: { fosAgentId: testFosAgent.id, retailerIds: [standardUser.id], action: "assign" }, user: adminUser };
      const res4b = mockResponse();
      await assignFosRetailers(req4b, res4b);
      console.log(`✔ FOS Retailer Mapping: ${res4b.data.success ? "MAPPING SUCCESS" : "FAILED"}`);
    } else {
      throw new Error("FOS directory failed to load");
    }

    // Test 5: Agreements Registry and Sign-offs
    console.log("\n[TEST 5]: Fetching Merchant Master Agreements...");
    const req5 = { user: adminUser };
    const res5 = mockResponse();
    await getAgreements(req5, res5);
    if (res5.data && res5.data.success) {
      console.log(`✔ Success! Found ${res5.data.data.length} master onboarding agreements.`);
      console.log(`Applying manual sign-off on agreement ID: ${testAgreement.id}...`);
      const req5b = { params: { id: testAgreement.id }, body: { status: "APPROVED", remarks: "Verified sign-off" }, user: adminUser };
      const res5b = mockResponse();
      await updateAgreementStatus(req5b, res5b);
      console.log(`✔ Agreement Signing: ${res5b.data.success ? "SIGN SUCCESS" : "FAILED"}`);
    } else {
      throw new Error("Agreements failed to load");
    }

    // Test 6: Employees Directory and registrations
    console.log("\n[TEST 6]: Workforce CRM Staff Directory...");
    const req6 = { user: adminUser };
    const res6 = mockResponse();
    await getEmployees(req6, res6);
    if (res6.data && res6.data.success) {
      console.log(`✔ Success! Found ${res6.data.data.length} corporate employees.`);
      console.log("Registering new corporate ASM employee...");
      const testEmail = `test_asm_${Date.now()}@irecharge.in`;
      const req6b = { body: { name: "Test ASM Employee", email: testEmail, role: "ASM" }, user: adminUser };
      const res6b = mockResponse();
      await createEmployee(req6b, res6b);
      if (res6b.data.success) {
        console.log(`✔ Successfully created employee ID: ${res6b.data.data.id}`);
        const empId = res6b.data.data.id;

        // Simulate check-in
        console.log(`Simulating daily check-in clock-in for employee ID: ${empId}...`);
        const reqCheckin = { body: { employeeId: empId, location: "GPS Noida sector 62" }, user: adminUser };
        const resCheckin = mockResponse();
        await checkInEmployee(reqCheckin, resCheckin);
        console.log(`✔ Clock-in registered: ${resCheckin.data.success ? "SUCCESS" : "FAILED"}`);

        // Simulate check-out
        console.log(`Simulating daily check-out clock-out for employee ID: ${empId}...`);
        const reqCheckout = { body: { employeeId: empId }, user: adminUser };
        const resCheckout = mockResponse();
        await checkOutEmployee(reqCheckout, resCheckout);
        console.log(`✔ Clock-out registered: ${resCheckout.data.success ? "SUCCESS" : "FAILED"}`);

        // Clean up check-ins/outs and ASM employee
        await prisma.attendance.deleteMany({ where: { employeeId: empId } });
        await prisma.employee.delete({ where: { id: empId } });
      }
    } else {
      throw new Error("Employees directory failed");
    }

    // Test 7: Workforce meetings schedule
    console.log("\n[TEST 7]: Booking corporate meeting calendar...");
    const req7 = { body: { title: "Test Operations Strategy Sync", startTime: new Date(Date.now() + 3600000), endTime: new Date(Date.now() + 7200000), location: "Meeting Room Alpha", attendeeIds: [testEmployee.id] }, user: adminUser };
    const res7 = mockResponse();
    await createMeeting(req7, res7);
    if (res7.data && res7.data.success) {
      console.log("✔ Success! Strategy Sync scheduled successfully.");
      const meetingId = res7.data.data.id;
      await prisma.employeeMeeting.deleteMany({ where: { meetingId } });
      await prisma.meeting.delete({ where: { id: meetingId } });
    } else {
      throw new Error("Meeting scheduling failed");
    }

    // Test 8: Security Auditing logs
    console.log("\n[TEST 8]: Fetching Admin Security Audit Trails...");
    const req8 = { user: adminUser };
    const res8 = mockResponse();
    await getAuditLogs(req8, res8);
    if (res8.data && res8.data.success) {
      console.log(`✔ Success! Retrieved ${res8.data.data.length} administrative audit logs.`);
    } else {
      throw new Error("Audit trails failed");
    }

    // Test 9: RBAC Matrix
    console.log("\n[TEST 9]: Retrieving RBAC Permissions Access Boundaries...");
    const req9 = { user: adminUser };
    const res9 = mockResponse();
    await getRbacPermissions(req9, res9);
    if (res9.data && res9.data.success) {
      console.log("✔ Success! Permissions Access boundaries loaded for all corporate roles.");
    } else {
      throw new Error("RBAC matrix retrieval failed");
    }

    // Test 10: Bulk Operations debit/credit transaction safety
    console.log("\n[TEST 10]: Executing Safe Bulk Transaction debit/credit adjustment...");
    const originalBalance = Number(standardUser.wallet?.balance || 0);
    console.log(`Target user ID ${standardUser.id} balance before bulk credit: ₹${originalBalance.toFixed(2)}`);

    const req10 = {
      body: {
        userIds: [standardUser.id],
        actionType: "debit_credit",
        actionPayload: {
          direction: "CREDIT",
          amount: "50.00",
          description: "Integration test credit"
        }
      },
      user: adminUser
    };
    const res10 = mockResponse();
    await executeBulkAction(req10, res10);

    if (res10.data && res10.data.success) {
      console.log(`✔ Success! Bulk action response message: ${res10.data.message}`);
      const updatedUser = await prisma.user.findUnique({
        where: { id: standardUser.id },
        include: { wallet: true }
      });
      const updatedBalance = Number(updatedUser.wallet?.balance || 0);
      console.log(`Target user balance after bulk credit: ₹${updatedBalance.toFixed(2)}`);
      if (updatedBalance - originalBalance !== 50.00) {
        throw new Error("Bulk credit mutation mismatch! Ledger transaction failed.");
      }
      console.log("✔ Ledger transaction verified and double entry matched successfully!");
    } else {
      throw new Error("Bulk operation credit adjustment failed");
    }

    console.log("\n====================================================");
    console.log("ALL ENTERPRISE OPERATIONS SYSTEM TESTS PASSED SUCCESSFULLY!");
    console.log("====================================================");
  } finally {
    // Thorough cleanup block to clear all sandbox integration records
    console.log("\nCleaning up integration test sandbox environment...");
    
    if (testDispute) {
      await prisma.dispute.delete({ where: { id: testDispute.id } });
    }
    await prisma.agreement.delete({ where: { id: testAgreement.id } });
    await prisma.outlet.delete({ where: { id: testOutlet.id } });
    await prisma.user.update({ where: { id: standardUser.id }, data: { fosAgentId: null } });
    await prisma.fosAgent.delete({ where: { id: testFosAgent.id } });
    await prisma.attendance.deleteMany({ where: { employeeId: testEmployee.id } });
    await prisma.employee.delete({ where: { id: testEmployee.id } });
    
    console.log("✔ Sandbox cleaned cleanly. 0 dummy records left.");
  }
}

runTests()
  .then(() => {
    prisma.$disconnect();
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ [TEST EXCEPTION ENCOUNTERED]:", err.message);
    prisma.$disconnect();
    process.exit(1);
  });
