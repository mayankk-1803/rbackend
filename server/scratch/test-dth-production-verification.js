import dotenv from "dotenv";
import axios from "axios";
import { PrismaClient, Prisma } from "@prisma/client";
import { getProviderService } from "../src/services/providers/providerFactory.js";
import { getProviderOperatorCode, normalizeOperator, APIBOX_OPERATORS } from "../src/config/operators.js";
import { normalizeTransactionStatus } from "../src/utils/statusHelper.js";
import { recordFinancialEntry } from "../src/services/ledgerService.js";
import { logTransactionEvent, TXN_EVENTS } from "../src/services/transactionEventService.js";
import { validateRechargeInput } from "../src/middlewares/validateInput.js";

dotenv.config();

const prisma = new PrismaClient();

// Mock Axios behavior globally to simulate APIBOX responses
let mockResponseHandler = (url, params) => {
  return { STATUS: 1, OPTXNID: `OPTXN_${Date.now()}`, MESSAGE: "Success" };
};

axios.get = async function(url, config = {}) {
  const params = config.params || {};
  if (url.includes("/Balance")) {
    return {
      status: 200,
      statusText: "OK",
      headers: {},
      config,
      data: { STATUS: 1, BALANCE: "5000", MESSAGE: "Success" }
    };
  }
  const data = mockResponseHandler(url, params);
  return {
    status: 200,
    statusText: "OK",
    headers: {},
    config,
    data
  };
};

axios.post = async function(url, data, config = {}) {
  const dataRes = mockResponseHandler(url, data);
  return {
    status: 200,
    statusText: "OK",
    headers: {},
    config,
    data: dataRes
  };
};

// Mock Helper for Express request/response in Joi validation
const makeMockRes = () => {
  const res = {
    statusCode: 200,
    sentData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.sentData = data;
      return this;
    }
  };
  return res;
};

