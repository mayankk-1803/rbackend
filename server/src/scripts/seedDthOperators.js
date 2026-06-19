import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const dthOperators = [
  {
    name: "VIDEOCON D2H",
    code: "6",
    category: "DTH"
  },
  {
    name: "AIRTEL DTH",
    code: "7",
    category: "DTH"
  },
  {
    name: "DISH TV",
    code: "8",
    category: "DTH"
  },
  {
    name: "SUN DIRECT",
    code: "9",
    category: "DTH"
  },
  {
    name: "TATA SKY",
    code: "10",
    category: "DTH"
  }
];

async function seed() {
  console.log("Seeding DTH operators...");
  try {
    for (const op of dthOperators) {
      const codesJson = JSON.stringify({
        code: op.code,
        category: op.category,
        circleRequired: false,
        description: `Direct-To-Home recharge for ${op.name}`
      });

      const upserted = await prisma.operator.upsert({
        where: { name: op.name },
        update: {
          codes: codesJson,
          active: true
        },
        create: {
          name: op.name,
          codes: codesJson,
          active: true
        }
      });
      console.log(`Upserted operator: ${upserted.name} -> ID: ${upserted.id}`);
    }
    console.log("DTH operators seeded successfully!");
  } catch (err) {
    console.error("Failed to seed DTH operators:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
