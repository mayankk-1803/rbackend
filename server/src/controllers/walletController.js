import prisma from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import crypto from "crypto";
import { claimIdempotencyKey } from "../utils/idempotency.js";

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
    const correlationId = crypto.randomBytes(8).toString('hex');
    let coinsToRedeem = 0;
    let redeemAmount = 0;
    
    const idempotencyKey = req.headers["x-idempotency-key"] || `redeem:${userId}:${correlationId}`;

    await prisma.$transaction(async (tx) => {
      // 0. Enforce idempotency
      const canClaim = await claimIdempotencyKey(idempotencyKey, req.body, tx);
      if (!canClaim) {
        throw new Error("Duplicate redemption request detected. Request already processed.");
      }

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

      // 2. Deduct coins and create coin transaction via central service
      const { recordCoinEntry, recordFinancialEntry } = await import("../services/ledgerService.js");
      await recordCoinEntry({
        userId,
        amount: coinsToRedeem,
        type: 'REDEEMED',
        description: `Redeemed for wallet balance`,
        context: { correlationId, ipAddress: req.ip },
        tx
      });

      // 3. Add wallet balance via ledger
      const { balanceAfter, ledgerEntry } = await recordFinancialEntry({
        userId,
        amount: redeemAmount,
        type: 'REDEMPTION_CREDIT',
        transactionId: null,
        description: `Redeemed ${coinsToRedeem} coins for ₹${redeemAmount}`,
        context: { correlationId, ipAddress: req.ip },
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
          financialSequenceId: correlationId,
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
    const { default: eventBus } = await import("../config/eventBus.js");
    eventBus.emit("wallet_updated", { userId: userId.toString() });

    res.json({ success: true, message: `Successfully redeemed ${coinsToRedeem} coins for ₹${redeemAmount}` });
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