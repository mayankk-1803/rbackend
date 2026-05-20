import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const totalTransactions = await prisma.transaction.count();
    console.log("Total Transactions:", totalTransactions);

    const pendingTxns = await prisma.transaction.findMany({
      where: { status: 'PENDING' },
      take: 10
    });
    console.log("Pending Transactions (up to 10):", pendingTxns);

    const firstTenTxns = await prisma.transaction.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' }
    });
    console.log("Latest 10 Transactions:", firstTenTxns);

    const providers = await prisma.provider.findMany();
    console.log("Seeded Providers:", providers);

  } catch (err) {
    console.error("Error running query:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
