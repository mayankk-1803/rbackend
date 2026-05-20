import prisma from "../src/config/prisma.js";
import { reconcilePendingTransactions } from "../src/services/reconciliationService.js";

async function main() {
  try {
    console.log("Running reconciliation manually...");
    await reconcilePendingTransactions();
    console.log("Reconciliation finished!");
  } catch (err) {
    console.error("Critical error running reconciliation:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
