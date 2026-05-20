import dotenv from "dotenv";
import prisma from "../src/config/prisma.js";
import { Prisma } from "@prisma/client";
import { getProviderService } from "../src/services/providers/providerFactory.js";
import { getProviderOperatorCode, normalizeOperator } from "../src/config/operators.js";
import { normalizeTransactionStatus } from "../src/utils/statusHelper.js";
import { recordFinancialEntry } from "../src/services/ledgerService.js";
import eventBus from "../src/config/eventBus.js";
import { logTransactionEvent, TXN_EVENTS } from "../src/services/transactionEventService.js";
import { redisClient } from "../src/config/redis.js";

// Load environment variables
dotenv.config();

// Stub Redis client to avoid ECONNREFUSED during programmatic tracing
redisClient.get = async () => null;
redisClient.set = async () => "OK";
redisClient.setex = async () => "OK";
redisClient.del = async () => 1;
redisClient.incr = async () => 1;
redisClient.expire = async () => 1;

// Stub EventBus emits to inspect socket/event notifications
const emittedEvents = [];
eventBus.emit = (event, data) => {
  console.log(`[SOCKET_EMIT] Event: ${event} | Data:`, JSON.stringify(data));
  emittedEvents.push({ event, data });
};

const TEST_USER_ID = 4; // Using Chetan (positive balance)
const MOBILE = "9258337170";
const AMOUNT = 10;
const OPERATOR_CODE = "5"; // JIO

async function runScenarioA() {
  console.log("\n====================================================");
  console.log("SCENARIO A: Real Provider Recharge Attempt (Whitelisted IP Failure Check)");
  console.log("====================================================");

  // 1. Check Wallet Before
  const user = await prisma.user.findUnique({ where: { id: TEST_USER_ID }, include: { wallet: true } });
  if (!user || !user.wallet) {
    console.error("Test user not found");
    return;
  }
  const balanceBefore = user.wallet.balance;
  console.log(`[WALLET_BEFORE] User: ${TEST_USER_ID} | Balance: ${balanceBefore}`);

  // 2. Perform Wallet Debit & Transaction Shell Creation
  console.log(`[WALLET_DEBIT] Debiting User: ${TEST_USER_ID} | Amount: ${AMOUNT}`);
  const result = await prisma.$transaction(async (tx) => {
    const updatedWallet = await tx.wallet.update({
      where: { userId: TEST_USER_ID },
      data: { balance: { decrement: AMOUNT } }
    });

    const transaction = await tx.transaction.create({
      data: {
        userId: TEST_USER_ID,
        amount: new Prisma.Decimal(AMOUNT),
        type: "RECHARGE",
        status: "PENDING",
        direction: "DEBIT",
        mobile: MOBILE,
        operator: normalizeOperator(OPERATOR_CODE),
        provider: "APIBOX",
        idempotencyKey: `trace_a_${Date.now()}`,
        balanceAfter: updatedWallet.balance
      }
    });
    return { transaction, updatedWallet };
  });

  const txnId = result.transaction.id;
  const balanceAfter = result.updatedWallet.balance;
  console.log(`[WALLET_AFTER] User: ${TEST_USER_ID} | New Balance: ${balanceAfter}`);

  // 3. Provider Resolution & API Request
  console.log(`[RECHARGE_INIT] Txn: ${txnId} | Mobile: ${MOBILE} | Amount: ${AMOUNT}`);
  const providerCode = "APIBOX";
  console.log(`[PROVIDER_SELECTED] Provider: ${providerCode} for Txn #${txnId}`);

  const providerService = getProviderService(providerCode);
  const providerOperatorCode = getProviderOperatorCode(normalizeOperator(OPERATOR_CODE));

  console.log(`[PROVIDER_REQUEST] Provider: ${providerCode} | TxnId: ${txnId} | Mobile: ${MOBILE} | Amount: ${AMOUNT} | OpCode: ${providerOperatorCode}`);
  
  let providerResponse;
  try {
    providerResponse = await providerService.recharge({
      mobile: MOBILE,
      amount: AMOUNT,
      operator: providerOperatorCode,
      txnId
    });
    console.log(`[PROVIDER_RESPONSE] Provider: ${providerCode} | TxnId: ${txnId} | Status: ${providerResponse.status} | Msg: ${providerResponse.message}`);
  } catch (error) {
    console.log(`[PROVIDER_RESPONSE] Failed with error: ${error.message}`);
    providerResponse = { status: "FAILED", message: error.message };
  }

  // 4. Status Mapping
  const mappedStatus = normalizeTransactionStatus(providerResponse.status);
  console.log(`[STATUS_MAPPED] Provider Status: ${providerResponse.status} mapped to normalized: ${mappedStatus}`);

  // 5. DB Status Update & Refund Trigger on failure
  if (mappedStatus === "failed") {
    console.log(`[DB_UPDATED] Marking TXN:${txnId} as FAILED`);
    await prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id: txnId },
        data: { status: "FAILED", refundStatus: "refunded", refundedAt: new Date() }
      });

      // Wallet Refund
      console.log(`[WALLET_UPDATED] Refunding amount ${AMOUNT} to User:${TEST_USER_ID} for FAILED TXN:${txnId}`);
      await recordFinancialEntry({
        userId: TEST_USER_ID,
        amount: AMOUNT,
        type: 'REFUND_CREDIT',
        transactionId: txnId,
        description: `Refund: ${providerResponse.message.slice(0, 50)}`,
        tx
      });
    });

    await logTransactionEvent(txnId, TXN_EVENTS.FAILED, { reason: providerResponse.message });
    eventBus.emit("recharge_failed", { txnId, status: "failed", reason: providerResponse.message });
  }

  // Verify wallet balance restored
  const finalUser = await prisma.user.findUnique({ where: { id: TEST_USER_ID }, include: { wallet: true } });
  console.log(`[VERIFICATION] Final User Balance: ${finalUser.wallet.balance} (Expected to match balanceBefore: ${balanceBefore})`);
}

