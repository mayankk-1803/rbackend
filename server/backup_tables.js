import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();
const BACKUP_DIR = "./backup";

async function main() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR);
  }

  const tables = [
    "serviceSection",
    "serviceCategory",
    "operator",
    "slab",
    "commissionPackage",
    "packageServiceSlab",
    "rechargeCommissionRule",
    "rangeCommissionRule"
  ];

  console.log("Starting backup of tables...");

  for (const t of tables) {
    console.log(`Backing up ${t}...`);
    const data = await prisma[t].findMany();
    const filePath = path.join(BACKUP_DIR, `${t}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Saved ${data.length} records to ${filePath}`);
  }

  console.log("Backup completed successfully!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
