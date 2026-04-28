import prisma from "../config/prisma.js";
import { Prisma } from "@prisma/client";

export const getWallet = async (req, res) => {
  if (!req.user || !req.user.id) {
    console.error("🔥 WALLET CRASH: Missing req.user");
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
        cashbackBalance: Number(wallet.cashbackBalance) || 0,
        currency: wallet.currency || "INR"
      }
    });

  } catch (error) {
    console.error("🔥 WALLET CRASH:", error);

    // FAILSAFE LOGIC
    return res.json({
      success: true,
      wallet: {
        id: null,
        userId,
        balance: 0,
        cashbackBalance: 0,
        currency: "INR"
      }
    });
  }
};