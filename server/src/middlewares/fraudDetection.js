import prisma from "../config/prisma.js";
import { redis } from "../config/redis.js";
import { sendAlert } from "../services/alertService.js";
import { Prisma } from "@prisma/client";

const FRAUD_TTL = 60; // 1 minute window for some checks
const DUPLICATE_TTL = 120; // 2 minutes for duplicate recharge protection
const LONGER_TTL = 3600; // 1 hour window

export const fraudDetectionMiddleware = async (req, res, next) => {
  const userId = req.body.userId || (req.user && req.user.id);
  if (!userId) return next();
  
  const { amount, mobile } = req.body;
  let riskScore = 0;
  const reasons = [];
  
  try {
    const pipeline = redis.pipeline();
    
    // 1. Transaction count per minute for SAME MOBILE
    const mobileKey = `fraud:mobile:${mobile}:count_min`;
    pipeline.incr(mobileKey);
    pipeline.expire(mobileKey, FRAUD_TTL);
    
    // 2. Duplicate recharge protection (same mobile within 2 mins)
    const duplicateKey = `fraud:duplicate:${mobile}`;
    pipeline.set(duplicateKey, "1", "NX", "EX", DUPLICATE_TTL);
    
    // 3. Repeated same amount for same mobile/user
    const repeatAmountKey = `fraud:user:${userId}:mobile:${mobile}:amount:${amount}:count`;
    pipeline.incr(repeatAmountKey);
    pipeline.expire(repeatAmountKey, LONGER_TTL);
    
    // 4. Overall user transaction count
    const userTxnKey = `fraud:user:${userId}:count_hour`;
    pipeline.incr(userTxnKey);
    pipeline.expire(userTxnKey, LONGER_TTL);

    const results = await pipeline.exec();
    
    const mobileTxnCountMin = results[0][1];
    const isDuplicate = results[1][1] === null; // NX failed means it exists
    const repeatAmountCount = results[2][1];
    const userTxnCountHour = results[4][1];
    
    // RULE: Duplicate recharge within 2 mins
    if (isDuplicate) {
      riskScore += 90;
      reasons.push("Duplicate recharge attempt to same mobile within 2 minutes");
    }

    // RULE: 5 transactions/min (same mobile)
    if (mobileTxnCountMin >= 5) {
      riskScore += 80;
      reasons.push("Rapid transactions to same mobile (>5/min)");
    }
    
    // RULE: repeated same amount (more than 3 times in an hour for same mobile)
    if (repeatAmountCount > 3) {
      riskScore += 40;
      reasons.push("Repeated identical amount to same mobile");
    }
    
    // RULE: High user frequency
    if (userTxnCountHour > 15) {
      riskScore += 50;
      reasons.push("High hourly transaction volume for user");
    }

    // 5. Daily Limit System (₹5000 per day)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const dailyTotal = await prisma.transaction.aggregate({
      where: {
        userId,
        status: "SUCCESS",
        createdAt: { gte: startOfDay }
      },
      _sum: {
        amount: true
      }
    });

    const currentSpent = Number(dailyTotal._sum.amount) || 0;
    if (currentSpent + (Number(amount) || 0) > 5000) {
      riskScore += 100;
      reasons.push(`Daily limit exceeded (Spent: ₹${currentSpent}, Limit: ₹5000)`);
    }

    if (riskScore > 0) {
      let actionTaken = "NONE";
      if (riskScore >= 100) {
        actionTaken = "BLOCKED";
      } else if (riskScore >= 50) {
        actionTaken = "FLAGGED";
      }

      if (actionTaken !== "NONE") {
        await prisma.fraudLog.create({
          data: {
            userId,
            mobile,
            riskScore,
            actionTaken: actionTaken === "BLOCKED" ? "BLOCKED" : "FLAGGED",
            reasons: reasons.join(", "),
            txnData: req.body
          }
        });

        if (actionTaken === "BLOCKED") {
          await sendAlert("FRAUD_BLOCKED", `User ${userId} blocked due to high risk score: ${riskScore}. Reasons: ${reasons.join(", ")}`, "High");
          return res.status(403).json({ success: false, message: "Transaction blocked due to security reasons", reasons });
        } else {
          await sendAlert("FRAUD_FLAGGED", `User ${userId} flagged for high risk score: ${riskScore}. Reasons: ${reasons.join(", ")}`, "Medium");
        }
      }
    }

    next();
  } catch (error) {
    console.error("Fraud Detection Error:", error);
    next();
  }
};
