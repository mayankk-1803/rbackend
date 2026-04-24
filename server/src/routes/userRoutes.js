import express from "express";
import { auth } from "../middlewares/auth.js";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";

const router = express.Router();

// Apply auth middleware
router.use(auth);

// GET /user/wallet
router.get("/wallet", async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.user.id });

    if (!wallet) {
      // If no wallet exists yet, just return 0 balance
      return res.json({
        success: true,
        message: "Wallet fetched",
        data: {
          walletBalance: 0,
          cashbackBalance: 0
        }
      });
    }

    res.json({
      success: true,
      message: "Wallet fetched",
      data: {
        walletBalance: wallet.balance,
        cashbackBalance: wallet.cashbackBalance
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// GET /user/transactions
router.get("/transactions", async (req, res) => {
  try {
    const { status, type, page = 1, limit = 10 } = req.query;

    const query = { userId: req.user.id };

    if (status) query.status = status;
    if (type) query.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select("-isLocked -__v");

    res.json({
      success: true,
      message: "Transactions fetched",
      data: transactions
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// GET /user/dashboard
router.get("/dashboard", async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.user.id });

    const transactions = await Transaction.find({
      userId: req.user.id
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("amount status type createdAt");

    res.json({
      success: true,
      message: "Dashboard fetched",
      data: {
        walletBalance: wallet ? wallet.balance : 0,
        cashbackBalance: wallet ? wallet.cashbackBalance : 0,
        recentTransactions: transactions
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

export default router;