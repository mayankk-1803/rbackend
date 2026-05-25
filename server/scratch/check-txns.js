import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const txns = await prisma.transaction.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' }
    });
    console.log("Last 10 transactions:");
    txns.forEach(t => {
      console.log(`ID: ${t.id} | Status: ${t.status} | Provider: ${t.provider} | ProviderRefId: ${t.providerRefId} | ProviderTxnId: ${t.providerTxnId} | Type: ${t.type} | Mobile: ${t.mobile}`);
    });
  } catch (err) {
    console.error("Error fetching transactions:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
