import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Checking tables...");
    const tables = await prisma.$queryRaw`SHOW TABLES`;
    console.log("Tables in DB:", tables);

    console.log("\nChecking Wallet columns...");
    const walletCols = await prisma.$queryRaw`SHOW COLUMNS FROM wallet`;
    console.log("Wallet Columns:", walletCols);

    console.log("\nChecking coinTransaction table...");
    try {
        const coinTxCols = await prisma.$queryRaw`SHOW COLUMNS FROM coinTransaction`;
        console.log("coinTransaction Columns:", coinTxCols);
    } catch (e) {
        console.log("coinTransaction table does NOT exist.");
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
