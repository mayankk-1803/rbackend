import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORIES = [
  { code: "RECHARGE", name: "Mobile/DTH Recharge" },
  { code: "DTH", name: "DTH Recharge" },
  { code: "POSTPAID", name: "Postpaid Mobile" },
  { code: "FASTAG", name: "FASTag Recharge" },
  { code: "ELECTRICITY", name: "Electricity Bill" },
  { code: "WATER", name: "Water Bill" },
  { code: "GAS", name: "Gas Bill" }
];

const OPERATORS = [
  { name: "AIRTEL", defaultCodes: { code: "1", category: "Mobile", circleRequired: true, description: "Prepaid mobile recharge for AIRTEL" } },
  { name: "JIO", defaultCodes: { code: "5", category: "Mobile", circleRequired: true, description: "Prepaid mobile recharge for JIO" } },
  { name: "VI", defaultCodes: { code: "2", category: "Mobile", circleRequired: true, description: "Prepaid mobile recharge for VI" } },
  { name: "BSNL", defaultCodes: { code: "3", category: "Mobile", circleRequired: true, description: "Prepaid mobile recharge for BSNL" } },
  { name: "BSNL TOPUP", defaultCodes: { code: "3", category: "Mobile", circleRequired: true, description: "Prepaid mobile recharge for BSNL TOPUP" } },
  { name: "MTNL", defaultCodes: { code: "11", category: "Mobile", circleRequired: true, description: "Prepaid mobile recharge for MTNL" } },
  { name: "TATA PLAY", defaultCodes: { code: "10", category: "DTH", circleRequired: false, description: "Direct-To-Home recharge for TATA PLAY" } },
  { name: "DISH TV", defaultCodes: { code: "8", category: "DTH", circleRequired: false, description: "Direct-To-Home recharge for DISH TV" } },
  { name: "SUN DIRECT", defaultCodes: { code: "9", category: "DTH", circleRequired: false, description: "Direct-To-Home recharge for SUN DIRECT" } },
  { name: "VIDEOCON D2H", defaultCodes: { code: "6", category: "DTH", circleRequired: false, description: "Direct-To-Home recharge for VIDEOCON D2H" } }
];

async function main() {
  console.log("=== RUNNING COMMISSION DROPDOWN CATALOG SEEDER ===");

  // 1. Fetch default package and slab for cross-linking
  const defaultSlab = await prisma.slab.findFirst({
    where: { isDefault: true, isDeleted: false }
  });
  const defaultPackage = await prisma.commissionPackage.findFirst({
    where: { isDefault: true, isDeleted: false }
  });

  if (!defaultSlab || !defaultPackage) {
    console.warn("[WARNING] Default slab or package not found. Skipping category mapping linkages.");
  } else {
    console.log(`Using Default Slab ID: ${defaultSlab.id}, Default Package ID: ${defaultPackage.id}`);
  }

  // 2. Seed Service Categories
  console.log("\n--- Seeding Service Categories ---");
  for (const cat of CATEGORIES) {
    const dbCat = await prisma.serviceCategory.upsert({
      where: { code: cat.code },
      update: { name: cat.name, isActive: true },
      create: { code: cat.code, name: cat.name, isActive: true }
    });
    console.log(`Upserted category: ${dbCat.code} (ID: ${dbCat.id})`);

    // Ensure mapping exists
    if (defaultPackage && defaultSlab) {
      const mapping = await prisma.packageServiceSlab.upsert({
        where: {
          packageId_serviceCategoryId: {
            packageId: defaultPackage.id,
            serviceCategoryId: dbCat.id
          }
        },
        update: {},
        create: {
          packageId: defaultPackage.id,
          serviceCategoryId: dbCat.id,
          slabId: defaultSlab.id
        }
      });
      console.log(`  Mapped Category ${dbCat.code} to Default Package-Slab link.`);
    }
  }

  // 3. Handle TATA SKY renaming to TATA PLAY
  console.log("\n--- Checking TATA SKY Renaming ---");
  const tataSky = await prisma.operator.findFirst({
    where: { name: "TATA SKY" }
  });
  if (tataSky) {
    await prisma.operator.update({
      where: { id: tataSky.id },
      data: {
        name: "TATA PLAY",
        active: true,
        codes: JSON.stringify({
          code: "10",
          category: "DTH",
          circleRequired: false,
          description: "Direct-To-Home recharge for TATA PLAY"
        })
      }
    });
    console.log(`Renamed TATA SKY (ID: ${tataSky.id}) to TATA PLAY.`);
  } else {
    console.log("TATA SKY operator not found or already renamed.");
  }

  // 4. Seed Operators
  console.log("\n--- Seeding Operators ---");
  for (const op of OPERATORS) {
    const existing = await prisma.operator.findUnique({
      where: { name: op.name }
    });

    if (existing) {
      // Never overwrite custom operator settings (codes), just ensure it's active
      // and has the correct name casing
      await prisma.operator.update({
        where: { id: existing.id },
        data: { active: true, name: op.name }
      });
      console.log(`Ensured operator active: ${op.name} (ID: ${existing.id})`);
    } else {
      // Create operator with default codes if it doesn't exist
      const newOp = await prisma.operator.create({
        data: {
          name: op.name,
          active: true,
          codes: JSON.stringify(op.defaultCodes)
        }
      });
      console.log(`Created operator: ${op.name} (ID: ${newOp.id})`);
    }
  }

  console.log("\n=== DROPDOWN SEEDING COMPLETE ===");
}

main()
  .catch(err => {
    console.error("Seeding execution failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