async function runScenarioB() {
  console.log("\n====================================================");
  console.log("SCENARIO B: Simulated Success Flow (Mock APIBOX Success Response)");
  console.log("====================================================");

  // 1. Check Wallet Before
  const user = await prisma.user.findUnique({ where: { id: TEST_USER_ID }, include: { wallet: true } });
  const balanceBefore = user.wallet.balance;
  console.log(`[WALLET_BEFORE] User: ${TEST_USER_ID} | Balance: ${balanceBefore}`);

  // 2. Perform Wallet Debit & Transaction Shell Creation
  console.log(`[WALLET_DEBIT] Debiting User: ${TEST_USER_ID} | Amount: ${AMOUNT}`);
  const result = await prisma.$transaction(async (tx) => {
    const updatedWallet = await tx.wallet.update({
      where: { userId: TEST_USER_ID },
      data: { balance: { decrement: AMOUNT } }
    });

    const transaction = await tx.transaction.create({
      data: {
        userId: TEST_USER_ID,
        amount: new Prisma.Decimal(AMOUNT),
        type: "RECHARGE",
        status: "PENDING",
        direction: "DEBIT",
        mobile: MOBILE,
        operator: normalizeOperator(OPERATOR_CODE),
        provider: "APIBOX",
        idempotencyKey: `trace_b_${Date.now()}`,
        balanceAfter: updatedWallet.balance
      }
    });
    return { transaction, updatedWallet };
  });

  const txnId = result.transaction.id;
  const balanceAfter = result.updatedWallet.balance;
  console.log(`[WALLET_AFTER] User: ${TEST_USER_ID} | New Balance: ${balanceAfter}`);

  // 3. Provider Resolution & API Request
  console.log(`[RECHARGE_INIT] Txn: ${txnId} | Mobile: ${MOBILE} | Amount: ${AMOUNT}`);
  const providerCode = "APIBOX";
  console.log(`[PROVIDER_SELECTED] Provider: ${providerCode} for Txn #${txnId}`);

  const providerOperatorCode = getProviderOperatorCode(normalizeOperator(OPERATOR_CODE));

  console.log(`[PROVIDER_REQUEST] Provider: ${providerCode} | TxnId: ${txnId} | Mobile: ${MOBILE} | Amount: ${AMOUNT} | OpCode: ${providerOperatorCode}`);
  
  // Mock APIBOX success response
  const providerResponse = {
    status: "SUCCESS",
    providerTxnId: "MOCK_OPTXN_123456",
    message: "Recharge Successful"
  };
  console.log(`[PROVIDER_RESPONSE] Provider: ${providerCode} | TxnId: ${txnId} | Status: ${providerResponse.status} | Msg: ${providerResponse.message}`);

  // 4. Status Mapping
  const mappedStatus = normalizeTransactionStatus(providerResponse.status);
  console.log(`[STATUS_MAPPED] Provider Status: ${providerResponse.status} mapped to normalized: ${mappedStatus}`);

  // 5. DB Status Update on Success
  if (mappedStatus === "success") {
    console.log(`[DB_UPDATED] Marking TXN:${txnId} as SUCCESS`);
    const updatedTxn = await prisma.transaction.update({
      where: { id: txnId },
      data: { status: "SUCCESS", providerTxnId: providerResponse.providerTxnId }
    });

    await logTransactionEvent(txnId, TXN_EVENTS.SUCCESS, { source: "test_trace" });
    eventBus.emit("transaction_updated", {
      transactionId: txnId,
      status: "SUCCESS",
      transaction: updatedTxn,
      amount: AMOUNT,
      providerTxnId: providerResponse.providerTxnId,
      userId: TEST_USER_ID
    });
  }

  // Verify wallet balance stayed debited
  const finalUser = await prisma.user.findUnique({ where: { id: TEST_USER_ID }, include: { wallet: true } });
  console.log(`[VERIFICATION] Final User Balance: ${finalUser.wallet.balance} (Expected to match balanceAfter: ${balanceAfter})`);
}

