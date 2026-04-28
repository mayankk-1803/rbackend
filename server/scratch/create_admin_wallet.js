import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const wallet = await prisma.wallet.upsert({
    where: { userId: 2 },
    update: {},
    create: {
      userId: 2,
      balance: 10000,
      cashbackBalance: 0
    }
  });
  console.log("Admin wallet created/verified:", wallet);
}

main().catch(console.error).finally(() => prisma.$disconnect());
