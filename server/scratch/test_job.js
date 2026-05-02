import prisma from "../src/config/prisma.js";
import { rechargeQueue } from "../src/services/rechargeService.js";

async function test() {
  const user = await prisma.user.findFirst();
  if (!user) return console.log("No user");

  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  
  const txn = await prisma.transaction.create({
    data: {
      userId: user.id,
      amount: 10,
      type: "RECHARGE",
      status: "PENDING",
      direction: "DEBIT",
      mobile: "9999999999",
      operator: "Jio"
    }
  });

  console.log("Created txn:", txn.id);

  await rechargeQueue.add("rechargeJob", {
    userId: user.id,
    txnId: txn.id,
    mobile: "9999999999",
    operator: "Jio",
    amount: 10,
  });

  console.log("Job added. Wait a few seconds...");
  await new Promise(r => setTimeout(r, 3000));
  
  const updated = await prisma.transaction.findUnique({ where: { id: txn.id } });
  console.log("Final status:", updated.status);
  process.exit(0);
}

test();
