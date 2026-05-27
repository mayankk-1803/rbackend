import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

// MOCK OUTGOING AXIOS REQUESTS VIA CUSTOM ADAPTER ON AXIOS.CREATE
import axios from "axios";
const originalCreate = axios.create;
axios.create = function (defaultConfig) {
  const instance = originalCreate.call(axios, defaultConfig);
  instance.interceptors.request.use((config) => {
    if (config.url && config.url.includes("/check_status.php")) {
      config.adapter = function (c) {
        return Promise.resolve({
          data: {
            status: "success",
            success: true,
            data: {
              status: "success",
              transaction_id: "MOCK_GATEWAY_TXN_REDIRECT_TEST",
              amount: "150.00"
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

import prisma from "../src/config/prisma.js";

async function runTest() {
  console.log("=== STARTING REDIRECT SEPARATION VERIFICATION TEST ===");

  // Import app route handler indirectly by calling the app route function or mocking it
  // Since app.js does not export the handler, we can mock or construct the req and res to run against the app.js code block
  // To test the exact route handler, we will simulate the logic directly, importing prisma and doing checks identical to app.js
  
  // 1. SETUP: Ensure a test user exists
  let user = await prisma.user.findFirst({ where: { role: "USER" } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Redirect Test User",
        email: "redirect_test@dizipay.com",
        password: "hash",
        phone: "9999999992",
        role: "USER"
      }
    });
  }

  // 2. CREATE A NORMAL USER PAYMENT
  const userPayment = await prisma.payment.create({
    data: {
      userId: user.id,
      amount: 150.00,
      idempotencyKey: `user_topup:${crypto.randomUUID()}`,
      upiId: "user@upi",
      intent: "TOPUP",
      status: "PENDING"
    }
  });
  console.log(`Created normal user payment ID: ${userPayment.id}`);

  // 3. CREATE AN ADMIN FUNDING PAYMENT
  const adminPayment = await prisma.payment.create({
    data: {
      userId: user.id,
      amount: 250.00,
      idempotencyKey: `admin_funding:adminId=2:reason=RedirectTest:${crypto.randomUUID()}`,
      upiId: "admin@upi",
      intent: "TOPUP",
      status: "PENDING"
    }
  });
  console.log(`Created admin-funded payment ID: ${adminPayment.id}`);

  // 4. DEFINE SIMULATOR FUNCTION MATCHING src/app.js LOGIC
  const simulateRedirect = async (orderId, queryStatus) => {
    const frontendUrl = process.env.FRONTEND_URL || "https://irecharge.in";
    const params = new URLSearchParams({ order_id: orderId.toString(), status: queryStatus });
    const status = queryStatus;

    let targetUrl = `${frontendUrl}/payment-success?${params.toString()}`;

    if (orderId) {
      try {
        let payment = await prisma.payment.findUnique({
          where: { id: Number(orderId) }
        });

        if (payment && payment.idempotencyKey && payment.idempotencyKey.startsWith("admin_funding:")) {
          // Sync verification simulation if pending and url is success
          if (payment.status === "PENDING" && (status === "SUCCESS" || status === "PAID")) {
            try {
              const { checkNexgateStatus } = await import("../src/services/providers/nexgateService.js");
              const { paymentWebhook } = await import("../src/controllers/paymentController.js");
              const gatewayStatus = await checkNexgateStatus(orderId);

              if (gatewayStatus.success && gatewayStatus.status === "SUCCESS") {
                const expectedSecret = process.env.WEBHOOK_SECRET || "internal_secret";
                await paymentWebhook(
                  {
                    body: {
                      order_id: orderId,
                      status: "SUCCESS",
                      transaction_id: gatewayStatus.operatorTxnId,
                      amount: gatewayStatus.raw?.amount || payment.amount.toString(),
                      message: "Synchronous Verification for Admin redirect",
                      secret: expectedSecret
                    }
                  },
                  { json: () => {}, status: () => ({ json: () => {} }) }
                );

                // Poll database state
                for (let i = 0; i < 15; i++) {
                  await new Promise(resolve => setTimeout(resolve, 100));
                  payment = await prisma.payment.findUnique({
                    where: { id: Number(orderId) }
                  });
                  if (payment.status !== "PENDING") {
                    break;
                  }
                }
              }
            } catch (verifyErr) {
              console.error(`[Redirector Sync Verify Error] Order ${orderId}:`, verifyErr.message);
            }
          }

          const adminUrl = (process.env.ADMIN_PANEL_URL || "https://irecharge.in/87564/admin").replace(/\/$/, "");
          const redirectParams = new URLSearchParams(params);
          redirectParams.set("status", payment.status);
          targetUrl = `${adminUrl}?${redirectParams.toString()}`;
        }
      } catch (dbErr) {
        console.error(`[Redirector DB Check Error] Order ${orderId}:`, dbErr.message);
      }
    }

    return targetUrl;
  };

  // 5. TEST USER REDIRECT TARGET
  console.log("\n--- STAGE 1: Testing normal user redirect ---");
  const userRedirectResult = await simulateRedirect(userPayment.id, "SUCCESS");
  console.log("Redirect URL for general user:", userRedirectResult);
  if (!userRedirectResult.includes("/payment-success?")) {
    throw new Error("User redirect target is incorrect! Expected normal landing page.");
  }
  console.log("User redirect matches expected behavior.");

  // 6. TEST ADMIN REDIRECT TARGET & SYNC FINALIZATION
  console.log("\n--- STAGE 2: Testing admin-funded redirect & sync verification ---");
  const adminRedirectResult = await simulateRedirect(adminPayment.id, "SUCCESS");
  console.log("Redirect URL for admin funding:", adminRedirectResult);
  
  const expectedAdminUrl = process.env.ADMIN_PANEL_URL || "https://irecharge.in/87564/admin";
  if (!adminRedirectResult.startsWith(expectedAdminUrl)) {
    throw new Error(`Admin redirect target is incorrect! Expected prefix: ${expectedAdminUrl}`);
  }
  
  // Verify that it contains status=SUCCESS
  if (!adminRedirectResult.includes("status=SUCCESS")) {
    throw new Error("Admin redirect status param is not SUCCESS! Synchronous verification did not commit.");
  }
  console.log("Admin redirect matches expected behavior.");

  // Verify wallet credited
  const updatedAdminPayment = await prisma.payment.findUnique({ where: { id: adminPayment.id } });
  console.log(`Payment Status in DB: ${updatedAdminPayment.status} (Expected: SUCCESS)`);
  if (updatedAdminPayment.status !== "SUCCESS") {
    throw new Error("Admin payment status was not updated to SUCCESS synchronously!");
  }

  // 7. CLEANUP
  await prisma.payment.deleteMany({
    where: { id: { in: [userPayment.id, adminPayment.id] } }
  });
  console.log("\nCleanup completed.");

  console.log("\n=== ALL REDIRECT SEPARATION TESTS PASSED SUCCESSFULLY ===");
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
