import mysql from 'mysql2/promise';

async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Mayank@1803',
    database: 'fintech'
  });

  try {
    const [rows] = await connection.execute("SHOW VARIABLES LIKE 'lower_case_table_names'");
    console.table(rows);

  } catch (error) {
    console.error("Inspection failed:", error);
  } finally {
    await connection.end();
  }
}

main();
