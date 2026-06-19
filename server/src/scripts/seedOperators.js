import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const operators = [
  // Mobile Operators
  {
    name: "AIRTEL",
    code: "1",
    category: "Mobile",
    circleRequired: true,
    description: "Prepaid mobile recharge for AIRTEL"
  },
  {
    name: "VI",
    code: "2",
    category: "Mobile",
    circleRequired: true,
    description: "Prepaid mobile recharge for VI"
  },
  {
    name: "BSNL Topup",
    code: "3",
    category: "Mobile",
    circleRequired: true,
    description: "Prepaid mobile recharge for BSNL Topup"
  },
  {
    name: "BSNL Special",
    code: "4",
    category: "Mobile",
    circleRequired: true,
    description: "Prepaid mobile recharge for BSNL Special"
  },
  {
    name: "JIO",
    code: "5",
    category: "Mobile",
    circleRequired: true,
    description: "Prepaid mobile recharge for JIO"
  },
  // DTH Operators
  {
    name: "VIDEOCON D2H",
    code: "6",
    category: "DTH",
    circleRequired: false,
    description: "Direct-To-Home recharge for VIDEOCON D2H"
  },
  {
    name: "AIRTEL DTH",
    code: "7",
    category: "DTH",
    circleRequired: false,
    description: "Direct-To-Home recharge for AIRTEL DTH"
  },
  {
    name: "DISH TV",
    code: "8",
    category: "DTH",
    circleRequired: false,
    description: "Direct-To-Home recharge for DISH TV"
  },
  {
    name: "SUN DIRECT",
    code: "9",
    category: "DTH",
    circleRequired: false,
    description: "Direct-To-Home recharge for SUN DIRECT"
  },
  {
    name: "TATA SKY",
    code: "10",
    category: "DTH",
    circleRequired: false,
    description: "Direct-To-Home recharge for TATA SKY"
  }
];

async function seed() {
  console.log("Seeding all operators...");
  try {
    for (const op of operators) {
      const codesJson = JSON.stringify({
        code: op.code,
        category: op.category,
        circleRequired: op.circleRequired,
        description: op.description
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
    console.log("All operators seeded successfully!");
  } catch (err) {
    console.error("Failed to seed operators:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
