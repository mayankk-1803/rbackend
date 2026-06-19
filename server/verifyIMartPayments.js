import prisma from "./src/config/prisma.js";
import { Prisma } from "@prisma/client";
import app from "./src/app.js";
import http from "http";
import crypto from "crypto";
import axios from "axios";
import jwt from "jsonwebtoken";

// Ensure environment has essential vars
process.env.SYSTEM_MASTER_KEY = "test-master-key-123456";
process.env.ENABLE_MASTER_KEY = "true";
const JWT_SECRET = process.env.JWT_SECRET || "asdfghjklzxcvbnmqwertyuiop";
const MASTER_KEY_SESSION_SECRET = process.env.MASTER_KEY_SESSION_SECRET || "dizipay_master_key_session_secret_2026_jwt_token_auth";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "internal_secret";

// 1. GLOBAL AXIOS OVERRIDE FOR MOCKING GATEWAY
const originalCreate = axios.create;
axios.create = function(config) {
  const instance = originalCreate.apply(this, arguments);
  instance.interceptors.request.use((cfg) => {
    if (cfg.baseURL && cfg.baseURL.includes("nexgate.in")) {
      cfg.baseURL = cfg.baseURL.replace(/https?:\/\/nexgate\.in\/api\/v1/, "http://localhost:51234");
    }
    if (cfg.url && cfg.url.includes("nexgate.in")) {
      cfg.url = cfg.url.replace(/https?:\/\/nexgate\.in\/api\/v1/, "http://localhost:51234");
    }
    return cfg;
  });
  return instance;
};

axios.interceptors.request.use((cfg) => {
  if (cfg.baseURL && cfg.baseURL.includes("nexgate.in")) {
    cfg.baseURL = cfg.baseURL.replace(/https?:\/\/nexgate\.in\/api\/v1/, "http://localhost:51234");
  }
  if (cfg.url && cfg.url.includes("nexgate.in")) {
    cfg.url = cfg.url.replace(/https?:\/\/nexgate\.in\/api\/v1/, "http://localhost:51234");
  }
  return cfg;
});

// Setup mock state
let mockStatus = "PENDING";
let mockGatewayAmount = 118;

// 2. SPAWN MOCK NEXGATE GATEWAY
const mockGatewayServer = http.createServer((req, res) => {
  let body = "";
  req.on("data", chunk => body += chunk);
  req.on("end", () => {
    res.writeHead(200, { "Content-Type": "application/json" });
    if (req.url === "/create_order.php") {
      res.end(JSON.stringify({
        status: "success",
        payment_url: `http://localhost:51234/pay/mock-checkout`,
        qr_image: `http://localhost:51234/qr/mock-checkout`,
        order_id: "MOCK_GATEWAY_ORDER_999"
      }));
    } else if (req.url === "/check_status.php") {
      res.end(JSON.stringify({
        status: mockStatus,
        amount: mockGatewayAmount,
        operator_id: "MOCK_OP_REF_777",
        message: "Mock Status Result"
      }));
    } else {
      res.end(JSON.stringify({ success: false }));
    }
  });
});

const cleanUserData = async (userId) => {
  if (!userId) return;
  await prisma.wishlistItem.deleteMany({ where: { wishlist: { userId } } }).catch(() => {});
  await prisma.wishlist.deleteMany({ where: { userId } }).catch(() => {});
  await prisma.orderItem.deleteMany({ where: { order: { userId } } }).catch(() => {});
  await prisma.order.deleteMany({ where: { userId } }).catch(() => {});
  await prisma.ledgerEntry.deleteMany({ where: { userId } }).catch(() => {});
  await prisma.transaction.deleteMany({ where: { userId } }).catch(() => {});
  await prisma.wallet.deleteMany({ where: { userId } }).catch(() => {});
  await prisma.pendingWalletCredit.deleteMany({ where: { userId } }).catch(() => {});
  await prisma.notification.deleteMany({ where: { userId } }).catch(() => {});
  await prisma.auditLog.deleteMany({ where: { OR: [ { userId }, { adminId: userId } ] } }).catch(() => {});
  await prisma.dispute.deleteMany({ where: { OR: [ { userId }, { adminId: userId } ] } }).catch(() => {});
  await prisma.payment.deleteMany({ where: { userId } }).catch(() => {});
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
};

