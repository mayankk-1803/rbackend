import prisma from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import { Queue } from "bullmq";
import { redis } from "../config/redis.js";

export const rechargeQueue = new Queue("rechargeQueue", { connection: redis });

export const recharge = async ({ userId, mobile, operator, amount, testProviders }) => {
  console.log("USER ID:", userId);

  const user = await prisma.user.findUnique({
    where: { id: Number(userId) }
  });

  if (!user) throw new Error("USER_NOT_FOUND");

  const txn = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({
      where: { userId }
    });

    if (!wallet) {
      throw new Error("WALLET_NOT_FOUND");
    }

    if (Number(wallet.balance) < amount) {
      throw new Error("INSUFFICIENT_BALANCE");
    }

    const newBalance = new Prisma.Decimal(wallet.balance).minus(amount);

    await tx.wallet.update({
      where: { userId },
      data: {
        balance: newBalance
      }
    });

    const txn = await tx.transaction.create({
      data: {
        userId,
        mobile,
        operator,
        amount: new Prisma.Decimal(amount),
        type: "RECHARGE",
        status: "PENDING",
        direction: "DEBIT",
        balanceAfter: newBalance
      }
    });

    return txn;
  });

  await rechargeQueue.add("rechargeJob", {
    userId,
    txnId: txn.id,
    mobile,
    operator,
    amount,
    testProviders
  });

  console.log("JOB ADDED:", txn.id);

  return txn;
};
