import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const adminWallet = await prisma.adminWallet.findFirst();
  console.log("AdminWallet:", adminWallet);
  
  const userWalletsSum = await prisma.wallet.aggregate({
    _sum: { balance: true }
  });
  console.log("User wallets sum:", userWalletsSum._sum.balance);
}

main().catch(console.error).finally(() => prisma.$disconnect());
