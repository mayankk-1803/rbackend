import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Mayank@1803',
    database: 'fintech',
    multipleStatements: true
  });

  try {
    console.log("Applying safe repair SQL...");
    const sql = fs.readFileSync('prisma/production_safe_repair.sql', 'utf8');
    await connection.query(sql);
    console.log("SQL applied successfully.");

  } catch (error) {
    console.error("SQL execution failed:", error);
  } finally {
    await connection.end();
  }
}

main();
