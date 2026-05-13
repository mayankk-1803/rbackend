import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function seed() {
  try {
    const apibox = await prisma.provider.upsert({
      where: { code: 'APIBOX' },
      update: {
        isActive: true,
        priority: 100,
        name: 'Apibox Recharge'
      },
      create: {
        code: 'APIBOX',
        name: 'Apibox Recharge',
        baseUrl: 'https://Apibox.co.in/Api/Service',
        apiKey: process.env.APIBOX_TOKEN || 'MISSING',
        isActive: true,
        priority: 100
      }
    });

    console.log("Upserted Apibox provider:", apibox);
    
    // Deactivate old providers if any
    await prisma.provider.updateMany({
      where: { code: { notIn: ['APIBOX', 'NEXGATE'] } },
      data: { isActive: false }
    });
    
    console.log("Deactivated legacy providers.");
  } catch (err) {
    console.error("Seeding failed:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
