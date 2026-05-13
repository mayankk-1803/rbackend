import mysql from 'mysql2/promise';

async function main() {
  console.log("--- DB CROSS-CHECK START ---");

  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Mayank@1803'
  });

  try {
    const [databases] = await connection.execute("SHOW DATABASES");
    console.log("Available databases:", databases.map(db => db.Database).join(', '));

    for (const db of ['fintech', 'recharge_db']) {
        if (databases.map(d => d.Database).includes(db)) {
            console.log(`\nChecking database: ${db}`);
            await connection.changeUser({ database: db });
            const [tables] = await connection.execute("SHOW TABLES LIKE 'coinTransaction'");
            console.log(` - Table 'coinTransaction' exists:`, tables.length > 0 ? "YES" : "NO");
            
            const [walletCols] = await connection.execute("SHOW COLUMNS FROM wallet LIKE 'coinBalance'");
            console.log(` - Column 'wallet.coinBalance' exists:`, walletCols.length > 0 ? "YES" : "NO");
        }
    }

  } catch (error) {
    console.error("Inspection failed:", error);
  } finally {
    await connection.end();
  }
  console.log("--- DB CROSS-CHECK END ---");
}

main();
