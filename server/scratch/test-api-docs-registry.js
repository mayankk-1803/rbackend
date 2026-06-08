import prisma from "../src/config/prisma.js";
import { getApiDocsRegistry } from "../src/controllers/adminController.js";

async function runTest() {
  console.log("=== API DOCS REGISTRY FILTERING TEST ===");

  // Ensure some permissions exist in the DB for role ADMIN
  // Let's create or update permissions for module 'wallets' and 'operations'
  await prisma.rolePermission.upsert({
    where: {
      role_module: {
        role: "ADMIN",
        module: "wallets"
      }
    },
    update: { canRead: true, canWrite: true },
    create: { role: "ADMIN", module: "wallets", canRead: true, canWrite: true }
  });

  await prisma.rolePermission.upsert({
    where: {
      role_module: {
        role: "ADMIN",
        module: "operations"
      }
    },
    update: { canRead: false, canWrite: false },
    create: { role: "ADMIN", module: "operations", canRead: false, canWrite: false }
  });

  // Mock response builder
  const mockRes = () => {
    const res = {};
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data) => {
      res.jsonData = data;
      return res;
    };
    return res;
  };

  // Case 1: Unauthorized user
  console.log("\nTesting Case 1: No user (unauthorized)");
  const req1 = { user: null };
  const res1 = mockRes();
  await getApiDocsRegistry(req1, res1);
  console.log("Status:", res1.statusCode || 200);
  console.log("Response:", res1.jsonData);

  // Case 2: SUPER_ADMIN
  console.log("\nTesting Case 2: SUPER_ADMIN user (should get full registry)");
  const req2 = { user: { role: "SUPER_ADMIN", id: 1 } };
  const res2 = mockRes();
  await getApiDocsRegistry(req2, res2);
  console.log("Success:", res2.jsonData.success);
  console.log("Number of groups:", res2.jsonData.groups?.length);
  const adminApiGroup = res2.jsonData.groups?.find(g => g.name === "Admin APIs");
  console.log("Has Admin APIs:", !!adminApiGroup);
  if (adminApiGroup) {
    console.log("Admin endpoints count:", adminApiGroup.endpoints.length);
  }

  // Case 3: ADMIN with restricted permissions
  console.log("\nTesting Case 3: ADMIN user with restricted permissions (wallets=true, operations=false)");
  const req3 = { user: { role: "ADMIN", id: 2 } };
  const res3 = mockRes();
  await getApiDocsRegistry(req3, res3);
  console.log("Success:", res3.jsonData.success);
  console.log("Filtered Groups:");
  res3.jsonData.groups.forEach(g => {
    console.log(`- Group "${g.name}": ${g.endpoints.length} endpoints`);
    g.endpoints.forEach(e => {
      console.log(`  * ${e.method} ${e.path} (isDeveloper: ${!!e.isDeveloper}, module: ${e.module || "none"})`);
    });
  });

  // Check that only wallets endpoints are present, operations are excluded
  const walletGroup = res3.jsonData.groups.find(g => g.name === "Wallet");
  console.log("Wallet Group exists for ADMIN:", !!walletGroup);
  if (walletGroup) {
    const hasAdminTopup = walletGroup.endpoints.some(e => e.path === "/api/admin/topup");
    console.log("  Contains '/api/admin/topup' (module: wallets):", hasAdminTopup);
  }
  
  const txnGroup = res3.jsonData.groups.find(g => g.name === "Transactions");
  console.log("Transactions Group exists for ADMIN:", !!txnGroup);
  if (txnGroup) {
    const hasRetry = txnGroup.endpoints.some(e => e.path === "/api/admin/retry/{id}");
    console.log("  Contains '/api/admin/retry/{id}' (module: operations):", hasRetry);
  }

  // Case 4: Developer / Retailer (should only get developer endpoints)
  console.log("\nTesting Case 4: RETAILER / DEVELOPER user");
  const req4 = { user: { role: "RETAILER", id: 3 } };
  const res4 = mockRes();
  await getApiDocsRegistry(req4, res4);
  console.log("Success:", res4.jsonData.success);
  console.log("Filtered Groups:");
  res4.jsonData.groups.forEach(g => {
    console.log(`- Group "${g.name}": ${g.endpoints.length} endpoints`);
    g.endpoints.forEach(e => {
      if (!e.isDeveloper) {
        console.error(`  ERROR: Non-developer endpoint leaked: ${e.method} ${e.path}`);
      }
    });
  });

  console.log("\n=== TEST COMPLETED ===");
}

runTest()
  .catch(err => console.error("Test failed:", err))
  .finally(() => prisma.$disconnect());
