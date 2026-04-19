import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import { addRechargeJob } from "../services/queueService.js";

export const getDashboard = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalTransactions = await Transaction.countDocuments();
    
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

    // 🔥 Push FULL DATA to queue
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