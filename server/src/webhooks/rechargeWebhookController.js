import prisma from "../config/prisma.js";
import eventBus from "../config/eventBus.js";
import { Prisma } from "@prisma/client";
import { issueReward } from "../services/rewardEngine.js";

export const handleApiboxCallback = async (req, res) => {
  // Support both GET and POST
  const params = req.method === "POST" ? req.body : req.query;

  console.log("[APIBOX] Webhook HIT:", params);

  // Apibox uses flexible naming. We support:
  // Status/STATUS, RefTxnId/OurTxnId, OPTXNID/OPtxnId
  const RefTxnId = params.RefTxnId || params.OurTxnId || params.agentid || params.AGENTID;
  const STATUS = params.STATUS || params.Status || params.status;
  const MSG = params.MSG || params.msg || params.remark;
  const TXNID = params.TXNID || params.txnid;
  const OPTXNID = params.OPTXNID || params.OPtxnId || params.operator_id;

  if (!RefTxnId) {
    console.warn("[APIBOX] Missing transaction reference in webhook");
    return res.status(400).send("Missing RefTxnId");
  }

  try {
    const txnIdNum = Number(RefTxnId);
    if (isNaN(txnIdNum)) {
      console.warn("[APIBOX] Invalid RefTxnId format:", RefTxnId);
      return res.status(400).send("Invalid RefTxnId");
    }

    const txn = await prisma.transaction.findUnique({
      where: { id: txnIdNum }
    });

    if (!txn) {
      console.warn("[APIBOX] Transaction not found:", RefTxnId);
      return res.status(404).send("Transaction not found");
    }

    if (txn.status !== "PENDING") {
      console.log(`[APIBOX] Transaction ${RefTxnId} is already ${txn.status}. Skipping.`);
      return res.status(200).send("OK");
    }

    const statusStr = String(STATUS);
    let finalStatus = "PENDING";
    let isRefund = false;

    // Apibox: 1=Success, 2=Pending, 3=Failed
    if (statusStr === "1" || statusStr.toLowerCase() === "success") {
      finalStatus = "SUCCESS";
    } else if (statusStr === "3" || statusStr.toLowerCase() === "failed") {
      finalStatus = "FAILED";
      isRefund = true;
    } else if (statusStr === "2" || statusStr.toLowerCase() === "pending") {
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

      // 2. SUCCESS Logic: Credit Cashback Reward
      if (finalStatus === "SUCCESS") {
         try {
           // We'll call this outside the transaction or via event bus if preferred,
           // but for immediate consistency we can do it here if issueReward handles its own tx
         } catch (e) {
           console.error("[APIBOX] Reward Issue Error:", e.message);
         }
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

    // [CRITICAL] Reward Issuance
    if (finalStatus === "SUCCESS") {
      // Trigger cashback reward engine
      await issueReward(txn.id).catch(err => console.error("Reward Error:", err));
    }

    // [CRITICAL] EVENT BUS EMITS
    if (finalStatus === "SUCCESS" || finalStatus === "FAILED") {
      eventBus.emit(`recharge_${finalStatus.toLowerCase()}`, {
        transactionId: txn.id,
        status: finalStatus.toLowerCase(),
        transaction: result.updatedTxn,
        reason: MSG,
        userId: txn.userId,
        amount: txn.amount,
        providerTxnId: result.updatedTxn.providerTxnId
      });
      
      eventBus.emit("transaction_updated", {
        transactionId: txn.id,
        status: finalStatus,
        transaction: result.updatedTxn,
        amount: txn.amount,
        providerTxnId: result.updatedTxn.providerTxnId,
        userId: txn.userId
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
