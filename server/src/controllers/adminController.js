import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import FraudLog from "../models/FraudLog.js";
import { addRechargeJob } from "../services/queueService.js";

export const getDashboard = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalTransactions = await Transaction.countDocuments();
    const failureCount = await Transaction.countDocuments({ status: "failed" });
    const pendingCount = await Transaction.countDocuments({ status: "pending" });
    const fraudAlerts = await FraudLog.countDocuments();
    
    let successRate = 0;
    if (totalTransactions > 0) {
      const successCount = totalTransactions - failureCount - pendingCount;
      successRate = Number(((successCount / totalTransactions) * 100).toFixed(2));
    }
    
    const stats = await Transaction.aggregate([
      { $match: { status: "success" } },
      { 
        $group: { 
          _id: null, 
          totalRevenue: { $sum: "$commission" }, 
          totalCashback: { $sum: "$cashback" } 
        } 
      }
    ]);

    const data = {
      totalUsers,
      totalTransactions,
      failureCount,
      pendingCount,
      fraudAlerts,
      successRate,
      totalRevenue: stats.length ? stats[0].totalRevenue : 0,
      totalCashback: stats.length ? stats[0].totalCashback : 0
    };

    res.json({ success: true, message: "Admin dashboard fetched", data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getTopUsers = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const users = await User.find()
      .sort({ referralEarnings: -1 })
      .limit(limit)
      .select("email referralEarnings walletBalance");

    res.json({ success: true, message: "Top users fetched", data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const retryTxn = async (req, res) => {
  try {
    const txn = await Transaction.findById(req.params.id);

    if (!txn) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found"
      });
    }

    if (txn.status !== "failed") {
      return res.status(400).json({
        success: false,
        message: "Only failed transactions can be retried"
      });
    }

    // Update status to pending
    txn.status = "pending";
    await txn.save();

    // 🔥 Push FULL DATA to queue (delay handled centrally)
    await addRechargeJob({
      userId: txn.userId,
      amount: txn.amount,
      mobile: txn.mobile,
      operator: txn.operator,
      idempotencyKey: "retry_" + Date.now()
    });

    res.json({
      success: true,
      message: "Retry queued successfully",
      data: {}
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

export const getRetryStats = async (req, res) => {
  try {
    const totalFailed = await Transaction.countDocuments({ status: "failed" });
    
    const stats = await Transaction.aggregate([
      { 
        $group: { 
          _id: null, 
          totalRetries: { $sum: "$retryCount" },
          avgRetries: { $avg: "$retryCount" }
        } 
      }
    ]);

    const data = {
      totalFailed,
      totalRetries: stats.length ? stats[0].totalRetries : 0,
      avgRetries: stats.length ? Number(stats[0].avgRetries.toFixed(2)) : 0
    };

    res.json({ success: true, message: "Retry stats fetched", data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .select("mobile amount operator status provider createdAt")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const normalizedTxns = transactions.map(t => {
      let normOperator = t.operator;
      if (!normOperator || normOperator === ".") normOperator = "Wallet";
      
      let normProvider = t.provider;
      if (normProvider === "primary") normProvider = "Primary API";
      else if (normProvider === "backup") normProvider = "Backup API";
      else if (!normProvider) normProvider = "Unknown";

      return { ...t, operator: normOperator, provider: normProvider };
    });

    res.json({ success: true, data: normalizedTxns });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAlerts = async (req, res) => {
  try {
    const logs = await FraudLog.find().sort({ createdAt: -1 }).limit(50);
    const alerts = logs.map(log => {
      let severity = "LOW";
      if (log.actionTaken === "BLOCKED" || log.riskScore > 80) {
        severity = "HIGH";
      } else if (log.actionTaken === "FLAGGED" || log.riskScore > 50) {
        severity = "MEDIUM";
      }
      
      return {
        _id: log._id,
        type: "Fraud Alert",
        message: log.reasons.join(", ") || "Suspicious activity detected",
        severity,
        createdAt: log.createdAt
      };
    });
    res.json({ success: true, data: alerts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getProviders = async (req, res) => {
  try {
    const stats = await Transaction.aggregate([
      { 
        $group: { 
          _id: "$provider", 
          total: { $sum: 1 }, 
          success: { $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] } } 
        } 
      }
    ]);

    const providers = stats.map(p => {
      const successRate = p.total > 0 ? (p.success / p.total) * 100 : 0;
      let status = "critical";
      if (successRate >= 90) status = "healthy";
      else if (successRate >= 70) status = "warning";

      let normName = p._id;
      if (normName === "primary") normName = "Primary API";
      else if (normName === "backup") normName = "Backup API";
      else if (!normName) normName = "Unknown";

      return {
        name: normName,
        successRate: Number(successRate.toFixed(2)),
        status
      };
    });

    res.json({ success: true, data: providers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getCharts = async (req, res) => {
  try {
    const successCount = await Transaction.countDocuments({ status: "success" });
    const pendingCount = await Transaction.countDocuments({ status: "pending" });
    const failedCount = await Transaction.countDocuments({ status: "failed" });

    const dailyRevenueAgg = await Transaction.aggregate([
      { $match: { status: "success" } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "Asia/Kolkata"
            }
          },
          revenue: { $sum: "$amount" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const dailyRevenue = dailyRevenueAgg.map(item => ({
      date: item._id,
      revenue: item.revenue
    }));

    res.json({
      success: successCount,
      pending: pendingCount,
      failed: failedCount,
      dailyRevenue
    });
  } catch (err) {
    console.error("Error in getCharts:", err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};