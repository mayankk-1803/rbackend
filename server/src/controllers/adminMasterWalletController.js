import prisma from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import { logAction } from "../services/auditService.js";
import { getAdminWalletStats, updateAdminWalletBalance, updateMinimumOperationalBalance } from "../services/adminWalletService.js";
import { getAdminLedgerEntries } from "../services/adminLedgerService.js";
import { getPendingWalletCredits, processPendingSettlementApproval, processPendingSettlementRejection, autoRetryPendingCredits } from "../services/pendingWalletCreditService.js";
import { checkMasterKeyLockout, recordMasterKeyFailure, clearMasterKeyFailures, safeCompare } from "../middlewares/masterKeySessionMiddleware.js";
import * as providerBalanceService from "../services/providerBalanceService.js";
import { recordFinancialEntry } from "../services/ledgerService.js";
import eventBus from "../config/eventBus.js";

/**
 * Get Admin Master Wallet details (balance, availableBalance, aggregates).
 * GET /admin/master-wallet
 */
export const getMasterWallet = async (req, res) => {
  try {
    const stats = await getAdminWalletStats();

    // Query pending credit stats from pendingWalletCredit table
    const pendingAgg = await prisma.pendingWalletCredit.aggregate({
      where: { settlementStatus: "PENDING" },
      _sum: { amount: true },
      _count: { id: true }
    });

    const pendingAmount = Number(pendingAgg._sum.amount || 0);
    const pendingCount = Number(pendingAgg._count.id || 0);

    // Calculate today's credits and debits from AdminLedger
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const todayCreditsAgg = await prisma.adminLedger.aggregate({
      where: {
        type: "CREDIT",
        amount: { gt: 0 },
        createdAt: { gte: startOfDay, lte: endOfDay }
      },
      _sum: { amount: true },
      _count: { id: true }
    });

    const todayDebitsAgg = await prisma.adminLedger.aggregate({
      where: {
        type: "DEBIT",
        amount: { lt: 0 },
        createdAt: { gte: startOfDay, lte: endOfDay }
      },
      _sum: { amount: true },
      _count: { id: true }
    });

    return res.json({
      success: true,
      balance: stats.balance,
      reservedBalance: stats.reservedBalance,
      availableBalance: stats.availableBalance,
      data: {
        balance: stats.balance,
        availableBalance: stats.availableBalance,
        reservedBalance: stats.reservedBalance,
        minimumOperationalBalance: stats.minimumOperationalBalance,
        totalCredits: stats.totalCredits,
        totalDebits: stats.totalDebits,
        pendingAmount,
        pendingCount,
        todayCreditsCount: todayCreditsAgg._count.id || 0,
        todayCreditsAmount: Math.abs(Number(todayCreditsAgg._sum.amount || 0)),
        todayDebitsCount: todayDebitsAgg._count.id || 0,
        todayDebitsAmount: Math.abs(Number(todayDebitsAgg._sum.amount || 0))
      }
    });
  } catch (error) {
    console.error("[GET_MASTER_WALLET_ERROR]", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get live read-only Recharge Pool Balance.
 * GET /api/admin/recharge-pool-balance
 */
export const getRechargePoolBalance = async (req, res) => {
  try {
    const balanceInfo = await providerBalanceService.getRechargePoolBalance();
    
    // Determine status based on providerAvailable flag
    const status = balanceInfo.providerAvailable ? "ACTIVE" : "DEGRADED";

    return res.json({
      success: true,
      balance: balanceInfo.balance,
      status,
      lastUpdated: balanceInfo.timestamp
    });
  } catch (error) {
    console.error("[GET_RECHARGE_POOL_BALANCE_ERROR]", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Credit Funds to Master Wallet (SUPER_ADMIN only, instant, no Master Key validation).
 * POST /admin/master-wallet/credit
 */
export const creditMasterWallet = async (req, res) => {
  try {
    if (req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const { amount, remarks } = req.body;
    const amt = parseFloat(amount);

    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ success: false, message: "Amount must be a positive number." });
    }

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || "127.0.0.1";
    const adminId = req.user.id;
    const timestamp = new Date().toISOString();

    await prisma.$transaction(async (tx) => {
      await updateAdminWalletBalance({
        amount: amt,
        type: "CREDIT",
        description: remarks || "System Capital Added",
        referenceId: "MANUAL_CREDIT",
        metadata: {
          adminId,
          ipAddress,
          timestamp,
          remarks: remarks || "System Capital Added",
          actionType: "CREDIT"
        },
        tx
      });
    });

    // Run the auto retry engine to process oldest pending credits
    await autoRetryPendingCredits(adminId);

    return res.json({ success: true, message: "Funds added successfully." });
  } catch (error) {
    console.error("[CREDIT_MASTER_WALLET_ERROR]", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Debit Funds from Master Wallet (SUPER_ADMIN only, requires Master Key validation).
 * POST /admin/master-wallet/debit
 */
export const debitMasterWallet = async (req, res) => {
  try {
    if (req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const { amount, remarks, masterKey } = req.body;
    const amt = parseFloat(amount);
    const adminId = req.user.id;

    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ success: false, message: "Amount must be a positive number." });
    }

    if (!masterKey) {
      return res.status(400).json({ success: false, message: "Master Key is required." });
    }

    // Lockout check
    const isLocked = await checkMasterKeyLockout(adminId);
    if (isLocked) {
      return res.status(403).json({
        success: false,
        message: "Master Key locked due to too many failed attempts. Locked for 15 minutes."
      });
    }

    const systemKey = process.env.SYSTEM_MASTER_KEY;
    const previousKey = process.env.SYSTEM_MASTER_KEY_PREVIOUS;

    if (!systemKey) {
      return res.status(500).json({ success: false, message: "System master key is not configured" });
    }

    const matchCurrent = safeCompare(masterKey, systemKey);
    const matchPrevious = previousKey ? safeCompare(masterKey, previousKey) : false;
    const isValid = matchCurrent || matchPrevious;

    if (!isValid) {
      await recordMasterKeyFailure(adminId);
      return res.status(403).json({ success: false, message: "Invalid Master Key." });
    }

    // Success
    await clearMasterKeyFailures(adminId);

    // Verify balance
    const stats = await getAdminWalletStats();
    if (amt > stats.balance) {
      return res.status(400).json({
        success: false,
        message: "Insufficient Master Wallet Balance"
      });
    }

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || "127.0.0.1";
    const timestamp = new Date().toISOString();

    await prisma.$transaction(async (tx) => {
      await updateAdminWalletBalance({
        amount: -amt,
        type: "DEBIT",
        description: remarks || "Capital Withdrawal",
        referenceId: "MANUAL_DEBIT",
        metadata: {
          adminId,
          ipAddress,
          timestamp,
          remarks: remarks || "Capital Withdrawal",
          actionType: "DEBIT"
        },
        tx
      });
    });

    return res.json({ success: true, message: "Funds withdrawn successfully." });
  } catch (error) {
    console.error("[DEBIT_MASTER_WALLET_ERROR]", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get Admin Wallet Dashboard statistics.
 * For compatibility with older dashboards.
 */
export const getDashboardStats = async (req, res) => {
  try {
    const stats = await getAdminWalletStats();

    // Query pending credit stats
    const pendingAgg = await prisma.pendingWalletCredit.aggregate({
      where: { settlementStatus: "PENDING" },
      _sum: { amount: true },
      _count: { id: true }
    });

    const pendingAmount = Number(pendingAgg._sum.amount || 0);
    const pendingCount = Number(pendingAgg._count.id || 0);

    // Query cashback earnings (CASHBACK_REVENUE credits)
    const cashbackAgg = await prisma.adminLedger.aggregate({
      where: { type: "CASHBACK_REVENUE" },
      _sum: { amount: true }
    });
    const cashbackEarnings = Number(cashbackAgg._sum.amount || 0);

    return res.json({
      success: true,
      data: {
        ...stats,
        pendingAmount,
        pendingCount,
        cashbackEarnings
      }
    });
  } catch (error) {
    console.error("[ADMIN_WALLET_STATS_ERROR]", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get filtered and paginated ledger entries.
 */
export const getLedger = async (req, res) => {
  try {
    const { page, limit, filter, startDate, endDate, type } = req.query;
    const ledger = await getAdminLedgerEntries({
      page,
      limit,
      filter,
      startDate,
      endDate,
      type
    });
    return res.json({ success: true, data: ledger });
  } catch (error) {
    console.error("[ADMIN_WALLET_LEDGER_ERROR]", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get filtered and paginated pending settlement requests.
 */
export const getPendingSettlements = async (req, res) => {
  try {
    const { page, limit, status } = req.query;
    const pending = await getPendingWalletCredits({
      page,
      limit,
      status
    });
    return res.json({ success: true, data: pending });
  } catch (error) {
    console.error("[ADMIN_WALLET_PENDING_ERROR]", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Handle manual credit/debit adjustments on the Master Wallet.
 */
export const adjustWallet = async (req, res) => {
  try {
    const { amount, type, remarks } = req.body;
    const amt = parseFloat(amount);

    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ success: false, message: "Amount must be a positive number." });
    }

    if (!remarks || !remarks.trim()) {
      return res.status(400).json({ success: false, message: "Remarks are mandatory for manual adjustments." });
    }

    const stats = await getAdminWalletStats();

    if (type === "DEBIT") {
      if (amt > stats.availableBalance) {
        return res.status(400).json({
          success: false,
          message: `Manual debit failed: Amount (₹${amt}) exceeds current available balance (₹${stats.availableBalance}).`
        });
      }

      await updateAdminWalletBalance({
        amount: -amt,
        type: "MANUAL_DEBIT",
        description: remarks.trim(),
        tx: prisma
      });
    } else if (type === "CREDIT") {
      await updateAdminWalletBalance({
        amount: amt,
        type: "MANUAL_CREDIT",
        description: remarks.trim(),
        tx: prisma
      });
    } else {
      return res.status(400).json({ success: false, message: "Invalid adjustment type. Use CREDIT or DEBIT." });
    }

    return res.json({ success: true, message: `Wallet manually adjusted successfully.` });
  } catch (error) {
    console.error("[ADMIN_WALLET_ADJUST_ERROR]", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Set Minimum Operational Balance parameter.
 */
export const adjustMinimumOperationalBalance = async (req, res) => {
  try {
    const { minimumOperationalBalance } = req.body;
    const minBal = parseFloat(minimumOperationalBalance);

    if (isNaN(minBal) || minBal < 0) {
      return res.status(400).json({ success: false, message: "Minimum Operational Balance must be a non-negative number." });
    }

    await updateMinimumOperationalBalance(minBal);
    return res.json({ success: true, message: "Minimum Operational Balance updated successfully." });
  } catch (error) {
    console.error("[ADMIN_WALLET_MIN_BAL_ERROR]", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Approve pending user topup settlement.
 */
export const approveSettlement = async (req, res) => {
  try {
    const { id } = req.body;
    const adminId = req.user.id;

    if (!id) {
      return res.status(400).json({ success: false, message: "Pending credit ID is required." });
    }

    await processPendingSettlementApproval(id, adminId);
    return res.json({ success: true, message: "Pending wallet credit settlement approved successfully." });
  } catch (error) {
    console.error("[ADMIN_SETTLEMENT_APPROVE_ERROR]", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Reject pending user topup settlement.
 */
export const rejectSettlement = async (req, res) => {
  try {
    const { id, remarks } = req.body;
    const adminId = req.user.id;

    if (!id) {
      return res.status(400).json({ success: false, message: "Pending credit ID is required." });
    }

    if (!remarks || !remarks.trim()) {
      return res.status(400).json({ success: false, message: "Remarks are mandatory for rejection." });
    }

    await processPendingSettlementRejection(id, adminId, remarks);
    return res.json({ success: true, message: "Pending wallet credit settlement rejected." });
  } catch (error) {
    console.error("[ADMIN_SETTLEMENT_REJECT_ERROR]", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Manual user wallet funding.
 * POST /api/admin/users/:userId/fund-wallet
 */
export const fundUserWallet = async (req, res) => {
  try {
    if (req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const userId = parseInt(req.params.userId);
    const { amount, remarks, masterKey } = req.body;
    const amt = parseFloat(amount);
    const adminId = req.user.id;

    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: "Invalid User ID." });
    }

    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ success: false, message: "Amount must be a positive number." });
    }

    if (!masterKey) {
      return res.status(400).json({ success: false, message: "Master Key is required." });
    }

    // 1. Lockout check
    const isLocked = await checkMasterKeyLockout(adminId);
    if (isLocked) {
      return res.status(403).json({
        success: false,
        message: "Master Key locked due to too many failed attempts. Locked for 15 minutes."
      });
    }

    const systemKey = process.env.SYSTEM_MASTER_KEY;
    const previousKey = process.env.SYSTEM_MASTER_KEY_PREVIOUS;

    if (!systemKey) {
      return res.status(500).json({ success: false, message: "System master key is not configured" });
    }

    const matchCurrent = safeCompare(masterKey, systemKey);
    const matchPrevious = previousKey ? safeCompare(masterKey, previousKey) : false;
    const isValid = matchCurrent || matchPrevious;

    if (!isValid) {
      await recordMasterKeyFailure(adminId);
      return res.status(403).json({ success: false, message: "Invalid Master Key." });
    }

    // Success - Clear lockout attempts
    await clearMasterKeyFailures(adminId);

    // 2. Validate User exists and is active
    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    if (!targetUser.isActive) {
      return res.status(400).json({ success: false, message: "User is not active." });
    }

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || "127.0.0.1";
    const timestamp = new Date().toISOString();
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const referenceId = `USERFUND-${userId}-${Date.now()}-${randomSuffix}`;

    let userWalletUpdated = null;
    let createdTx = null;

    // 3. Execute Funding Logic inside ONE Serializable Transaction
    await prisma.$transaction(async (tx) => {
      // Lock Admin Wallet record (id: 1)
      const adminWallets = await tx.$queryRaw`SELECT * FROM admin_wallet WHERE id = 1 FOR UPDATE`;
      let lockedAdminWallet = adminWallets && adminWallets[0];
      if (!lockedAdminWallet) {
        throw new Error("Admin wallet not found.");
      }

      // Check Available Balance
      const balance = Number(lockedAdminWallet.balance);
      const reservedBalance = Number(lockedAdminWallet.reservedBalance);
      const minimumOperationalBalance = Number(lockedAdminWallet.minimumOperationalBalance);
      const availableBalance = balance - reservedBalance - minimumOperationalBalance;

      // Log details to console as requested by Phase 7
      console.log(`[USER_FUNDING_ATTEMPT] Admin Balance: ${balance}, Reserved Balance: ${reservedBalance}, Available Balance: ${availableBalance}, Minimum Operational Balance: ${minimumOperationalBalance}, Requested Amount: ${amt}`);

      if (availableBalance < amt) {
        throw new Error("Insufficient Admin Vault Balance");
      }

      // Check and auto-create missing user wallet (Phase 4)
      let userWalletObj = await tx.wallet.findUnique({
        where: { userId }
      });
      if (!userWalletObj) {
        userWalletObj = await tx.wallet.create({
          data: {
            userId,
            balance: 0
          }
        });
      }

      // Lock user wallet record (Phase 3 Lock User Wallet)
      const userWalletsLocked = await tx.$queryRaw`SELECT * FROM wallet WHERE userId = ${userId} FOR UPDATE`;
      const lockedUserWallet = userWalletsLocked && userWalletsLocked[0];
      if (!lockedUserWallet) {
        throw new Error("User wallet not found after creation.");
      }

      // Debit Admin Wallet
      const newAdminBalance = balance - amt;
      const totalDebits = Number(lockedAdminWallet.totalDebits) + amt;

      await tx.adminWallet.update({
        where: { id: 1 },
        data: {
          balance: new Prisma.Decimal(newAdminBalance),
          totalDebits: new Prisma.Decimal(totalDebits)
        }
      });

      // Create Admin Ledger Entry
      await tx.adminLedger.create({
        data: {
          type: "USER_WALLET_FUND_DEBIT",
          amount: new Prisma.Decimal(-amt),
          openingBalance: new Prisma.Decimal(balance),
          closingBalance: new Prisma.Decimal(newAdminBalance),
          referenceId,
          description: remarks || `Manual user funding for User #${userId}`,
          metadata: {
            source: "ADMIN_USER_FUNDING",
            referenceId,
            adminId: String(adminId),
            userId: String(userId),
            remarks: remarks || "Manual Adjustment"
          }
        }
      });

      // Create User Transaction record
      createdTx = await tx.transaction.create({
        data: {
          userId,
          amount: new Prisma.Decimal(amt),
          type: "WALLET",
          status: "SUCCESS",
          direction: "CREDIT",
          gatewayTxnId: referenceId,
          balanceAfter: new Prisma.Decimal(0), // will be updated
          description: remarks || "Admin Funding",
          idempotencyKey: `fund:${userId}:${referenceId}`,
          financialSequenceId: referenceId
        }
      });

      // Credit User Wallet and Create Ledger Entry (User side)
      const { balanceAfter } = await recordFinancialEntry({
        userId,
        amount: amt,
        type: "ADMIN_CREDIT",
        transactionId: createdTx.id,
        description: remarks || "Admin Funding",
        metadata: {
          source: "ADMIN_USER_FUNDING",
          referenceId,
          adminId: String(adminId),
          userId: String(userId),
          remarks: remarks || "Manual Adjustment"
        },
        context: {
          ipAddress,
          userAgent: req.headers['user-agent'] || "admin-terminal",
          correlationId: referenceId
        },
        tx
      });

      // Update Transaction with final balance
      createdTx = await tx.transaction.update({
        where: { id: createdTx.id },
        data: { balanceAfter }
      });

      userWalletUpdated = {
        userId,
        amount: amt,
        balance: Number(balanceAfter)
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });

    // Trigger realtime updates outside transaction
    if (userWalletUpdated) {
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
        console.warn("[MANUAL_USER_FUNDING] Realtime event emit failed:", err.message);
      }
    }

    return res.json({ success: true, message: "User wallet funded successfully." });
  } catch (error) {
    console.error("[FUND_USER_WALLET_ERROR]", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Replenish Admin Master Wallet (SUPER_ADMIN only, requires Master Key validation).
 * POST /api/admin/master-wallet/add-funds
 */
export const addFundsToMasterWallet = async (req, res) => {
  try {
    if (req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Access restricted to SUPER_ADMIN."
      });
    }

    const { amount, remarks, masterKey } = req.body;
    const amt = parseFloat(amount);
    const adminId = req.user.id;

    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ success: false, message: "Amount must be a positive number." });
    }

    if (!remarks || !remarks.trim()) {
      return res.status(400).json({ success: false, message: "Remarks are required for replenishment." });
    }

    if (!masterKey) {
      return res.status(400).json({ success: false, message: "Master Key is required." });
    }

    // 1. Lockout check
    const isLocked = await checkMasterKeyLockout(adminId);
    if (isLocked) {
      return res.status(403).json({
        success: false,
        message: "Master Key locked due to too many failed attempts. Locked for 15 minutes."
      });
    }

    const systemKey = process.env.SYSTEM_MASTER_KEY;
    const previousKey = process.env.SYSTEM_MASTER_KEY_PREVIOUS;

    if (!systemKey) {
      return res.status(500).json({ success: false, message: "System master key is not configured" });
    }

    const matchCurrent = safeCompare(masterKey, systemKey);
    const matchPrevious = previousKey ? safeCompare(masterKey, previousKey) : false;
    const isValid = matchCurrent || matchPrevious;

    if (!isValid) {
      await recordMasterKeyFailure(adminId);
      return res.status(403).json({ success: false, message: "Invalid Master Key." });
    }

    // Success - Clear lockout attempts
    await clearMasterKeyFailures(adminId);

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || "127.0.0.1";
    const timestamp = new Date().toISOString();

    let openingBalance = 0;
    let closingBalance = 0;

    // Execute within a serializable transaction block
    await prisma.$transaction(async (tx) => {
      // Step 1: Lock Admin Wallet row
      const wallets = await tx.$queryRaw`SELECT * FROM admin_wallet WHERE id = 1 FOR UPDATE`;
      let wallet = wallets && wallets[0];
      if (!wallet) {
        throw new Error("Admin Wallet not found.");
      }

      openingBalance = Number(wallet.balance);
      closingBalance = openingBalance + amt;
      const currentCredits = Number(wallet.totalCredits);
      const newCredits = currentCredits + amt;

      // Step 2: Update balance and totalCredits
      await tx.adminWallet.update({
        where: { id: 1 },
        data: {
          balance: new Prisma.Decimal(closingBalance),
          totalCredits: new Prisma.Decimal(newCredits)
        }
      });

      // Step 3: Create AdminLedger record
      const referenceId = `TOPUP-${Date.now()}`;
      await tx.adminLedger.create({
        data: {
          type: "ADMIN_WALLET_TOPUP",
          amount: new Prisma.Decimal(amt),
          openingBalance: new Prisma.Decimal(openingBalance),
          closingBalance: new Prisma.Decimal(closingBalance),
          referenceId,
          description: remarks.trim(),
          metadata: {
            performedBy: req.user.email || req.user.name || String(adminId),
            remarks: remarks.trim(),
            timestamp
          }
        }
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });

    // Step 4: Create audit log entry
    await logAction({
      action: "ADMIN_WALLET_TOPUP",
      adminId,
      entity: "AdminWallet",
      entityId: 1,
      details: {
        amount: amt,
        remarks: remarks.trim(),
        openingBalance,
        closingBalance,
        ipAddress,
        timestamp
      },
      req
    });

    return res.json({
      success: true,
      message: "Admin Wallet replenished successfully.",
      data: {
        amount: amt,
        openingBalance,
        closingBalance
      }
    });

  } catch (error) {
    console.error("[ADD_FUNDS_MASTER_WALLET_ERROR]", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

