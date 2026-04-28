import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.user.update({
    where: { email: 'admin@dizipay.com' },
    data: { password: '$2b$10$NLjEjLBiKUvJEleRYvmrWuwNOmeUIHhaOICKLbvsBoTPqU7ZcNsYe' }
  });
  console.log("Admin password hashed successfully");
}

main().catch(console.error).finally(() => prisma.$disconnect());