async function runScenarioC() {
  console.log("\n====================================================");
  console.log("SCENARIO C: Simulated Reconciliation Flow (PENDING -> SUCCESS)");
  console.log("====================================================");

  // 1. Check Wallet Before
  const user = await prisma.user.findUnique({ where: { id: TEST_USER_ID }, include: { wallet: true } });
  const balanceBefore = user.wallet.balance;
  console.log(`[WALLET_BEFORE] User: ${TEST_USER_ID} | Balance: ${balanceBefore}`);

  // 2. Perform Wallet Debit & Transaction Shell Creation
  console.log(`[WALLET_DEBIT] Debiting User: ${TEST_USER_ID} | Amount: ${AMOUNT}`);
  const result = await prisma.$transaction(async (tx) => {
    const updatedWallet = await tx.wallet.update({
      where: { userId: TEST_USER_ID },
      data: { balance: { decrement: AMOUNT } }
    });

    const transaction = await tx.transaction.create({
      data: {
        userId: TEST_USER_ID,
        amount: new Prisma.Decimal(AMOUNT),
        type: "RECHARGE",
        status: "PENDING",
        direction: "DEBIT",
        mobile: MOBILE,
        operator: normalizeOperator(OPERATOR_CODE),
        provider: "APIBOX",
        idempotencyKey: `trace_c_${Date.now()}`,
        balanceAfter: updatedWallet.balance
      }
    });
    return { transaction, updatedWallet };
  });

  const txnId = result.transaction.id;
  const balanceAfter = result.updatedWallet.balance;
  console.log(`[WALLET_AFTER] User: ${TEST_USER_ID} | New Balance: ${balanceAfter}`);

  // 3. Provider Resolution & API Request
  console.log(`[RECHARGE_INIT] Txn: ${txnId} | Mobile: ${MOBILE} | Amount: ${AMOUNT}`);
  const providerCode = "APIBOX";
  console.log(`[PROVIDER_SELECTED] Provider: ${providerCode} for Txn #${txnId}`);

  const providerOperatorCode = getProviderOperatorCode(normalizeOperator(OPERATOR_CODE));

  console.log(`[PROVIDER_REQUEST] Provider: ${providerCode} | TxnId: ${txnId} | Mobile: ${MOBILE} | Amount: ${AMOUNT} | OpCode: ${providerOperatorCode}`);
  
  // Mock APIBOX pending response
  const providerResponse = {
    status: "PENDING",
    providerTxnId: "MOCK_OPTXN_PENDING",
    message: "Recharge Accepted - Awaiting operator status"
  };
  console.log(`[PROVIDER_RESPONSE] Provider: ${providerCode} | TxnId: ${txnId} | Status: ${providerResponse.status} | Msg: ${providerResponse.message}`);

  // 4. Status Mapping
  const mappedStatus = normalizeTransactionStatus(providerResponse.status);
  console.log(`[STATUS_MAPPED] Provider Status: ${providerResponse.status} mapped to normalized: ${mappedStatus}`);

  // 5. DB status kept PENDING
  if (mappedStatus === "pending") {
    console.log(`[DB_UPDATED] Keeping TXN:${txnId} as PENDING`);
    await prisma.transaction.update({
      where: { id: txnId },
      data: { status: "PENDING", providerTxnId: providerResponse.providerTxnId }
    });
  }

  // 6. Reconciliation Sync simulation
  console.log(`[STATUS_CHECK] Running reconciliation check for pending TXN:${txnId}`);
  
  // Simulate status check returns SUCCESS
  const reconResponse = {
    status: "SUCCESS",
    operatorTxnId: "RECON_OPTXN_998877",
    message: "Recharge success confirmed"
  };
  console.log(`[STATUS_RESPONSE] Status check response for TXN:${txnId}:`, JSON.stringify(reconResponse));

  const reconMappedStatus = normalizeTransactionStatus(reconResponse.status);
  console.log(`[STATUS_MAPPED] Reconciliation status mapped to: ${reconMappedStatus} for TXN:${txnId}`);

  if (reconMappedStatus === "success") {
    console.log(`[DB_UPDATED] Marking TXN:${txnId} as SUCCESS via reconciliation`);
    const updatedTxn = await prisma.transaction.update({
      where: { id: txnId },
      data: { status: "SUCCESS", providerTxnId: reconResponse.operatorTxnId }
    });

    await logTransactionEvent(txnId, TXN_EVENTS.SUCCESS, { source: "reconciliation" });
    eventBus.emit("transaction_updated", {
      transactionId: txnId,
      status: "SUCCESS",
      transaction: updatedTxn,
      amount: AMOUNT,
      providerTxnId: updatedTxn.providerTxnId,
      userId: TEST_USER_ID
    });
  }
}

async function run() {
  try {
    await runScenarioA();
    await runScenarioB();
    await runScenarioC();
  } catch (error) {
    console.error("Trace failed with error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
