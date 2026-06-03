import prisma from "../src/config/prisma.js";

async function searchDB() {
  try {
    // Search the provider table
    const providers = await prisma.provider.findMany();
    console.log("Providers count:", providers.length);
    for (const p of providers) {
      if (JSON.stringify(p).toLowerCase().includes("phonepe") || JSON.stringify(p).toLowerCase().includes("nexgate")) {
        console.log("Found in provider table:", p);
      }
    }

    // Search all other tables dynamically
    const tables = await prisma.$queryRawUnsafe("SHOW TABLES");
    for (const t of tables) {
      const tableName = Object.values(t)[0];
      try {
        const rows = await prisma.$queryRawUnsafe(`SELECT * FROM \`${tableName}\``);
        for (const row of rows) {
          const str = JSON.stringify(row).toLowerCase();
          if (str.includes("phonepe") || str.includes("nexgate")) {
            console.log(`Found in table ${tableName}:`, row);
          }
        }
      } catch (err) {
        // Skip tables that fail (e.g. empty or binary)
      }
    }
    console.log("Search finished.");
  } catch (err) {
    console.error("Search DB error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

searchDB();
