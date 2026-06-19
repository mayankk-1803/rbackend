import express from "express";
import { auth } from "../middlewares/auth.js";
import prisma from "../config/prisma.js";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import eventBus from "../config/eventBus.js";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import { getTransactionHistory, getWalletLedger, exportTransactions } from "../controllers/reportController.js";
import { getInvoice } from "../controllers/invoiceController.js";
import { raiseDispute, getMyDisputes } from "../controllers/disputeController.js";
import { recordFinancialEntry } from "../services/ledgerService.js";
import { redeemLimiter } from "../middlewares/rateLimiter.js";
import { encodeTxnId } from "../utils/referenceHelper.js";



// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const upload = multer({ dest: 'uploads/' });

const router = express.Router();

// Apply auth middleware
router.use(auth);

// GET /user/wallet
router.get("/wallet", async (req, res) => {
  try {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user.id }
    });

    const settings = await prisma.cashbackSettings.findFirst();
    const rate = settings?.coinConversionRate || 100;

    if (!wallet) {
      // If no wallet exists yet, just return 0 balance
      return res.json({
        success: true,
        message: "Wallet fetched",
        data: {
          walletBalance: 0,
          cashbackBalance: 0,
          coinBalance: 0,
          totalCoins: 0,
          availableCoins: 0,
          earnedCoins: 0,
          redemptionBalance: 0
        }
      });
    }

    const coinsVal = Number(wallet.coinBalance) || 0;

    res.json({
      success: true,
      message: "Wallet fetched",
      data: {
        walletBalance: wallet.balance,
        cashbackBalance: wallet.cashbackBalance,
        coinBalance: coinsVal,
        totalCoins: coinsVal,
        availableCoins: coinsVal,
        earnedCoins: coinsVal,
        redemptionBalance: Math.floor(coinsVal / rate)
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

    const where = { userId: req.user.id };

    if (status) where.status = status;
    if (type) where.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: skip,
      take: parseInt(limit),
      select: {
        id: true,
        amount: true,
        status: true,
        type: true,
        direction: true,
        mobile: true,
        operator: true,
        createdAt: true,
        balanceAfter: true,
        lastRetryAt: true,
        processingStartedAt: true,
        processedAt: true,
        retryCount: true,
        reviewStatus: true,
        invoiceSnapshot: true,
        providerTxnId: true,
        providerRef: true,
        providerRefId: true
      }
    });

    const mappedTransactions = transactions.map(tx => {
      return {
        ...tx,
        publicRef: encodeTxnId(tx.id),
        operatorReferenceId: tx.providerRef || tx.providerRefId || tx.providerTxnId || null
      };
    });

    res.json({
      success: true,
      message: "Transactions fetched",
      data: mappedTransactions
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
    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user.id }
    });

    const transactions = await prisma.transaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        amount: true,
        status: true,
        type: true,
        createdAt: true
      }
    });

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

// PUT /user/update-profile
router.put("/update-profile", upload.single('profileImage'), async (req, res) => {
  try {
    const { name, address, alternatePhone, city, state, dob, gender, pincode } = req.body;
    let profileImageUrl = req.body.profileImage;

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'profile_images'
      });
      profileImageUrl = result.secure_url;
      fs.unlinkSync(req.file.path);
    }

    let dobDate = undefined;
    if (dob !== undefined) {
      if (dob === null || dob === "") {
        dobDate = null;
      } else {
        const parsed = new Date(dob);
        if (!isNaN(parsed.getTime())) {
          dobDate = parsed;
        }
      }
    }
    
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name && { name }),
        ...(profileImageUrl && { profileImage: profileImageUrl }),
        ...(address !== undefined && { address }),
        ...(alternatePhone !== undefined && { alternatePhone }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
        ...(dobDate !== undefined && { dob: dobDate }),
        ...(gender !== undefined && { gender }),
        ...(pincode !== undefined && { pincode })
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        profileImage: true,
        address: true,
        alternatePhone: true,
        city: true,
        state: true,
        dob: true,
        gender: true,
        pincode: true
      }
    });

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// PUT /user/change-password
router.put("/change-password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required"
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters long"
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect"
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
        mustResetPassword: false,
        tempPasswordIssuedAt: null
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        profileImage: true,
        mustChangePassword: true
      }
    });

    res.json({
      success: true,
      message: "Password changed successfully",
      data: updatedUser
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// V3 Fintech Routes
router.get("/reports/transactions", getTransactionHistory);
router.get("/reports/transactions/export", exportTransactions);
router.get("/reports/ledger", getWalletLedger);
router.get("/invoice/:transactionId", getInvoice);
router.get("/disputes", getMyDisputes);
router.post("/disputes", raiseDispute);

// Reward Collection is now automatic upon successful recharge.

// Coin History
router.get("/wallet/coins-history", async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [data, total] = await Promise.all([
      prisma.coinTransaction.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.coinTransaction.count({ where: { userId: req.user.id } })
    ]);

    res.json({
      success: true,
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Redeem Coins
router.post("/wallet/redeem-coins", redeemLimiter, async (req, res) => {
  try {
    const userId = Number(req.user.id);
    let coinsToRedeem = 0;
    let redeemAmount = 0;

    await prisma.$transaction(async (tx) => {
      // 1. Lock wallet row during redemption
      const wallets = await tx.$queryRaw`SELECT * FROM wallet WHERE userId = ${userId} FOR UPDATE`;
      if (!wallets || wallets.length === 0) {
        throw new Error("Wallet not found");
      }
      const wallet = wallets[0];
      const coinBalance = Number(wallet.coinBalance);

      // Check conversion rate from settings, default to 100
      const settings = await tx.cashbackSettings.findFirst();
      const rate = settings?.coinConversionRate || 100;

      if (coinBalance < rate) {
        throw new Error(`Minimum ${rate} coins required for redemption`);
      }

      redeemAmount = Math.floor(coinBalance / rate);
      coinsToRedeem = redeemAmount * rate;

      if (redeemAmount <= 0) {
        throw new Error(`Insufficient coins for redemption at the current rate of ${rate} coins = ₹1`);
      }

      // Idempotency key for redeem
      const idempotencyKey = `redeem:${userId}_${Date.now()}`;

      // 2. Deduct coins and create coin transaction via central service
      const { recordCoinEntry, recordFinancialEntry } = await import("../services/ledgerService.js");
      await recordCoinEntry({
        userId,
        amount: coinsToRedeem,
        type: 'REDEEMED',
        description: `Redeemed for wallet balance`,
        tx
      });

      // 3. Add wallet balance via ledger
      const { balanceAfter, ledgerEntry } = await recordFinancialEntry({
        userId,
        amount: redeemAmount,
        type: 'REDEMPTION_CREDIT',
        transactionId: null,
        description: `Redeemed ${coinsToRedeem} coins for ₹${redeemAmount}`,
        tx
      });

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          userId,
          amount: new Prisma.Decimal(redeemAmount),
          type: "WALLET",
          status: "SUCCESS",
          direction: "CREDIT",
          balanceAfter,
          idempotencyKey,
          description: `Redeemed ${coinsToRedeem} coins for ₹${redeemAmount}`
        }
      });

      await tx.ledgerEntry.update({
        where: { id: ledgerEntry.id },
        data: { transactionId: transaction.id }
      });

    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });

    // Emit event bus notification after transaction commit
    eventBus.emit("wallet_updated", { userId: userId.toString() });

    res.json({ success: true, message: `Successfully redeemed ${coinsToRedeem} coins for ₹${redeemAmount}` });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;