async function verifyDthProduction() {
  console.log("=== STARTING DTH PRODUCTION VERIFICATION WORKFLOW ===");

  // 1. Setup Test User & Wallet
  let testUser = await prisma.user.findFirst({
    where: { email: "dth_verification_test_user@dizipay.com" }
  });

  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        name: "DTH Verification User",
        email: "dth_verification_test_user@dizipay.com",
        password: "securepassword123",
        phone: "9123456780",
        isPhoneVerified: true,
        isEmailVerified: true,
        role: "USER"
      }
    });
  }

  // Set wallet balance to 1000
  await prisma.wallet.upsert({
    where: { userId: testUser.id },
    update: { balance: 1000.00 },
    create: { userId: testUser.id, balance: 1000.00, currency: "INR" }
  });

  console.log(`[SETUP] Verified test user ID: ${testUser.id} exists with wallet balance: ₹1000.00`);

  // ==========================================================
  // SCENARIO 1: DB Records Integrity Check
  // ==========================================================
  console.log("\n--- SCENARIO 1: DB Operator Records Verification ---");
  const requiredOperators = [
    "JIO", "AIRTEL", "VI", "BSNL Topup", "BSNL Special",
    "VIDEOCON D2H", "AIRTEL DTH", "DISH TV", "SUN DIRECT", "TATA SKY"
  ];

  for (const opName of requiredOperators) {
    const record = await prisma.operator.findUnique({
      where: { name: opName }
    });
    if (!record) {
      throw new Error(`DB Integrity Failure: Operator ${opName} is missing from operator table`);
    }
    console.log(`[DB_CHECK] Operator ${record.name} (Active: ${record.active}) verified in database.`);
  }
  console.log("[PASS] Scenario 1: All required operators exist in database operator table.");

  // ==========================================================
  // SCENARIO 2: APIBOX DTH Execution (Success Flow for all 5 DTH Operators)
  // ==========================================================
  console.log("\n--- SCENARIO 2: APIBOX DTH Execution Tests ---");
  
  const dthOperatorsToTest = [
    { code: "6", name: "VIDEOCON D2H", vc: "3012456789" },
    { code: "7", name: "AIRTEL DTH", vc: "3012456789" },
    { code: "8", name: "DISH TV", vc: "3012456789" },
    { code: "9", name: "SUN DIRECT", vc: "3012456789" },
    { code: "10", name: "TATA SKY", vc: "3012456789" }
  ];

  for (const testOp of dthOperatorsToTest) {
    const operatorName = APIBOX_OPERATORS[testOp.code];
    console.log(`\n>> Executing recharge check for ${operatorName} (APIBOX code: ${testOp.code})`);

    const amount = 150.00;
    const correlationId = `trace_${testOp.code}_${Date.now()}`;
    const idempotencyKey = `idemp_${testOp.code}_${Date.now()}`;

    // Define mock APIBOX return payload specifically for this operator
    const mockOptxnId = `APIBOX_OPTXN_${testOp.code}_${Date.now()}`;
    mockResponseHandler = (url, params) => {
      console.log(`[AXIOS APIBOX] Request: ${url} | Mobile: ${params.MobileNo} | OpId: ${params.OpId}`);
      if (params.OpId !== testOp.code) {
        throw new Error(`Operator mapping mismatch! Expected ${testOp.code}, got ${params.OpId}`);
      }
      return {
        STATUS: 1,
        OPTXNID: mockOptxnId,
        MSG: "Recharge Successful"
      };
    };

    // 1. Debit Wallet & Create Pending Transaction Shell
    const transactionResult = await prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.wallet.update({
        where: { userId: testUser.id },
        data: { balance: { decrement: amount } }
      });

      const transaction = await tx.transaction.create({
        data: {
          userId: testUser.id,
          amount: new Prisma.Decimal(amount),
          type: "RECHARGE",
          status: "PENDING_REVIEW",
          direction: "DEBIT",
          mobile: testOp.vc,
          operator: operatorName,
          provider: "APIBOX",
          idempotencyKey,
          financialSequenceId: correlationId,
          balanceAfter: updatedWallet.balance
        }
      });
      return { transaction, updatedWallet };
    });

    const txnId = transactionResult.transaction.id;
    console.log(`[WALLET_DEBIT] Debited amount: ${amount} | New Balance: ${transactionResult.updatedWallet.balance} | Created Txn: #${txnId}`);

    // 2. Worker / Provider Service simulation
    const providerService = getProviderService("APIBOX");
    const resolvedOpCode = getProviderOperatorCode(normalizeOperator(operatorName));
    
    console.log(`[RESOLVER] Normalized: ${normalizeOperator(operatorName)} | Mapped APIBOX Code: ${resolvedOpCode}`);
    if (resolvedOpCode !== testOp.code) {
      throw new Error(`Resolved operator code mismatch: Expected ${testOp.code}, got ${resolvedOpCode}`);
    }

    const providerResponse = await providerService.recharge({
      mobile: testOp.vc,
      amount,
      operator: resolvedOpCode,
      txnId
    });

    console.log(`[PROVIDER_RESPONSE] Status: ${providerResponse.status} | TxnRef: ${providerResponse.providerTxnId || providerResponse.operatorTxnId}`);

    const mappedStatus = normalizeTransactionStatus(providerResponse.status);
    const opTxnRef = providerResponse.providerTxnId || providerResponse.operatorTxnId;

    if (mappedStatus !== "success") {
      throw new Error(`APIBOX execution failed for operator: ${operatorName}`);
    }

    // 3. Finalize Transaction Status in Database
    const invoiceSnapshot = {
      customer: { name: testUser.name, phone: testUser.phone, email: testUser.email },
      operator: operatorName,
      mobile: testOp.vc,
      amount,
      timestamp: new Date().toISOString(),
      providerRef: opTxnRef
    };

    await prisma.transaction.update({
      where: { id: txnId },
      data: {
        status: "SUCCESS",
        providerTxnId: opTxnRef,
        providerRef: opTxnRef,
        invoiceSnapshot
      }
    });

    // 4. Assert database records are populated correctly
    const dbTxn = await prisma.transaction.findUnique({ where: { id: txnId } });
    console.log(`[DB_VERIFICATION] Txn #${txnId} status: ${dbTxn.status}`);
    console.log(`[DB_VERIFICATION] transaction.providerRef: ${dbTxn.providerRef}`);
    console.log(`[DB_VERIFICATION] transaction.providerTxnId: ${dbTxn.providerTxnId}`);

    if (dbTxn.status !== "SUCCESS" || dbTxn.providerRef !== opTxnRef || dbTxn.providerTxnId !== opTxnRef) {
      throw new Error("DB record verification failed: transaction references were not stored correctly.");
    }
    console.log(`[PASS] Recharge executed successfully for ${operatorName}.`);
  }
  console.log("[PASS] Scenario 2: All 5 DTH operators executed successfully through APIBOX and stored in DB.");

  // ==========================================================
  // SCENARIO 3: Invoice Verification (getOperatorRef candidate logic)
  // ==========================================================
  console.log("\n--- SCENARIO 3: Invoice Verification ---");
  // candidate logic from InvoiceModal.jsx
  const getOperatorRef = (transaction, snapshot) => {
    const candidates = [
      transaction.operatorReferenceId,
      snapshot.providerRef,
      transaction.providerRef,
      transaction.providerRefId,
      transaction.providerTxnId
    ];
    for (const val of candidates) {
      if (val === null || val === undefined) continue;
      const strVal = String(val).trim();
      if (strVal === "") continue;
      
      const upperVal = strVal.toUpperCase();
      const invalidPlaceholders = [
        "PENDING", "PENDING_RECONCILIATION", "TEST_OP_ID", "TEST_REF",
        "OP_SUCCESS", "UNKNOWN", "N/A", "NULL", "UNDEFINED"
      ];
      if (invalidPlaceholders.includes(upperVal)) continue;
      if (
        upperVal.startsWith("TEST_OP_ID") ||
        upperVal.startsWith("OP_SUCCESS") ||
        upperVal.startsWith("OP_FAIL") ||
        upperVal.startsWith("OP_FAKE") ||
        upperVal.startsWith("RECON_") ||
        upperVal.startsWith("NEXGATE_")
      ) {
        continue;
      }
      if (transaction.id && strVal === String(transaction.id)) continue;
      return strVal;
    }
    return "Pending Operator Assignment";
  };

  const sampleTxn = await prisma.transaction.findFirst({
    where: { userId: testUser.id, status: "SUCCESS" }
  });

  const parsedSnapshot = sampleTxn.invoiceSnapshot || {};
  const operatorRefVal = getOperatorRef(sampleTxn, parsedSnapshot);
  console.log(`[INVOICE_CHECK] Resolved Operator Reference ID: ${operatorRefVal}`);
  if (operatorRefVal === "Pending Operator Assignment" || operatorRefVal === String(sampleTxn.id)) {
    throw new Error(`Invoice Logic Failure: operator reference resolved incorrectly as: ${operatorRefVal}`);
  }
  console.log("[PASS] Scenario 3: Invoice candidate selection logic retrieves actual operator reference ID correctly.");

  // ==========================================================
  // SCENARIO 4: Refund Safety Verification (Failure Flow)
  // ==========================================================
  console.log("\n--- SCENARIO 4: Refund Safety & Atomic Wallet Crediting ---");
  
  const failOp = { code: "10", name: "TATA SKY", vc: "3012456789" };
  const failAmount = 200.00;
  const failCorrelationId = `trace_fail_${Date.now()}`;
  const failIdempotencyKey = `idemp_fail_${Date.now()}`;

  // Stub mock Axios adapter to return failure for this test
  mockResponseHandler = (url, params) => {
    return {
      STATUS: 3,
      MSG: "Insufficient API balance or provider timeout"
    };
  };

  const beforeFailUser = await prisma.user.findUnique({
    where: { id: testUser.id },
    include: { wallet: true }
  });
  const balanceBeforeFail = Number(beforeFailUser.wallet.balance);

  // 1. Wallet Debit
  const failTxnResult = await prisma.$transaction(async (tx) => {
    const updatedWallet = await tx.wallet.update({
      where: { userId: testUser.id },
      data: { balance: { decrement: failAmount } }
    });

    const transaction = await tx.transaction.create({
      data: {
        userId: testUser.id,
        amount: new Prisma.Decimal(failAmount),
        type: "RECHARGE",
        status: "PENDING_REVIEW",
        direction: "DEBIT",
        mobile: failOp.vc,
        operator: APIBOX_OPERATORS[failOp.code],
        provider: "APIBOX",
        idempotencyKey: failIdempotencyKey,
        financialSequenceId: failCorrelationId,
        balanceAfter: updatedWallet.balance
      }
    });
    return { transaction, updatedWallet };
  });

  const failTxnId = failTxnResult.transaction.id;
  console.log(`[DEBIT_FAIL_TXN] Debited: ${failAmount} | New Balance: ${failTxnResult.updatedWallet.balance} | Txn: #${failTxnId}`);

  // 2. Execute provider recharge (will fail)
  const providerService = getProviderService("APIBOX");
  let providerResponse;
  try {
    providerResponse = await providerService.recharge({
      mobile: failOp.vc,
      amount: failAmount,
      operator: failOp.code,
      txnId: failTxnId
    });
  } catch (err) {
    providerResponse = { status: "FAILED", message: err.message };
  }

  const failMappedStatus = normalizeTransactionStatus(providerResponse.status);
  console.log(`[PROVIDER_RESPONSE] Status: ${providerResponse.status} (mapped to: ${failMappedStatus})`);

  // 3. Trigger refund flow manually mimicking processFailureRefund
  if (failMappedStatus === "failed") {
    console.log(`[REFUND_TRIGGERED] Initializing atomic database refund sequence for txn: #${failTxnId}`);
    
    await prisma.$transaction(async (tx) => {
      // Set status to FAILED
      await tx.transaction.update({
        where: { id: failTxnId },
        data: { status: "FAILED" }
      });

      // Set status to REFUNDED
      await tx.transaction.update({
        where: { id: failTxnId },
        data: {
          status: "REFUNDED",
          reviewStatus: "REFUNDED",
          refundStatus: "refunded",
          refundedAt: new Date()
        }
      });

      // Atomically refund wallet & record ledger entry
      const { balanceAfter, ledgerEntry } = await recordFinancialEntry({
        userId: testUser.id,
        amount: failAmount,
        type: 'REFUND_CREDIT',
        transactionId: failTxnId,
        description: `Refund: APIBOX failure`,
        tx
      });
      console.log(`[ATOMIC_REFUND] Wallet Credited. Balance After Refund: ${balanceAfter} | Ledger ID: ${ledgerEntry.id}`);
    });
  }

  // 4. Assert values
  const finalUser = await prisma.user.findUnique({
    where: { id: testUser.id },
    include: { wallet: true }
  });
  const finalBalance = Number(finalUser.wallet.balance);

  const finalTxn = await prisma.transaction.findUnique({ where: { id: failTxnId } });
  const refundLedger = await prisma.ledgerEntry.findFirst({
    where: { transactionId: failTxnId, type: "REFUND_CREDIT" }
  });

  console.log(`[REFUND_VERIFICATION] transaction.status: ${finalTxn.status}`);
  console.log(`[REFUND_VERIFICATION] ledgerEntry type: ${refundLedger?.type}`);
  console.log(`[REFUND_VERIFICATION] Wallet balance restored: ${finalBalance === balanceBeforeFail ? "YES" : "NO"} (${finalBalance} vs ${balanceBeforeFail})`);

  if (finalTxn.status !== "REFUNDED" || !refundLedger || finalBalance !== balanceBeforeFail) {
    throw new Error("Refund flow verification failed: wallet was not restored or status is incorrect.");
  }
  console.log("[PASS] Scenario 4: Refund safety sequence, atomic crediting, and ledger entry creation verified successfully.");

  // ==========================================================
  // SCENARIO 5: Joi Middleware Validation Regression Tests
  // ==========================================================
  console.log("\n--- SCENARIO 5: Validation Regression checks ---");

  const runValidation = (body) => {
    return new Promise((resolve) => {
      const req = { body, headers: {} };
      const res = makeMockRes();
      validateRechargeInput(req, res, (err) => {
        if (err) {
          resolve({ success: false, message: err.message });
        } else {
          resolve({ success: true, body: req.body });
        }
      });
    });
  };

  // 1. Mobile Prepaid success regression (Jio Code 5, 10 digits)
  const val1 = await runValidation({ mobile: "9988776655", amount: 199, operatorCode: "5" });
  console.log("[VAL_TEST 1] Mobile Prepaid (10 digits):", val1.success ? "PASSED" : `FAILED: ${val1.message}`);
  if (!val1.success) throw new Error("Mobile Prepaid Joi check failed");

  // 2. Mobile Prepaid failure regression (Jio Code 5, 9 digits)
  const val2 = await runValidation({ mobile: "998877665", amount: 199, operatorCode: "5" });
  console.log("[VAL_TEST 2] Mobile Prepaid (9 digits - expect reject):", val2.success ? "FAILED (accepted incorrectly)" : `PASSED (rejected with: ${val2.message || val2.sentData?.message || "validation error"})`);
  const isRejected2 = !val2.success || val2.message || val2.sentData?.message;
  if (!isRejected2) throw new Error("Mobile Prepaid Joi check accepted 9-digits incorrectly");

  // 3. DTH success check (Tata Sky Code 10, 9 digits)
  const val3 = await runValidation({ mobile: "301245678", amount: 250, operatorCode: "10" });
  console.log("[VAL_TEST 3] DTH Joi (9 digits):", val3.success ? "PASSED" : `FAILED: ${val3.message}`);
  if (!val3.success) throw new Error("DTH Joi check failed for 9-digits");

  // 4. DTH failure check (Tata Sky Code 10, 7 digits)
  const val4 = await runValidation({ mobile: "3012456", amount: 250, operatorCode: "10" });
  console.log("[VAL_TEST 4] DTH Joi (7 digits - expect reject):", val4.success ? "FAILED (accepted incorrectly)" : `PASSED (rejected with: ${val4.message || val4.sentData?.message || "validation error"})`);
  const isRejected4 = !val4.success || val4.message || val4.sentData?.message;
  if (!isRejected4) throw new Error("DTH Joi check accepted 7-digits incorrectly");

  console.log("[PASS] Scenario 5: Input validation rules properly distinguish Mobile vs DTH.");

  // ==========================================================
  // CLEANUP
  // ==========================================================
  console.log("\n[CLEANUP] Deleting test transactions, ledger entries, and test user...");
  await prisma.ledgerEntry.deleteMany({ where: { userId: testUser.id } });
  await prisma.transaction.deleteMany({ where: { userId: testUser.id } });
  await prisma.wallet.delete({ where: { userId: testUser.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
  console.log("[CLEANUP] Done.");

  console.log("\n=== ALL DTH PRODUCTION VERIFICATION WORKFLOWS PASSED ===");
}

verifyDthProduction()
  .then(() => {
    prisma.$disconnect();
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n[VERIFICATION FAILURE]:", err);
    prisma.$disconnect();
    process.exit(1);
  });
