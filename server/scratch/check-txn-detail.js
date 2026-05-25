import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const txn = await prisma.transaction.findUnique({
      where: { id: 51 }
    });
    console.log("Transaction 51 details:", JSON.stringify(txn, null, 2));

    const logs = await prisma.transactionTimeline?.findMany({
      where: { transactionId: 51 }
    });
    console.log("Transaction 51 timeline logs:", JSON.stringify(logs, null, 2));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
