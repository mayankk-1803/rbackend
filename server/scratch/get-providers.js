import prisma from "../src/config/prisma.js";

async function main() {
  try {
    const providers = await prisma.provider.findMany();
    console.log("Providers in DB:");
    console.log(JSON.stringify(providers, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
