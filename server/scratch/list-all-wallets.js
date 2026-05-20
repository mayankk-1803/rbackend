import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: { wallet: true }
  });
  console.log("Users and Wallets:");
  console.log(users.map(u => ({
    id: u.id,
    role: u.role,
    name: u.name,
    phone: u.phone,
    balance: u.wallet ? u.wallet.balance : "No Wallet"
  })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
