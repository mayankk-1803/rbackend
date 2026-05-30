import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("Starting Commission Suite Seeding...");

  // 1. Create Service Categories
  const servicesToSeed = [
    { code: "RECHARGE", name: "Mobile/DTH Recharge" },
    { code: "AEPS", name: "Aadhaar Enabled Payment System" },
    { code: "BBPS", name: "Bharat Bill Payment System" },
    { code: "DMT", name: "Domestic Money Transfer" },
    { code: "FASTAG", name: "FASTag Recharge" },
    { code: "CMS", name: "Cash Management Service" },
    { code: "INSURANCE", name: "Insurance Premium Payment" },
    { code: "TRAVEL", name: "Travel/Ticket Booking" },
    { code: "SHOPPING", name: "Shopping E-Commerce" },
    { code: "PAYOUT", name: "Payout Transfers" }
  ];

  const dbCategories = [];
  for (const s of servicesToSeed) {
    const category = await prisma.serviceCategory.upsert({
      where: { code: s.code },
      update: { name: s.name },
      create: { code: s.code, name: s.name }
    });
    dbCategories.push(category);
    console.log(`Seeded ServiceCategory: ${s.code} -> ID: ${category.id}`);
  }

  // 2. Create Default Slab if none exists
  let defaultSlab = await prisma.slab.findFirst({
    where: { isDefault: true, isDeleted: false }
  });

  if (!defaultSlab) {
    defaultSlab = await prisma.slab.create({
      data: {
        name: "Default Slab",
        description: "Default commission rates slab",
        isActive: true,
        isDefault: true
      }
    });
    console.log(`Created Default Slab: ${defaultSlab.name} -> ID: ${defaultSlab.id}`);
  } else {
    console.log(`Default Slab already exists -> ID: ${defaultSlab.id}`);
  }

  // 3. Create Default Package if none exists
  let defaultPackage = await prisma.commissionPackage.findFirst({
    where: { isDefault: true, isDeleted: false }
  });

  if (!defaultPackage) {
    defaultPackage = await prisma.commissionPackage.create({
      data: {
        name: "Default Package",
        description: "Default commission package for all users",
        cost: 0.0,
        expiryDays: null,
        isDefault: true,
        selfAssignment: false,
        isActive: true
      }
    });
    console.log(`Created Default Package: ${defaultPackage.name} -> ID: ${defaultPackage.id}`);
  } else {
    console.log(`Default Package already exists -> ID: ${defaultPackage.id}`);
  }

  // Link Default Package to Default Slab for all categories
  for (const category of dbCategories) {
    await prisma.packageServiceSlab.upsert({
      where: {
        packageId_serviceCategoryId: {
          packageId: defaultPackage.id,
          serviceCategoryId: category.id
        }
      },
      update: {},
      create: {
        packageId: defaultPackage.id,
        serviceCategoryId: category.id,
        slabId: defaultSlab.id
      }
    });
  }
  console.log("Package Service Slab links updated successfully.");

  // 4. User Mapping
  const users = await prisma.user.findMany({
    include: { partner: true }
  });
  console.log(`Mapping ${users.length} users to commission roles...`);

  for (const u of users) {
    let role = "CUSTOMER";
    if (u.role === "SUPER_ADMIN") {
      role = "SUPER_ADMIN";
    } else if (u.role === "ADMIN") {
      role = "SUB_ADMIN";
    } else if (u.role === "API_USER") {
      role = "API_USER";
    } else if (u.partner) {
      if (u.partner.type === "DISTRIBUTOR") {
        role = "DISTRIBUTOR";
      } else if (u.partner.type === "RETAILER") {
        role = "RETAILER";
      }
    }

    await prisma.user.update({
      where: { id: u.id },
      data: {
        commissionRole: role,
        // 5. Package Assignment (Assign default package only if packageId is null)
        packageId: u.packageId === null ? defaultPackage.id : u.packageId
      }
    });
  }
  console.log("User commission roles & default package assignments completed.");

  // 6. Create CommissionConfig row
  const config = await prisma.commissionConfig.findUnique({
    where: { id: 1 }
  });

  if (!config) {
    await prisma.commissionConfig.create({
      data: { id: 1, currentVersion: 1 }
    });
    console.log("Created default CommissionConfig row.");
  } else {
    console.log("CommissionConfig row already exists.");
  }

  console.log("Commission Suite Seeding Finished Successfully!");
}

main()
  .catch((e) => {
    console.error("Seeding Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
