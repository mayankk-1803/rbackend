import express from "express";
import { auth } from "../middlewares/auth.js";
import prisma from "../config/prisma.js";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

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
        balanceAfter: true
      }
    });

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
    const { name } = req.body;
    let profileImageUrl = req.body.profileImage;

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'profile_images'
      });
      profileImageUrl = result.secure_url;
      fs.unlinkSync(req.file.path);
    }
    
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name && { name }),
        ...(profileImageUrl && { profileImage: profileImageUrl })
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        profileImage: true
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

export default router;