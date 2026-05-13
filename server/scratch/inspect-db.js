import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("--- DATABASE INSPECTION START ---");

  try {
    // Check if coinTransaction table exists
    const tables = await prisma.$queryRawUnsafe(`SHOW TABLES LIKE 'coinTransaction'`);
    console.log("coinTransaction table existence:", tables.length > 0 ? "YES" : "NO");

    // Check if wallet.coinBalance column exists
    const columns = await prisma.$queryRawUnsafe(`SHOW COLUMNS FROM wallet LIKE 'coinBalance'`);
    console.log("wallet.coinBalance column existence:", columns.length > 0 ? "YES" : "NO");

    // Check migration history
    try {
        const migrations = await prisma.$queryRawUnsafe(`SELECT * FROM _prisma_migrations`);
        console.table(migrations.map(m => ({
            id: m.id,
            migration_name: m.migration_name,
            finished_at: m.finished_at ? m.finished_at.toISOString() : "NULL",
            rolled_back_at: m.rolled_back_at ? m.rolled_back_at.toISOString() : "NULL"
        })));
    } catch (e) {
        console.error("Could not fetch migration history:", e.message);
    }

  } catch (error) {
    console.error("Inspection failed:", error);
  } finally {
    await prisma.$disconnect();
  }
  console.log("--- DATABASE INSPECTION END ---");
}

main();
