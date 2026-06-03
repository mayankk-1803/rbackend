import prisma from "../src/config/prisma.js";

async function inspect() {
  try {
    console.log("=== Providers ===");
    const providers = await prisma.provider.findMany();
    console.log(JSON.stringify(providers, null, 2));

    console.log("=== Feature Flags ===");
    const flags = await prisma.featureFlag.findMany();
    console.log(JSON.stringify(flags, null, 2));

    console.log("=== Raw Table List ===");
    const tables = await prisma.$queryRawUnsafe("SHOW TABLES");
    console.log(JSON.stringify(tables, null, 2));
    
    // Let's also check if there are users
    const userCount = await prisma.user.count();
    console.log("User count:", userCount);

  } catch (err) {
    console.error("Error inspecting database:", err);
  } finally {
    await prisma.$disconnect();
  }
}

inspect();
