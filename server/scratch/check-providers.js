import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const providers = await prisma.provider.findMany();
    console.log("Providers in DB:", JSON.stringify(providers, null, 2));
  } catch (err) {
    console.error("Error fetching providers:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
