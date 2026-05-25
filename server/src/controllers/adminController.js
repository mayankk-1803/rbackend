import prisma from "../config/prisma.js";
import { addRechargeJob } from "../services/queueService.js";
import { compareProviders } from "../services/compareService.js";
import { recordFinancialEntry } from "../services/ledgerService.js";
import { logAction, AUDIT_ACTIONS } from "../services/auditService.js";
import { Prisma } from "@prisma/client";
import eventBus from "../config/eventBus.js";
import { logTransactionEvent, TXN_EVENTS } from "../services/transactionEventService.js";
import { reconcileSingleTransaction } from "../services/reconciliationService.js";

export const getDashboard = async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    const totalTransactions = await prisma.transaction.count();
    const failureCount = await prisma.transaction.count({ where: { status: "FAILED" } });
    const pendingCount = await prisma.transaction.count({ where: { status: { in: ["PENDING", "PENDING_REVIEW", "PROCESSING"] } } });
    const fraudAlerts = prisma.fraudlog ? await prisma.fraudlog.count() : 0;
    
    let successRate = 0;
    if (totalTransactions > 0) {
      const successCount = await prisma.transaction.count({ where: { status: "SUCCESS" } });
      successRate = Number(((successCount / totalTransactions) * 100).toFixed(2));
    }
    
    const stats = await prisma.transaction.aggregate({
      where: { 
        status: "SUCCESS"
      },
      _sum: {
        commission: true,
        cashback: true,
        profit: true,
        amount: true
      }
    });

    const topupStats = await prisma.transaction.aggregate({
      where: {
        status: "SUCCESS",
        type: "TOPUP"
      },
      _sum: {
        amount: true
      }
    });

    const refundCount = await prisma.transaction.count({ where: { type: "REFUND" } });
    
    // Get Operator Metrics
    const operators = await prisma.provider.findMany({
      select: {
        name: true,
        healthStatus: true,
        avgResponseTime: true,
        successRate: true,
        code: true
      }
    });

    const apibox = operators.find(p => p.code === 'APIBOX');

    const data = {
      totalUsers,
      totalTransactions,
      failureCount,
      pendingCount,
      refundCount,
      fraudAlerts,
      successRate,
      totalRevenue: Number(stats._sum.profit || 0),
      totalCashback: Number(stats._sum.cashback || 0),
      totalAdded: Number(topupStats._sum.amount || 0),
      providers: operators,
      apiboxMetrics: {
        health: apibox?.healthStatus || "UNKNOWN",
        responseTime: apibox?.avgResponseTime || 0,
        successRate: apibox?.successRate || 0
      }
    };

    res.json({ success: true, message: "Admin dashboard fetched", data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        wallet: true
      },
      orderBy: { createdAt: "desc" }
    });
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getTopUsers = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const users = await prisma.user.findMany({
      take: limit,
      orderBy: { referralEarnings: "desc" },
      select: {
        email: true,
        referralEarnings: true,
        wallet: {
          select: { balance: true }
        }
      }
    });

    const formattedUsers = users.map(u => ({
      email: u.email,
      referralEarnings: u.referralEarnings,
      walletBalance: u.wallet?.balance || 0
    }));

    res.json({ success: true, message: "Top users fetched", data: formattedUsers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const retryTxnLegacy = async (req, res) => {
  try {
    const txnId = parseInt(req.params.id);
    console.log(`[RETRY][REQUESTED] → Txn #${txnId} by Admin ${req.user.id}`);

    const txn = await prisma.transaction.findUnique({
      where: { id: txnId }
    });

    if (!txn) {
      console.warn(`[RETRY][FAILED] → Txn #${txnId} not found`);
      return res.status(404).json({
        success: false,
        message: "Transaction not found"
      });
    }

    // Allow retry for FAILED or stuck PENDING (e.g. > 5 mins old)
    const isPending = txn.status === "PENDING";
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const isStuck = isPending && txn.updatedAt < fiveMinutesAgo;

    if (txn.status !== "FAILED" && !isStuck) {
      console.warn(`[RETRY][VALIDATED] → Txn #${txnId} ineligible (Status: ${txn.status})`);
      return res.status(400).json({
        success: false,
        message: isPending ? "Transaction is still processing. Please wait 5 minutes before retrying stuck transactions." : "Only failed or stuck transactions can be retried"
      });
    }

    // Block if max retries exceeded
    if (txn.retryCount >= 3) {
      console.warn(`[RETRY][BLOCKED] → Txn #${txnId} exceeded max retries (3)`);
      return res.status(400).json({
        success: false,
        message: "Maximum retry attempts (3) exceeded. Please investigate or refund manually."
      });
    }

    console.log(`[RETRY][VALIDATED] → Txn #${txnId} eligible. Resetting to PENDING...`);

    // Reset status to PENDING
    await prisma.transaction.update({
      where: { id: txn.id },
      data: { 
        status: "PENDING", 
        retryCount: { increment: 1 },
        lastRetryAt: new Date()
      }
    });

    // Re-add to queue
    console.log(`[RETRY][PROVIDER_CALL] → Re-queueing job for Txn #${txnId}`);
    await addRechargeJob({
      userId: txn.userId,
      amount: txn.amount,
      mobile: txn.mobile,
      operator: txn.operator,
      txnId: txn.id,
      retryCount: txn.retryCount + 1, // Pass current + 1
      idempotencyKey: txn.idempotencyKey 
    });

    console.log(`[RETRY][SUCCESS] → Txn #${txnId} re-queued successfully`);

    res.json({
      success: true,
      message: "Transaction re-queued for processing"
    });
  } catch (err) {
    console.error(`[RETRY][FAILED] → Txn #${req.params.id}: ${err.message}`);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const retryTxn = async (req, res) => {
  try {
    const txnId = parseInt(req.params.id);
    console.log(`[RETRY][REQUESTED] Txn #${txnId} by Admin ${req.user.id}`);

    let queuedTxn;

    await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw`SELECT * FROM transaction WHERE id = ${txnId} FOR UPDATE`;
      const txn = rows?.[0];

      if (!txn) {
        const error = new Error("Transaction not found");
        error.statusCode = 404;
        throw error;
      }

      const eligible = txn.status === "PENDING_REVIEW" || txn.status === "FAILED";
      if (!eligible) {
        const error = new Error("Recharge is not eligible for retry");
        error.statusCode = 400;
        throw error;
      }

      if (txn.rechargeProcessing) {
        const error = new Error("Recharge processing");
        error.statusCode = 409;
        throw error;
      }

      if (Number(txn.retryCount || 0) >= 3) {
        const error = new Error("Maximum retry attempts exceeded");
        error.statusCode = 400;
        throw error;
      }

      queuedTxn = await tx.transaction.update({
        where: { id: txn.id },
        data: {
          status: "PROCESSING",
          reviewStatus: "PROCESSING",
          rechargeProcessing: true,
          retryCount: { increment: 1 },
          lastRetryAt: new Date(),
          processingStartedAt: new Date(),
          adminRetriedBy: req.user.id
        }
      });

      await logTransactionEvent(txn.id, TXN_EVENTS.ADMIN_RETRY_REQUESTED, {
        adminId: req.user.id,
        retryCount: Number(txn.retryCount || 0) + 1
      }, tx);
      await logTransactionEvent(txn.id, TXN_EVENTS.PROCESSING, { source: "admin_retry" }, tx);
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 10000
    });

    try {
      await addRechargeJob({
        userId: queuedTxn.userId,
        amount: queuedTxn.amount,
        mobile: queuedTxn.mobile,
        operator: queuedTxn.operator,
        txnId: queuedTxn.id,
        retryCount: queuedTxn.retryCount,
        idempotencyKey: queuedTxn.idempotencyKey
      });
    } catch (queueErr) {
      await prisma.transaction.update({
        where: { id: queuedTxn.id },
        data: {
          status: "PENDING_REVIEW",
          reviewStatus: "PENDING_REVIEW",
          rechargeProcessing: false
        }
      });
      throw queueErr;
    }

    eventBus.emit("recharge_processing", {
      userId: queuedTxn.userId,
      txnId: queuedTxn.id,
      transactionId: queuedTxn.id,
      status: "PROCESSING",
      transaction: queuedTxn
    });
    eventBus.emit("transaction_updated", {
      userId: queuedTxn.userId,
      transactionId: queuedTxn.id,
      status: "PROCESSING",
      transaction: queuedTxn
    });

    res.json({
      success: true,
      message: "Recharge processing",
      data: {
        transactionId: queuedTxn.id,
        status: "PROCESSING"
      }
    });
  } catch (err) {
    console.error(`[RETRY][FAILED] Txn #${req.params.id}: ${err.message}`);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

export const getTransactions = async (req, res) => {
  try {
    const txns = await prisma.transaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { email: true } } }
    });
    res.json({ success: true, data: txns });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getProviders = async (req, res) => {
  try {
    const providers = await prisma.provider.findMany();
    
    // Simulate/Fetch balances for each provider
    const enhancedProviders = await Promise.all(providers.map(async (p) => {
       const failureCount = await prisma.transaction.count({
         where: { provider: p.code, status: "FAILED" }
       });
       
       return {
         ...p,
         failureCount,
         balance: p.balance || 0 // Use DB balance or fetch via service
       };
    }));

    res.json({ success: true, data: enhancedProviders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const setActiveProvider = async (req, res) => {
  try {
    const { selectedProviders, primaryProvider } = req.body;
    
    if (!selectedProviders || selectedProviders.length === 0 || !primaryProvider) {
      return res.status(400).json({ success: false, message: "Invalid selection: at least one provider and a primary must be set." });
    }

    await prisma.$transaction(async (tx) => {
      // Reset all providers
      await tx.provider.updateMany({
        data: { isActive: false, priority: 0 }
      });

      // Activate selected and assign priorities (1 = Primary, 2 = Backup)
      for (const code of selectedProviders) {
        await tx.provider.update({
          where: { code },
          data: {
            isActive: true,
            priority: code === primaryProvider ? 1 : 2
          }
        });
      }
    });

    res.json({ success: true, message: "Provider selection updated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const compareRecharge = async (req, res) => {
  try {
    const result = await compareProviders(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const getRetryStats = async (req, res) => {
  try {
    const stats = await prisma.transaction.aggregate({
      _sum: { retryCount: true },
      _count: { id: true },
      where: { retryCount: { gt: 0 } }
    });
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAlerts = async (req, res) => {
  try {
    const alerts = await prisma.fraudlog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { user: { select: { email: true } } }
    });
    res.json({ success: true, data: alerts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getCharts = async (req, res) => {
  try {
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    // 1. Transaction Status Counts
    const statusData = await prisma.transaction.groupBy({
      by: ['status'],
      _count: { id: true },
      where: { createdAt: { gte: last7Days } }
    });

    const statusMap = statusData.reduce((acc, item) => {
      acc[item.status.toLowerCase()] = item._count.id;
      return acc;
    }, {});

    // 2. Daily Revenue Trends
    // This is a bit simplified: group by day and sum amount for SUCCESS recharges
    const revenueData = await prisma.transaction.findMany({
      where: {
        status: "SUCCESS",
        type: { in: ["RECHARGE", "BILL_PAYMENT"] },
        createdAt: { gte: last7Days }
      },
      select: {
        profit: true,
        createdAt: true
      }
    });

    const dailyRevenueMap = {};
    revenueData.forEach(txn => {
      const date = txn.createdAt.toISOString().split('T')[0];
      dailyRevenueMap[date] = (dailyRevenueMap[date] || 0) + Number(txn.profit || 0);
    });

    const dailyRevenue = Object.entries(dailyRevenueMap).map(([date, revenue]) => ({
      date,
      revenue
    })).sort((a, b) => a.date.localeCompare(b.date));

    res.json({ 
      success: true, 
      successCount: statusMap.success || 0,
      pendingCount: statusMap.pending || 0,
      failedCount: statusMap.failed || 0,
      dailyRevenue 
    });
  } catch (err) {
    console.error("Chart Data Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const topUpWallet = async (req, res) => {
  try {
    const { userId, amount, description } = req.body;
    const targetUserId = userId ? Number(userId) : Number(req.user.id);
    
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: "User ID required" });
    }

    const result = await recordFinancialEntry({
      userId: targetUserId,
      amount: amount,
      type: 'TOPUP_CREDIT',
      description: description || "Admin Wallet Top-up"
    });

    await logAction({
      action: AUDIT_ACTIONS.WALLET_ADJUSTMENT,
      adminId: req.user.id,
      userId: targetUserId,
      entity: "WALLET",
      details: { amount, description },
      req
    });

    res.json({ success: true, message: "Wallet topped up", balance: result.balanceAfter });
  } catch (err) {
    console.error("TopUp Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getCashbackSettings = async (req, res) => {
  try {
    let settings = await prisma.cashbackSettings.findFirst({
      where: { id: 1 }
    });
    if (!settings) {
      settings = await prisma.cashbackSettings.create({ 
        data: { 
          id: 1,
          cashbackEnabled: true,
          rewardMode: 'PERCENTAGE',
          coinConversionRate: 100,
          minRechargeAmount: 10,
          maxCashbackPerRecharge: 50,
          dailyCashbackLimit: 500,
          cooldownSeconds: 0,
          globalPercentage: 1.0,
          operatorWiseCashback: {},
          slabWiseCashback: []
        } 
      });
    }
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateCashbackSettings = async (req, res) => {
  try {
    const { 
      cashbackEnabled, 
      rewardMode, 
      coinConversionRate, 
      minRechargeAmount, 
      maxCashbackPerRecharge,
      dailyCashbackLimit,
      cooldownSeconds,
      globalPercentage,
      operatorWiseCashback,
      slabWiseCashback
    } = req.body;

    const data = {
      cashbackEnabled: Boolean(cashbackEnabled),
      rewardMode: rewardMode || 'PERCENTAGE',
      coinConversionRate: parseInt(coinConversionRate || 100),
      minRechargeAmount: new Prisma.Decimal(minRechargeAmount || 10),
      maxCashbackPerRecharge: new Prisma.Decimal(maxCashbackPerRecharge || 50),
      dailyCashbackLimit: new Prisma.Decimal(dailyCashbackLimit || 500),
      cooldownSeconds: parseInt(cooldownSeconds || 0),
      globalPercentage: parseFloat(globalPercentage || 0),
      operatorWiseCashback: operatorWiseCashback || {},
      slabWiseCashback: slabWiseCashback || [],
      updatedById: req.user.id
    };

    const settings = await prisma.cashbackSettings.upsert({
      where: { id: 1 },
      update: data,
      create: { ...data, id: 1 }
    });

    await logAction({
      action: AUDIT_ACTIONS.CASHBACK_UPDATE,
      adminId: req.user.id,
      entity: "CASHBACK_SETTINGS",
      details: data,
      req
    });

    res.json({ success: true, data: settings });
  } catch (err) {
    console.error("Update Cashback Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAdminWallet = async (req, res) => {
  try {
    // Assuming admin wallet is a special user or just overall balance
    const totalBalance = await prisma.wallet.aggregate({
      _sum: { balance: true }
    });
    res.json({ success: true, data: { balance: totalBalance._sum.balance || 0 } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const retryReconciliation = async (req, res) => {
  try {
    const txnId = parseInt(req.params.id);
    if (isNaN(txnId)) {
      return res.status(400).json({ success: false, message: "Invalid transaction ID" });
    }

    console.log(`[MANUAL_RECONCILE][REQUESTED] Txn #${txnId} by Admin ${req.user.id}`);

    // Call reconcileSingleTransaction which handles validation and status checks internally
    const result = await reconcileSingleTransaction(txnId);

    // Audit logging
    await logAction({
      action: AUDIT_ACTIONS.RECHARGE_RECONCILE || "RECHARGE_RECONCILE",
      adminId: req.user.id,
      entity: "TRANSACTION",
      entityId: txnId,
      details: { result },
      req
    });

    res.json({
      success: true,
      message: "Transaction reconciliation completed",
      data: result
    });
  } catch (err) {
    console.error(`[MANUAL_RECONCILE][FAILED] Txn #${req.params.id}: ${err.message}`);
    
    // Audit log the failure as well
    await logAction({
      action: AUDIT_ACTIONS.RECHARGE_RECONCILE || "RECHARGE_RECONCILE",
      adminId: req.user?.id,
      entity: "TRANSACTION",
      entityId: parseInt(req.params.id) || null,
      details: { error: err.message, status: "FAILED" },
      req
    });

    let statusCode = 500;
    if (err.message.includes("not found")) {
      statusCode = 404;
    } else if (err.message.includes("cannot be reconciled manually") || err.message.includes("status is")) {
      statusCode = 400;
    }

    res.status(statusCode).json({ success: false, message: err.message });
  }
};
