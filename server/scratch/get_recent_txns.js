import prisma from "../src/config/prisma.js";

async function main() {
  try {
    const txns = await prisma.transaction.findMany({
      orderBy: { id: 'desc' },
      take: 20,
      select: {
        id: true,
        operator: true,
        mobile: true,
        amount: true,
        status: true,
        providerRef: true,
        providerTxnId: true
      }
    });
    console.log("RECENT_TRANSACTIONS_START");
    console.log(JSON.stringify(txns, null, 2));
    console.log("RECENT_TRANSACTIONS_END");
  } catch (err) {
    console.error("Failed to query transactions:", err);
  } finally {
    await prisma.$disconnect();
  }
}
main();
