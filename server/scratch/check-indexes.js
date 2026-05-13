import mysql from 'mysql2/promise';

async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Mayank@1803',
    database: 'fintech'
  });

  try {
    const [indexes] = await connection.execute("SHOW INDEX FROM cointransaction");
    console.log("Indexes on cointransaction:");
    console.table(indexes.map(idx => ({
        Name: idx.Key_name,
        Column: idx.Column_name,
        Unique: !idx.Non_unique
    })));

  } catch (error) {
    console.error("Inspection failed:", error);
  } finally {
    await connection.end();
  }
}

main();
