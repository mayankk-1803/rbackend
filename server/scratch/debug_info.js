import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const txns = await prisma.transaction.findMany({
    where: {
      type: 'RECHARGE',
      status: 'SUCCESS'
    },
    select: {
      id: true,
      amount: true,
      operator: true,
      commission: true,
      profit: true,
      createdAt: true
    }
  });
  console.log("=== Successful Recharge Transactions ===");
  console.log(txns);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
