import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();
const BACKUP_DIR = "./backup";

async function main() {
  console.log("[RESTORATION] Starting master data restoration...");

  // Disable foreign key checks
  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0;");
  console.log("✔ Disabled foreign key checks.");

  const tables = [
    { name: "serviceSection", file: "serviceSection.json" },
    { name: "serviceCategory", file: "serviceCategory.json" },
    { name: "operator", file: "operator.json" },
    { name: "slab", file: "slab.json" },
    { name: "commissionPackage", file: "commissionPackage.json" },
    { name: "packageServiceSlab", file: "packageServiceSlab.json" },
    { name: "rechargeCommissionRule", file: "rechargeCommissionRule.json" },
    { name: "rangeCommissionRule", file: "rangeCommissionRule.json" }
  ];

  // 1. Clear target tables
  console.log("Clearing existing tables...");
  for (const t of [...tables].reverse()) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${t.name}\`;`);
    console.log(`✔ Truncated table: ${t.name}`);
  }

  // 2. Restore tables from backups
  for (const t of tables) {
    const filePath = path.join(BACKUP_DIR, t.file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Backup file not found: ${filePath}`);
    }

    const records = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    console.log(`Restoring ${records.length} records to ${t.name}...`);

    // We can use createMany for bulk insertion.
    // In Prisma, createMany supports inserting original IDs and raw columns.
    // However, some date strings in JSON need to be parsed back to Date objects.
    const parsedRecords = records.map(r => {
      const parsed = { ...r };
      for (const [key, val] of Object.entries(parsed)) {
        if (typeof val === "string" && (key.endsWith("At") || key.startsWith("effective") || key === "deletedAt" || key === "signedAt" || key === "checkIn" || key === "checkOut" || key === "startTime" || key === "endTime")) {
          parsed[key] = new Date(val);
        }
      }
      return parsed;
    });

    // We batch insert records in chunks of 5000 to prevent SQL string length errors
    const chunkSize = 5000;
    for (let i = 0; i < parsedRecords.length; i += chunkSize) {
      const chunk = parsedRecords.slice(i, i + chunkSize);
      await prisma[t.name].createMany({
        data: chunk,
        skipDuplicates: true
      });
    }

    console.log(`✔ Restored ${t.name} successfully.`);
  }

  // Enable foreign key checks back
  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1;");
  console.log("✔ Re-enabled foreign key checks.");
  console.log("[RESTORATION] All tables restored successfully!");
}

main().catch(async (err) => {
  console.error("Restoration failed:", err);
  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1;");
  process.exit(1);
}).finally(() => prisma.$disconnect());
