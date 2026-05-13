import mysql from 'mysql2/promise';

async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Mayank@1803',
    database: 'fintech'
  });

  try {
    const [tables] = await connection.execute("SHOW TABLES");
    console.log("Tables in fintech:", tables.map(t => Object.values(t)[0]).join(', '));

    const [columns] = await connection.execute("SHOW COLUMNS FROM wallet");
    console.log("Wallet columns:", columns.map(c => c.Field).join(', '));

  } catch (error) {
    console.error("Inspection failed:", error);
  } finally {
    await connection.end();
  }
}

main();
