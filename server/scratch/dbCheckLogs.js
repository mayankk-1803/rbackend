import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function showLogs() {
  const logs = await prisma.auditLog.findMany({
    where: {
      action: { in: ["PACKAGE_ASSIGN", "SLAB_ASSIGN"] }
    },
    orderBy: { createdAt: "desc" },
    take: 4,
    select: {
      id: true,
      action: true,
      entity: true,
      entityId: true,
      details: true,
      createdAt: true
    }
  });
  console.log(JSON.stringify(logs, null, 2));
}

showLogs()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
