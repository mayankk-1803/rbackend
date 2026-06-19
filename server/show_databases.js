import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const dbs = await prisma.$queryRaw`SHOW DATABASES`;
  console.log("Databases:", dbs);
}

main().catch(console.error).finally(() => prisma.$disconnect());
