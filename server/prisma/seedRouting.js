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

async function main() {
  console.log("Seeding Telecom Routing Suite sections...");
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
  console.log("Sections seeded successfully.");

  // Fetch all providers
  const providers = await prisma.provider.findMany();
  console.log(`Found ${providers.length} providers for cost initialization.`);

  for (const prov of providers) {
    // Upsert default health metrics
    await prisma.providerHealthMetrics.upsert({
      where: { providerId: prov.id },
      update: {},
      create: {
        providerId: prov.id,
        latency: 120.0,
        successRate: 100.0,
        failureRate: 0.0,
        healthScore: 100.0
      }
    });

    // Upsert default cost entries
    await prisma.providerCost.upsert({
      where: { providerId: prov.id },
      update: {},
      create: {
        providerId: prov.id,
        costPerTxn: 0.00,
        priorityWeight: 1,
        isActive: true
      }
    });
  }
  console.log("Provider health metrics and costs initialized.");

  // Fetch all operators
  const operators = await prisma.operator.findMany();
  console.log(`Found ${operators.length} operators for mapping sync.`);

  // Auto-build mappings based on existing OperatorMapping table if available
  const existingMappings = await prisma.operatorMapping.findMany({
    where: { isActive: true }
  });

  console.log(`Syncing ${existingMappings.length} existing mappings to OperatorProviderMapping...`);
  for (const em of existingMappings) {
    const operator = operators.find(o => o.name === em.operatorName);
    const provider = providers.find(p => p.code === em.providerCode);

    if (operator && provider) {
      await prisma.operatorProviderMapping.upsert({
        where: {
          operatorId_providerId: {
            operatorId: operator.id,
            providerId: provider.id
          }
        },
        update: {
          providerOperatorCode: em.providerOperatorCode,
          isActive: true
        },
        create: {
          operatorId: operator.id,
          providerId: provider.id,
          providerOperatorCode: em.providerOperatorCode,
          isActive: true
        }
      });
    }
  }
  console.log("Mappings synced successfully.");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
