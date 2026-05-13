import prisma from "../config/prisma.js";
import eventBus from "../config/eventBus.js";
import { Prisma } from "@prisma/client";

export const handleApiboxCallback = async (req, res) => {
  // Support both GET and POST
  const params = req.method === "POST" ? req.body : req.query;

  console.log("[APIBOX] Webhook HIT:", params);

  // Apibox uses STATUS (1=Success, 2=Pending, 3=Failed) and RefTxnId
  const { RefTxnId, STATUS, MSG, TXNID, OPTXNID } = params;

  if (!RefTxnId) {
    console.warn("[APIBOX] Missing RefTxnId in webhook");
    return res.status(400).send("Missing RefTxnId");
  }

  try {
    const txn = await prisma.transaction.findUnique({
      where: { id: Number(RefTxnId) }
    });

    if (!txn) {
      console.warn("[APIBOX] Transaction not found:", RefTxnId);
      return res.status(404).send("Transaction not found");
    }

    if (txn.status !== "PENDING") {
      console.log(`[APIBOX] Transaction ${RefTxnId} is already ${txn.status}. Skipping.`);
      return res.status(200).send("OK");
    }

    const statusInt = Number(STATUS);
    let finalStatus = "PENDING";
    let isRefund = false;

    if (statusInt === 1) {
      finalStatus = "SUCCESS";
    } else if (statusInt === 3) {
      finalStatus = "FAILED";
      isRefund = true;
    } else if (statusInt === 2) {
      finalStatus = "PENDING";
    } else {
      console.log(`[APIBOX] Unhandled status ${STATUS} for Txn ${RefTxnId}.`);
      return res.status(200).send("OK");
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update Transaction
      const updatedTxn = await tx.transaction.update({
        where: { id: txn.id },
        data: { 
          status: finalStatus,
          providerTxnId: OPTXNID || TXNID || txn.providerTxnId,
          ...(isRefund ? { refundStatus: "refunded", refundedAt: new Date() } : {})
        }
      });

      let updatedWallet = null;

      // 2. SUCCESS Logic: Optional Cashback/Referral
      if (finalStatus === "SUCCESS") {
         // Keep existing cashback logic if needed
      }

      // 3. FAILED Logic: Refund
      if (finalStatus === "FAILED" && isRefund) {
        updatedWallet = await tx.wallet.update({
          where: { userId: txn.userId },
          data: { balance: { increment: txn.amount } }
        });

        await tx.transaction.create({
          data: { 
            userId: txn.userId, 
            amount: txn.amount, 
            type: "REFUND", 
            status: "SUCCESS", 
            direction: "CREDIT",
            description: `Refund for recharge ${txn.id}: ${MSG || 'Provider failed'}`
          }
        });
        console.log(`[REFUND] Apibox Txn ${txn.id} refunded to user ${txn.userId}`);
      }

      if (!updatedWallet) {
          updatedWallet = await tx.wallet.findUnique({ where: { userId: txn.userId } });
      }

      return { updatedTxn, updatedWallet };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    // [CRITICAL] EVENT BUS EMITS
    if (finalStatus === "SUCCESS" || finalStatus === "FAILED") {
      eventBus.emit(`recharge_${finalStatus.toLowerCase()}`, {
        txnId: txn.id,
        status: finalStatus.toLowerCase(),
        transaction: result.updatedTxn,
        reason: MSG
      });
      
      eventBus.emit("recharge_update", {
        txnId: txn.id,
        status: finalStatus,
        transaction: result.updatedTxn
      });
    }

    if (result.updatedWallet) {
      eventBus.emit("wallet_updated", { userId: txn.userId.toString() });
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("[APIBOX] Webhook Error:", err.message);
    return res.status(500).send("Error");
  }
};
