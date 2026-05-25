import prisma from "../src/config/prisma.js";

async function testLedgerConsistency() {
  console.log("=== STARTING LEDGER CONSISTENCY TEST ===");
  const users = await prisma.user.findMany({
    include: { wallet: true }
  });

  let inconsistenciesFound = 0;

  for (const user of users) {
    if (!user.wallet) continue;

    // Fiat balance check
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { userId: user.id }
    });

    let calculatedFiat = 0;
    for (const entry of ledgerEntries) {
      if (entry.type.includes("CREDIT")) {
        calculatedFiat += Number(entry.amount);
      } else if (entry.type.includes("DEBIT")) {
        calculatedFiat -= Number(entry.amount);
      }
    }

    if (calculatedFiat !== Number(user.wallet.balance)) {
      console.error(`[MISMATCH] User ${user.id} - Wallet Balance: ${user.wallet.balance}, Ledger Sum: ${calculatedFiat}`);
      inconsistenciesFound++;
    }

    // Coin balance check
    const coinEntries = await prisma.coinTransaction.findMany({
      where: { userId: user.id }
    });

    let calculatedCoins = 0;
    for (const entry of coinEntries) {
      if (entry.type === "EARNED") {
        calculatedCoins += entry.amount;
      } else if (entry.type === "REDEEMED") {
        calculatedCoins -= entry.amount;
      }
    }

    if (calculatedCoins !== user.wallet.coinBalance) {
      console.error(`[COIN_MISMATCH] User ${user.id} - Wallet Coins: ${user.wallet.coinBalance}, Ledger Sum: ${calculatedCoins}`);
      inconsistenciesFound++;
    }
  }

  if (inconsistenciesFound === 0) {
    console.log("[SUCCESS] All wallets match ledger history perfectly.");
  } else {
    console.error(`[FAILED] Found ${inconsistenciesFound} inconsistencies.`);
  }
}

testLedgerConsistency()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
