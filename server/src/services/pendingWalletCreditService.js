import prisma from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import { recordFinancialEntry } from "./ledgerService.js";
import { updateAdminWalletBalance, getAdminWalletStats } from "./adminWalletService.js";
import { validateMasterKeyAndRoutes } from "./masterKeyValidationService.js";
import eventBus from "../config/eventBus.js";

/**
 * Creates a system notification in the DB for a specific user.
 */
export const createSystemNotification = async (userId, title, message, type, tx = prisma) => {
  return await tx.notification.create({
    data: {
      userId,
      title,
      message,
      type
    }
  });
};

/**
 * Dispatches notifications to all Admins and Super Admins.
 */
export const notifyAdmins = async (title, message, type, tx = prisma) => {
  const admins = await tx.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
    select: { id: true }
  });

  for (const admin of admins) {
    await tx.notification.create({
      data: {
        userId: admin.id,
        title,
        message,
        type
      }
    });
  }
};

/**
 * Fetches all PendingWalletCredit records with pagination, search, and status filters.
 */
export const getPendingWalletCredits = async ({
  page = 1,
  limit = 20,
  status = "PENDING"
}) => {
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.max(1, parseInt(limit));
  const skip = (pageNum - 1) * limitNum;

  const where = {};
  if (status && status !== "ALL") {
    where.settlementStatus = status;
  }

  const [items, total] = await Promise.all([
    prisma.pendingWalletCredit.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, phone: true, email: true }
        },
        payment: {
          select: { id: true, gatewayTxnId: true, amount: true, idempotencyKey: true, createdAt: true }
        }
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limitNum
    }),
    prisma.pendingWalletCredit.count({ where })
  ]);

  return {
    items,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum)
    }
  };
};

/**
 * Creates a PendingWalletCredit record.
 */
export const createPendingWalletCredit = async ({
  userId,
  paymentId,
  amount,
  settlementStatus = "PENDING",
  remarks = null,
  tx = prisma
}) => {
  const pendingCredit = await tx.pendingWalletCredit.create({
    data: {
      userId,
      paymentId,
      amount: new Prisma.Decimal(amount),
      settlementStatus,
      remarks
    }
  });

  // Generate Admin and User Notifications
  if (settlementStatus === "PENDING") {
    await notifyAdmins(
      "PENDING CREDIT APPROVAL",
      `Wallet Top-up of ₹${amount} for User #${userId} is pending approval due to insufficient master wallet balance.`,
      "PENDING_CREDIT_APPROVAL",
      tx
    );

    await createSystemNotification(
      userId,
      "Wallet Credit Pending",
      `Payment of ₹${amount} received successfully. Your wallet credit is pending administrative approval.`,
      "WALLET_CREDIT_PENDING",
      tx
    );
  } else if (settlementStatus === "FAILED") {
    await notifyAdmins(
      "MASTER KEY / ROUTE FAILURE",
      `Recharge/Settlement failed validation checks for User #${userId} top-up of ₹${amount}.`,
      "PROVIDER_FAILURE",
      tx
    );
  }

  return pendingCredit;
};

/**
 * Processes approval of a pending wallet credit.
 * Executed inside a SERIALIZABLE transaction.
 */
