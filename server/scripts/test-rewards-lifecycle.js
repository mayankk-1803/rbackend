import prisma from "../src/config/prisma.js";
import { issueReward } from "../src/services/rewardEngine.js";

async function main() {
  console.log("=== STARTING REWARDS LIFECYCLE TEST ===");
  try {
    // 1. Get or create test user
    const email = "testuser@dizipay.com";
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        name: "Test User",
        email,
        password: "hashedpassword123",
        role: "USER"
      }
    });

    // 2. Ensure wallet exists with zero coins and standard balance
    const wallet = await prisma.wallet.upsert({
      where: { userId: user.id },
      update: { balance: 1000.0, coinBalance: 0 },
      create: {
        userId: user.id,
        balance: 1000.0,
        coinBalance: 0
      }
    });

    // 3. Ensure cashbackSettings exist and are enabled
    const settings = await prisma.cashbackSettings.upsert({
      where: { id: 1 },
      update: {
        cashbackEnabled: true,
        globalPercentage: 5,
        minRechargeAmount: 10,
        maxCashbackPerRecharge: 100,
        dailyCashbackLimit: 500,
        rewardMode: "PERCENTAGE"
      },
      create: {
        id: 1,
        cashbackEnabled: true,
        globalPercentage: 5,
        minRechargeAmount: 10,
        maxCashbackPerRecharge: 100,
        dailyCashbackLimit: 500,
        rewardMode: "PERCENTAGE"
      }
    });

    // Clean up any existing txns/coins for clean run
    await prisma.coinTransaction.deleteMany({ where: { userId: user.id } });
    await prisma.transaction.deleteMany({ where: { userId: user.id } });
    await prisma.ledgerEntry.deleteMany({ where: { userId: user.id } });

    // Reset wallet again
    await prisma.wallet.update({
      where: { userId: user.id },
      data: { balance: 1000.0, coinBalance: 0 }
    });

    // 4. Create a successful recharge transaction
    const rechargeTx = await prisma.transaction.create({
      data: {
        userId: user.id,
        amount: 100.0,
        type: "RECHARGE",
        status: "SUCCESS", // Must be SUCCESS to award rewards
        direction: "DEBIT",
        mobile: "9876543210",
        operator: "Jio"
      }
    });

    console.log(`Created successful recharge txn: #${rechargeTx.id} with amount ₹${rechargeTx.amount}`);

    // 5. Trigger Reward Engine
    const result = await issueReward(rechargeTx.id);
    console.log("issueReward result:", result);

    // 6. Verify database updates
    const updatedTx = await prisma.transaction.findUnique({
      where: { id: rechargeTx.id }
    });

    const updatedWallet = await prisma.wallet.findUnique({
      where: { userId: user.id }
    });

    const coinTxns = await prisma.coinTransaction.findMany({
      where: { userId: user.id }
    });

    const cashbackTxns = await prisma.transaction.findMany({
      where: { userId: user.id, type: "CASHBACK" }
    });

    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { userId: user.id }
    });

    console.log("\n=== VERIFICATION ===");
    console.log("Original Recharge Tx Updated:", {
      rewardProcessed: updatedTx.rewardProcessed,
      rewardProcessedAt: updatedTx.rewardProcessedAt,
      rewardClaimed: updatedTx.rewardClaimed,
      cashback: updatedTx.cashback.toNumber(),
      cashbackCoins: updatedTx.cashbackCoins
    });

    console.log("Wallet Balance:", updatedWallet.balance.toNumber(), "(Expected: 1005)");
    console.log("Wallet Coins:", updatedWallet.coinBalance, "(Expected: 1 or 2)");

    console.log("Coin Transactions Count:", coinTxns.length, "(Expected: 1)");
    if (coinTxns[0]) {
      console.log("Coin Transaction Details:", {
        amount: coinTxns[0].amount,
        type: coinTxns[0].type,
        rechargeTxnId: coinTxns[0].rechargeTxnId,
        sourceTransactionId: coinTxns[0].sourceTransactionId
      });
    }

    console.log("Cashback Transaction Logs Count:", cashbackTxns.length, "(Expected: 1)");
    if (cashbackTxns[0]) {
      console.log("Cashback Transaction Details:", {
        amount: cashbackTxns[0].amount.toNumber(),
        type: cashbackTxns[0].type,
        status: cashbackTxns[0].status,
        direction: cashbackTxns[0].direction,
        balanceAfter: cashbackTxns[0].balanceAfter?.toNumber()
      });
    }

    console.log("Ledger Entries Count:", ledgerEntries.length, "(Expected: 1 for CASHBACK_CREDIT)");
    if (ledgerEntries[0]) {
      console.log("Ledger Entry Details:", {
        amount: ledgerEntries[0].amount.toNumber(),
        type: ledgerEntries[0].type,
        balanceBefore: ledgerEntries[0].balanceBefore.toNumber(),
        balanceAfter: ledgerEntries[0].balanceAfter.toNumber()
      });
    }

    // Assertions
    if (
      updatedTx.rewardProcessed === true &&
      updatedTx.rewardClaimed === true &&
      updatedWallet.balance.toNumber() === 1005.0 &&
      (updatedWallet.coinBalance === 1 || updatedWallet.coinBalance === 2) &&
      coinTxns.length === 1 &&
      cashbackTxns.length === 1 &&
      ledgerEntries.length === 1
    ) {
      console.log("\n>>> SUCCESS: ALL REWARD LIFECYCLE TESTS PASSED! <<<");
    } else {
      console.error("\n>>> FAILURE: VERIFICATION DISCREPANCIES DETECTED! <<<");
    }
  } catch (err) {
    console.error("Test Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
