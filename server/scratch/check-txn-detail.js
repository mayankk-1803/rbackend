import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const txns = await prisma.transaction.findMany({
      orderBy: {
        amount: 'desc'
      },
      take: 20
    });
    console.log("Matching transactions:", JSON.stringify(txns, null, 2));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
