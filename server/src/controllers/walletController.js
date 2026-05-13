import prisma from "../config/prisma.js";
import { Prisma } from "@prisma/client";

export const getWallet = async (req, res) => {
  if (!req.user || !req.user.id) {
    console.error("[WALLET CRASH] Missing req.user");
    return res.status(401).json({
      success: false,
      message: "USER_NOT_AUTHENTICATED"
    });
  }

  const userId = Number(req.user.id);
  console.log("Fetching wallet for user:", userId);

  try {
    let wallet = await prisma.wallet.findUnique({
      where: { userId }
    });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId,
          balance: new Prisma.Decimal(0),
          cashbackBalance: new Prisma.Decimal(0),
          coinBalance: 0,
          currency: "INR"
        }
      });
    }

    return res.json({
      success: true,
      wallet: {
        id: wallet.id,
        userId: wallet.userId,
        balance: Number(wallet.balance) || 0,
        coinBalance: Number(wallet.coinBalance) || 0,
        currency: wallet.currency || "INR"
      }
    });

  } catch (error) {
    console.error("[WALLET CRASH]", error);

    // FAILSAFE LOGIC
    return res.json({
      success: true,
      wallet: {
        id: null,
        userId,
        balance: 0,
        coinBalance: 0,
        currency: "INR"
      }
    });
  }
};

export const redeemCoins = async (req, res) => {
  try {
    const userId = Number(req.user.id);

    await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      
      if (!wallet || wallet.coinBalance < 50) {
        throw new Error("Insufficient Earned Coins. Minimum 50 coins required.");
      }

      const newBalance = Number(wallet.balance) + 1;

      // Deduct 50 coins and add 1 INR to balance
      await tx.wallet.update({
        where: { userId },
        data: {
          coinBalance: { decrement: 50 },
          balance: { increment: 1 }
        }
      });

      // Log coin redemption
      await tx.coinTransaction.create({
        data: {
          userId,
          amount: 50,
          type: "REDEEMED",
          description: "Redeemed 50 Earned Coins for ₹1"
        }
      });

      // Log wallet transaction for the 1 INR
      await tx.transaction.create({
        data: {
          userId,
          amount: 1,
          type: "WALLET",
          status: "SUCCESS",
          direction: "CREDIT",
          balanceAfter: newBalance,
          providerTxnId: `COIN_REDEEM_${Date.now()}`
        }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    res.json({ success: true, message: "Successfully redeemed 50 Earned Coins for ₹1" });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getCoinsHistory = async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      prisma.coinTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit
      }),
      prisma.coinTransaction.count({ where: { userId } })
    ]);

    return res.json({
      success: true,
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("[COINS HISTORY ERROR]", error);
    return res.status(500).json({ success: false, message: "Failed to fetch coins history" });
  }
};