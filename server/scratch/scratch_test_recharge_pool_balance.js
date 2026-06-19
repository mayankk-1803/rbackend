import prisma from "../src/config/prisma.js";
import { getRechargePoolBalance } from "../src/controllers/adminMasterWalletController.js";

async function verifyEndpoint() {
  console.log("=== STARTING SCRATCH TEST FOR RECHARGE POOL BALANCE ENDPOINT ===");

  // Create a mock Super Admin user for session auth context
  let admin = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        phone: "9999999999",
        name: "Mock Super Admin",
        password: "hashed_dummy_password",
        role: "SUPER_ADMIN"
      }
    });
  }

  // Helpers to mock request and response
  const req = {
    user: admin,
    ip: "127.0.0.1",
    headers: {}
  };

  const res = {
    statusCode: 200,
    jsonData: null,
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      this.jsonData = data;
      return this;
    }
  };

  console.log("Executing getRechargePoolBalance controller action...");
  await getRechargePoolBalance(req, res);

  console.log(`HTTP Status Code: ${res.statusCode}`);
  console.log("Response JSON:", JSON.stringify(res.jsonData, null, 2));

  // Assertions
  if (res.statusCode !== 200) {
    throw new Error(`FAIL: Expected status code 200, got ${res.statusCode}`);
  }

  const data = res.jsonData;
  if (!data.success) {
    throw new Error("FAIL: Response success is not true.");
  }

  if (typeof data.balance !== "number") {
    throw new Error(`FAIL: Balance should be a number, got ${typeof data.balance}`);
  }

  if (data.status !== "ACTIVE" && data.status !== "DEGRADED") {
    throw new Error(`FAIL: Status should be ACTIVE or DEGRADED, got ${data.status}`);
  }

  if (!data.lastUpdated || isNaN(Date.parse(data.lastUpdated))) {
    throw new Error(`FAIL: lastUpdated is not a valid timestamp string: ${data.lastUpdated}`);
  }

  // Verify provider details sanitization
  const rawString = JSON.stringify(data).toLowerCase();
  const forbiddenKeywords = ["apibox", "provider", "token", "key", "secret", "url", "client"];
  
  for (const word of forbiddenKeywords) {
    if (rawString.includes(word)) {
      throw new Error(`FAIL: Sanitization check failed! Exposed word found: "${word}" in response.`);
    }
  }

  console.log("✔ SUCCESS: Sanitization verified! No provider credentials, names, or raw responses exposed.");
  console.log("=== ALL RECHARGE POOL BALANCE ENDPOINT TESTS PASSED SUCCESSFULLY ===");
}

verifyEndpoint()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("\n*** VERIFICATION TEST FAILURE ***", err);
    process.exit(1);
  });