async function main() {
  console.log("==========================================================");
  console.log("STARTING IMART NEXGATE INTEGRATION VERIFICATION SUITE");
  console.log("==========================================================");

  let passed = 0;
  let failed = 0;

  const assert = (condition, message) => {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  };

  // Start Gateway mock
  mockGatewayServer.listen(51234);
  console.log("Mock Nexgate Gateway server listening on port 51234");

  // Start Express App
  const expressServer = http.createServer(app);
  const appPort = await new Promise((resolve) => {
    expressServer.listen(0, () => {
      resolve(expressServer.address().port);
    });
  });
  console.log(`Test Express app server listening on port ${appPort}`);

  const baseUrl = `http://localhost:${appPort}`;

  // Seeding/Clearing DB variables
  let testUser, testAdmin, testCategory, testProduct;
  let userToken, adminToken, masterKeySessionToken;

  try {
    // 0. Clean DB from previous runs
    console.log("\nCleaning database from previous runs...");
    const oldUsers = await prisma.user.findMany({
      where: { email: { in: ["imart_user@test.com", "imart_admin@test.com"] } }
    });
    for (const u of oldUsers) {
      await cleanUserData(u.id);
    }

    await prisma.product.deleteMany({ where: { slug: "quantum-verify-phone" } }).catch(() => {});
    await prisma.category.deleteMany({ where: { slug: "verify-category" } }).catch(() => {});

    // Create Test Category & Product
    testCategory = await prisma.category.create({
      data: { name: "Verify Category", slug: "verify-category" }
    });

    testProduct = await prisma.product.create({
      data: {
        name: "Quantum Verify Phone",
        slug: "quantum-verify-phone",
        description: "Verify description",
        price: new Prisma.Decimal(100.00), // GST 18% -> Total 118
        stock: 5,
        categoryId: testCategory.id
      }
    });

    // Create Test User & Admin
    testUser = await prisma.user.create({
      data: {
        email: "imart_user@test.com",
        password: "hashedpassword",
        phone: "919999999991",
        role: "USER",
        isActive: true
      }
    });

    testAdmin = await prisma.user.create({
      data: {
        email: "imart_admin@test.com",
        password: "hashedpassword",
        phone: "918888888882",
        role: "SUPER_ADMIN",
        isActive: true
      }
    });

    // Create User Wallet
    await prisma.wallet.create({
      data: { userId: testUser.id, balance: 0.00 }
    });

    // Reset Central Admin Wallet
    await prisma.adminWallet.upsert({
      where: { id: 1 },
      update: {
        balance: new Prisma.Decimal(10000.00),
        reservedBalance: new Prisma.Decimal(0.00),
        minimumOperationalBalance: new Prisma.Decimal(0.00)
      },
      create: {
        id: 1,
        balance: new Prisma.Decimal(10000.00),
        reservedBalance: new Prisma.Decimal(0.00),
        minimumOperationalBalance: new Prisma.Decimal(0.00)
      }
    });

    // Reset Nexgate payment provider in database
    await prisma.provider.upsert({
      where: { code: "NEXGATE" },
      update: {
        baseUrl: "http://localhost:51234",
        apiKey: "test-api-key",
        isActive: true,
        priority: 0,
        providerType: "PAYMENT"
      },
      create: {
        name: "Nexgate Mock",
        code: "NEXGATE",
        baseUrl: "http://localhost:51234",
        apiKey: "test-api-key",
        isActive: true,
        priority: 0,
        providerType: "PAYMENT"
      }
    });

    // Generate JWT Tokens
    userToken = jwt.sign(
      { id: testUser.id, role: "USER", tokenType: "USER_PANEL", authVersion: testUser.authVersion },
      JWT_SECRET
    );
    adminToken = jwt.sign(
      { id: testAdmin.id, role: "SUPER_ADMIN", tokenType: "ADMIN_PANEL", authVersion: testAdmin.authVersion },
      JWT_SECRET
    );
    masterKeySessionToken = jwt.sign(
      { type: "MASTER_KEY_SESSION", adminId: testAdmin.id },
      MASTER_KEY_SESSION_SECRET
    );

    // Initialize Wishlist for User
    const wishlist = await prisma.wishlist.create({
      data: { userId: testUser.id }
    });
    await prisma.wishlistItem.create({
      data: { wishlistId: wishlist.id, productId: testProduct.id }
    });

    console.log("Setup complete. Seeded Category, Product, User, Admin, and AdminWallet.");

    // -------------------------------------------------------------------------
    // Scenario 1, 2, 3, 10: Checkout, Order Creation, Nexgate Order Gen, Redirect Flow, Cart Preservation
    // -------------------------------------------------------------------------
    console.log("\n--- Scenario 1, 2, 3 & 10: Checkout & Payment Order Creation ---");
    mockStatus = "PENDING";
    mockGatewayAmount = 118;

    const checkoutRes = await axios.post(`${baseUrl}/api/imart/checkout`, {
      paymentMethod: "UPI"
    }, {
      headers: { Authorization: `Bearer ${userToken}`, "x-idempotency-key": `imart_chk_${Date.now()}` }
    });

    assert(checkoutRes.status === 200, "Checkout returned 200 OK");
    assert(checkoutRes.data.success === true, "Checkout response indicates success");
    assert(!!checkoutRes.data.paymentUrl, "Checkout returns redirect paymentUrl");
    assert(checkoutRes.data.paymentUrl.includes("http://localhost:51234/pay"), "paymentUrl correctly routes to the mock Nexgate gateway");

    const orderId = checkoutRes.data.order.id;
    const paymentId = checkoutRes.data.order.paymentId;

    const dbOrder = await prisma.order.findUnique({
      where: { id: orderId }
    });
    const dbPayment = await prisma.payment.findUnique({
      where: { id: paymentId }
    });
    const dbTx = await prisma.transaction.findFirst({
      where: { userId: testUser.id, type: "IMART_BUY" }
    });

    assert(dbOrder && dbOrder.paymentStatus === "PENDING_PAYMENT" && dbOrder.status === "PENDING", "Order is successfully initialized in PENDING / PENDING_PAYMENT status");
    assert(dbPayment && dbPayment.status === "PENDING" && dbPayment.intent === "IMART", "Payment record created in PENDING status with intent: IMART");
    assert(dbTx && dbTx.status === "PENDING", "Debit transaction record created in PENDING status");

    // Verify cart/wishlist was not deleted immediately
    const dbWishlistItem = await prisma.wishlistItem.findFirst({
      where: { wishlistId: wishlist.id, productId: testProduct.id }
    });
    assert(!!dbWishlistItem, "Cart item is preserved on checkout (cart items are only deleted on successful payment settlement)");

    // -------------------------------------------------------------------------
    // Scenario 4 & 11: Payment Success & Polling Status check
    // -------------------------------------------------------------------------
    console.log("\n--- Scenario 4 & 11: Payment Status Polling Success Settlement ---");
    mockStatus = "SUCCESS"; // Simulate gateway payment confirmed success

    const statusRes = await axios.get(`${baseUrl}/api/payment/status/${paymentId}`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });

    assert(statusRes.status === 200, "Payment status check returned 200 OK");
    assert(statusRes.data.status === "SUCCESS", "Payment status check resolved to SUCCESS");

    const paidOrder = await prisma.order.findUnique({
      where: { id: orderId }
    });
    const paidPayment = await prisma.payment.findUnique({
      where: { id: paymentId }
    });
    const paidProduct = await prisma.product.findUnique({
      where: { id: testProduct.id }
    });
    const paidWishlistItem = await prisma.wishlistItem.findFirst({
      where: { wishlistId: wishlist.id, productId: testProduct.id }
    });

    assert(paidOrder && paidOrder.paymentStatus === "PAID" && paidOrder.status === "PROCESSING", "Order transitions to PROCESSING status and paymentStatus = PAID");
    assert(paidPayment && paidPayment.status === "SUCCESS", "Payment transitions to SUCCESS status");
    assert(paidProduct && paidProduct.stock === 4, "Product stock decremented successfully by 1 (stock: 5 -> 4)");
    assert(!paidWishlistItem, "Cart items successfully deleted from user wishlist upon successful payment settlement");

    // Verify Scenario 11: Topup Credit & IMART Debit created
    const creditTx = await prisma.transaction.findFirst({
      where: { userId: testUser.id, type: "TOPUP" }
    });
    const debitTx = await prisma.transaction.findFirst({
      where: { userId: testUser.id, type: "IMART_BUY", status: "SUCCESS" }
    });
    const topupLedger = await prisma.ledgerEntry.findFirst({
      where: { userId: testUser.id, type: "TOPUP_CREDIT" }
    });
    const imartLedger = await prisma.ledgerEntry.findFirst({
      where: { userId: testUser.id, type: "IMART_DEBIT" }
    });

    assert(!!creditTx, "TOPUP credit transaction record generated");
    assert(!!debitTx, "IMART_BUY debit transaction status updated to SUCCESS");
    assert(!!topupLedger, "TOPUP_CREDIT ledger entry created with correct reference");
    assert(!!imartLedger, "IMART_DEBIT ledger entry created with correct reference");

    // Verify user balance remains unchanged (since it's a Topup Credit + iMart Debit)
    const userWallet = await prisma.wallet.findUnique({ where: { userId: testUser.id } });
    assert(Number(userWallet.balance) === 0.00, "User wallet balance remains net ₹0.00 after successful IMART purchase");

    // -------------------------------------------------------------------------
    // Scenario 5: Payment Failure
    // -------------------------------------------------------------------------
    console.log("\n--- Scenario 5: Payment Failure ---");
    // Add item back to wishlist
    await prisma.wishlistItem.create({
      data: { wishlistId: wishlist.id, productId: testProduct.id }
    });

    // Create a new checkout
    const checkoutRes2 = await axios.post(`${baseUrl}/api/imart/checkout`, {
      paymentMethod: "UPI"
    }, {
      headers: { Authorization: `Bearer ${userToken}`, "x-idempotency-key": `imart_chk_${Date.now()}` }
    });

    const orderId2 = checkoutRes2.data.order.id;
    const paymentId2 = checkoutRes2.data.order.paymentId;

    // Simulate gateway failure via Webhook callback
    const webhookBodyFailed = {
      paymentId: paymentId2,
      status: "FAILED",
      gatewayTxnId: "GW-FAILED-111",
      errorMessage: "Bank declined"
    };
    const timestampFailed = Date.now().toString();
    const nonceFailed = crypto.randomBytes(16).toString("hex");
    const payloadStringFailed = timestampFailed + "." + nonceFailed + "." + JSON.stringify(webhookBodyFailed);
    const signatureFailed = crypto.createHmac("sha256", WEBHOOK_SECRET).update(payloadStringFailed).digest("hex");

    const webhookResFailed = await axios.post(`${baseUrl}/api/payment/webhook`, webhookBodyFailed, {
      headers: {
        "x-webhook-signature": signatureFailed,
        "x-webhook-timestamp": timestampFailed,
        "x-webhook-nonce": nonceFailed
      }
    });

    assert(webhookResFailed.status === 200, "Webhook accepted failed callback");

    // Give webhook time to process
    await new Promise(resolve => setTimeout(resolve, 500));

    const failedOrder = await prisma.order.findUnique({
      where: { id: orderId2 }
    });
    const failedPayment = await prisma.payment.findUnique({
      where: { id: paymentId2 }
    });
    const failedProduct = await prisma.product.findUnique({
      where: { id: testProduct.id }
    });
    const failedWishlistItem = await prisma.wishlistItem.findFirst({
      where: { wishlistId: wishlist.id, productId: testProduct.id }
    });

    assert(failedOrder && failedOrder.paymentStatus === "FAILED" && failedOrder.status === "CANCELLED", "Order status transitions to CANCELLED and paymentStatus = FAILED");
    assert(failedPayment && failedPayment.status === "FAILED", "Payment record status is updated to FAILED");
    assert(failedProduct && failedProduct.stock === 4, "Product stock remains unchanged at 4");
    assert(!!failedWishlistItem, "Cart item is preserved in user wishlist upon payment failure (cart not lost!)");

    // -------------------------------------------------------------------------
    // Scenario 6, 7 & 8: Webhook Settlement, Duplicate Callback, and Replay Protection
    // -------------------------------------------------------------------------
    console.log("\n--- Scenario 6, 7 & 8: Webhook Settlement & Protections ---");
    // Create checkout 3
    const checkoutRes3 = await axios.post(`${baseUrl}/api/imart/checkout`, {
      paymentMethod: "UPI"
    }, {
      headers: { Authorization: `Bearer ${userToken}`, "x-idempotency-key": `imart_chk_${Date.now()}` }
    });

    const orderId3 = checkoutRes3.data.order.id;
    const paymentId3 = checkoutRes3.data.order.paymentId;

    // Compute Webhook HMAC Signature
    const webhookBody = {
      paymentId: paymentId3,
      status: "SUCCESS",
      gatewayTxnId: "GW-WEBHOOK-777",
      errorMessage: ""
    };

    const timestamp = Date.now().toString();
    const nonce = crypto.randomBytes(16).toString("hex");
    const payloadString = timestamp + "." + nonce + "." + JSON.stringify(webhookBody);
    const signature = crypto.createHmac("sha256", WEBHOOK_SECRET).update(payloadString).digest("hex");

    // Scenario 6: Webhook Settle Order
    const webhookRes = await axios.post(`${baseUrl}/api/payment/webhook`, webhookBody, {
      headers: {
        "x-webhook-signature": signature,
        "x-webhook-timestamp": timestamp,
        "x-webhook-nonce": nonce
      }
    });

    assert(webhookRes.status === 200, "Webhook endpoint accepted payload and returned 200 OK");
    
    // Give callback time to process async webhook logic
    await new Promise(resolve => setTimeout(resolve, 500));

    const webhOrder = await prisma.order.findUnique({
      where: { id: orderId3 }
    });
    const webhPayment = await prisma.payment.findUnique({
      where: { id: paymentId3 }
    });
    assert(webhOrder && webhOrder.paymentStatus === "PAID" && webhOrder.status === "PROCESSING", "Webhook successfully settled order to PAID/PROCESSING");
    assert(webhPayment && webhPayment.status === "SUCCESS", "Webhook successfully updated payment status to SUCCESS");

    // Scenario 7: Duplicate Webhook Protection
    const webhookResDup = await axios.post(`${baseUrl}/api/payment/webhook`, webhookBody, {
      headers: {
        "x-webhook-signature": signature,
        "x-webhook-timestamp": timestamp,
        "x-webhook-nonce": nonce
      }
    });
    assert(webhookResDup.status === 200, "Duplicate webhook request gracefully handled and returned 200 OK");
    
    const countTopups = await prisma.transaction.count({
      where: { userId: testUser.id, type: "TOPUP", gatewayTxnId: "GW-WEBHOOK-777" }
    });
    assert(countTopups === 1, "Duplicate protection works: Only 1 credit transaction was created (no double spending/settlement)");

    // Scenario 8: Webhook Replay Protection
    // Expired timestamp
    const expiredTimestamp = (Date.now() - 360000).toString(); // 6 mins ago
    const payloadStringExpired = expiredTimestamp + "." + nonce + "." + JSON.stringify(webhookBody);
    const signatureExpired = crypto.createHmac("sha256", WEBHOOK_SECRET).update(payloadStringExpired).digest("hex");

    try {
      await axios.post(`${baseUrl}/api/payment/webhook`, webhookBody, {
        headers: {
          "x-webhook-signature": signatureExpired,
          "x-webhook-timestamp": expiredTimestamp,
          "x-webhook-nonce": nonce
        }
      });
      assert(false, "Replay Attack: Expired timestamp was not rejected");
    } catch (err) {
      assert(err.response?.status === 400, `Replay Attack: Expired timestamp was correctly rejected with status ${err.response?.status}`);
    }

    // Duplicate Nonce
    const newBody = { ...webhookBody, gatewayTxnId: "GW-REPLAY-888" };
    const payloadStringNonce = timestamp + "." + nonce + "." + JSON.stringify(newBody); // Reused nonce
    const signatureNonce = crypto.createHmac("sha256", WEBHOOK_SECRET).update(payloadStringNonce).digest("hex");

    try {
      await axios.post(`${baseUrl}/api/payment/webhook`, newBody, {
        headers: {
          "x-webhook-signature": signatureNonce,
          "x-webhook-timestamp": timestamp,
          "x-webhook-nonce": nonce // Duplicate nonce
        }
      });
      assert(false, "Replay Attack: Duplicate nonce was not rejected");
    } catch (err) {
      assert(err.response?.status === 429, `Replay Attack: Duplicate nonce was correctly rejected with status ${err.response?.status}`);
    }

    // -------------------------------------------------------------------------
    // Scenario 9: Refund Flow
    // -------------------------------------------------------------------------
    console.log("\n--- Scenario 9: iMart Order Refund Flow ---");
    // Order 3 (from Scenario 6) is PAID, amount ₹118.
    
    // Action A: Request Full Refund
    const refReqRes = await axios.post(`${baseUrl}/api/imart/admin/orders/${orderId3}/refund`, {
      action: "REQUEST",
      amount: 118,
      remarks: "Defective device"
    }, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "x-master-key-session": masterKeySessionToken
      }
    });

    assert(refReqRes.status === 200, "Refund request route returned 200 OK");
    const refReqOrder = await prisma.order.findUnique({ where: { id: orderId3 } });
    assert(refReqOrder && refReqOrder.paymentStatus === "REFUND_PENDING", "Order paymentStatus transitioned to REFUND_PENDING");

    // Action B: Reject Refund
    const refRejRes = await axios.post(`${baseUrl}/api/imart/admin/orders/${orderId3}/refund`, {
      action: "REJECT",
      remarks: "Defect not verified"
    }, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "x-master-key-session": masterKeySessionToken
      }
    });

    assert(refRejRes.status === 200, "Refund rejection returned 200 OK");
    const refRejOrder = await prisma.order.findUnique({ where: { id: orderId3 } });
    assert(refRejOrder && refRejOrder.paymentStatus === "PAID", "Order paymentStatus reverted back to PAID on rejection");

    // Action C: Process Full Refund
    const userWalletBefore = await prisma.wallet.findUnique({ where: { userId: testUser.id } });
    
    const refundRes = await axios.post(`${baseUrl}/api/imart/admin/orders/${orderId3}/refund`, {
      action: "FULL",
      remarks: "Full refund processed directly"
    }, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "x-master-key-session": masterKeySessionToken
      }
    });

    assert(refundRes.status === 200, "Refund processing returned 200 OK");

    const refundedOrder = await prisma.order.findUnique({ where: { id: orderId3 } });
    const userWalletAfter = await prisma.wallet.findUnique({ where: { userId: testUser.id } });
    
    assert(refundedOrder && refundedOrder.paymentStatus === "REFUNDED" && refundedOrder.status === "CANCELLED", "Refunded order paymentStatus transitions to REFUNDED and status to CANCELLED");
    assert(Number(userWalletAfter.balance) === Number(userWalletBefore.balance) + 118.00, "User wallet credited with full refund amount of ₹118.00");

    // Check refund ledger entry and transaction record
    const refundLedger = await prisma.ledgerEntry.findFirst({
      where: { userId: testUser.id, type: "REFUND_CREDIT", description: { contains: "Order #"+orderId3 } }
    });
    const refundTx = await prisma.transaction.findFirst({
      where: { userId: testUser.id, type: "REFUND", status: "SUCCESS" }
    });

    assert(!!refundLedger, "REFUND_CREDIT ledger entry successfully recorded with correct metadata");
    assert(!!refundTx && Number(refundTx.amount) === 118.00, "REFUND transaction record in SUCCESS status is created");

    // Verify Admin audit logging
    const auditRecord = await prisma.auditLog.findFirst({
      where: { adminId: testAdmin.id, action: "IMART_ORDER_REFUNDED" }
    });
    assert(!!auditRecord, "Admin audit log record created for IMART_ORDER_REFUNDED");

    // -------------------------------------------------------------------------
    // Scenario 12: Reconciliation Recovery
    // -------------------------------------------------------------------------
    console.log("\n--- Scenario 12: Reconciliation Recovery (Unsent Webhook) ---");
    // Add item back to wishlist since it was cleared upon Scenario 6's success
    const userWishlist = await prisma.wishlist.findUnique({ where: { userId: testUser.id } });
    await prisma.wishlistItem.create({
      data: { wishlistId: userWishlist.id, productId: testProduct.id }
    });

    // Create checkout 4
    const checkoutRes4 = await axios.post(`${baseUrl}/api/imart/checkout`, {
      paymentMethod: "UPI"
    }, {
      headers: { Authorization: `Bearer ${userToken}`, "x-idempotency-key": `imart_chk_${Date.now()}` }
    });

    const orderId4 = checkoutRes4.data.order.id;
    const paymentId4 = checkoutRes4.data.order.paymentId;

    // Simulate gateway success, but webhook doesn't arrive (payment stays PENDING)
    mockStatus = "SUCCESS";
    mockGatewayAmount = 118;

    // Trigger reconciliation via status check
    const statusCheckRes = await axios.get(`${baseUrl}/api/payment/status/${paymentId4}`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });

    assert(statusCheckRes.status === 200, "Status query returned 200");
    assert(statusCheckRes.data.status === "SUCCESS", "Payment status checks reconciles and transitions to SUCCESS");

    const reconciledOrder = await prisma.order.findUnique({ where: { id: orderId4 } });
    assert(reconciledOrder && reconciledOrder.paymentStatus === "PAID" && reconciledOrder.status === "PROCESSING", "Reconciliation recovery settles order to PAID/PROCESSING");

  } catch (err) {
    console.error("Test execution threw exception:", err.response?.data || err.message || err);
    failed++;
  } finally {
    // Cleanup mock servers
    mockGatewayServer.close();
    expressServer.close();
    console.log("\nMock servers closed.");

    // Cleanup test data from DB
    console.log("Cleaning up test data from database...");
    if (testUser) {
      await cleanUserData(testUser.id);
    }
    if (testAdmin) {
      await cleanUserData(testAdmin.id);
    }
    if (testProduct) {
      await prisma.product.delete({ where: { id: testProduct.id } }).catch(() => {});
    }
    if (testCategory) {
      await prisma.category.delete({ where: { id: testCategory.id } }).catch(() => {});
    }

    await prisma.$disconnect();
  }

  console.log("\n=== IMART NEXGATE INTEGRATION TESTS SUMMARY ===");
  console.log(`PASS: ${passed}`);
  console.log(`FAIL: ${failed}`);
  if (failed === 0) {
    console.log("ALL TESTS PASSED SUCCESSFULLY! ✅");
  } else {
    console.log("SOME TESTS FAILED! ❌");
  }
}

main();
