import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const pendingCount = await prisma.transaction.count({
      where: { status: 'PENDING' }
    });
    console.log("Pending transactions count:", pendingCount);

    const pendingList = await prisma.transaction.findMany({
      where: { status: 'PENDING' },
      take: 10,
      orderBy: { createdAt: 'desc' }
    });
    console.log("Details of first 10 pending transactions:", JSON.stringify(pendingList, null, 2));

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
