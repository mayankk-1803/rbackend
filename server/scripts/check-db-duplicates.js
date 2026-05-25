import prisma from "../src/config/prisma.js";

async function main() {
  console.log("[DB_CHECK] Verifying no duplicate providerTxnId values exist in transaction table...");

  try {
    // Query all transactions with a providerTxnId that is not null or empty
    const txns = await prisma.transaction.findMany({
      where: {
        providerTxnId: {
          not: null
        }
      },
      select: {
        id: true,
        providerTxnId: true
      }
    });

    const counts = {};
    const duplicates = [];

    for (const txn of txns) {
      const val = txn.providerTxnId.trim();
      if (val === "" || val === "NONE") continue; // Ignore empty strings or dummy values

      if (counts[val]) {
        counts[val].push(txn.id);
        if (counts[val].length === 2) {
          duplicates.push(val);
        }
      } else {
        counts[val] = [txn.id];
      }
    }

    if (duplicates.length > 0) {
      console.error("[CRITICAL ERROR] Duplicate providerTxnId values found!");
      for (const dup of duplicates) {
        console.error(`providerTxnId: "${dup}" is used by transaction IDs: ${counts[dup].join(", ")}`);
      }
      process.exit(1);
    } else {
      console.log("[SUCCESS] No duplicate providerTxnId values found. Safe to apply index!");
      process.exit(0);
    }
  } catch (err) {
    console.error("[DB_CHECK] Error running duplicate check:", err.message);
    process.exit(1);
  }
}

main();
