import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const txns = await prisma.transaction.findMany({
      where: {
        OR: [
          { amount: 35398.82 },
          { id: 35398 }
        ]
      }
    });
    console.log("Matching Transactions:", txns);

    const wallets = await prisma.wallet.findMany({
      where: {
        balance: 35398.82
      }
    });
    console.log("Matching Wallets:", wallets);

    const allTxns = await prisma.transaction.findMany({
      take: 100,
      orderBy: { id: 'desc' }
    });
    console.log("Total Transactions found:", allTxns.length);
    const match = allTxns.find(t => String(t.amount).includes("35398") || String(t.id).includes("35398"));
    if (match) {
      console.log("Found match in top 100:", match);
    } else {
      console.log("No match in top 100.");
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
