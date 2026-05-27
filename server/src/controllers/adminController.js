import prisma from "../config/prisma.js";
import { structuredLog } from "../utils/logger.js";
import { addRechargeJob } from "../services/queueService.js";
import { compareProviders } from "../services/compareService.js";
import { recordFinancialEntry } from "../services/ledgerService.js";
import { logAction, AUDIT_ACTIONS } from "../services/auditService.js";
import { Prisma } from "@prisma/client";
import eventBus from "../config/eventBus.js";
import { logTransactionEvent, TXN_EVENTS } from "../services/transactionEventService.js";
import { reconcileSingleTransaction } from "../services/reconciliationService.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { sendTempPasswordWhatsApp } from "../services/otp/nxtbyteOtpService.js";
import { sendTempPasswordEmail } from "../services/emailService.js";

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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const role = req.query.role;
    const status = req.query.status;
    const sortBy = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder || "desc";

    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } }
      ];
    }

    // Dynamic Role Hierarchy filtering based on actor role
    if (req.user.role === "ADMIN") {
      where.role = { notIn: ["ADMIN", "SUPER_ADMIN"] };
      if (role && role !== "ALL") {
        if (["ADMIN", "SUPER_ADMIN"].includes(role)) {
          return res.status(403).json({ success: false, message: "Access Denied: Role hierarchy violation." });
        }
        where.role = role;
      }
    } else if (req.user.role === "SUPER_ADMIN") {
      where.role = { notIn: ["SUPER_ADMIN"] };
      if (role && role !== "ALL") {
        if (role === "SUPER_ADMIN") {
          return res.status(403).json({ success: false, message: "Access Denied: Role hierarchy violation." });
        }
        where.role = role;
      }
    } else {
      if (role && role !== "ALL") {
        where.role = role;
      }
    }

    if (status === "active") {
      where.isActive = true;
    } else if (status === "inactive") {
      where.isActive = false;
    }

    const orderBy = {};
    if (sortBy === "balance") {
      orderBy.wallet = { balance: sortOrder };
    } else {
      orderBy[sortBy] = sortOrder;
    }

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          profileImage: true,
          createdAt: true,
          authType: true,
          wallet: {
            select: {
              balance: true,
              cashbackBalance: true,
              coinBalance: true
            }
          }
        }
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getUsersStats = async (req, res) => {
  try {
    const where = {};
    if (req.user.role === "ADMIN") {
      where.role = { notIn: ["ADMIN", "SUPER_ADMIN"] };
    } else if (req.user.role === "SUPER_ADMIN") {
      where.role = { notIn: ["SUPER_ADMIN"] };
    }

    const totalUsers = await prisma.user.count({ where });
    const activeUsers = await prisma.user.count({ where: { ...where, isActive: true } });
    const inactiveUsers = await prisma.user.count({ where: { ...where, isActive: false } });

    const walletSum = await prisma.wallet.aggregate({
      where: {
        user: where
      },
      _sum: {
        balance: true
      }
    });

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        inactiveUsers,
        totalWalletBalance: Number(walletSum._sum.balance || 0)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getSingleUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        profileImage: true,
        createdAt: true,
        authType: true,
        wallet: true,
        _count: {
          select: {
            transaction: true,
            orders: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Role hierarchy check
    const roleLevels = { USER: 1, API_USER: 1, ADMIN: 2, SUPER_ADMIN: 3 };
    const actorLevel = roleLevels[req.user.role] || 0;
    const targetLevel = roleLevels[user.role] || 0;
    if (userId !== req.user.id && actorLevel <= targetLevel) {
      return res.status(403).json({ success: false, message: "Access Denied: Role hierarchy violation." });
    }

    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const toggleUserStatus = async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id);
    const { isActive } = req.body;

    if (isNaN(targetUserId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    if (isActive === undefined || typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: "isActive state is required and must be boolean" });
    }

    if (req.user.id === targetUserId && !isActive) {
      return res.status(400).json({ success: false, message: "You cannot deactivate your own account." });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true }
    });

    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Role hierarchy check
    const roleLevels = { USER: 1, API_USER: 1, ADMIN: 2, SUPER_ADMIN: 3 };
    const actorLevel = roleLevels[req.user.role] || 0;
    const targetLevel = roleLevels[targetUser.role] || 0;
    if (actorLevel <= targetLevel) {
      return res.status(403).json({ success: false, message: "Access Denied: Role hierarchy violation." });
    }

    if (targetUser.role === 'SUPER_ADMIN' && !isActive) {
      return res.status(400).json({ success: false, message: "Super Admin accounts cannot be deactivated." });
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: { isActive },
      select: {
        id: true,
        name: true,
        isActive: true,
        role: true
      }
    });

    await logAction({
      action: isActive ? AUDIT_ACTIONS.USER_ACTIVATE || "USER_ACTIVATE" : AUDIT_ACTIONS.USER_DEACTIVATE || "USER_DEACTIVATE",
      adminId: req.user.id,
      userId: targetUserId,
      entity: "user",
      details: { isActive },
      req
    });

    res.json({
      success: true,
      message: `User account has been successfully ${isActive ? 'activated' : 'deactivated'}`,
      data: updatedUser
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const sendTemporaryPassword = async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id);

    if (isNaN(targetUserId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, phone: true, email: true, role: true, authType: true }
    });

    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Role hierarchy check
    const roleLevels = { USER: 1, API_USER: 1, ADMIN: 2, SUPER_ADMIN: 3 };
    const actorLevel = roleLevels[req.user.role] || 0;
    const targetLevel = roleLevels[targetUser.role] || 0;
    if (actorLevel <= targetLevel) {
      return res.status(403).json({ success: false, message: "Access Denied: Role hierarchy violation." });
    }

    if (targetUser.authType !== "email") {
      return res.status(400).json({
        success: false,
        message: "Temporary password is only available for email-based accounts."
      });
    }

    if (!targetUser.phone && !targetUser.email) {
      return res.status(400).json({ success: false, message: "User has neither a phone number nor an email address." });
    }

    if (targetUser.role === 'SUPER_ADMIN') {
      return res.status(400).json({ success: false, message: "Cannot generate temporary password for a Super Admin." });
    }

    // Generate secure random temporary password (8 characters: letters + numbers)
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let tempPassword = "";
    for (let i = 0; i < 8; i++) {
      tempPassword += chars.charAt(crypto.randomInt(chars.length));
    }

    // Hash the password immediately
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Save to user account and set mustChangePassword to true
    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        password: hashedPassword,
        mustChangePassword: true,
        tempPasswordIssuedAt: new Date(),
        mustResetPassword: true
      }
    });

    // Send temporary password to user via WhatsApp (preferred) or Email (fallback)
    let sendResult;
    let deliveryMethod = "";

    if (targetUser.phone) {
      deliveryMethod = "WhatsApp";
      sendResult = await sendTempPasswordWhatsApp(targetUser.phone, targetUser.name, tempPassword);
    } else if (targetUser.email) {
      deliveryMethod = "Email";
      sendResult = await sendTempPasswordEmail(targetUser.email, targetUser.name, tempPassword);
    }

    if (!sendResult.success) {
      return res.status(500).json({
        success: false,
        message: sendResult.message || `Failed to send temporary password via ${deliveryMethod}`
      });
    }

    // Audit logging
    await logAction({
      action: "USER_SEND_TEMP_PASSWORD",
      adminId: req.user.id,
      userId: targetUserId,
      entity: "user",
      details: { phone: targetUser.phone, email: targetUser.email, deliveryMethod },
      req
    });

    res.json({
      success: true,
      message: `Temporary password sent successfully ${deliveryMethod === "WhatsApp" ? "on WhatsApp" : "via email"}.`,
      data: { deliveryMethod }
    });

  } catch (err) {
    console.error("[ADMIN][TEMP_PASSWORD] Error:", err.message);
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
      include: { user: { select: { email: true, phone: true } } }
    });

    const normalizedTxns = txns.map(t => {
      // Normalize mobile number
      let displayMobile = t.mobile;
      if (!displayMobile && t.user?.phone) {
        displayMobile = t.user.phone;
      }
      if (!displayMobile && t.user?.email) {
        displayMobile = t.user.email;
      }
      if (!displayMobile) {
        displayMobile = "System";
      }

      // Normalize provider name
      let displayProvider = t.provider;
      if (!displayProvider) {
        if (t.paymentGateway) {
          displayProvider = t.paymentGateway;
        } else if (t.type === "TOPUP") {
          displayProvider = "NexGATE";
        } else {
          displayProvider = t.type || "SYSTEM";
        }
      }

      return {
        ...t,
        mobile: displayMobile,
        provider: displayProvider
      };
    });

    res.json({ success: true, data: normalizedTxns });
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
  const correlationId = crypto.randomUUID();
  const { userId, amount, description } = req.body;
  const targetUserId = userId ? Number(userId) : Number(req.user.id);

  try {
    structuredLog({
      eventType: "ADMIN_FUNDING_INITIATE",
      correlationId,
      targetUserId,
      adminId: req.user.id,
      message: `Admin ${req.user.id} requested top-up of ₹${amount} for user ${targetUserId}`,
      metadata: { amount, description }
    });

    if (!targetUserId) {
      structuredLog({
        level: "warn",
        eventType: "ADMIN_FUNDING_VALIDATION_FAILED",
        correlationId,
        targetUserId,
        adminId: req.user.id,
        message: "User ID required"
      });
      return res.status(400).json({ success: false, message: "User ID required" });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true }
    });

    if (!targetUser) {
      structuredLog({
        level: "warn",
        eventType: "ADMIN_FUNDING_VALIDATION_FAILED",
        correlationId,
        targetUserId,
        adminId: req.user.id,
        message: "Target user not found"
      });
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Role hierarchy check
    const roleLevels = { USER: 1, API_USER: 1, ADMIN: 2, SUPER_ADMIN: 3 };
    const actorLevel = roleLevels[req.user.role] || 0;
    const targetLevel = roleLevels[targetUser.role] || 0;
    if (actorLevel <= targetLevel) {
      structuredLog({
        level: "warn",
        eventType: "ADMIN_FUNDING_VALIDATION_FAILED",
        correlationId,
        targetUserId,
        adminId: req.user.id,
        message: `Role hierarchy violation: Actor ${req.user.role} trying to fund target ${targetUser.role}`
      });
      return res.status(403).json({ success: false, message: "Access Denied: Role hierarchy violation." });
    }

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      structuredLog({
        level: "warn",
        eventType: "ADMIN_FUNDING_VALIDATION_FAILED",
        correlationId,
        targetUserId,
        adminId: req.user.id,
        message: `Invalid amount: ${amount}`
      });
      return res.status(400).json({ success: false, message: "Invalid amount. Must be greater than 0." });
    }

    const cleanDescription = (description || "Admin Wallet Top-up").replace(/:/g, " "); // Prevent delimiter collisions

    // gateway-backed payment order flow
    const idempotencyKey = `admin_funding:adminId=${req.user.id}:reason=${encodeURIComponent(cleanDescription)}:${correlationId}`;

    const { createPaymentOrder } = await import("../services/paymentService.js");
    const payment = await createPaymentOrder(
      targetUserId,
      Number(amount),
      idempotencyKey,
      "admin@upi",
      "TOPUP"
    );

    if (!payment.success) {
      structuredLog({
        level: "error",
        eventType: "ADMIN_FUNDING_GATEWAY_FAILED",
        correlationId,
        targetUserId,
        adminId: req.user.id,
        message: `Failed to initiate payment gateway order: ${payment.message || 'Unknown error'}`
      });
      return res.status(400).json({
        success: false,
        message: payment.message || "Failed to initiate payment gateway order"
      });
    }

    const paymentUrl = payment.paymentUrl || payment.payment_url || payment.gatewayUrl;

    structuredLog({
      eventType: "ADMIN_FUNDING_REDIRECT",
      correlationId,
      paymentId: payment.id || payment.orderId,
      targetUserId,
      adminId: req.user.id,
      message: `Redirect URL generated for Admin Funding Payment Order ID: ${payment.id || payment.orderId}`,
      metadata: { paymentUrl, status: payment.status }
    });

    res.json({
      success: true,
      message: "Admin funding payment session created",
      paymentUrl,
      payment_url: paymentUrl,
      orderId: payment.id || payment.orderId,
      status: payment.status
    });
  } catch (err) {
    structuredLog({
      level: "error",
      eventType: "ADMIN_FUNDING_EXCEPTION",
      correlationId,
      targetUserId: targetUserId || null,
      adminId: req?.user?.id || null,
      message: `Exception during admin wallet funding: ${err.message}`,
      metadata: { error: err.stack }
    });
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

export const approveApiAccess = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ success: false, message: "Target User ID is required" });

    const userToUpgrade = await prisma.user.findUnique({ where: { id: Number(targetUserId) } });
    if (!userToUpgrade) return res.status(404).json({ success: false, message: "User not found" });

    let newSecret = null;
    let newApiKey = null;
    
    // Serializable Prisma transaction to prevent duplicate creations or double approvals
    await prisma.$transaction(async (tx) => {
      const request = await tx.apiAccessRequest.findFirst({
        where: { userId: userToUpgrade.id, status: "PENDING" }
      });

      if (!request) {
        throw new Error("No pending API Access request found for this user");
      }

      await tx.apiAccessRequest.update({
        where: { id: request.id },
        data: {
          status: "APPROVED",
          approvedBy: req.user.id,
          approvedAt: new Date()
        }
      });

      await tx.user.update({
        where: { id: userToUpgrade.id },
        data: { role: "API_USER" }
      });

      const existingAccess = await tx.apiAccess.findFirst({ where: { userId: userToUpgrade.id } });
      if (!existingAccess) {
        newApiKey = `ak_live_${crypto.randomBytes(16).toString('hex')}`;
        newSecret = `sec_live_${crypto.randomBytes(32).toString('hex')}`;
        const salt = await bcrypt.genSalt(10);
        const apiSecretHash = await bcrypt.hash(newSecret, salt);

        await tx.apiAccess.create({
          data: {
            userId: userToUpgrade.id,
            apiKey: newApiKey,
            apiSecretHash,
            isActive: true,
            environment: "PRODUCTION"
          }
        });
      } else {
        await tx.apiAccess.update({
          where: { id: existingAccess.id },
          data: { isActive: true }
        });
      }

      await tx.auditLog.create({
        data: {
          action: "API_ACCESS_APPROVED",
          userId: userToUpgrade.id,
          adminId: req.user.id,
          entity: "user",
          entityId: userToUpgrade.id,
          details: { upgradedTo: "API_USER", apiKey: newApiKey || existingAccess?.apiKey }
        }
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });

    // Emit event bus notification AFTER transaction commit successfully
    eventBus.emit("api_access_updated", {
      userId: userToUpgrade.id,
      status: "APPROVED"
    });

    res.json({ 
      success: true, 
      message: "API Access upgrade approved successfully", 
      apiSecret: newSecret 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const rejectApiAccess = async (req, res) => {
  try {
    const { targetUserId, reason } = req.body;
    if (!targetUserId) return res.status(400).json({ success: false, message: "Target User ID is required" });

    const user = await prisma.user.findUnique({ where: { id: Number(targetUserId) } });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    await prisma.$transaction(async (tx) => {
      const request = await tx.apiAccessRequest.findFirst({
        where: { userId: user.id, status: "PENDING" }
      });

      if (!request) {
        throw new Error("No pending API Access request found for this user");
      }

      await tx.apiAccessRequest.update({
        where: { id: request.id },
        data: {
          status: "REJECTED",
          reason: reason || "Insufficient business verification"
        }
      });

      await tx.auditLog.create({
        data: {
          action: "API_ACCESS_REJECTED",
          userId: user.id,
          adminId: req.user.id,
          entity: "user",
          entityId: user.id,
          details: { reason }
        }
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });

    eventBus.emit("api_access_updated", {
      userId: user.id,
      status: "REJECTED"
    });

    res.json({ success: true, message: "API Access upgrade request rejected successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getApiPartnersSummary = async (req, res) => {
  try {
    const pendingRequests = await prisma.apiAccessRequest.findMany({
      where: { status: "PENDING" },
      include: { user: { select: { id: true, name: true, phone: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" }
    });

    const approvedUsers = await prisma.user.findMany({
      where: { role: "API_USER" },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        createdAt: true,
        apiAccesses: {
          select: {
            id: true,
            apiKey: true,
            isActive: true,
            rateLimit: true,
            environment: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const suspendedUsers = await prisma.user.findMany({
      where: {
        role: "API_USER",
        apiAccesses: {
          some: { isActive: false }
        }
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        apiAccesses: {
          select: {
            id: true,
            apiKey: true,
            isActive: true
          }
        }
      }
    });

    const rejectedRequests = await prisma.apiAccessRequest.findMany({
      where: { status: "REJECTED" },
      include: { user: { select: { id: true, name: true, phone: true, email: true } } },
      orderBy: { createdAt: "desc" }
    });

    const totalApiUsers = await prisma.user.count({ where: { role: "API_USER" } });
    const pendingCount = await prisma.apiAccessRequest.count({ where: { status: "PENDING" } });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const approvedToday = await prisma.apiAccessRequest.count({
      where: { status: "APPROVED", approvedAt: { gte: today } }
    });

    const activeKeysCount = await prisma.apiAccess.count({ where: { isActive: true } });
    const sandboxUsageCount = await prisma.apiUsage.count();

    const analytics = {
      totalApiUsers,
      pendingRequests: pendingCount,
      approvedToday,
      activeKeys: activeKeysCount,
      sandboxUsage: sandboxUsageCount
    };

    res.json({
      success: true,
      pendingRequests,
      approvedUsers,
      suspendedUsers,
      rejectedRequests,
      analytics
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const togglePartnerActiveState = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const access = await prisma.apiAccess.findFirst({ where: { userId: Number(targetUserId) } });
    if (!access) return res.status(404).json({ success: false, message: "API credentials not found" });

    const updated = await prisma.apiAccess.update({
      where: { id: access.id },
      data: { isActive: !access.isActive }
    });

    await prisma.auditLog.create({
      data: {
        action: "API_ACCESS_TOGGLED",
        userId: Number(targetUserId),
        adminId: req.user.id,
        entity: "ApiAccess",
        entityId: Number(targetUserId),
        details: { isActive: updated.isActive }
      }
    });

    eventBus.emit("api_access_updated", { userId: Number(targetUserId), status: "UPDATED" });

    res.json({ success: true, message: `Access state toggled to ${updated.isActive ? 'Active' : 'Inactive'}`, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const rotatePartnerKeys = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const access = await prisma.apiAccess.findFirst({ where: { userId: Number(targetUserId) } });
    if (!access) return res.status(404).json({ success: false, message: "API credentials not found" });

    const newSecret = `sec_live_${crypto.randomBytes(32).toString('hex')}`;
    const salt = await bcrypt.genSalt(10);
    const apiSecretHash = await bcrypt.hash(newSecret, salt);

    await prisma.apiAccess.update({
      where: { id: access.id },
      data: { apiSecretHash }
    });

    await prisma.auditLog.create({
      data: {
        action: "API_ACCESS_SECRET_ROTATED",
        userId: Number(targetUserId),
        adminId: req.user.id,
        entity: "ApiAccess",
        entityId: Number(targetUserId)
      }
    });

    res.json({ success: true, message: "API secret rotated successfully", apiSecret: newSecret });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updatePartnerRateLimit = async (req, res) => {
  try {
    const { targetUserId, rateLimit } = req.body;
    const access = await prisma.apiAccess.findFirst({ where: { userId: Number(targetUserId) } });
    if (!access) return res.status(404).json({ success: false, message: "API credentials not found" });

    const updated = await prisma.apiAccess.update({
      where: { id: access.id },
      data: { rateLimit: Number(rateLimit) }
    });

    await prisma.auditLog.create({
      data: {
        action: "API_ACCESS_RATELIMIT_UPDATED",
        userId: Number(targetUserId),
        adminId: req.user.id,
        entity: "ApiAccess",
        entityId: Number(targetUserId),
        details: { rateLimit }
      }
    });

    res.json({ success: true, message: "Rate limit updated successfully", data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updatePartnerEnvironment = async (req, res) => {
  try {
    const { targetUserId, environment } = req.body;
    if (!["PRODUCTION", "SANDBOX"].includes(environment)) {
      return res.status(400).json({ success: false, message: "Invalid environment" });
    }

    const access = await prisma.apiAccess.findFirst({ where: { userId: Number(targetUserId) } });
    if (!access) return res.status(404).json({ success: false, message: "API credentials not found" });

    const updated = await prisma.apiAccess.update({
      where: { id: access.id },
      data: { environment }
    });

    await prisma.auditLog.create({
      data: {
        action: "ENVIRONMENT_TOGGLED",
        userId: Number(targetUserId),
        adminId: req.user.id,
        entity: "ApiAccess",
        entityId: Number(targetUserId),
        details: { environment }
      }
    });

    res.json({ success: true, message: `Environment switched to ${environment}`, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getPartnerWebhookEvents = async (req, res) => {
  try {
    const userId = Number(req.query.userId);
    const access = await prisma.apiAccess.findFirst({ where: { userId } });
    if (!access) return res.json({ success: true, data: [] });

    const events = await prisma.webhookEvent.findMany({
      where: { apiAccessId: access.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.json({ success: true, data: events });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

import axios from "axios";

export const replayPartnerWebhookEvent = async (req, res) => {
  try {
    const { eventId } = req.body;
    const event = await prisma.webhookEvent.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ success: false, message: "Event not found" });

    const access = await prisma.apiAccess.findUnique({ where: { id: event.apiAccessId } });
    if (!access || !access.webhookUrl) return res.status(400).json({ success: false, message: "No active webhook URL registered" });

    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { retryCount: { increment: 1 } }
    });

    axios.post(access.webhookUrl, event.payload, {
      headers: {
        "Content-Type": "application/json",
        "x-webhook-signature": "admin_signature_replay"
      }
    }).then(response => {
      prisma.webhookEvent.update({
        where: { id: event.id },
        data: { deliveryStatus: "SUCCESS", responseCode: response.status }
      }).catch(() => {});
    }).catch(err => {
      prisma.webhookEvent.update({
        where: { id: event.id },
        data: { deliveryStatus: "FAILED", responseCode: err.response?.status || 500 }
      }).catch(() => {});
    });

    res.json({ success: true, message: "Webhook replay event queued" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getPartnerUsageLogs = async (req, res) => {
  try {
    const userId = Number(req.query.userId);
    const access = await prisma.apiAccess.findFirst({ where: { userId } });
    if (!access) return res.json({ success: true, data: [] });

    const usages = await prisma.apiUsage.findMany({
      where: { apiAccessId: access.id },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json({ success: true, data: usages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
