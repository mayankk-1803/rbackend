import prisma from "../config/prisma.js";
import { addRechargeJob } from "../services/queueService.js";
import { compareProviders } from "../services/compareService.js";

export const getDashboard = async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    const totalTransactions = await prisma.transaction.count();
    const failureCount = await prisma.transaction.count({ where: { status: "FAILED" } });
    const pendingCount = await prisma.transaction.count({ where: { status: "PENDING" } });
    const fraudAlerts = prisma.fraudLog ? await prisma.fraudLog.count() : 0;
    
    let successRate = 0;
    if (totalTransactions > 0) {
      const successCount = await prisma.transaction.count({ where: { status: "SUCCESS" } });
      successRate = Number(((successCount / totalTransactions) * 100).toFixed(2));
    }
    
    const stats = await prisma.transaction.aggregate({
      where: { status: "SUCCESS" },
      _sum: {
        commission: true,
        cashback: true
      }
    });

    const data = {
      totalUsers,
      totalTransactions,
      failureCount,
      pendingCount,
      fraudAlerts,
      successRate,
      totalRevenue: stats._sum.commission || 0,
      totalCashback: stats._sum.cashback || 0
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

export const retryTxn = async (req, res) => {
  try {
    const txn = await prisma.transaction.findUnique({
      where: { id: parseInt(req.params.id) }
    });

    if (!txn) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found"
      });
    }

    if (txn.status !== "FAILED") {
      return res.status(400).json({
        success: false,
        message: "Only failed transactions can be retried"
      });
    }

    // Reset status to PENDING
    await prisma.transaction.update({
      where: { id: txn.id },
      data: { status: "PENDING", retryCount: { increment: 1 } }
    });

    // Re-add to queue
    await addRechargeJob({
      userId: txn.userId,
      amount: txn.amount,
      mobile: txn.mobile,
      operator: txn.operator,
      txnId: txn.id,
      idempotencyKey: txn.idempotencyKey
    });

    res.json({
      success: true,
      message: "Transaction re-queued for processing"
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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
    res.json({ success: true, data: providers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const setActiveProvider = async (req, res) => {
  try {
    const { code, isActive } = req.body;
    await prisma.provider.update({
      where: { code },
      data: { isActive }
    });
    res.json({ success: true, message: `Provider ${code} status updated` });
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
    const alerts = await prisma.fraudLog.findMany({
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
        type: "RECHARGE",
        createdAt: { gte: last7Days }
      },
      select: {
        amount: true,
        createdAt: true
      }
    });

    const dailyRevenueMap = {};
    revenueData.forEach(txn => {
      const date = txn.createdAt.toISOString().split('T')[0];
      dailyRevenueMap[date] = (dailyRevenueMap[date] || 0) + Number(txn.amount);
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
    const { userId, amount } = req.body;
    const targetUserId = userId ? Number(userId) : Number(req.user.id);
    
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: "User ID required" });
    }

    const wallet = await prisma.wallet.upsert({
      where: { userId: targetUserId },
      update: { balance: { increment: amount } },
      create: { 
        userId: targetUserId, 
        balance: amount,
        cashbackBalance: 0 
      }
    });

    res.json({ success: true, message: "Wallet topped up", balance: wallet.balance });
  } catch (err) {
    console.error("TopUp Error:", err);
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
