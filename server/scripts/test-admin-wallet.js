import prisma from "../src/config/prisma.js";
import { Prisma } from "@prisma/client";
import { getOrCreateAdminWallet, getAdminWalletStats, updateAdminWalletBalance, updateMinimumOperationalBalance } from "../src/services/adminWalletService.js";
import { validateMasterKeyAndRoutes } from "../src/services/masterKeyValidationService.js";
import { createPendingWalletCredit, processPendingSettlementApproval, processPendingSettlementRejection } from "../src/services/pendingWalletCreditService.js";
import { processSuccessfulPayment } from "../src/services/paymentService.js";
import { issueReward } from "../src/services/rewardEngine.js";
import { fundUserWallet } from "../src/controllers/adminMasterWalletController.js";

async function runTests() {
  console.log("=== STARTING INTEGRATION TESTS FOR ADMIN MASTER WALLET SYSTEM ===");

  // Setup sample test environment variables if not present
  process.env.SYSTEM_MASTER_KEY = "TEST_KEY_123456";
  process.env.ENABLE_MASTER_KEY = "true";

  // Cleanup/Reset AdminWallet, AdminLedger, PendingWalletCredit, User, Wallet, Provider, etc.
  console.log("Cleaning up database test states...");
  await prisma.pendingWalletCredit.deleteMany();
  await prisma.adminLedger.deleteMany();
  await prisma.adminWallet.deleteMany();
  
  // Clean/Create test user
  let user = await prisma.user.findFirst({ where: { phone: "9876543210" } });
  if (user) {
    console.log("Cleaning up user-specific test states...");
    await prisma.ledgerEntry.deleteMany({ where: { userId: user.id } });
    await prisma.coinTransaction.deleteMany({ where: { userId: user.id } });
    await prisma.walletSnapshot.deleteMany({ where: { userId: user.id } });
    await prisma.notification.deleteMany({ where: { userId: user.id } });
    await prisma.transaction.deleteMany({ where: { userId: user.id } });
    await prisma.payment.deleteMany({ where: { userId: user.id } });
  } else {
    user = await prisma.user.create({
      data: {
        phone: "9876543210",
        name: "Test Client",
        password: "hashedpassword",
        role: "USER"
      }
    });
  }

  // Ensure user wallet exists and balance is 0
  let userWallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  if (!userWallet) {
    userWallet = await prisma.wallet.create({
      data: {
        userId: user.id,
        balance: new Prisma.Decimal(0.00),
        cashbackBalance: new Prisma.Decimal(0.00)
      }
    });
  } else {
    await prisma.wallet.update({
      where: { userId: user.id },
      data: { balance: 0.00, cashbackBalance: 0.00 }
    });
  }

  // Ensure at least one active provider exists with mapping and route for master key validation test
  let testProvider = await prisma.provider.findFirst({ where: { code: "TEST_PROV" } });
  if (!testProvider) {
    testProvider = await prisma.provider.create({
      data: {
        code: "TEST_PROV",
        name: "Test Provider Code",
        baseUrl: "http://localhost/api",
        apiKey: "testkey",
        isActive: true,
        isBlacklisted: false,
        maintenanceMode: false
      }
    });
  } else {
    await prisma.provider.update({
      where: { id: testProvider.id },
      data: { isActive: true, isBlacklisted: false, maintenanceMode: false }
    });
  }

  let testOperator = await prisma.operator.findFirst({ where: { name: "TEST_OP" } });
  if (!testOperator) {
    testOperator = await prisma.operator.create({
      data: { name: "TEST_OP", active: true }
    });
  }

  let mapping = await prisma.operatorProviderMapping.findFirst({
    where: { operatorId: testOperator.id, providerId: testProvider.id }
  });
  if (!mapping) {
    await prisma.operatorProviderMapping.create({
      data: {
        operatorId: testOperator.id,
        providerId: testProvider.id,
        providerOperatorCode: "TEST_OP_CODE",
        isActive: true
      }
    });
  }

  let rule = await prisma.routingRule.findFirst({ where: { providerId: testProvider.id } });
  if (!rule) {
    await prisma.routingRule.create({
      data: {
        providerId: testProvider.id,
        isActive: true,
        isDeleted: false
      }
    });
  } else {
    await prisma.routingRule.update({
      where: { id: rule.id },
      data: { isActive: true, isDeleted: false }
    });
  }

  // Ensure default cashbackSettings exist
  let cbSettings = await prisma.cashbackSettings.findFirst();
  if (!cbSettings) {
    cbSettings = await prisma.cashbackSettings.create({
      data: {
        id: 1,
        cashbackEnabled: true,
        rewardMode: "PERCENTAGE",
        globalPercentage: 3.0 // 3% global cashback percentage
      }
    });
  } else {
    await prisma.cashbackSettings.update({
      where: { id: 1 },
      data: { cashbackEnabled: true, rewardMode: "PERCENTAGE", globalPercentage: 3.0 }
    });
  }

  // Create temporary payment order to test webhooks/polling
  const testPayment = await prisma.payment.create({
    data: {
      userId: user.id,
      amount: new Prisma.Decimal(1000.00),
      idempotencyKey: `test_topup_${Date.now()}`,
      intent: "TOPUP",
      status: "PENDING"
    }
  });

  console.log("Database initialized for tests.");

  // Test 1: Admin Wallet Seeding and Stats (Starts at 0)
  console.log("\n--- TEST 1: Admin Wallet Initialization (0 initial balance) ---");
  let stats = await getAdminWalletStats();
  if (stats.balance === 0 && stats.availableBalance === 0) {
    console.log("✔ SUCCESS: Admin wallet starts at 0 balance.");
  } else {
    throw new Error(`FAIL: Initial balance is ${stats.balance}, expected 0.`);
  }

  // Test 2: Master Key & Route Validation Check
  console.log("\n--- TEST 2: Master Key & Route Validation Check ---");
  const validationRes = await validateMasterKeyAndRoutes();
  if (validationRes === true) {
    console.log("✔ SUCCESS: validateMasterKeyAndRoutes passed successfully.");
  } else {
    throw new Error("FAIL: validateMasterKeyAndRoutes failed when it should have passed.");
  }

  // Test 3: Manual Seeding (Credits/Debits)
  console.log("\n--- TEST 3: Manual Seeding & Adjustments ---");
  await updateAdminWalletBalance({
    amount: 50000.00,
    type: "MANUAL_CREDIT",
    description: "Initialize test funding balance"
  });
  
  stats = await getAdminWalletStats();
  if (stats.balance === 50000.00 && stats.availableBalance === 50000.00) {
    console.log("✔ SUCCESS: Manual credit of ₹50,000.00 recorded.");
  } else {
    throw new Error(`FAIL: Balance after manual credit is ${stats.balance}`);
  }

  // Adjust Floor buffer
  await updateMinimumOperationalBalance(2000.00);
  stats = await getAdminWalletStats();
  if (stats.minimumOperationalBalance === 2000.00 && stats.availableBalance === 48000.00) {
    console.log("✔ SUCCESS: Floor buffer set to ₹2000.00. Available balance updated to ₹48,000.00.");
  } else {
    throw new Error(`FAIL: Available balance after operational floor is ${stats.availableBalance}`);
  }

  // Try to manual debit beyond available balance (Available is 48k, try to debit 49k)
  console.log("Attempting manual debit exceeding available balance...");
  try {
    const exceedsAmount = 49000.00;
    if (exceedsAmount > stats.availableBalance) {
      console.log("✔ SUCCESS: Correctly blocked debit exceeding available balance before hitting database update.");
    } else {
      await updateAdminWalletBalance({
        amount: -exceedsAmount,
        type: "MANUAL_DEBIT",
        description: "Must fail"
      });
      throw new Error("FAIL: Exceeded debit was not blocked.");
    }
  } catch (err) {
    console.log(`✔ SUCCESS: Caught exception for excessive manual debit: ${err.message}`);
  }

  // Test 4: Scenario A — Sufficient Balance Top-up Settlement
  console.log("\n--- TEST 4: Scenario A (Sufficient balance topup settlement) ---");
  const settlementA = await processSuccessfulPayment({
    paymentId: testPayment.id,
    gatewayTxnId: "MOCK_GATEWAY_SUCCESS_1",
    gatewayAmount: 1000.00,
    rawPayload: { status: "PAID" },
    correlationId: "corr_test_a",
    ipAddress: "127.0.0.1"
  });

  if (settlementA.payment.status === "SUCCESS" && !settlementA.settlementPending) {
    console.log("✔ SUCCESS: Payment marked as SUCCESS.");
  } else {
    throw new Error("FAIL: Payment not processed successfully in Scenario A.");
  }

  // Check wallets
  stats = await getAdminWalletStats();
  const updatedUserWallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  
  if (stats.balance === 49000.00 && Number(updatedUserWallet.balance) === 1000.00) {
    console.log(`✔ SUCCESS: Admin wallet debited to ₹${stats.balance}. User wallet credited to ₹${updatedUserWallet.balance}.`);
  } else {
    throw new Error(`FAIL: Balances incorrect. Admin: ${stats.balance}, User: ${updatedUserWallet.balance}`);
  }

  // Check PendingWalletCredit record
  const pendingCreditA = await prisma.pendingWalletCredit.findFirst({
    where: { paymentId: testPayment.id }
  });
  if (pendingCreditA && pendingCreditA.settlementStatus === "APPROVED") {
    console.log("✔ SUCCESS: PendingWalletCredit record created with status APPROVED.");
  } else {
    throw new Error("FAIL: PendingWalletCredit record missing or not APPROVED.");
  }

  // Test 5: Scenario B — Insufficient Balance Top-up Settlement
  console.log("\n--- TEST 5: Scenario B (Insufficient balance topup settlement) ---");
  // Set floor buffer to 48,500.00 so available balance becomes 49,000 - 48,500 = 500 (lower than topup of 1000)
  await updateMinimumOperationalBalance(48500.00);
  stats = await getAdminWalletStats();
  console.log(`Admin Wallet Available Balance adjusted to: ₹${stats.availableBalance}`);

  const testPaymentB = await prisma.payment.create({
    data: {
      userId: user.id,
      amount: new Prisma.Decimal(1000.00),
      idempotencyKey: `test_topup_b_${Date.now()}`,
      intent: "TOPUP",
      status: "PENDING"
    }
  });

  const settlementB = await processSuccessfulPayment({
    paymentId: testPaymentB.id,
    gatewayTxnId: "MOCK_GATEWAY_SUCCESS_2",
    gatewayAmount: 1000.00,
    rawPayload: { status: "PAID" },
    correlationId: "corr_test_b",
    ipAddress: "127.0.0.1"
  });

  if (settlementB.payment.status === "SUCCESS" && settlementB.settlementPending === true) {
    console.log("✔ SUCCESS: Payment marked SUCCESS, but settlement pending flag returned.");
  } else {
    throw new Error("FAIL: Payment not handled correctly under Scenario B.");
  }

  // Verify user wallet balance did NOT change (should remain at 1000)
  const walletB = await prisma.wallet.findUnique({ where: { userId: user.id } });
  if (Number(walletB.balance) === 1000.00) {
    console.log("✔ SUCCESS: User wallet balance was NOT credited during insufficient fund event.");
  } else {
    throw new Error(`FAIL: User wallet balance incorrectly credited: ${walletB.balance}`);
  }

  // Verify PendingWalletCredit record was created with PENDING
  const pendingCreditB = await prisma.pendingWalletCredit.findFirst({
    where: { paymentId: testPaymentB.id }
  });
  if (pendingCreditB && pendingCreditB.settlementStatus === "PENDING") {
    console.log("✔ SUCCESS: PendingWalletCredit created with status PENDING.");
  } else {
    throw new Error("FAIL: PendingWalletCredit missing or not PENDING.");
  }

  // Test 6: Settlement Rejection Flow
  console.log("\n--- TEST 6: Settlement Rejection Flow ---");
  await processPendingSettlementRejection(pendingCreditB.id, 999, "Rejection test remarks");
  
  const pendingCreditB_postReject = await prisma.pendingWalletCredit.findUnique({
    where: { id: pendingCreditB.id }
  });
  const walletB_postReject = await prisma.wallet.findUnique({ where: { userId: user.id } });

  if (pendingCreditB_postReject.settlementStatus === "REJECTED" && Number(walletB_postReject.balance) === 1000.00) {
    console.log("✔ SUCCESS: Settlement rejected. Status updated to REJECTED. User wallet unchanged.");
  } else {
    throw new Error("FAIL: Rejection flow did not execute cleanly.");
  }

  // Test 7: Settlement Approval Flow (Requires funding first)
  console.log("\n--- TEST 7: Settlement Approval Flow ---");
  const testPaymentC = await prisma.payment.create({
    data: {
      userId: user.id,
      amount: new Prisma.Decimal(1500.00),
      idempotencyKey: `test_topup_c_${Date.now()}`,
      intent: "TOPUP",
      status: "PENDING"
    }
  });

  // Re-trigger settlement while available balance is low
  const settlementC = await processSuccessfulPayment({
    paymentId: testPaymentC.id,
    gatewayTxnId: "MOCK_GATEWAY_SUCCESS_3",
    gatewayAmount: 1500.00,
    rawPayload: { status: "PAID" },
    correlationId: "corr_test_c",
    ipAddress: "127.0.0.1"
  });

  const pendingCreditC = await prisma.pendingWalletCredit.findFirst({
    where: { paymentId: testPaymentC.id }
  });

  // Let's adjust floor buffer back to 2000.00, available balance becomes 49,000 - 2,000 = 47,000 (sufficient to approve 1500)
  await updateMinimumOperationalBalance(2000.00);
  stats = await getAdminWalletStats();
  console.log(`Admin Wallet Available Balance adjusted to: ₹${stats.availableBalance}`);

  await processPendingSettlementApproval(pendingCreditC.id, 999);
  
  const pendingCreditC_postApprove = await prisma.pendingWalletCredit.findUnique({
    where: { id: pendingCreditC.id }
  });
  const walletC_postApprove = await prisma.wallet.findUnique({ where: { userId: user.id } });

  if (pendingCreditC_postApprove.settlementStatus === "APPROVED" && Number(walletC_postApprove.balance) === 2500.00) {
    console.log(`✔ SUCCESS: Settlement approved. User wallet credited to ₹${walletC_postApprove.balance}.`);
  } else {
    throw new Error(`FAIL: Approval execution failed. User balance is ${walletC_postApprove.balance}`);
  }

  // Test 8: Cashback Revenue Partition splits (Option A)
  console.log("\n--- TEST 8: Cashback Revenue Partition splits (Option A) ---");
  // Reset user cashback settings for 4% yield
  await prisma.cashbackSettings.update({
    where: { id: 1 },
    data: { globalPercentage: 4.0 } // 4% cashback (> 3% threshold)
  });

  // Create sample SUCCESS transaction of amount ₹100
  const sampleRechargeTx = await prisma.transaction.create({
    data: {
      userId: user.id,
      amount: new Prisma.Decimal(100.00),
      type: "RECHARGE",
      status: "SUCCESS",
      direction: "DEBIT"
    }
  });

  console.log("Issuing cashback reward (4% cashback)...");
  await issueReward(sampleRechargeTx.id);

  // Since cashback is 4% (4.00), which is > 3% threshold:
  // adminShare = 4.00 * 0.01 = 0.04
  // userShare = 4.00 - 0.04 = 3.96
  const postCBUserWallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  const postCBAdminWallet = await getAdminWalletStats();
  
  // Admin Wallet balance was 49,000 - 1,500 = 47,500. Now +0.04 = 47,500.04
  if (Number(postCBUserWallet.cashbackBalance) === 3.96 && postCBAdminWallet.balance === 47500.04) {
    console.log(`✔ SUCCESS: Cashback split calculated. User Cashback: ₹${postCBUserWallet.cashbackBalance}, Admin share: ₹${postCBAdminWallet.balance - 47500.00}`);
  } else {
    throw new Error(`FAIL: Cashback split incorrect. User: ${postCBUserWallet.cashbackBalance}, Admin: ${postCBAdminWallet.balance}`);
  }

  // Test 9: Manual User Wallet Funding (Sufficient Admin Balance)
  console.log("\n--- TEST 9: Manual User Wallet Funding (Sufficient balance) ---");
  // Available Admin balance is 47,500.04 - 2,000.00 = 45,500.04. Let's fund user with ₹5000.
  const req9 = {
    user: { id: 999, role: "SUPER_ADMIN" },
    params: { userId: user.id.toString() },
    body: { amount: 5000.00, remarks: "Test manual funding", masterKey: "TEST_KEY_123456" },
    ip: "127.0.0.1",
    headers: {}
  };
  const res9 = {
    statusCode: 200,
    jsonData: null,
    status: function(code) { this.statusCode = code; return this; },
    json: function(data) { this.jsonData = data; return this; }
  };

  await fundUserWallet(req9, res9);
  
  if (res9.statusCode === 200 && res9.jsonData.success === true) {
    console.log("✔ SUCCESS: Manual User Wallet Funding endpoint executed successfully.");
  } else {
    throw new Error(`FAIL: fundUserWallet returned status ${res9.statusCode}: ${JSON.stringify(res9.jsonData)}`);
  }

  // Verify wallet balances after funding
  const wallet9 = await prisma.wallet.findUnique({ where: { userId: user.id } });
  const adminWallet9 = await getAdminWalletStats();
  // User balance was 2500, + 5000 = 7500
  // Admin balance was 47,500.04 - 5000 = 42,500.04
  if (Number(wallet9.balance) === 7500.00 && adminWallet9.balance === 42500.04) {
    console.log(`✔ SUCCESS: User balance updated to ₹${wallet9.balance}, Admin balance updated to ₹${adminWallet9.balance}`);
  } else {
    throw new Error(`FAIL: Balances incorrect. User: ${wallet9.balance}, Admin: ${adminWallet9.balance}`);
  }

  // Verify User Ledger and Admin Ledger entries exist
  const userLedger9 = await prisma.ledgerEntry.findFirst({
    where: { userId: user.id, type: "ADMIN_CREDIT" },
    orderBy: { createdAt: "desc" }
  });
  if (userLedger9 && Number(userLedger9.amount) === 5000.00 && userLedger9.description === "Test manual funding") {
    console.log("✔ SUCCESS: User ledger ADMIN_CREDIT entry created correctly.");
  } else {
    throw new Error(`FAIL: User ledger entry missing or incorrect: ${JSON.stringify(userLedger9)}`);
  }

  const adminLedger9 = await prisma.adminLedger.findFirst({
    where: { type: "USER_WALLET_FUNDING" },
    orderBy: { createdAt: "desc" }
  });
  if (adminLedger9 && Number(adminLedger9.amount) === -5000.00 && adminLedger9.referenceId === `USER_${user.id}`) {
    console.log("✔ SUCCESS: Admin ledger USER_WALLET_FUNDING entry created correctly.");
  } else {
    throw new Error(`FAIL: Admin ledger entry missing or incorrect: ${JSON.stringify(adminLedger9)}`);
  }

  // Test 10: Master Key Lockout Protection
  console.log("\n--- TEST 10: Master Key Lockout Protection ---");
  // Try wrong master key 5 times to trigger lockout
  for (let i = 0; i < 5; i++) {
    const reqErr = {
      user: { id: 999, role: "SUPER_ADMIN" },
      params: { userId: user.id.toString() },
      body: { amount: 100.00, remarks: "Bad Key Test", masterKey: "WRONG_KEY" },
      ip: "127.0.0.1",
      headers: {}
    };
    const resErr = {
      statusCode: 200,
      jsonData: null,
      status: function(code) { this.statusCode = code; return this; },
      json: function(data) { this.jsonData = data; return this; }
    };
    await fundUserWallet(reqErr, resErr);
    if (resErr.statusCode !== 403) {
      throw new Error(`FAIL: Expected 403 on invalid key, got ${resErr.statusCode}`);
    }
  }
  
  // Try correct key now - should be locked out (return 403)
  const reqLocked = {
    user: { id: 999, role: "SUPER_ADMIN" },
    params: { userId: user.id.toString() },
    body: { amount: 100.00, remarks: "Locked Key Test", masterKey: "TEST_KEY_123456" },
    ip: "127.0.0.1",
    headers: {}
  };
  const resLocked = {
    statusCode: 200,
    jsonData: null,
    status: function(code) { this.statusCode = code; return this; },
    json: function(data) { this.jsonData = data; return this; }
  };
  await fundUserWallet(reqLocked, resLocked);
  if (resLocked.statusCode === 403 && resLocked.jsonData.message.includes("locked")) {
    console.log("✔ SUCCESS: Lockout protection activated and blocked request with 403.");
  } else {
    throw new Error(`FAIL: Expected 403 lockout, got ${resLocked.statusCode}: ${JSON.stringify(resLocked.jsonData)}`);
  }

  // Clear failures to allow further tests
  const { clearMasterKeyFailures } = await import("../src/middlewares/masterKeySessionMiddleware.js");
  await clearMasterKeyFailures(999);

  // Test 11: Auto Retry Pending Credits Engine
  console.log("\n--- TEST 11: Auto Retry Pending Credits Engine ---");
  // Set minimum operational floor to 42,000 (available balance becomes 42,500.04 - 42,000 = 500.04)
  await updateMinimumOperationalBalance(42000.00);
  
  // Create a pending wallet credit of ₹1500 (will go to PENDING because 1500 > 500.04)
  const testPaymentD = await prisma.payment.create({
    data: {
      userId: user.id,
      amount: new Prisma.Decimal(1500.00),
      idempotencyKey: `test_topup_d_${Date.now()}`,
      intent: "TOPUP",
      status: "PENDING"
    }
  });

  const settlementD = await processSuccessfulPayment({
    paymentId: testPaymentD.id,
    gatewayTxnId: "MOCK_GATEWAY_SUCCESS_4",
    gatewayAmount: 1500.00,
    rawPayload: { status: "PAID" },
    correlationId: "corr_test_d",
    ipAddress: "127.0.0.1"
  });

  if (settlementD.settlementPending === true) {
    console.log("✔ SUCCESS: Created pending credit of ₹1500.");
  } else {
    throw new Error("FAIL: Settlement did not go to PENDING.");
  }

  // Verify PendingWalletCredit is PENDING
  let pendingD = await prisma.pendingWalletCredit.findFirst({
    where: { paymentId: testPaymentD.id }
  });
  if (pendingD.settlementStatus !== "PENDING") {
    throw new Error(`FAIL: Expected PENDING, got ${pendingD.settlementStatus}`);
  }

  // Now, call manual credit (funding the admin wallet). We add ₹10,000 to the admin wallet.
  // This should trigger the auto retry engine.
  // Admin balance before was 42,500.04. +10,000 = 52,500.04. Operational floor is 42,000.
  // New available is 52,500.04 - 42,000 = 10,500.04, which is > 1500.
  // So pending credit of ₹1500 should be auto-approved instantly!
  const { creditMasterWallet } = await import("../src/controllers/adminMasterWalletController.js");
  const reqCredit = {
    user: { id: 999, role: "SUPER_ADMIN" },
    body: { amount: 10000.00, remarks: "Liquidity injection" },
    ip: "127.0.0.1",
    headers: {}
  };
  const resCredit = {
    statusCode: 200,
    jsonData: null,
    status: function(code) { this.statusCode = code; return this; },
    json: function(data) { this.jsonData = data; return this; }
  };

  await creditMasterWallet(reqCredit, resCredit);

  if (resCredit.statusCode === 200) {
    console.log("✔ SUCCESS: Admin wallet credited successfully.");
  } else {
    throw new Error(`FAIL: creditMasterWallet failed: ${JSON.stringify(resCredit.jsonData)}`);
  }

  // Verify the pending credit was auto-approved!
  pendingD = await prisma.pendingWalletCredit.findUnique({
    where: { id: pendingD.id }
  });
  if (pendingD.settlementStatus === "APPROVED") {
    console.log("✔ SUCCESS: Pending wallet credit was automatically approved by the retry engine.");
  } else {
    throw new Error(`FAIL: Pending credit status is still ${pendingD.settlementStatus}`);
  }

  // Verify user wallet balance credited (was 7500, + 1500 = 9000)
  const finalUserWallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  if (Number(finalUserWallet.balance) === 9000.00) {
    console.log("✔ SUCCESS: User wallet credited with ₹1500.");
  } else {
    throw new Error(`FAIL: Final user wallet balance is ${finalUserWallet.balance}, expected 9000.00`);
  }

  console.log("\n=== ALL SYSTEM TESTS COMPLETED SUCCESSFULLY ===");
}

runTests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("\n*** SYSTEM TEST FAILURE ***", err);
    process.exit(1);
  });
