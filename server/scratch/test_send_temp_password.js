import prisma from '../src/config/prisma.js';
import { sendTemporaryPassword } from '../src/controllers/adminController.js';

async function main() {
  console.log("--- Starting Temporary Password Controller Test ---");

  // 1. Setup mock user of authType "phone" (id = 32, "Finalization Test User")
  // Let's first check if the test user exists, otherwise find/create one.
  let testUser = await prisma.user.findFirst({
    where: { email: "finalization_test_user@dizipay.com" }
  });

  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        name: "Finalization Test User",
        email: "finalization_test_user@dizipay.com",
        password: "hashedpassword",
        phone: "9876543210",
        authType: "phone",
        role: "USER"
      }
    });
  }

  // Ensure it has authType "phone" to test the rejection
  await prisma.user.update({
    where: { id: testUser.id },
    data: { authType: "phone" }
  });

  // Define response helper
  const makeMockRes = (resolve) => {
    let statusCode = 200;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        resolve({ statusCode, data });
      }
    };
    return res;
  };

  // Run test 1: Reject temporary password for authType !== "email"
  console.log("Test 1: Testing OTP user temp password rejection...");
  const req1 = {
    params: { id: testUser.id.toString() },
    user: { id: 2, role: "ADMIN" }, // Mock admin ID and role
    ip: "127.0.0.1",
    headers: {
      "user-agent": "mock-agent"
    }
  };

  const response1 = await new Promise((resolve) => {
    const res = makeMockRes(resolve);
    sendTemporaryPassword(req1, res).catch(resolve);
  });

  console.log("Test 1 Result Status:", response1.statusCode);
  console.log("Test 1 Result Data:", response1.data);
  if (response1.statusCode === 400 && response1.data?.message === "Temporary password is only available for email-based accounts.") {
    console.log("✓ Test 1 Passed!");
  } else {
    console.error("✗ Test 1 Failed!");
    process.exit(1);
  }

  // Run test 2: Allow temporary password for authType === "email"
  console.log("Test 2: Testing Email user temp password acceptance...");
  await prisma.user.update({
    where: { id: testUser.id },
    data: { authType: "email" }
  });

  const req2 = {
    params: { id: testUser.id.toString() },
    user: { id: 2, role: "ADMIN" }, // Mock admin ID and role
    ip: "127.0.0.1",
    headers: {
      "user-agent": "mock-agent"
    }
  };

  const response2 = await new Promise((resolve) => {
    const res = makeMockRes(resolve);
    sendTemporaryPassword(req2, res).catch(resolve);
  });

  console.log("Test 2 Result Status:", response2.statusCode);
  console.log("Test 2 Result Data:", response2.data);
  if (response2.statusCode === 200 && response2.data?.success === true) {
    console.log("✓ Test 2 Passed!");
  } else {
    console.error("✗ Test 2 Failed!");
    process.exit(1);
  }

  // Cleanup: restore authType of testUser
  await prisma.user.update({
    where: { id: testUser.id },
    data: { authType: "phone" }
  });

  console.log("--- All Tests Passed! ---");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