export const processPendingSettlementApproval = async (pendingId, adminId) => {
  let userWalletUpdated = null;
  let createdTx = null;

  const result = await prisma.$transaction(async (tx) => {
    // 1. Lock and fetch PendingWalletCredit record
    const pendingCredits = await tx.$queryRaw`SELECT * FROM pending_wallet_credit WHERE id = ${Number(pendingId)} FOR UPDATE`;
    const pending = pendingCredits && pendingCredits[0];
    
    if (!pending) {
      throw new Error(`Pending credit record not found.`);
    }

    if (pending.settlementStatus !== "PENDING") {
      throw new Error(`Pending credit is already processed (Status: ${pending.settlementStatus}).`);
    }

    // 2. Revalidate Master Key and Route configurations
    const isMasterValid = await validateMasterKeyAndRoutes(tx);
    if (!isMasterValid) {
      // Create failure notification and abort
      await notifyAdmins(
        "MASTER KEY FAILURE",
        `Approval failed: Master Key/Route validation check failed during manual approval of Pending Settlement #${pendingId}.`,
        "MASTER_KEY_FAILURE",
        tx
      );
      throw new Error("Validation check failed: Active Master Key or Provider Route is unavailable.");
    }

    // 3. Revalidate Admin Wallet Balance
    const adminStats = await getAdminWalletStats(tx);
    const amountNum = Number(pending.amount);
    
    if (adminStats.availableBalance < amountNum) {
      await notifyAdmins(
        "LOW WALLET BALANCE",
        `Insufficient available balance (₹${adminStats.availableBalance}) to approve settlement #${pendingId} (₹${amountNum}).`,
        "LOW_WALLET_BALANCE",
        tx
      );
      throw new Error(`Insufficient Admin Master Wallet balance. Current Available: ₹${adminStats.availableBalance}`);
    }

    // 4. Execute balance updates:
    // Debit Admin Wallet
    await updateAdminWalletBalance({
      amount: -amountNum,
      type: "SETTLEMENT_DEBIT",
      description: `Settlement debit for User #${pending.userId} pending credit approval`,
      referenceId: String(pending.paymentId),
      metadata: { pendingCreditId: pendingId },
      tx
    });

    // Credit User Wallet
    const wallets = await tx.$queryRaw`SELECT * FROM wallet WHERE userId = ${pending.userId} FOR UPDATE`;
    if (!wallets || wallets.length === 0) {
      throw new Error(`User wallet not found.`);
    }
    const wallet = wallets[0];
    const balanceBefore = Number(wallet.balance);
    const balanceAfter = balanceBefore + amountNum;

    await tx.wallet.update({
      where: { userId: pending.userId },
      data: { balance: new Prisma.Decimal(balanceAfter) }
    });

    const correlationId = `settle-${pendingId}-${Date.now()}`;
    const ledgerDesc = `Wallet topup approved | Order: ${pending.paymentId}`;
    const txDesc = `Wallet topup approved | Order: ${pending.paymentId} | Before: ${balanceBefore}`;

    // Record User Financial Entry
    await recordFinancialEntry({
      userId: pending.userId,
      amount: pending.amount,
      type: 'TOPUP_CREDIT',
      transactionId: null,
      description: ledgerDesc,
      context: { correlationId, ipAddress: "system" },
      tx,
      skipWalletUpdate: true,
      overrideBalanceBefore: balanceBefore,
      overrideBalanceAfter: balanceAfter
    });

    // Create Transaction Log
    createdTx = await tx.transaction.create({
      data: {
        userId: pending.userId,
        amount: pending.amount,
        type: "TOPUP",
        status: "SUCCESS",
        direction: "CREDIT",
        gatewayTxnId: `SETTLE_${pendingId}`,
        balanceAfter: new Prisma.Decimal(balanceAfter),
        description: txDesc,
        idempotencyKey: `settle:${pending.paymentId}`,
        financialSequenceId: correlationId
      }
    });

    // Update Pending Settlement Status
    await tx.pendingWalletCredit.update({
      where: { id: pending.id },
      data: {
        settlementStatus: "APPROVED",
        approvedBy: Number(adminId),
        approvedAt: new Date()
      }
    });

    // Send notifications to User and Admin
    await createSystemNotification(
      pending.userId,
      "Wallet Credited",
      `Your wallet has been credited with ₹${amountNum} successfully.`,
      "WALLET_CREDITED",
      tx
    );

    userWalletUpdated = {
      userId: pending.userId,
      amount: amountNum,
      balance: balanceAfter
    };

    return { success: true };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  });

  // Trigger realtime events outside transaction
  if (result.success && userWalletUpdated) {
    try {
      eventBus.emit("wallet_updated", userWalletUpdated);
      if (createdTx) {
        eventBus.emit("transaction_updated", {
          userId: userWalletUpdated.userId,
          txnId: createdTx.id,
          status: "SUCCESS",
          transaction: createdTx
        });
      }
    } catch (err) {
      console.warn("[PENDING_SETTLEMENT] Realtime event emit failed:", err.message);
    }
  }

  return result;
};

/**
 * Processes rejection of a pending wallet credit.
 */
export const processPendingSettlementRejection = async (pendingId, adminId, remarks) => {
  if (!remarks || !remarks.trim()) {
    throw new Error("Rejection remarks are mandatory.");
  }

  const result = await prisma.$transaction(async (tx) => {
    // Lock and fetch PendingWalletCredit record
    const pendingCredits = await tx.$queryRaw`SELECT * FROM pending_wallet_credit WHERE id = ${Number(pendingId)} FOR UPDATE`;
    const pending = pendingCredits && pendingCredits[0];

    if (!pending) {
      throw new Error(`Pending credit record not found.`);
    }

    if (pending.settlementStatus !== "PENDING") {
      throw new Error(`Pending credit is already processed (Status: ${pending.settlementStatus}).`);
    }

    // Update Pending Settlement Status to REJECTED
    await tx.pendingWalletCredit.update({
      where: { id: pending.id },
      data: {
        settlementStatus: "REJECTED",
        remarks: remarks.trim(),
        approvedBy: Number(adminId),
        approvedAt: new Date()
      }
    });

    // Send user notification
    await createSystemNotification(
      pending.userId,
      "Wallet Rejected",
      `Your wallet credit of ₹${pending.amount} was rejected. Remarks: ${remarks}`,
      "WALLET_REJECTED",
      tx
    );

    // Send admin notification
    await notifyAdmins(
      "SETTLEMENT REJECTED",
      `Pending settlement of ₹${pending.amount} for User #${pending.userId} has been rejected by Admin #${adminId}.`,
      "SETTLEMENT_REJECTED",
      tx
    );

    return { success: true };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  });

  return result;
};

/**
 * Automatically retries pending wallet credits, oldest first,
 * processing them until the admin wallet balance is insufficient.
 */
export const autoRetryPendingCredits = async (adminId) => {
  try {
    while (true) {
      const pending = await prisma.pendingWalletCredit.findFirst({
        where: { settlementStatus: "PENDING" },
        orderBy: { createdAt: "asc" }
      });
      if (!pending) break;

      try {
        await processPendingSettlementApproval(pending.id, adminId);
        console.log(`[AUTO_RETRY] Successfully auto-approved pending credit #${pending.id}`);
      } catch (err) {
        console.log(`[AUTO_RETRY] Auto-approve failed or stopped for pending credit #${pending.id}:`, err.message);
        break; // Stop loop when balance is insufficient or validation fails
      }
    }
  } catch (error) {
    console.error("[AUTO_RETRY_ERROR] Error running auto-retry engine:", error);
  }
};
