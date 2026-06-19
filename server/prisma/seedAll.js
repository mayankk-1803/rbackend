import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SECTIONS = [
  { name: "Recharge", code: "RECHARGE", serviceType: "RECHARGE", displayOrder: 1 },
  { name: "DTH", code: "DTH", serviceType: "DTH", displayOrder: 2 },
  { name: "BBPS", code: "BBPS", serviceType: "BBPS", displayOrder: 3 },
  { name: "AEPS", code: "AEPS", serviceType: "AEPS", displayOrder: 4 },
  { name: "Money Transfer", code: "DMT", serviceType: "DMT", displayOrder: 5 },
  { name: "Fastag", code: "FASTAG", serviceType: "FASTAG", displayOrder: 6 }
];

const CATEGORIES = [
  { name: "Mobile/DTH Recharge", code: "RECHARGE" },
  { name: "Aadhaar Enabled Payment System", code: "AEPS" },
  { name: "Bharat Bill Payment System", code: "BBPS" },
  { name: "Domestic Money Transfer", code: "DMT" },
  { name: "FASTag Recharge", code: "FASTAG" },
  { name: "Cash Management Service", code: "CMS" },
  { name: "Insurance Premium Payment", code: "INSURANCE" },
  { name: "Travel/Ticket Booking", code: "TRAVEL" },
  { name: "Shopping E-Commerce", code: "SHOPPING" },
  { name: "Payout Transfers", code: "PAYOUT" }
];

const DEFAULT_OPERATORS = [
  { name: "JIO", active: true },
  { name: "AIRTEL", active: true },
  { name: "VI", active: true },
  { name: "BSNL", active: true },
  { name: "VIDEOCON D2H", active: true },
  { name: "AIRTEL DTH", active: true },
  { name: "DISH TV", active: true },
  { name: "SUN DIRECT", active: true },
  { name: "TATA SKY", active: true }
];

async function main() {
  console.log("[SEEDING] Starting system database configuration seeding...");

  // 1. Seed Service Sections
  console.log("Seeding service sections (operations)...");
  for (const sec of SECTIONS) {
    await prisma.serviceSection.upsert({
      where: { code: sec.code },
      update: {
        name: sec.name,
        serviceType: sec.serviceType,
        displayOrder: sec.displayOrder,
        isActive: true,
        isDeleted: false
      },
      create: {
        name: sec.name,
        code: sec.code,
        serviceType: sec.serviceType,
        displayOrder: sec.displayOrder,
        isActive: true
      }
    });
  }
  console.log("✔ Service sections seeded.");

  // 2. Seed Service Categories
  console.log("Seeding service categories (commissions)...");
  for (const cat of CATEGORIES) {
    await prisma.serviceCategory.upsert({
      where: { code: cat.code },
      update: {
        name: cat.name,
        isActive: true
      },
      create: {
        name: cat.name,
        code: cat.code,
        isActive: true
      }
    });
  }
  console.log("✔ Service categories seeded.");

  // 3. Seed Default Operators (if missing)
  console.log("Checking and seeding default operators...");
  for (const op of DEFAULT_OPERATORS) {
    await prisma.operator.upsert({
      where: { name: op.name },
      update: { active: op.active },
      create: { name: op.name, active: op.active }
    });
  }
  console.log("✔ Default operators verified/seeded.");

  // 4. Seed Default Slab
  console.log("Verifying default slab...");
  const defaultSlab = await prisma.slab.findFirst({
    where: { isDefault: true }
  });
  if (!defaultSlab) {
    await prisma.slab.create({
      data: {
        name: "Default Slab",
        description: "System default commission slab",
        isDefault: true,
        isActive: true
      }
    });
    console.log("✔ Created default slab.");
  } else {
    console.log("✔ Default slab already exists.");
  }

  // 5. Seed Default Package
  console.log("Verifying default package...");
  const defaultPkg = await prisma.commissionPackage.findFirst({
    where: { isDefault: true }
  });
  if (!defaultPkg) {
    await prisma.commissionPackage.create({
      data: {
        name: "Default Package",
        description: "System default package mapping",
        isDefault: true,
        isActive: true
      }
    });
    console.log("✔ Created default package.");
  } else {
    console.log("✔ Default package already exists.");
  }

  console.log("[SEEDING COMPLETE] System database is now configured successfully.");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
