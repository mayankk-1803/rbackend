import prisma from "../config/prisma.js";
import nextgate from "../services/payments/nextgate/index.js";

/**
 * Get Admin Wallet Stats
 */
export const getAdminWalletStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const wallet = await prisma.wallet.findUnique({
      where: { userId }
    });

    const recentPayments = await prisma.payment.findMany({
      where: { userId, intent: "TOPUP" },
      orderBy: { createdAt: "desc" },
      take: 10
    });

    res.json({
      success: true,
      data: {
        balance: wallet?.balance || 0,
        recentPayments
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Initiate Nextgate Topup for Admin
 */
export const initiateAdminTopup = async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.id;

    if (!amount || amount < 100) {
      return res.status(400).json({ success: false, message: "Minimum topup is 100" });
    }

    // 1. Create Payment Record
    const idempotencyKey = `ADMIN_TOPUP_${Date.now()}`;
    const payment = await prisma.payment.create({
      data: {
        userId,
        amount: amount,
        status: "PENDING",
        intent: "TOPUP",
        idempotencyKey
      }
    });

    // 2. Create Nextgate Order
    const order = await nextgate.createOrder({
      amount,
      txnId: payment.id,
      userId
    });

    // 3. Update Payment with Gateway Info
    await prisma.payment.update({
      where: { id: payment.id },
      data: { gatewayUrl: order.paymentUrl }
    });

    res.json({
      success: true,
      paymentUrl: order.paymentUrl,
      orderId: payment.id
    });
  } catch (err) {
    console.error("[ADMIN TOPUP ERROR]:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Verify Admin Topup (Manual Trigger)
 */
export const verifyAdminTopup = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const verification = await nextgate.verifyPayment(orderId);
    
    if (verification.success) {
      const payment = await prisma.payment.findUnique({ 
        where: { id: Number(orderId) } 
      });

      if (payment && payment.status === "PENDING") {
         await prisma.$transaction(async (tx) => {
            await tx.payment.update({
              where: { id: payment.id },
              data: { status: "SUCCESS", gatewayTxnId: verification.gatewayTxnId }
            });

            await tx.wallet.update({
              where: { userId: payment.userId },
              data: { balance: { increment: payment.amount } }
            });

            await tx.transaction.create({
              data: {
                userId: payment.userId,
                amount: payment.amount,
                type: "TOPUP",
                status: "SUCCESS",
                direction: "CREDIT",
                description: "Admin Wallet Topup via Nextgate"
              }
            });
         });
         return res.json({ success: true, message: "Payment verified and wallet credited" });
      }
    }

    res.json({ success: false, message: "Payment not verified yet", status: verification.status });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
