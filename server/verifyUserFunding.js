import prisma from "./src/config/prisma.js";
import { Prisma } from "@prisma/client";
import { fundUserWallet } from "./src/controllers/adminMasterWalletController.js";

// Ensure environment has a system master key
process.env.SYSTEM_MASTER_KEY = "test-master-key-123456";

async function runTests() {
  console.log("=== STARTING USER WALLET FUNDING VERIFICATION ===");
  let passCount = 0;
  let failCount = 0;

  const testUserEmail = `testuser-${Date.now()}@example.com`;
  const testAdminEmail = `testadmin-${Date.now()}@example.com`;
  let testUser, testAdmin;

  try {
    // 0. Setup test users and admin wallet
    testUser = await prisma.user.create({
      data: {
        email: testUserEmail,
        password: "hashedpassword",
        phone: `99${Math.floor(10000000 + Math.random() * 90000000)}`,
        role: "USER",
        isActive: true,
      }
    });

    testAdmin = await prisma.user.create({
      data: {
        email: testAdminEmail,
        password: "hashedpassword",
        phone: `88${Math.floor(10000000 + Math.random() * 90000000)}`,
        role: "SUPER_ADMIN",
        isActive: true,
      }
    });

    // Initialize or Reset central admin wallet
    let adminWallet = await prisma.adminWallet.findUnique({ where: { id: 1 } });
    if (!adminWallet) {
      adminWallet = await prisma.adminWallet.create({
        data: {
          id: 1,
          balance: new Prisma.Decimal(1000.00),
          reservedBalance: new Prisma.Decimal(0.00),
          minimumOperationalBalance: new Prisma.Decimal(0.00),
          totalCredits: new Prisma.Decimal(1000.00),
          totalDebits: new Prisma.Decimal(0.00)
        }
      });
    } else {
      adminWallet = await prisma.adminWallet.update({
        where: { id: 1 },
        data: {
          balance: new Prisma.Decimal(1000.00),
          reservedBalance: new Prisma.Decimal(0.00),
          minimumOperationalBalance: new Prisma.Decimal(0.00),
        }
      });
    }

    // Helper to mock request and response
    const runFunding = (params, body, user = testAdmin) => {
      return new Promise((resolve) => {
        const req = {
          params,
          body,
          user,
          ip: "127.0.0.1",
          headers: {
            "user-agent": "verify-script"
          }
        };
        const res = {
          statusCode: 200,
          status(code) {
            this.statusCode = code;
            return this;
          },
          json(data) {
            resolve({ statusCode: this.statusCode, data });
          }
        };
        fundUserWallet(req, res).catch(err => {
          resolve({ statusCode: 500, data: { success: false, message: err.message } });
        });
      });
    };

    // ----------------------------------------------------
    // Scenario 1: Admin ₹1000, Transfer ₹100
    // Expected: PASS, Admin balance decreases by ₹100, User balance increases by ₹100.
    // ----------------------------------------------------
    console.log("\n--- Scenario 1: Successful Transfer (₹100) ---");
    // Setup target user wallet
    await prisma.wallet.upsert({
      where: { userId: testUser.id },
      update: { balance: 0.00 },
      create: { userId: testUser.id, balance: 0.00 }
    });

    let res1 = await runFunding(
      { userId: String(testUser.id) },
      { amount: 100, remarks: "Scenario 1 Fund", masterKey: "test-master-key-123456" }
    );

    let updatedAdmin1 = await prisma.adminWallet.findUnique({ where: { id: 1 } });
    let updatedUser1 = await prisma.wallet.findUnique({ where: { userId: testUser.id } });

    if (
      res1.statusCode === 200 &&
      res1.data.success &&
      Number(updatedAdmin1.balance) === 900 &&
      Number(updatedUser1.balance) === 100
    ) {
      console.log("PASS: Transfer succeeded and balances matched.");
      passCount++;
    } else {
      console.log(`FAIL: Status ${res1.statusCode}, Success ${res1.data.success}, Admin Balance: ${updatedAdmin1.balance}, User Balance: ${updatedUser1.balance}`);
      failCount++;
    }

    // ----------------------------------------------------
    // Scenario 2: Admin ₹900, Transfer ₹1000 (Insufficient Balance)
    // Expected: Rejected, "Insufficient Admin Vault Balance" error message
    // ----------------------------------------------------
    console.log("\n--- Scenario 2: Insufficient Balance (Request ₹1000) ---");
    let res2 = await runFunding(
      { userId: String(testUser.id) },
      { amount: 1000, remarks: "Scenario 2 Fund", masterKey: "test-master-key-123456" }
    );

    if (
      res2.statusCode === 500 &&
      res2.data.message.includes("Insufficient Admin Vault Balance")
    ) {
      console.log("PASS: Rejected correctly with 'Insufficient Admin Vault Balance'.");
      passCount++;
    } else {
      console.log(`FAIL: Expected 'Insufficient Admin Vault Balance', got status ${res2.statusCode} and message: ${res2.data.message}`);
      failCount++;
    }

    // ----------------------------------------------------
    // Scenario 3: Invalid Master Key
    // Expected: Rejected, status 403, "Invalid Master Key."
    // ----------------------------------------------------
    console.log("\n--- Scenario 3: Invalid Master Key ---");
    let res3 = await runFunding(
      { userId: String(testUser.id) },
      { amount: 50, remarks: "Scenario 3 Fund", masterKey: "wrong-key" }
    );

    if (
      res3.statusCode === 403 &&
      res3.data.message === "Invalid Master Key."
    ) {
      console.log("PASS: Rejected correctly with 'Invalid Master Key.'.");
      passCount++;
    } else {
      console.log(`FAIL: Expected 403 and 'Invalid Master Key.', got status ${res3.statusCode} and message: ${res3.data.message}`);
      failCount++;
    }

    // ----------------------------------------------------
    // Scenario 4: Missing User Wallet
    // Expected: Wallet Created, Transfer Success
    // ----------------------------------------------------
    console.log("\n--- Scenario 4: Missing User Wallet (Auto-Create) ---");
    // Delete testUser's wallet first
    await prisma.wallet.delete({ where: { userId: testUser.id } });

    let res4 = await runFunding(
      { userId: String(testUser.id) },
      { amount: 50, remarks: "Scenario 4 Fund", masterKey: "test-master-key-123456" }
    );

    let updatedAdmin4 = await prisma.adminWallet.findUnique({ where: { id: 1 } });
    let updatedUser4 = await prisma.wallet.findUnique({ where: { userId: testUser.id } });

    if (
      res4.statusCode === 200 &&
      res4.data.success &&
      updatedUser4 &&
      Number(updatedUser4.balance) === 50 &&
      Number(updatedAdmin4.balance) === 850
    ) {
      console.log("PASS: User wallet auto-created and funded successfully.");
      passCount++;
    } else {
      console.log(`FAIL: User Wallet Exist: ${!!updatedUser4}, User Balance: ${updatedUser4?.balance}, Admin Balance: ${updatedAdmin4?.balance}`);
      failCount++;
    }

    // ----------------------------------------------------
    // Scenario 5: 10 Concurrent Transfers (₹10 each, total ₹100)
    // Expected: All succeed or reject safely depending on limit, but no race condition or double spend.
    // ----------------------------------------------------
    console.log("\n--- Scenario 5: 10 Concurrent Transfers ---");
    // User wallet starts at ₹50. Admin wallet starts at ₹850.
    const startAdminBal = Number((await prisma.adminWallet.findUnique({ where: { id: 1 } })).balance);
    const startUserBal = Number((await prisma.wallet.findUnique({ where: { userId: testUser.id } })).balance);

    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        runFunding(
          { userId: String(testUser.id) },
          { amount: 10, remarks: `Scenario 5 Fund ${i}`, masterKey: "test-master-key-123456" }
        )
      );
    }

    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.statusCode === 200 && r.data.success).length;

    const endAdminBal = Number((await prisma.adminWallet.findUnique({ where: { id: 1 } })).balance);
    const endUserBal = Number((await prisma.wallet.findUnique({ where: { userId: testUser.id } })).balance);

    if (
      successCount === 10 &&
      endAdminBal === startAdminBal - 100 &&
      endUserBal === startUserBal + 100
    ) {
      console.log("PASS: All 10 concurrent transfers completed successfully without race conditions.");
      passCount++;
    } else {
      console.log(`FAIL: Success Count: ${successCount}/10. Admin Bal: ${startAdminBal} -> ${endAdminBal}, User Bal: ${startUserBal} -> ${endUserBal}`);
      failCount++;
    }

    // ----------------------------------------------------
    // Scenario 6: Ledger Link Integrity
    // Expected: Admin Ledger Exists, User Ledger Exists, Same Reference ID, Same Amount
    // ----------------------------------------------------
    console.log("\n--- Scenario 6: Ledger Link Integrity ---");
    // Let's perform one transfer and check its ledgers
    const remarks = `Scenario 6 Fund ${Date.now()}`;
    let res6 = await runFunding(
      { userId: String(testUser.id) },
      { amount: 20, remarks, masterKey: "test-master-key-123456" }
    );

    if (res6.statusCode === 200 && res6.data.success) {
      // Find the Admin Ledger entry
      const adminLedger = await prisma.adminLedger.findFirst({
        where: { description: remarks }
      });
      // Find the User Ledger entry
      const userLedger = await prisma.ledgerEntry.findFirst({
        where: { description: remarks }
      });

      if (
        adminLedger &&
        userLedger &&
        adminLedger.referenceId === userLedger.metadata.referenceId &&
        Math.abs(Number(adminLedger.amount)) === Number(userLedger.amount) &&
        Number(userLedger.amount) === 20
      ) {
        console.log("PASS: Ledger entries created with matching referenceId and amounts.");
        passCount++;
      } else {
        console.log("FAIL: Ledgers did not match.");
        console.log("Admin Ledger:", adminLedger);
        console.log("User Ledger:", userLedger);
        failCount++;
      }
    } else {
      console.log("FAIL: Transfer for Scenario 6 failed.");
      failCount++;
    }

  } catch (err) {
    console.error("Test execution threw error:", err);
    failCount++;
  } finally {
    // Cleanup test data
    console.log("\nCleaning up test data...");
    if (testUser) {
      await prisma.ledgerEntry.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
      await prisma.transaction.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
      await prisma.wallet.delete({ where: { userId: testUser.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
    if (testAdmin) {
      await prisma.user.delete({ where: { id: testAdmin.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  }

  console.log("\n=== WALLET FUNDING TESTS SUMMARY ===");
  console.log(`PASS: ${passCount}`);
  console.log(`FAIL: ${failCount}`);
  if (failCount === 0) {
    console.log("ALL TESTS PASSED SUCCESSFULLY! ✅");
  } else {
    console.log("SOME TESTS FAILED! ❌");
  }
}

runTests();
