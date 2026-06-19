import prisma from "./src/config/prisma.js";
import { Prisma } from "@prisma/client";
import { addFundsToMasterWallet } from "./src/controllers/adminMasterWalletController.js";
import { fundUserWallet } from "./src/controllers/adminMasterWalletController.js";

process.env.SYSTEM_MASTER_KEY = "replenish-master-key-xyz";

async function runTests() {
  console.log("=== STARTING ADMIN WALLET FUNDING VERIFICATION ===");
  let passCount = 0;
  let failCount = 0;

  const testUserEmail = `testuser-${Date.now()}@example.com`;
  const testSuperAdminEmail = `superadmin-${Date.now()}@example.com`;
  const testSubAdminEmail = `subadmin-${Date.now()}@example.com`;
  let testUser, testSuperAdmin, testSubAdmin;

  try {
    // 0. Setup test users
    testUser = await prisma.user.create({
      data: {
        email: testUserEmail,
        password: "hashedpassword",
        phone: `99${Math.floor(10000000 + Math.random() * 90000000)}`,
        role: "USER",
        isActive: true,
      }
    });

    testSuperAdmin = await prisma.user.create({
      data: {
        email: testSuperAdminEmail,
        password: "hashedpassword",
        phone: `88${Math.floor(10000000 + Math.random() * 90000000)}`,
        role: "SUPER_ADMIN",
        isActive: true,
      }
    });

    testSubAdmin = await prisma.user.create({
      data: {
        email: testSubAdminEmail,
        password: "hashedpassword",
        phone: `77${Math.floor(10000000 + Math.random() * 90000000)}`,
        role: "ADMIN",
        isActive: true,
      }
    });

    // Reset Central Admin Wallet
    let adminWallet = await prisma.adminWallet.findUnique({ where: { id: 1 } });
    if (!adminWallet) {
      adminWallet = await prisma.adminWallet.create({
        data: {
          id: 1,
          balance: new Prisma.Decimal(500.00),
          reservedBalance: new Prisma.Decimal(0.00),
          minimumOperationalBalance: new Prisma.Decimal(0.00),
          totalCredits: new Prisma.Decimal(500.00),
          totalDebits: new Prisma.Decimal(0.00)
        }
      });
    } else {
      adminWallet = await prisma.adminWallet.update({
        where: { id: 1 },
        data: {
          balance: new Prisma.Decimal(500.00),
          reservedBalance: new Prisma.Decimal(0.00),
          minimumOperationalBalance: new Prisma.Decimal(0.00),
        }
      });
    }

    // Helper to mock request and response
    const runAddFunds = (body, user = testSuperAdmin) => {
      return new Promise((resolve) => {
        const req = {
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
        addFundsToMasterWallet(req, res).catch(err => {
          resolve({ statusCode: 500, data: { success: false, message: err.message } });
        });
      });
    };

    const runFundUser = (params, body, user = testSuperAdmin) => {
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
    // Test 1: Replenish ₹10,000 via add-funds
    // ----------------------------------------------------
    console.log("\n--- Test 1: Replenish ₹10,000 (SUPER_ADMIN) ---");
    const remarks1 = `Test 1 Topup ${Date.now()}`;
    let res1 = await runAddFunds({
      amount: 10000,
      remarks: remarks1,
      masterKey: "replenish-master-key-xyz"
    }, testSuperAdmin);

    const updatedAdmin1 = await prisma.adminWallet.findUnique({ where: { id: 1 } });
    
    // Find ledger entry
    const ledgerEntry = await prisma.adminLedger.findFirst({
      where: { description: remarks1 }
    });

    // Find audit log
    const auditLogs = await prisma.auditLog.findMany({
      where: { action: "ADMIN_WALLET_TOPUP" }
    });
    const auditEntry = auditLogs.find(log => log.details && log.details.remarks === remarks1);

    if (
      res1.statusCode === 200 &&
      res1.data.success &&
      Number(updatedAdmin1.balance) === 10500 &&
      ledgerEntry &&
      ledgerEntry.type === "ADMIN_WALLET_TOPUP" &&
      Number(ledgerEntry.amount) === 10000 &&
      auditEntry &&
      auditEntry.adminId === testSuperAdmin.id
    ) {
      console.log("PASS: Admin Wallet replenished. Ledger and Audit log created successfully.");
      passCount++;
    } else {
      console.log(`FAIL: Status=${res1.statusCode}, Success=${res1.data?.success}, Balance=${updatedAdmin1.balance}`);
      console.log("Ledger entry:", ledgerEntry);
      console.log("Audit entry:", auditEntry);
      failCount++;
    }

    // ----------------------------------------------------
    // Test 2: Fund User with ₹100
    // ----------------------------------------------------
    console.log("\n--- Test 2: Fund User ₹100 ---");
    await prisma.wallet.upsert({
      where: { userId: testUser.id },
      update: { balance: 0.00 },
      create: { userId: testUser.id, balance: 0.00 }
    });

    let res2 = await runFundUser(
      { userId: String(testUser.id) },
      { amount: 100, remarks: "Manual funding verification test", masterKey: "replenish-master-key-xyz" },
      testSuperAdmin
    );

    const updatedAdmin2 = await prisma.adminWallet.findUnique({ where: { id: 1 } });
    const updatedUser2 = await prisma.wallet.findUnique({ where: { userId: testUser.id } });

    if (
      res2.statusCode === 200 &&
      res2.data.success &&
      Number(updatedAdmin2.balance) === 10400 &&
      Number(updatedUser2.balance) === 100
    ) {
      console.log("PASS: User funded successfully. Balance decreased and user balance increased.");
      passCount++;
    } else {
      console.log(`FAIL: Status=${res2.statusCode}, Success=${res2.data?.success}, Admin Balance=${updatedAdmin2.balance}, User Balance=${updatedUser2?.balance}`);
      failCount++;
    }

    // ----------------------------------------------------
    // Test 3: Verify Ledger Entry
    // ----------------------------------------------------
    console.log("\n--- Test 3: Verify Ledger fields ---");
    if (
      ledgerEntry &&
      Number(ledgerEntry.openingBalance) === 500 &&
      Number(ledgerEntry.closingBalance) === 10500 &&
      Number(ledgerEntry.amount) === 10000
    ) {
      console.log("PASS: Ledger details opening/closing/amount verified.");
      passCount++;
    } else {
      console.log(`FAIL: Ledger opening=${ledgerEntry?.openingBalance}, closing=${ledgerEntry?.closingBalance}, amount=${ledgerEntry?.amount}`);
      failCount++;
    }

    // ----------------------------------------------------
    // Test 4: Verify Audit Entry
    // ----------------------------------------------------
    console.log("\n--- Test 4: Verify Audit fields ---");
    if (
      auditEntry &&
      auditEntry.details &&
      Number(auditEntry.details.amount) === 10000 &&
      auditEntry.details.remarks === remarks1
    ) {
      console.log("PASS: Audit details verified.");
      passCount++;
    } else {
      console.log(`FAIL: Audit entry does not contain correct details:`, auditEntry?.details);
      failCount++;
    }

    // ----------------------------------------------------
    // Test 5: Verify non-SUPER_ADMIN Access Block
    // ----------------------------------------------------
    console.log("\n--- Test 5: Non-SUPER_ADMIN Access Blocked (ADMIN role) ---");
    let res5 = await runAddFunds({
      amount: 1000,
      remarks: "Unauthorized replenishment",
      masterKey: "replenish-master-key-xyz"
    }, testSubAdmin);

    if (res5.statusCode === 403 && !res5.data.success) {
      console.log("PASS: Access correctly blocked for non-SUPER_ADMIN.");
      passCount++;
    } else {
      console.log(`FAIL: Expected 403, got status ${res5.statusCode}:`, res5.data);
      failCount++;
    }

  } catch (err) {
    console.error("Test execution threw error:", err);
    failCount++;
  } finally {
    console.log("\nCleaning up test data...");
    if (testUser) {
      await prisma.ledgerEntry.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
      await prisma.transaction.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
      await prisma.wallet.delete({ where: { userId: testUser.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
    if (testSuperAdmin) {
      await prisma.auditLog.deleteMany({ where: { adminId: testSuperAdmin.id } }).catch(() => {});
      await prisma.adminLedger.deleteMany({ where: { metadata: { path: ["performedBy"], equals: testSuperAdmin.email } } }).catch(() => {});
      await prisma.user.delete({ where: { id: testSuperAdmin.id } }).catch(() => {});
    }
    if (testSubAdmin) {
      await prisma.user.delete({ where: { id: testSubAdmin.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  }

  console.log("\n=== ADMIN WALLET FUNDING TESTS SUMMARY ===");
  console.log(`PASS: ${passCount}`);
  console.log(`FAIL: ${failCount}`);
  if (failCount === 0) {
    console.log("ALL TESTS PASSED SUCCESSFULLY! ✅");
  } else {
    console.log("SOME TESTS FAILED! ❌");
  }
}

runTests();
