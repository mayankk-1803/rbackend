import axios from "axios";

// MOCK OUTGOING AXIOS REQUESTS VIA CUSTOM ADAPTER ON AXIOS.CREATE
const originalCreate = axios.create;
axios.create = function (defaultConfig) {
  const instance = originalCreate.call(axios, defaultConfig);
  
  // Register request interceptor to inject custom mock adapter
  instance.interceptors.request.use((config) => {
    if (config.url && config.url.includes("/create_order.php")) {
      console.log(`\n[MOCK AXIOS ADAPTER] Intercepted ${config.url}`);
      config.adapter = function (c) {
        // Parse data if it is a string
        const parsedData = typeof c.data === "string" ? JSON.parse(c.data) : c.data;
        const orderId = parsedData?.order_id || "mock_order_id";
        
        return Promise.resolve({
          data: {
            status: "success",
            success: true,
            data: {
              payment_url: `https://mock.nexgate.in/checkout?order_id=${orderId}`,
              order_id: `NEXGATE_${orderId}`
            }
          },
          status: 200,
          statusText: "OK",
          headers: { "content-type": "application/json" },
          config: c
        });
      };
    }
    return config;
  });
  
  return instance;
};

import crypto from "crypto";

async function runTest() {
  console.log("=== STARTING ADMIN FUNDING GATEWAY INTEGRATION TEST ===");

  // Force enable gateway flow for integration tests
  process.env.ADMIN_FUNDING_GATEWAY_ENABLED = "true";

  // Dynamically import to ensure axios.create override happens first
  const { default: prisma } = await import("../src/config/prisma.js");
  const { topUpWallet } = await import("../src/controllers/adminController.js");
  const { paymentWebhook } = await import("../src/controllers/paymentController.js");

  // 1. SETUP: Find or create a test admin and user
  let admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        name: "Test Admin",
        email: "testadmin@dizipay.com",
        password: "hash",
        phone: "9999999990",
        role: "ADMIN",
        isPhoneVerified: true,
        isEmailVerified: true
      }
    });
    console.log("Created test admin:", admin.id);
  } else {
    console.log("Using existing admin:", admin.id);
  }

  let user = await prisma.user.findFirst({ where: { role: "USER" } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Test User",
        email: "testuser@dizipay.com",
        password: "hash",
        phone: "9999999991",
        role: "USER",
        isPhoneVerified: true,
        isEmailVerified: true
      }
    });
    console.log("Created test user:", user.id);
  } else {
    console.log("Using existing user:", user.id);
  }

  // Ensure user has a wallet
  let wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: {
        userId: user.id,
        balance: 0.00
      }
    });
    console.log("Created wallet for test user");
  }

  const initialBalance = Number(wallet.balance);
  console.log(`Initial User Balance: ₹${initialBalance}`);

  const topupAmount = 250.00;
  const description = "Test admin funding description";

  // 2. STAGE 1: Initiate Admin Topup
  let paymentRecordId = null;
  let paymentUrl = null;

  const mockReqInitiate = {
    user: { id: admin.id },
    body: {
      userId: user.id,
      amount: topupAmount,
      description: description
    }
  };

  const mockResInitiate = {
    status: function (code) {
      console.error(`Initiate Response Status: ${code}`);
      return this;
    },
    json: function (data) {
      console.log("Initiate Response JSON:", JSON.stringify(data, null, 2));
      if (data.success) {
        paymentRecordId = data.orderId;
        paymentUrl = data.paymentUrl;
      }
    }
  };

  console.log("\n--- STAGE 1: Initiating top-up via adminController.topUpWallet ---");
  await topUpWallet(mockReqInitiate, mockResInitiate);

  if (!paymentRecordId) {
    throw new Error("Failed to create pending payment order!");
  }

  // Verify DB state for payment record
  let payment = await prisma.payment.findUnique({ where: { id: paymentRecordId } });
  console.log("Payment Record in Database:");
  console.log(`- ID: ${payment.id}`);
  console.log(`- Amount: ₹${payment.amount}`);
  console.log(`- Status: ${payment.status} (Expected: PENDING)`);
  console.log(`- Intent: ${payment.intent}`);
  console.log(`- IdempotencyKey: ${payment.idempotencyKey}`);

  if (payment.status !== "PENDING") {
    throw new Error(`Expected payment status PENDING, but got ${payment.status}`);
  }

  // Verify wallet has not been credited yet (Zero-mutation guarantee)
  let walletAfterInitiate = await prisma.wallet.findUnique({ where: { userId: user.id } });
  const midBalance = Number(walletAfterInitiate.balance);
  console.log(`User balance after initiation: ₹${midBalance} (Expected: ₹${initialBalance})`);
  if (midBalance !== initialBalance) {
    throw new Error("Wallet balance was mutated prematurely during initiation!");
  }

  // 3. STAGE 2: Simulate Webhook Call
  console.log("\n--- STAGE 2: Simulating Webhook success callback ---");
  
  const gatewayTxnId = `GW_TXN_${Date.now()}`;
  const webhookSecret = process.env.WEBHOOK_SECRET || "internal_secret";
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  
  const webhookBody = {
    order_id: payment.id,
    status: "SUCCESS",
    amount: topupAmount.toString(),
    transaction_id: gatewayTxnId,
    message: "Payment Success"
  };

  const payloadString = timestamp + "." + nonce + "." + JSON.stringify(webhookBody);
  const signature = crypto.createHmac("sha256", webhookSecret).update(payloadString).digest("hex");

  const mockReqWebhook = {
    body: webhookBody,
    headers: {
      "x-webhook-signature": signature,
      "x-webhook-timestamp": timestamp,
      "x-webhook-nonce": nonce
    },
    ip: "127.0.0.1",
    method: "POST",
    originalUrl: "/api/payment/webhook"
  };

  const mockResWebhook = {
    status: function (code) {
      console.log(`Webhook immediate status: ${code}`);
      return this;
    },
    json: function (data) {
      console.log("Webhook immediate response JSON:", JSON.stringify(data));
      return this;
    }
  };

  // Run webhook processing
  await paymentWebhook(mockReqWebhook, mockResWebhook);

  // Since webhook processes transaction asynchronously in the background, let's wait a bit
  console.log("Waiting 3 seconds for asynchronous webhook processing to complete...");
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 4. STAGE 3: Verification
  console.log("\n--- STAGE 3: Verifying final state in database ---");

  // Verify payment status updated to SUCCESS
  payment = await prisma.payment.findUnique({ where: { id: paymentRecordId } });
  console.log(`Final Payment Status: ${payment.status} (Expected: SUCCESS)`);
  if (payment.status !== "SUCCESS") {
    throw new Error(`Expected payment status SUCCESS, but got ${payment.status}`);
  }

  // Verify wallet balance is credited
  let walletFinal = await prisma.wallet.findUnique({ where: { userId: user.id } });
  const finalBalance = Number(walletFinal.balance);
  console.log(`Final User Balance: ₹${finalBalance} (Expected: ₹${initialBalance + topupAmount})`);
  if (finalBalance !== initialBalance + topupAmount) {
    throw new Error(`Expected wallet balance to be ${initialBalance + topupAmount}, but got ${finalBalance}`);
  }

  // Verify transaction history record
  const txn = await prisma.transaction.findFirst({
    where: { userId: user.id, type: "TOPUP" },
    orderBy: { createdAt: "desc" }
  });
  console.log("Transaction History Record:");
  console.log(`- Type: ${txn.type}`);
  console.log(`- Status: ${txn.status}`);
  console.log(`- Amount: ₹${txn.amount}`);
  console.log(`- Description: "${txn.description}"`);
  console.log(`- BalanceAfter: ₹${txn.balanceAfter}`);
  
  if (txn.status !== "SUCCESS" || Number(txn.amount) !== topupAmount) {
    throw new Error("Transaction history record was not correctly saved!");
  }
  if (!txn.description.includes(description)) {
    throw new Error("Transaction description did not incorporate the custom admin reason!");
  }

  // Verify ledger entry
  const ledger = await prisma.ledgerEntry.findFirst({
    where: { userId: user.id, type: "TOPUP_CREDIT" },
    orderBy: { createdAt: "desc" }
  });
  console.log("Ledger Entry:");
  console.log(`- Type: ${ledger.type}`);
  console.log(`- Amount: ₹${ledger.amount}`);
  console.log(`- Description: "${ledger.description}"`);
  console.log(`- BalanceBefore: ₹${ledger.balanceBefore}`);
  console.log(`- BalanceAfter: ₹${ledger.balanceAfter}`);

  if (Number(ledger.amount) !== topupAmount || Number(ledger.balanceAfter) !== finalBalance) {
    throw new Error("Ledger entry records are inconsistent with final balance!");
  }
  if (!ledger.description.includes(description)) {
    throw new Error("Ledger description did not incorporate the custom admin reason!");
  }

  // Verify audit log
  const audit = await prisma.auditLog.findFirst({
    where: { action: "WALLET_ADJUSTMENT", adminId: admin.id },
    orderBy: { createdAt: "desc" }
  });

  if (!audit) {
    throw new Error("Administrative audit log was NOT created!");
  }
  console.log("Audit Log Record:");
  console.log(`- Action: ${audit.action}`);
  console.log(`- Admin ID: ${audit.adminId}`);
  console.log(`- Beneficiary User ID: ${audit.userId}`);
  console.log(`- Details: ${JSON.stringify(audit.details)}`);

  if (audit.userId !== user.id || Number(audit.details?.amount) !== topupAmount) {
    throw new Error("Audit log details are incorrect!");
  }

  // 5. STAGE 4: Idempotency (Replay Attack Check)
  console.log("\n--- STAGE 4: Simulating Duplicate Webhook Call (Idempotency verification) ---");
  await paymentWebhook(mockReqWebhook, mockResWebhook);
  
  console.log("Waiting 2 seconds...");
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Verify wallet balance remained unchanged (Double credit prevention check)
  let walletDouble = await prisma.wallet.findUnique({ where: { userId: user.id } });
  const finalBalance2 = Number(walletDouble.balance);
  console.log(`User balance after duplicate webhook: ₹${finalBalance2} (Expected: ₹${finalBalance})`);
  if (finalBalance2 !== finalBalance) {
    throw new Error("SECURITY ALERT: Double credit occurred! Duplicate webhook was not blocked.");
  }

  // 6. STAGE 5: Unauthorized Callback Check (Missing credentials verification)
  console.log("\n--- STAGE 5: Simulating Unauthorized Webhook Call (Missing credentials check) ---");
  const mockReqUnauthorized = {
    body: webhookBody,
    headers: {}, // No credentials
    ip: "127.0.0.1",
    method: "POST",
    originalUrl: "/api/payment/webhook"
  };
  const mockResUnauthorized = {
    status: function (code) {
      console.log(`Unauthorized webhook status (immediate response): ${code}`);
      return this;
    },
    json: function (data) {
      console.log("Unauthorized webhook response JSON (immediate response):", JSON.stringify(data));
      return this;
    }
  };
  await paymentWebhook(mockReqUnauthorized, mockResUnauthorized);
  
  console.log("Waiting 3 seconds for async verification checks...");
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Verify wallet balance remained unchanged (No unauthorized mutation check)
  let walletUnauth = await prisma.wallet.findUnique({ where: { userId: user.id } });
  const finalBalance3 = Number(walletUnauth.balance);
  console.log(`User balance after unauthorized webhook: ₹${finalBalance3} (Expected: ₹${finalBalance2})`);
  if (finalBalance3 !== finalBalance2) {
    throw new Error("SECURITY ALERT: Wallet balance was mutated by unauthorized webhook!");
  }
  console.log("Unauthorized webhook was successfully ignored (no wallet mutation occurred).");

  console.log("\n=== ALL INTEGRATION TESTS PASSED SUCCESSFULLY ===");
}

runTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nTEST FAILED WITH ERROR:", err);
    process.exit(1);
  });
