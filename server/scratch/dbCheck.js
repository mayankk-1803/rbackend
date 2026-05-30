import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  console.log("Fetching up to 20 users with their packageId...");
  const users = await prisma.$queryRaw`SELECT id, packageId, name, email, phone FROM user LIMIT 20;`;
  console.log("DB Results:");
  console.table(users);
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
