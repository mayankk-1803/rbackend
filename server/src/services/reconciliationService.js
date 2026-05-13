import prisma from "../config/prisma.js";
import { checkNexgateStatus } from "./providers/nexgateService.js";
import { paymentWebhook } from "../controllers/paymentController.js";

/**
 * Reconciliation Service
 * Recovers lost webhooks and expires abandoned payments
 */
export const reconcilePayments = async () => {
  console.log("[Reconciliation] Starting scan for stale payments...");

  try {
    // 1. Find PENDING payments older than 30 minutes but newer than 24 hours
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const stalePayments = await prisma.payment.findMany({
      where: {
        status: "PENDING",
        createdAt: {
          lt: thirtyMinsAgo,
          gt: oneDayAgo
        }
      }
    });

    console.log(`[Reconciliation] Found ${stalePayments.length} stale payments to verify.`);

    for (const payment of stalePayments) {
      try {
        console.log(`[Reconciliation] Verifying Payment ${payment.id} (Gateway ID: ${payment.gatewayTxnId})`);
        
        // Call gateway to check real status
        const gatewayStatus = await checkNexgateStatus(payment.id);
        
        if (gatewayStatus.success && (gatewayStatus.status === "SUCCESS" || gatewayStatus.status === "FAILED")) {
          console.log(`[Reconciliation] Payment ${payment.id} found with state ${gatewayStatus.status}. Triggering internal webhook.`);
          
          // Simulate webhook hit to trigger the hardened logic
          const mockReq = {
            body: {
              order_id: payment.id,
              status: gatewayStatus.status,
              transaction_id: gatewayStatus.operatorTxnId || payment.gatewayTxnId,
              amount: payment.amount,
              message: "Reconciliation Recovery"
            }
          };
          const mockRes = {
            json: (data) => console.log(`[Reconciliation] Sync Result for ${payment.id}:`, data),
            status: () => ({ json: (data) => console.error(`[Reconciliation] Sync Error for ${payment.id}:`, data) })
          };

          await paymentWebhook(mockReq, mockRes);
        } else {
          console.log(`[Reconciliation] Payment ${payment.id} still pending at gateway.`);
        }
      } catch (err) {
        console.error(`[Reconciliation] Failed to verify payment ${payment.id}:`, err.message);
      }
    }

    // 2. Expire payments older than 2 hours that are still pending
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const expiredCount = await prisma.payment.updateMany({
      where: {
        status: "PENDING",
        createdAt: { lt: twoHoursAgo }
      },
      data: {
        status: "FAILED",
        errorMessage: "Payment Expired (Abandoned)"
      }
    });

    if (expiredCount.count > 0) {
      console.log(`[Reconciliation] Expired ${expiredCount.count} abandoned payments.`);
    }

  } catch (error) {
    console.error("[Reconciliation Error]:", error);
  }
};

// Auto-trigger reconciliation every 15 minutes
export const startReconciliationCron = () => {
  console.log("[Reconciliation] Scheduler initialized (Every 15 mins)");
  setInterval(reconcilePayments, 15 * 60 * 1000);
};
