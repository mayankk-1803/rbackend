import mysql from 'mysql2/promise';

async function main() {
  console.log("--- RAW DB INSPECTION START ---");

  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Mayank@1803',
    database: 'fintech'
  });

  try {
    // 1. Check coinTransaction table
    const [tables] = await connection.execute("SHOW TABLES LIKE 'coinTransaction'");
    console.log("coinTransaction table existence:", tables.length > 0 ? "YES" : "NO");

    // 2. Check wallet.coinBalance column
    const [columns] = await connection.execute("SHOW COLUMNS FROM wallet LIKE 'coinBalance'");
    console.log("wallet.coinBalance column existence:", columns.length > 0 ? "YES" : "NO");

    // 3. Check migration history
    try {
        const [migrations] = await connection.execute("SELECT * FROM _prisma_migrations");
        console.table(migrations.map(m => ({
            id: m.id,
            migration_name: m.migration_name,
            finished_at: m.finished_at ? m.finished_at.toISOString() : "NULL",
            rolled_back_at: m.rolled_back_at ? m.rolled_back_at.toISOString() : "NULL",
            logs: m.logs ? m.logs.substring(0, 50) + "..." : "NONE"
        })));
    } catch (e) {
        console.error("Could not fetch migration history:", e.message);
    }

    // 4. Check User table structure (to see if phone/email/password etc match schema)
    const [userColumns] = await connection.execute("SHOW COLUMNS FROM user");
    console.log("User table columns:", userColumns.map(c => c.Field).join(', '));

  } catch (error) {
    console.error("Inspection failed:", error);
  } finally {
    await connection.end();
  }
  console.log("--- RAW DB INSPECTION END ---");
}

main();
