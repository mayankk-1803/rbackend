import { seedProviders } from "../src/utils/seedProviders.js";
import prisma from "../src/config/prisma.js";

async function main() {
  try {
    await seedProviders();
    const providers = await prisma.provider.findMany();
    console.log("Current providers in DB:", providers.map(p => ({ name: p.name, code: p.code, providerType: p.providerType, isActive: p.isActive })));
  } catch (err) {
    console.error("Seeding test failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
